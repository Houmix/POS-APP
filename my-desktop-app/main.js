const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const os = require('os'); // 💡 Ajout du module 'os' pour obtenir l'IP

// 🚨 CORRECTION CRUCIALE POUR WINDOWS (Installeurs Squirrel/NSIS)
// Cette vérification gère la création/suppression des raccourcis par l'installeur.
const electronSquirrelStartup = require('electron-squirrel-startup');
if (electronSquirrelStartup) {
  // Si le programme est lancé par l'installeur, nous devons quitter.
  return app.quit(); 
}
// 🚨 FIN DE LA CORRECTION

let djangoProcess;
let staticServer;
let mainWindow;
let splashWindow; 

// 🔹 Détection mode dev/prod
const isDev = !app.isPackaged;

// 🔹 Logs
function log(message, type = 'info') {
  const emoji = { info: '🔹', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
  console.log(`${emoji} ${message}`);
}

// 💡 Nouvelle fonction : trouver l'adresse IP locale
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // Filtrer IPv4, non interne (pas 127.0.0.1) et souvent lié à Ethernet/Wi-Fi
            if (iface.family === 'IPv4' && !iface.internal) {
                // On privilégie souvent les connexions qui ne sont pas des boucles locales
                // Si l'interface a un nom standard (eth, en), on la prend
                if (name.toLowerCase().startsWith('eth') || name.toLowerCase().startsWith('en') || name.toLowerCase().startsWith('wi')) {
                    return iface.address;
                }
                // Fallback: prendre la première IP publique trouvée
                return iface.address; 
            }
        }
    }
    return '127.0.0.1'; // IP de secours
}

const localIp = getLocalIpAddress(); // 💡 IP de la machine
log(`Adresse IP locale (Ethernet/WiFi) du serveur de caisse: ${localIp}`, 'info');


// 🔹 Chemins adaptés au mode
function getResourcePath(relativePath) {
  if (isDev) {
    // Mode dev : dossiers à côté de main.js
    return path.join(__dirname, '..', relativePath);
  }
  // Mode prod : dans app.asar.unpacked ou Resources
  if (process.platform === 'darwin') {
    // macOS : MyApp.app/Contents/Resources/
    return path.join(process.resourcesPath, relativePath);
  }
  // Windows/Linux
  return path.join(process.resourcesPath, relativePath);
}

const backendPath = getResourcePath('born_dz');
const frontendPath = getResourcePath('pos');
const webBuildPath = path.join(frontendPath, 'web-build');

// 🔥 Déterminer l'exécutable Django (PyInstaller)
function getDjangoExecutable() {
  const managePyPath = path.join(backendPath, 'manage.py');
  
  if (isDev) {
    // En DEV: On utilise le venv + manage.py
    const venvPython = path.join(backendPath, 'venv', 'bin', 'python3');
    const venvPythonWin = path.join(backendPath, 'venv', 'Scripts', 'python.exe');
    let pythonExec = 'python3'; 
    
    // Détection venv
    if (fs.existsSync(venvPython)) {
      pythonExec = venvPython;
    } else if (fs.existsSync(venvPythonWin)) {
      pythonExec = venvPythonWin;
    } else {
        log('Avertissement: venv Python non trouvé, utilisation de la commande système "python3". Assurez-vous que Django est installé globalement.', 'warning');
    }

    if (!fs.existsSync(managePyPath)) {
       log(`❌ manage.py introuvable à: ${managePyPath}`, 'error');
       app.quit();
       return null;
    }
    
    // Retourne l'interpréteur Python et le script manage.py comme arguments
    return { exec: pythonExec, args: [managePyPath] };
  } else {
    // En PROD: On utilise l'exécutable PyInstaller bundlé
    const executableName = process.platform === 'win32' ? 'django_app.exe' : 'django_app';
    const bundledExec = path.join(backendPath, executableName); 
    
    if (!fs.existsSync(bundledExec)) {
        log(`❌ Exécutable PyInstaller manquant ! (Attendu à: ${bundledExec})`, 'error');
        log('Raison probable: Le script PyInstaller a échoué. Exécutez npm run prebuild:python pour vérifier les erreurs.', 'error');
        app.quit();
        return null;
    }
    // Retourne uniquement l'exécutable PyInstaller, sans Python ni manage.py
    return { exec: bundledExec, args: [] };
  }
}

const djangoExecInfo = getDjangoExecutable();

log(`Mode: ${isDev ? 'DEV' : 'PROD'}`, 'info');
log(`Backend Path: ${backendPath}`, 'info');
log(`Frontend Path: ${frontendPath}`, 'info');

// 🔹 Vérifications
function checkRequirements() {
  if (!djangoExecInfo) return false;
  
  // En prod, web-build DOIT exister
  if (!isDev && !fs.existsSync(webBuildPath)) {
    log('ERREUR: web-build manquant !', 'error');
    log('Build le frontend: cd pos && npx expo export --platform web --output-dir web-build', 'error');
    app.quit();
    return false;
  }
  
  // En dev, prévenir si web-build manque
  if (isDev && !fs.existsSync(webBuildPath)) {
    log('web-build manquant, Expo sera utilisé (plus lent)', 'warning');
  }
  
  return true;
}

// 🔹 Lancer Django
function startDjango(callback) {
  if (!djangoExecInfo) return; // Sécurité après checkRequirements
  
  log('Démarrage Django...', 'info');
  
  // Arguments communs pour runserver
  // 💡 On garde 0.0.0.0 pour écouter toutes les interfaces (y compris Ethernet)
  const runserverArgs = ['runserver', '0.0.0.0:8000', '--noreload']; 
  
  // L'exécutable et les arguments sont déterminés par getDjangoExecutable()
  const exec = djangoExecInfo.exec;
  const args = [...djangoExecInfo.args, ...runserverArgs]; // Concaténer manage.py (si dev) + runserver

  // Ajout du log de la commande exacte pour le débogage
  log(`Commande exécutée: ${exec} ${args.join(' ')}`, 'info'); 

  djangoProcess = spawn(exec, args, {
    cwd: backendPath,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      // Variables d'environnement pour Django
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8', 
      DJANGO_SETTINGS_MODULE: 'born_dz.settings' 
    }
  });

  djangoProcess.stdout.on('data', (data) => {
    // Afficher uniquement les messages importants de Django
    const dataStr = data.toString().trim();
    if (dataStr.includes('Starting development server') || dataStr.includes('Quit the server')) {
        console.log(`[Django] ${dataStr}`);
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
    log('Django prêt', 'success');
    log(`URL du serveur pour les clients distants : http://${localIp}:8000`, 'info'); // 💡 Affiche l'IP réelle
    callback();
  });
}

// 🔹 Serveur statique (PRODUCTION ou si web-build existe)
function startStaticServer(callback) {
  log('Démarrage serveur frontend statique...', 'info');
  
  const app = express();
  
  // CORS pour Django
  app.use((req, res, next) => {
    // Permet à Django (8000) d'accéder au serveur statique (8081)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  
  // Servir les fichiers
  app.use(express.static(webBuildPath));
  
  // SPA fallback (pour les routes Expo/React)
  app.get('*', (req, res) => {
    res.sendFile(path.join(webBuildPath, 'index.html'));
  });
  
  // 💡 L'Electron front-end s'ouvre toujours sur localhost:8081
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

// 🔹 Expo (DEV uniquement si web-build manque)
function startExpo(callback) {
  log('Démarrage Expo web (dev)...', 'warning');
  
  // 💡 On force l'interface 127.0.0.1 (localhost) pour Expo CLI
  const expoProcess = spawn('npx', ['expo', 'start', '--web', '--port', '8081', '--non-interactive', '--host', '127.0.0.1'], {
    cwd: frontendPath,
    shell: true,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'pipe'
  });

  expoProcess.stdout.on('data', (data) => {
    // On filtre les messages pour ne garder que ceux pertinents pour le démarrage
    const dataStr = data.toString().trim();
    if (dataStr.includes('http://127.0.0.1:8081')) {
       console.log(`[Expo] ${dataStr}`);
    }
  });

  expoProcess.stderr.on('data', (data) => {
    console.error(`[Expo] ${data.toString().trim()}`);
  });

  expoProcess.on('error', (err) => {
    log(`Erreur Expo (spawn): ${err.message}`, 'error');
    app.quit();
  });

  // Expo est parfois très lent à se lancer
  waitForServer('http://127.0.0.1:8081', 90, 2000, () => {
    log('Expo prêt', 'success');
    callback();
  });
}

// 🔹 Attente serveur
function waitForServer(url, retries = 30, interval = 2000, callback) {
  let attempts = 0;
  
  const check = () => {
    http.get(url, (res) => {
      // 200: OK; 301/302: Redirection
      // 404/500/etc. signifie que le serveur répond, c'est suffisant pour Electron.
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
      log(`Attente de ${url} (${attempts}/${retries})...`, 'info');
      setTimeout(check, interval);
    } else {
      log(`Timeout: ${url} non accessible après ${retries} tentatives`, 'error');
      // Ferme l'écran d'attente avant de quitter l'application
      if (splashWindow) {
        splashWindow.close();
      }
      app.quit();
    }
  };
  
  check();
}

// 🔹 Créer la fenêtre principale
function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Ne pas montrer tant que le chargement n'est pas fini
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => {
    // Fermer l'écran d'attente et afficher la fenêtre principale
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    log('Application prête', 'success');
  });

  // On charge le frontend (Express/Expo)
  mainWindow.loadURL('http://127.0.0.1:8081'); 

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// 🔹 Créer la fenêtre d'attente (Splash Screen)
function createSplashWindow(callback) {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false, // Pas de bordure, style propre
    transparent: true, // Fond transparent si votre image est ronde
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
  });

  // Pour un écran de chargement simple, nous utilisons un fichier HTML statique.
  // Ce fichier doit être créé dans le dossier racine de votre projet Electron.
  splashWindow.loadFile(path.join(__dirname, 'splash.html')); 
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    callback();
  });
}

// 🔹 Nettoyage
function cleanup() {
  log('Arrêt des processus...', 'info');
  
  // Utiliser SIGTERM ou SIGKILL pour tuer les processus enfants
  if (djangoProcess && !djangoProcess.killed) {
    djangoProcess.kill('SIGTERM');
  }
  
  if (staticServer) {
    staticServer.close(() => log('Serveur statique arrêté', 'info'));
  }
}

// 🔹 Démarrage
app.whenReady().then(() => {
  if (!checkRequirements()) return;
  
  // 1. Créer la fenêtre d'attente
  createSplashWindow(() => {
    // 2. Lancer Django
    startDjango(() => {
      // 3. Déterminer la source du frontend
      if (fs.existsSync(webBuildPath)) {
        startStaticServer(createMainWindow); // Utiliser createMainWindow ici
      } else if (isDev) {
        // Seulement en dev si web-build manque
        startExpo(createMainWindow); // Utiliser createMainWindow ici
      } else {
        log('Pas de frontend disponible en prod !', 'error');
        if (splashWindow) {
          splashWindow.close();
        }
        app.quit();
      }
    });
  });
});

// 🔹 Fermeture
app.on('window-all-closed', () => {
  cleanup();
  // Sur macOS, on ne quitte pas l'application tant que l'utilisateur n'a pas fait Cmd+Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);

process.on('uncaughtException', (error) => {
  log(`Erreur non gérée: ${error.message}`, 'error');
  console.error(error.stack);
  cleanup();
  app.quit();
});