const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { existsSync } = fs;

const backendDir = path.join(__dirname, '..', 'born_dz');
const buildDir = path.join(__dirname, 'dist', 'python-build');
const pyinstallerPath = path.join(backendDir, 'venv', 'bin', 'pyinstaller');
const pyinstallerPathWin = path.join(backendDir, 'venv', 'Scripts', 'pyinstaller.exe');

// OK Chemin vers le fichier .spec
const specFilePath = path.join(backendDir, 'born_dz.spec');

// OK CORRECTION : Nom cohérent avec main.js
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
        console.log(`   OK PyInstaller trouvé : ${pyinstallerPathWin}`);
        return pyinstallerPathWin;
    }
    if (existsSync(pyinstallerPath)) {
        console.log(`   OK PyInstaller trouvé : ${pyinstallerPath}`);
        return pyinstallerPath;
    }
    try {
        const whichPath = execSync('which pyinstaller', { encoding: 'utf8' }).trim();
        if (whichPath) {
            console.log(`   OK PyInstaller trouvé via 'which': ${whichPath}`);
            return whichPath;
        }
    } catch (e) {}
    
    console.error(`   No PyInstaller introuvable dans le venv.`);
    console.error(`     Installez-le: pip install pyinstaller`);
    process.exit(1);
}

function cleanupBuildDir() {
    console.log(` INFO Nettoyage: ${buildDir}`);
    try {
        if (existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildDir, { recursive: true });
    } catch (e) {
        console.error(`   No Erreur nettoyage: ${e.message}`);
        process.exit(1);
    }
}

function createDaphneEntrypoint() {
    // OK SOLUTION : Créer un point d'entrée Python qui lance Daphne
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
    console.log(`   OK Point d'entrée Daphne créé : ${entrypointPath}`);
    return entrypointPath;
}

function runPyInstaller() {
    const pyinstallerExec = getPyInstallerExec();
    cleanupBuildDir();
    
    // OK Créer le point d'entrée Daphne
    const entrypointPath = createDaphneEntrypoint();
    
    let args;
    
    // OK NOUVEAU : Vérifier si le fichier .spec existe
    if (existsSync(specFilePath)) {
        console.log(` INFO Fichier .spec détecté : ${specFilePath}`);
        console.log(` INFO Build avec le fichier .spec (mode avancé)`);
        
        // Utiliser le fichier .spec
        args = [
            '--distpath', buildDir,
            '--workpath', path.join(backendDir, 'build'),
            '--clean',
            specFilePath
        ];
    } else {
        console.log(` INFO Pas de fichier .spec détecté`);
        console.log(` INFO Build avec arguments directs (mode standard)`);
        console.log(`  Pour un contrôle avancé, placez born_dz.spec dans ${backendDir}`);
        
        // Mode standard : arguments directs
        args = [
            '--onedir',
            '--distpath', buildDir,
            '--name', 'born_dz',
            '--workpath', path.join(backendDir, 'build'),
            '--clean',
            '--console',
            
            // Chemins Python pour toutes les apps
            ...djangoApps.map(app => `--paths=${path.join(backendDir, app)}`),
            
            // Collections de dépendances
            '--collect-all', 'django',
            '--collect-all', 'daphne',
            '--collect-all', 'channels',
            '--collect-all', 'channels_redis',
            
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
            
            entrypointPath
        ];
    }
    
    const pyinstallerProcess = spawn(pyinstallerExec, args, { 
        cwd: backendDir, 
        shell: true,
        stdio: 'inherit'
    });

    pyinstallerProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`No PyInstaller échoué (code ${code})`);
            process.exit(1);
        }
        
        console.log("OK PyInstaller terminé. Recherche du fichier généré...");
        
        const targetDir = path.join(buildDir, 'born_dz');
        
        if (!fs.existsSync(targetDir)) {
             console.error(`No Le dossier ${targetDir} n'a pas été créé.`);
             process.exit(1);
        }

        const files = fs.readdirSync(targetDir);
        const generatedExe = files.find(f => f.endsWith('.exe'));

        if (!generatedExe) {
            console.error(`No Aucun fichier .exe trouvé dans ${targetDir}`);
            console.log("Fichiers présents :", files);
            process.exit(1);
        }

        const oldPath = path.join(targetDir, generatedExe);
        const newPath = path.join(targetDir, finalExecutableName);

        if (generatedExe === finalExecutableName) {
            console.log(`OK L'exécutable est déjà nommé correctement : ${finalExecutableName}`);
        } else {
            try {
                if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
                
                fs.renameSync(oldPath, newPath);
                console.log(`OK Renommé : ${generatedExe} -> ${finalExecutableName}`);
            } catch (e) {
                console.error(`No Erreur lors du renommage : ${e.message}`);
                process.exit(1);
            }
        }
        
        console.log(` DONE BUILD PYTHON TERMINÉ AVEC SUCCÈS !`);
    });
}

runPyInstaller();