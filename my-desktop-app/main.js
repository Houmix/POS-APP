const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process'); // ⭐ AJOUT execSync ICI
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const os = require('os');

// 🚨 CORRECTION CRUCIALE POUR WINDOWS (Installeurs Squirrel/NSIS)
const electronSquirrelStartup = require('electron-squirrel-startup');
if (electronSquirrelStartup) {
  return app.quit(); 
}

let djangoProcess;
let staticServer;
let mainWindow;
let splashWindow; 

const isDev = !app.isPackaged;

function log(message, type = 'info') {
  const emoji = { info: '🔹', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
  console.log(`${emoji} ${message}`);
}

const POS_PRINTER_NAME = "POS-80"; // ⬅️ AJUSTEZ CE NOM EXACTEMENT
// ==========================================
// 🖨️ HANDLER D'IMPRESSION (TEXTE BRUT RAW)
// ==========================================
ipcMain.handle("print-ticket", async (event, ticketText) => {
    // Utiliser un nom de fichier unique pour éviter les erreurs d'accès concurrents
    const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);

    try {
        log(`[Impression] Tentative RAW sur "${POS_PRINTER_NAME}"`, 'info');

        // 1️⃣ Écriture du fichier en encodage 'latin1' (ou 'cp437')
        // Cela garantit que les caractères spéciaux de l'imprimante (lignes, euros) passent bien
        fs.writeFileSync(tempFilePath, ticketText, { encoding: 'latin1' });

        // 2️⃣ Commande d'envoi direct (Mode RAW)
        // Note: Pour que '\\127.0.0.1\POS-80' fonctionne, l'imprimante DOIT être partagée dans Windows.
        const printerPath = `\\\\127.0.0.1\\${POS_PRINTER_NAME}`;
        
        // On utilise la commande 'type' vers le chemin réseau local du spooler
        const commandRaw = `cmd /c "type ${tempFilePath} > ${printerPath}"`;

        log('[Impression] Envoi direct au spooler (0 marges)...', 'info');
        
        // Exécution de la commande
        execSync(commandRaw, { windowsHide: true });

        log('[Impression] ✅ Ticket envoyé avec succès lalalala', 'success');

        // 3️⃣ Nettoyage asynchrone pour ne pas ralentir le retour UI
        setTimeout(() => {
            if (fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
        }, 1000);

        return { success: true };

    } catch (error) {
        log(`[Impression] ❌ Erreur: ${error.message}`, 'error');
        
        // Tentative de secours automatique si le partage réseau n'est pas actif
        try {
            log('[Impression] ⚠️ Repli sur PowerShell (Out-Printer)...', 'warning');
            const commandAlt = `powershell -Command "Get-Content '${tempFilePath}' | Out-Printer -Name '${POS_PRINTER_NAME}'"`;
            execSync(commandAlt, { windowsHide: true });
            return { success: true, warning: "Repli PowerShell utilisé" };
        } catch (altError) {
            log(`[Impression] ❌ Échec total: ${altError.message}`, 'error');
            return { success: false, error: altError.message };
        }
    }
});

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (name.toLowerCase().startsWith('eth') || 
                    name.toLowerCase().startsWith('en') || 
                    name.toLowerCase().startsWith('wi')) {
                    return iface.address;
                }
                return iface.address; 
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIpAddress();
log(`Adresse IP locale: ${localIp}`, 'info');

function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  if (process.platform === 'darwin') {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

const backendPath = getResourcePath('born_dz');
const frontendPath = getResourcePath('pos');
const webBuildPath = path.join(frontendPath, 'web-build');

function getDjangoExecutable() {
  const managePyPath = path.join(backendPath, 'manage.py');
  const asgiApplication = 'born_dz.asgi:application';
  
  if (isDev) {
    const venvPython = path.join(backendPath, 'venv', 'bin', 'python3');
    const venvPythonWin = path.join(backendPath, 'venv', 'Scripts', 'python.exe');
    const venvDaphne = path.join(backendPath, 'venv', 'bin', 'daphne');
    const venvDaphneWin = path.join(backendPath, 'venv', 'Scripts', 'daphne.exe');
    
    if (fs.existsSync(venvDaphne)) {
      return { exec: venvDaphne, args: [asgiApplication] };
    } else if (fs.existsSync(venvDaphneWin)) {
      return { exec: venvDaphneWin, args: [asgiApplication] };
    } else if (fs.existsSync(venvPython) || fs.existsSync(venvPythonWin)) {
      log('⚠️ Daphne non trouvé, fallback manage.py', 'warning');
      const pythonExec = fs.existsSync(venvPython) ? venvPython : venvPythonWin;
      return { exec: pythonExec, args: [managePyPath] };
    }
    
    log('❌ Python/Daphne introuvable', 'error');
    app.quit();
    return null;

  } else {
    const executableName = process.platform === 'win32' ? 'django_asgi_app.exe' : 'django_asgi_app';
    const bundledExec = path.join(backendPath, executableName); 
    
    if (!fs.existsSync(bundledExec)) {
        log(`❌ Exécutable ASGI manquant: ${bundledExec}`, 'error');
        app.quit();
        return null;
    }
    return { exec: bundledExec, args: [asgiApplication] };
  }
}

const djangoExecInfo = getDjangoExecutable();

log(`Mode: ${isDev ? 'DEV' : 'PROD'}`, 'info');
log(`Backend: ${backendPath}`, 'info');
log(`Frontend: ${frontendPath}`, 'info');

function checkRequirements() {
  if (!djangoExecInfo) return false;
  
  if (!isDev && !fs.existsSync(webBuildPath)) {
    log('ERREUR: web-build manquant !', 'error');
    app.quit();
    return false;
  }
  
  if (isDev && !fs.existsSync(webBuildPath)) {
    log('web-build manquant, Expo sera utilisé', 'warning');
  }
  
  return true;
}

function startDjango(callback) {
  if (!djangoExecInfo) return;

  log('Vérification et nettoyage du port 8000...', 'info');

  // Définition de la logique de démarrage
  const proceedWithStart = () => {
    log('Démarrage Django (ASGI/Daphne)...', 'info');

    const daphneArgs = ['--bind', '0.0.0.0', '--port', '8000'];
    const execPath = djangoExecInfo.exec;
    const args = [...djangoExecInfo.args, ...daphneArgs];

    log(`Commande exécutée: ${execPath} ${args.join(' ')}`, 'info');

    djangoProcess = spawn(execPath, args, {
      cwd: backendPath,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        DJANGO_SETTINGS_MODULE: 'born_dz.settings'
      }
    });

    djangoProcess.stdout.on('data', (data) => {
      const dataStr = data.toString().trim();
      if (dataStr.includes('Starting server') || dataStr.includes('Listening on')) {
        console.log(`[Daphne] ${dataStr}`);
      }
    });

    djangoProcess.stderr.on('data', (data) => {
      console.error(`[Django] ${data.toString().trim()}`);
    });

    djangoProcess.on('error', (err) => {
      log(`Erreur Django (spawn): ${err.message}`, 'error');
      app.quit();
    });

    djangoProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        log(`Django arrêté de manière inattendue (code ${code})`, 'error');
      }
    });

    // Utiliser /admin/ pour le check de santé
    waitForServer('http://127.0.0.1:8000/admin/', 30, 2000, () => {
      log('Django (ASGI) prêt', 'success');
      log(`URL du serveur pour les clients distants : http://${localIp}:8000`, 'info');
      callback();
    });
  };

  // 🛡️ Nettoyage préventif AVANT de lancer proceedWithStart
  if (process.platform === 'win32') {
    // On force l'arrêt de tout processus daphne.exe existant
    // /f = force, /im = image name, /t = arbre de processus (enfants)
    exec('taskkill /f /im daphne.exe /t', () => {
      // On attend 500ms que Windows libère réellement le port réseau
      setTimeout(proceedWithStart, 500);
    });
  } else {
    // Sur macOS/Linux, le signal SIGTERM suffit généralement
    proceedWithStart();
  }
}

function startStaticServer(callback) {
  log('Démarrage serveur statique...', 'info');
  
  const app = express();
  
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  
  app.use(express.static(webBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(webBuildPath, 'index.html'));
  });
  
  staticServer = app.listen(8081, '127.0.0.1', (err) => {
    if (err) {
      log(`Erreur serveur: ${err.message}`, 'error');
      app.quit();
      return;
    }
    log('Frontend prêt sur http://127.0.0.1:8081', 'success');
    callback();
  });
}

function startExpo(callback) {
  log('Démarrage Expo (dev)...', 'warning');
  
  const expoProcess = spawn('npx', ['expo', 'start', '--web', '--port', '8081'], {
    cwd: frontendPath,
    shell: true,
    env: { 
      ...process.env, 
      BROWSER: 'none',
      CI: '1',
    },
    stdio: 'pipe'
  });

  expoProcess.stdout.on('data', (data) => {
    const dataStr = data.toString().trim();
    if (dataStr.includes('http://127.0.0.1:8081')) {
       console.log(`[Expo] ${dataStr}`);
    }
  });

  expoProcess.stderr.on('data', (data) => {
    console.error(`[Expo] ${data.toString().trim()}`);
  });

  expoProcess.on('error', (err) => {
    log(`Erreur Expo: ${err.message}`, 'error');
    app.quit();
  });

  waitForServer('http://127.0.0.1:8081', 90, 2000, () => {
    log('Expo prêt', 'success');
    callback();
  });
}

function waitForServer(url, retries = 30, interval = 2000, callback) {
  let attempts = 0;
  
  const check = () => {
    http.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 510) { 
        callback();
      } else {
        retry();
      }
    }).on('error', retry);
  };
  
  const retry = () => {
    attempts++;
    if (attempts < retries) {
      log(`Attente ${url} (${attempts}/${retries})...`, 'info');
      setTimeout(check, interval);
    } else {
      log(`Timeout: ${url}`, 'error');
      if (splashWindow) splashWindow.close();
      app.quit();
    }
  };
  
  check();
}

function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#ffffff',
  });
  mainWindow.maximize();
  mainWindow.once('ready-to-show', async () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    
    // 🖨️ Lister les imprimantes disponibles
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      console.log('\n🖨️ === IMPRIMANTES DISPONIBLES ===');
      printers.forEach((p, i) => {
        console.log(`[${i+1}] "${p.name}" ${p.isDefault ? '⭐ (Par défaut)' : ''}`);
        if (p.name === POS_PRINTER_NAME) {
          console.log('    ✅ IMPRIMANTE POS TROUVÉE !');
        }
      });
      console.log('===================================\n');
    } catch (err) {
      console.error('❌ Erreur récupération imprimantes:', err);
    }
    
    log('Application prête', 'success');
  });

  mainWindow.loadURL('http://127.0.0.1:8081'); 

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSplashWindow(callback) {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html')); 
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    callback();
  });
}
const { exec } = require('child_process');
function cleanup() {
  log('Arrêt des processus et libération des ports...', 'info');

  // 1️⃣ Tuer Django/Daphne proprement ou par la force
  if (djangoProcess) {
    if (process.platform === 'win32') {
      // Sous Windows, on utilise taskkill avec /F (force) et /T (tree/enfants)
      // On utilise le PID du processus que nous avons spawn
      exec(`taskkill /pid ${djangoProcess.pid} /f /t`, (err) => {
        if (err) {
          log(`Note: Impossible de tuer le PID ${djangoProcess.pid} (déjà fermé ?)`, 'info');
        } else {
          log('✅ Django et ses processus enfants ont été terminés.', 'success');
        }
      });
    } else {
      // Unix (macOS/Linux)
      djangoProcess.kill('SIGTERM');
    }
  }

  // 2️⃣ Fermer le serveur Express
  if (staticServer) {
    staticServer.close(() => log('✅ Serveur statique arrêté', 'success'));
  }
}

app.whenReady().then(async () => {
  if (!checkRequirements()) return;

  createSplashWindow(() => {
    startDjango(() => {
      if (fs.existsSync(webBuildPath)) {
        startStaticServer(() => createMainWindow());
      } else if (isDev) {
        startExpo(() => createMainWindow());
      } else {
        log('Pas de frontend en prod !', 'error');
        if (splashWindow) splashWindow.close();
        app.quit();
      }
    });
  });
});

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);

process.on('uncaughtException', (error) => {
  log(`Erreur: ${error.message}`, 'error');
  console.error(error.stack);
  cleanup();
  app.quit();
});