const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { existsSync } = fs;

const backendDir = path.join(__dirname, '..', 'born_dz');
const buildDir = path.join(__dirname, 'dist', 'python-build');
const pyinstallerPath = path.join(backendDir, 'venv', 'bin', 'pyinstaller');
const pyinstallerPathWin = path.join(backendDir, 'venv', 'Scripts', 'pyinstaller.exe');

// ✅ CORRECTION : Nom cohérent avec main.js
const finalExecutableName = 'django_asgi_app.exe';
const outputFolder = path.join(buildDir, 'born_dz');

// Chemins des données
const settingsJsonPath = path.join(backendDir, 'settings.json');
const sqlitePath = path.join(backendDir, 'db.sqlite3');

// Liste des apps Django
const djangoApps = [
    'user', 'chain', 'customer', 'KDS', 'manager', 'media',
    'menu', 'order', 'POS', 'restaurant', 'terminal', 'website'
];

function getPyInstallerExec() {
    if (process.platform === 'win32' && existsSync(pyinstallerPathWin)) {
        console.log(`   ✅ PyInstaller trouvé : ${pyinstallerPathWin}`);
        return pyinstallerPathWin;
    }
    if (existsSync(pyinstallerPath)) {
        console.log(`   ✅ PyInstaller trouvé : ${pyinstallerPath}`);
        return pyinstallerPath;
    }
    try {
        const whichPath = execSync('which pyinstaller', { encoding: 'utf8' }).trim();
        if (whichPath) {
            console.log(`   ✅ PyInstaller trouvé via 'which': ${whichPath}`);
            return whichPath;
        }
    } catch (e) {}
    
    console.error(`   ❌ PyInstaller introuvable dans le venv.`);
    console.error(`   💡 Installez-le: pip install pyinstaller`);
    process.exit(1);
}

function cleanupBuildDir() {
    console.log(`🔹 Nettoyage: ${buildDir}`);
    try {
        if (existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildDir, { recursive: true });
    } catch (e) {
        console.error(`   ❌ Erreur nettoyage: ${e.message}`);
        process.exit(1);
    }
}

function createDaphneEntrypoint() {
    // ✅ SOLUTION : Créer un point d'entrée Python qui lance Daphne
    const entrypointPath = path.join(backendDir, 'run_daphne.py');
    const entrypointContent = `#!/usr/bin/env python
# Point d'entrée pour PyInstaller qui lance Daphne
import sys
import os
from daphne.cli import CommandLineInterface

if __name__ == '__main__':
    # Définir le module ASGI
    sys.argv = [
        'daphne',
        '--bind', '0.0.0.0',
        '--port', '8000',
        'born_dz.asgi:application'
    ]
    
    # Lancer Daphne
    CommandLineInterface().run(sys.argv[1:])
`;
    
    fs.writeFileSync(entrypointPath, entrypointContent, 'utf-8');
    console.log(`   ✅ Point d'entrée Daphne créé : ${entrypointPath}`);
    return entrypointPath;
}

function runPyInstaller() {
    const pyinstallerExec = getPyInstallerExec();
    cleanupBuildDir();
    
    // ✅ Créer le point d'entrée Daphne
    const entrypointPath = createDaphneEntrypoint();
    
    console.log(`🔹 Lancement PyInstaller avec ${djangoApps.length} apps Django...`);
    
    let args = [
        '--onedir',
        '--distpath', buildDir,
        '--name', 'born_dz',
        '--workpath', path.join(backendDir, 'build'),
        '--clean',
        '--console',  // Mode console pour voir les logs
        
        // Chemins Python pour toutes les apps
        ...djangoApps.map(app => `--paths=${path.join(backendDir, app)}`),
        
        // Collections de dépendances
        '--collect-all', 'django',
        '--collect-all', 'daphne',        // ← IMPORTANT pour Daphne
        '--collect-all', 'channels',      // ← IMPORTANT pour Django Channels
        '--collect-all', 'channels_redis', // ← Si vous utilisez Redis
        
        // Données Django
        `--add-data=${path.join(backendDir, 'born_dz')}${path.delimiter}born_dz`,
        ...djangoApps.map(app => 
            `--add-data=${path.join(backendDir, app)}${path.delimiter}${app}`
        ),
        `--add-data=${path.join(backendDir, 'templates')}${path.delimiter}templates`,
        
        // Static si existe
        ...(existsSync(path.join(backendDir, 'static')) ? 
            [`--add-data=${path.join(backendDir, 'static')}${path.delimiter}static`] : []
        ),
        
        // DB et settings
        ...(existsSync(sqlitePath) ? 
            [`--add-data=${sqlitePath}${path.delimiter}.`] : []
        ),
        ...(existsSync(settingsJsonPath) ? 
            [`--add-data=${settingsJsonPath}${path.delimiter}.`] : []
        ),
        
        // ✅ Point d'entrée = run_daphne.py (pas manage.py)
        entrypointPath
    ];
    
    const pyinstallerProcess = spawn(pyinstallerExec, args, { 
        cwd: backendDir, 
        shell: true,
        stdio: 'inherit'  // Afficher la sortie en direct
    });

    pyinstallerProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ PyInstaller échoué (code ${code})`);
            process.exit(1);
        }
        
        console.log("✅ PyInstaller terminé. Vérification...");
        
        // ✅ Renommage correct
        const pyinstallerOutputBin = path.join(buildDir, 'born_dz', 'born_dz.exe');
        const targetPath = path.join(buildDir, 'born_dz', finalExecutableName);

        try {
            if (existsSync(pyinstallerOutputBin)) {
                fs.renameSync(pyinstallerOutputBin, targetPath);
                console.log(`   ✅ Exécutable renommé : ${finalExecutableName}`);
                console.log(`   📍 Chemin : ${targetPath}`);
            } else {
                console.error(`   ❌ Binaire PyInstaller introuvable : ${pyinstallerOutputBin}`);
                process.exit(1);
            }
        } catch(e) {
            console.error(`   ❌ Erreur renommage : ${e.message}`);
            process.exit(1);
        }
        
        console.log("✅ Build Python prêt pour Electron Builder !");
    });
}

runPyInstaller();