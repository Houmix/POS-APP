//  OK TOUS les imports au début
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec, execSync } = require('child_process'); // ← Tous ensemble
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const os = require('os');

// Correction Squirrel
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
  const emoji = { info: ' info', success: ' OK', error: ' NO', warning: ' ATTENTION' }[type] || '•';
  console.log(`${emoji} ${message}`);
}
// ==========================================
//   HANDLER D'IMPRESSION (MULTI-IMPRIMANTES)
// ==========================================
ipcMain.handle("print-ticket", async (event, ticketText) => {
    // 1. Création du fichier temporaire unique
    const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);

    try {
        log(`[Impression] Préparation du ticket pour TOUTES les imprimantes...`, 'info');

        // --- Préparation du contenu (ESC/POS) ---
        // On ajoute les commandes de coupe et les sauts de ligne
        const ESC = '\x1B';
        const GS = '\x1D';
        const CUT_COMMAND = GS + 'V' + '\x42' + '\x00'; 
        const LINE_FEEDS = '\n\n\n\n\n\n'; 
        const fullContent = ticketText + LINE_FEEDS + CUT_COMMAND;

        // --- Écriture du fichier ---
        // Encodage latin1 pour les accents
        fs.writeFileSync(tempFilePath, fullContent, { encoding: 'latin1' });

        // 2. Récupérer la liste dynamique des imprimantes
        if (!mainWindow) {
            throw new Error("La fenêtre principale n'est pas active.");
        }
        
        const printers = await mainWindow.webContents.getPrintersAsync();
        
        // 3. Filtrer pour ne garder que les imprimantes physiques
        // On retire PDF, Fax, OneNote, XPS pour ne pas bloquer la borne
        const physicalPrinters = printers.filter(p => {
             const name = p.name.toLowerCase();
             return !name.includes('pdf') && 
                    !name.includes('xps') && 
                    !name.includes('fax') && 
                    !name.includes('onenote') &&
                    !name.includes('microsoft');
        });

        if (physicalPrinters.length === 0) {
            log('[Impression] Aucune imprimante physique trouvée.', 'warning');
            return { success: false, error: "Aucune imprimante disponible" };
        }

        log(`[Impression] Lancement sur ${physicalPrinters.length} imprimante(s)...`, 'info');

        // 4. Boucle d'impression sur chaque imprimante trouvée
        const printPromises = physicalPrinters.map(async (printer) => {
            const printerName = printer.name;
            log(`  -> Envoi vers : "${printerName}"`, 'info');

            try {
                // On utilise PowerShell car c'est le plus robuste pour les noms avec espaces
                // et cela ne nécessite pas de partager l'imprimante sur le réseau
                const command = `powershell -Command "Get-Content '${tempFilePath}' | Out-Printer -Name '${printerName}'"`;
                
                execSync(command, { windowsHide: true });
                log(`     [OK] Succès sur ${printerName}`, 'success');
                return { printer: printerName, status: 'success' };

            } catch (err) {
                log(`     [ERREUR] Échec sur ${printerName}: ${err.message}`, 'error');
                return { printer: printerName, status: 'error', error: err.message };
            }
        });

        // On attend que toutes les impressions soient finies
        await Promise.all(printPromises);

        // 5. Nettoyage du fichier temporaire
        setTimeout(() => {
            if (fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
        }, 2000);

        return { success: true };

    } catch (error) {
        log(`[Impression] ERREUR GÉNÉRALE: ${error.message}`, 'error');
        // Nettoyage d'urgence
        if (fs.existsSync(tempFilePath)) {
             try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        return { success: false, error: error.message };
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
//  OK CORRECTION getDjangoExecutable en production
function getDjangoExecutable() {
  // En PROD, le dossier s'appelle 'born_dz' (défini dans le "to" du package.json)
  // Il se trouve dans resources
  const prodPath = path.join(process.resourcesPath, 'born_dz');
  const executableName = 'django_asgi_app.exe';
  
  if (isDev) {
    // ... (garde ton code dev actuel)
    return null; // ou ta logique dev
  } else {
    // MODE PROD
    const bundledExec = path.join(prodPath, executableName);
    
    // Debug: Vérifier si le fichier est là
    log(`Recherche du backend ici : ${bundledExec}`, 'info');

    if (!fs.existsSync(bundledExec)) {
        log(`CRITIQUE: Backend introuvable à ${bundledExec}`, 'error');
        // Fallback: parfois il est dans un sous-dossier selon PyInstaller
        const nestedExec = path.join(prodPath, 'django_asgi_app', executableName);
        if (fs.existsSync(nestedExec)) return { exec: nestedExec, args: [] };
        return null;
    }
    return { exec: bundledExec, args: [] };
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

//  OK CORRECTION startDjango (ligne ~110)
function startDjango(callback) {
  if (!djangoExecInfo) return;

  log('Vérification et nettoyage du port 8000...', 'info');

  const proceedWithStart = () => {
    log('Démarrage Django (ASGI/Daphne)...', 'info');

    const execPath = djangoExecInfo.exec;
    
    //  OK CORRECTION : En production, pas besoin d'args Daphne
    // L'exe bundlé les a déjà intégrés
    const args = isDev ? ['--bind', '0.0.0.0', '--port', '8000', ...djangoExecInfo.args] : [];

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

  if (process.platform === 'win32') {
    exec('taskkill /f /im daphne.exe /t 2>nul', () => {
      exec('taskkill /f /im django_asgi_app.exe /t 2>nul', () => {  // ← Ajouter ceci
        setTimeout(proceedWithStart, 500);
      });
    });
  } else {
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
    // 1. Force le plein écran (masque la barre des tâches Windows)
    fullscreen: true, 
    // 2. Supprime la bordure et la barre de titre (Fermer, Réduire, etc.)
    frame: false,
    // 3. Empêche l'utilisateur de sortir du mode plein écran facilement
    kiosk: true, 
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

  // 4. Supprime totalement la barre de menu (Fichier, Aide, Zoom...)
  mainWindow.setMenu(null); 

  mainWindow.maximize();
  mainWindow.once('ready-to-show', async () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    
    //   Lister les imprimantes disponibles
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      console.log('\n  === IMPRIMANTES DISPONIBLES ===');
      printers.forEach((p, i) => {
        console.log(`[${i+1}] "${p.name}" ${p.isDefault ? '  (Par défaut)' : ''}`);
        if (p.name === POS_PRINTER_NAME) {
          console.log('     OK IMPRIMANTE POS TROUVÉE !');
        }
      });
      console.log('===================================\n');
    } catch (err) {
      console.error(' NO Erreur récupération imprimantes:', err);
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
          log(' OK Django et ses processus enfants ont été terminés.', 'success');
        }
      });
    } else {
      // Unix (macOS/Linux)
      djangoProcess.kill('SIGTERM');
    }
  }

  // 2️⃣ Fermer le serveur Express
  if (staticServer) {
    staticServer.close(() => log(' OK Serveur statique arrêté', 'success'));
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