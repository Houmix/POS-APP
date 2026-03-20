//  OK TOUS les imports au début
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec, execSync } = require('child_process'); // ← Tous ensemble
const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const os = require('os');
const SyncManager = require('./modules/sync-manager');
const LicenseManager = require('./modules/license-manager');
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

// 🔑 Licence
const licenseManager = new LicenseManager({
  serverUrl: 'https://borndz-production.up.railway.app',
  gracePeriodDays: 7,
});

// 🔄 Sync
const syncManager = new SyncManager({
  serverUrl: 'https://borndz-production.up.railway.app',
  localApiUrl: 'http://127.0.0.1:8000',
  syncInterval: 30000,
  connectivityCheckInterval: 10000,
});
function log(message, type = 'info') {
  const emoji = { info: ' info', success: ' OK', error: ' NO', warning: ' ATTENTION' }[type] || '•';
  console.log(`${emoji} ${message}`);
}
// ==========================================
// 🖨️ MÉTHODE 1 : RAW via partage réseau local
// ==========================================
// Prérequis : chaque imprimante doit être PARTAGÉE dans Windows
//   → Paramètres > Imprimantes > Propriétés > Partage > Partager cette imprimante
//
// Comment ça marche :
//   "type fichier.bin > \\127.0.0.1\NomImprimante"
//   → Envoie les octets bruts directement au spooler Windows
//   → 0 marge, pleine largeur 80mm, commandes ESC/POS préservées
//
// À coller dans votre main.js (remplacez l'ancien handler print-ticket)
// ==========================================

// const VIRTUAL_PRINTER_KEYWORDS = ['PDF', 'Fax', 'OneNote', 'XPS', 'Microsoft', 'Send to', 'Cloud'];

// ipcMain.handle("print-ticket", async (event, ticketText) => {
//     const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);

//     try {
//         log('[Impression] Préparation du ticket...', 'info');

//         // ── 1. Commandes ESC/POS ──
//         const ESC = '\x1B';
//         const GS  = '\x1D';

//         const INIT           = ESC + '@';                     // Reset imprimante
//         const MARGIN_LEFT_0  = GS + 'L' + '\x00' + '\x00';  // Marge gauche = 0
//         const FULL_WIDTH     = GS + 'W' + '\x00' + '\x02';  // Zone impression = 512 dots (pleine largeur 80mm)
//         const ALIGN_LEFT     = ESC + 'a' + '\x00';           // Alignement gauche
//         const FONT_NORMAL    = ESC + '!' + '\x00';           // Police normale (Font A)
//         const LINE_SPACING   = ESC + '3' + '\x12';           // Interligne serré
//         const LINE_FEEDS     = '\n\n\n\n\n';                 // Espace avant coupe
//         const CUT_COMMAND    = GS + 'V' + '\x42' + '\x00';  // Coupe complète

//         const fullContent = INIT
//             + MARGIN_LEFT_0
//             + FULL_WIDTH
//             + ALIGN_LEFT
//             + FONT_NORMAL
//             + LINE_SPACING
//             + ticketText
//             + LINE_FEEDS
//             + CUT_COMMAND;

//         // ── 2. Écriture fichier binaire ──
//         // latin1 = chaque caractère → 1 octet, les commandes ESC/POS sont préservées
//         fs.writeFileSync(tempFilePath, fullContent, { encoding: 'latin1' });

//         // ── 3. Récupérer les imprimantes physiques ──
//         if (!mainWindow) {
//             throw new Error("La fenêtre principale n'est pas active.");
//         }

//         const allPrinters = await mainWindow.webContents.getPrintersAsync();

//         const physicalPrinters = allPrinters.filter(p => {
//             const name = p.name.toLowerCase();
//             return !VIRTUAL_PRINTER_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
//         });

//         if (physicalPrinters.length === 0) {
//             log('[Impression] Aucune imprimante physique trouvée.', 'warning');
//             return { success: false, error: "Aucune imprimante disponible" };
//         }

//         log(`[Impression] ${physicalPrinters.length} imprimante(s) détectée(s)`, 'info');

//         // ── 4. Envoi RAW à chaque imprimante ──
//         const results = [];

//         for (const printer of physicalPrinters) {
//             const printerName = printer.name;
//             log(`[Impression] --> Envoi RAW vers "${printerName}"...`, 'info');

//             try {
//                 // \\127.0.0.1\NomImprimante = chemin réseau local du partage
//                 const printerPath = `\\\\127.0.0.1\\${printerName}`;
//                 const cmd = `cmd /c "type "${tempFilePath}" > "${printerPath}""`;

//                 execSync(cmd, { windowsHide: true, timeout: 8000 });

//                 log(`[Impression] OK "${printerName}"`, 'success');
//                 results.push({ printer: printerName, status: 'success' });

//             } catch (err) {
//                 log(`[Impression] ÉCHEC "${printerName}": ${err.message}`, 'error');
//                 results.push({ printer: printerName, status: 'error', error: err.message });
//             }
//         }

//         // ── 5. Nettoyage ──
//         setTimeout(() => {
//             try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
//         }, 2000);

//         const successCount = results.filter(r => r.status === 'success').length;
//         log(`[Impression] Terminé : ${successCount}/${physicalPrinters.length} OK`, 'info');

//         return { success: successCount > 0, details: results };

//     } catch (error) {
//         log(`[Impression] ERREUR: ${error.message}`, 'error');
//         try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
//         return { success: false, error: error.message };
//     }
// });

// ==========================================
// 🖨️ MÉTHODE 2 : RAW via PowerShell + .NET (winspool.drv)
// ==========================================
// Prérequis : AUCUN (pas besoin de partager l'imprimante)
//
// Comment ça marche :
//   PowerShell charge une classe C# qui appelle directement l'API Windows :
//   OpenPrinter → StartDocPrinter (mode RAW) → WritePrinter → ClosePrinter
//   → Les octets arrivent tels quels à l'imprimante
//   → 0 marge, pleine largeur 80mm, commandes ESC/POS préservées
//
// À coller dans votre main.js (remplacez l'ancien handler print-ticket)
// ==========================================

const VIRTUAL_PRINTER_KEYWORDS = ['PDF', 'Fax', 'OneNote', 'XPS', 'Microsoft', 'Send to', 'Cloud'];

/**
 * Génère le script PowerShell qui envoie des octets bruts à une imprimante
 * via l'API Windows winspool.drv (mode RAW, aucun reformatage GDI)
 */
function buildRawPrintScript(filePath, printerName) {
    // Échapper les apostrophes pour PowerShell
    const safePrinter = printerName.replace(/'/g, "''");
    const safePath = filePath.replace(/\\/g, '\\\\');

    return `
$ErrorActionPreference = 'Stop'

# 1. Charger la classe C# qui parle directement au spooler Windows
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    public static bool SendBytesToPrinter(string printerName, byte[] data)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA docInfo = new DOCINFOA();
        docInfo.pDocName = "DoEat Ticket";
        docInfo.pDataType = "RAW";

        bool success = false;

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, ref docInfo))
            {
                if (StartPagePrinter(hPrinter))
                {
                    IntPtr unmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                    Marshal.Copy(data, 0, unmanagedBytes, data.Length);

                    int bytesWritten;
                    success = WritePrinter(hPrinter, unmanagedBytes, data.Length, out bytesWritten);
                    success = success && (bytesWritten == data.Length);

                    Marshal.FreeCoTaskMem(unmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }

        return success;
    }
}
'@ -ErrorAction SilentlyContinue

# 2. Lire le fichier binaire et l'envoyer à l'imprimante
$bytes = [System.IO.File]::ReadAllBytes('${safePath}')
$result = [RawPrinterHelper]::SendBytesToPrinter('${safePrinter}', $bytes)

# 3. Retourner le résultat (True/False)
Write-Output $result
`;
}

/**
 * Scanne tous les ports COM disponibles et tente d'envoyer les données ESC/POS
 * (imprimantes série sans pilote Windows)
 */
async function printToComPorts(dataBuffer) {
    let SerialPort;
    try {
        ({ SerialPort } = require('serialport'));
    } catch (e) {
        log('[COM] Module serialport non disponible: ' + e.message, 'warning');
        return [];
    }

    let ports = [];
    try {
        ports = await SerialPort.list();
    } catch (e) {
        log('[COM] Impossible de lister les ports COM: ' + e.message, 'warning');
        return [];
    }

    if (ports.length === 0) {
        log('[COM] Aucun port COM détecté.', 'info');
        return [];
    }

    log(`[COM] ${ports.length} port(s) COM : ${ports.map(p => p.path).join(', ')}`, 'info');

    const BAUD_RATES = [9600, 19200, 38400, 115200];
    const results = [];

    for (const portInfo of ports) {
        const portPath = portInfo.path;
        let sent = false;

        for (const baudRate of BAUD_RATES) {
            if (sent) break;
            try {
                await new Promise((resolve, reject) => {
                    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
                    const timer = setTimeout(() => {
                        try { port.close(); } catch (e) {}
                        reject(new Error('Timeout'));
                    }, 3000);

                    port.open((err) => {
                        if (err) { clearTimeout(timer); return reject(err); }
                        port.write(dataBuffer, (writeErr) => {
                            if (writeErr) {
                                clearTimeout(timer);
                                port.close();
                                return reject(writeErr);
                            }
                            port.drain(() => {
                                clearTimeout(timer);
                                port.close();
                                resolve();
                            });
                        });
                    });
                });
                sent = true;
                log(`[COM] OK "${portPath}" @${baudRate}`, 'success');
                results.push({ printer: portPath, status: 'success' });
            } catch (e) {
                // essai baud rate suivant
            }
        }

        if (!sent) {
            log(`[COM] ÉCHEC "${portPath}"`, 'error');
            results.push({ printer: portPath, status: 'error', error: 'Aucun baud rate accepté' });
        }
    }

    return results;
}

ipcMain.handle("print-ticket", async (event, ticketText) => {
    const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);

    try {
        log('[Impression] Préparation du ticket...', 'info');

        // ── 1. Commandes ESC/POS ──
        const ESC = '\x1B';
        const GS  = '\x1D';

        const INIT            = ESC + '@';                    // Reset imprimante
        const MARGIN_LEFT_0   = GS + 'L' + '\x00' + '\x00'; // Marge gauche = 0
        // GS W (largeur zone) volontairement absent : on laisse l'imprimante
        // utiliser sa largeur par défaut (80mm, ~576 dots) pour éviter les
        // marges involontaires sur différents modèles.
        const ALIGN_LEFT      = ESC + 'a' + '\x00';          // Alignement gauche
        const FONT_NORMAL     = ESC + '!' + '\x00';          // Police normale (Font A)
        const LINE_SPACING    = ESC + '3' + '\x12';          // Interligne serré
        const LINE_FEEDS      = '\n\n\n\n\n';                // Espace avant coupe
        const CUT_COMMAND     = GS + 'V' + '\x42' + '\x00'; // Coupe complète

        const fullContent = INIT
            + MARGIN_LEFT_0
            + ALIGN_LEFT
            + FONT_NORMAL
            + LINE_SPACING
            + ticketText
            + LINE_FEEDS
            + CUT_COMMAND;

        // ── 2. Écriture fichier binaire ──
        fs.writeFileSync(tempFilePath, fullContent, { encoding: 'latin1' });

        // ── 3. Récupérer les imprimantes physiques ──
        if (!mainWindow) {
            throw new Error("La fenêtre principale n'est pas active.");
        }

        const allPrinters = await mainWindow.webContents.getPrintersAsync();

        log(`[Impression] ${allPrinters.length} imprimante(s) détectée(s) au total:`, 'info');
        allPrinters.forEach((p, i) => {
            log(`  [${i+1}] "${p.name}" | status=${p.status} | isDefault=${p.isDefault}`, 'info');
        });

        const physicalPrinters = allPrinters.filter(p => {
            const name = p.name.toLowerCase();
            const isVirtual = VIRTUAL_PRINTER_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
            if (isVirtual) log(`  --> Ignorée (virtuelle): "${p.name}"`, 'info');
            return !isVirtual;
        });

        log(`[Impression] ${physicalPrinters.length} imprimante(s) physique(s) retenues`, 'info');

        if (physicalPrinters.length === 0) {
            log('[Impression] Aucune imprimante physique via spooler → scan ports COM...', 'warning');
            const dataBuffer = Buffer.from(fullContent, 'latin1');
            const comResults = await printToComPorts(dataBuffer);
            const comSuccess = comResults.some(r => r.status === 'success');
            return { success: comSuccess, details: comResults, error: comSuccess ? undefined : "Aucune imprimante disponible" };
        }

        log(`[Impression] ${physicalPrinters.length} imprimante(s) détectée(s)`, 'info');

        // ── 4. Envoi RAW à chaque imprimante via winspool.drv ──
        const results = [];

        for (const printer of physicalPrinters) {
            const printerName = printer.name;
            log(`[Impression] --> Envoi RAW .NET vers "${printerName}"...`, 'info');

            try {
                // Générer le script PowerShell
                const psScript = buildRawPrintScript(tempFilePath, printerName);

                // Sauvegarder le script dans un fichier temporaire
                // (évite les problèmes d'échappement dans la ligne de commande)
                const scriptPath = path.join(os.tmpdir(), `print-script-${Date.now()}.ps1`);
                fs.writeFileSync(scriptPath, psScript, { encoding: 'utf-8' });

                // Exécuter le script
                log(`[Impression] Exécution PowerShell: ${scriptPath}`, 'info');
                let output;
                try {
                    output = execSync(
                        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
                        { windowsHide: true, timeout: 10000, encoding: 'utf-8' }
                    ).trim();
                } catch (psErr) {
                    const stdout = psErr.stdout ? psErr.stdout.trim() : '';
                    const stderr = psErr.stderr ? psErr.stderr.trim() : '';
                    log(`[Impression] PowerShell stdout: ${stdout}`, 'error');
                    log(`[Impression] PowerShell stderr: ${stderr}`, 'error');
                    throw new Error(`PowerShell échoué: ${psErr.message} | stderr: ${stderr}`);
                }

                // Nettoyage du script
                try { fs.unlinkSync(scriptPath); } catch (e) {}

                log(`[Impression] PowerShell output: "${output}"`, 'info');
                if (output === 'True') {
                    log(`[Impression] OK "${printerName}"`, 'success');
                    results.push({ printer: printerName, status: 'success' });
                } else {
                    throw new Error(`WritePrinter a retourné: "${output}"`);
                }

            } catch (err) {
                log(`[Impression] ÉCHEC "${printerName}": ${err.message}`, 'error');
                results.push({ printer: printerName, status: 'error', error: err.message });
            }
        }

        // ── 5. Fallback COM si aucun succès via spooler ──
        if (!results.some(r => r.status === 'success')) {
            log('[Impression] Spooler sans succès → scan ports COM...', 'warning');
            const dataBuffer = Buffer.from(fullContent, 'latin1');
            const comResults = await printToComPorts(dataBuffer);
            results.push(...comResults);
        }

        // ── 6. Nettoyage ──
        setTimeout(() => {
            try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
        }, 2000);

        const successCount = results.filter(r => r.status === 'success').length;
        log(`[Impression] Terminé : ${successCount}/${results.length} OK`, 'info');

        return { success: successCount > 0, details: results };

    } catch (error) {
        log(`[Impression] ERREUR: ${error.message}`, 'error');
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
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
  if (!isDev && !djangoExecInfo) {
    log('ERREUR: backend Django introuvable !', 'error');
    return false;
  }

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
  if (!djangoExecInfo) {
    log('Mode dev: Django doit être lancé manuellement sur le port 8000', 'warning');
    return callback();
  }

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
  // 3️⃣ Arrêter la sync
  syncManager.stop();
  licenseManager.stop();
}

app.whenReady().then(async () => {
  if (!checkRequirements()) return;

  // 1. Démarrer la licence
  await licenseManager.start();

  // 2. Si licence OK, configurer la sync
  if (licenseManager.isValid && licenseManager.license) {
      syncManager.restaurantId = licenseManager.license.restaurantId;
      syncManager.terminalUuid = licenseManager.machineId;
      syncManager.authToken = licenseManager.license.key;
      syncManager.start();
  }
  // 3. Démarrer l'interface
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