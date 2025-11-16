const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
// Utilisation de fs.rmSync pour la compatibilité moderne et la récursivité
const { existsSync } = fs; 

const backendDir = path.join(__dirname, '..', '..', 'born_dz');
const buildDir = path.join(__dirname, '..', 'dist', 'python-build');
const pyinstallerPath = path.join(backendDir, 'venv', 'bin', 'pyinstaller');
const pyinstallerPathWin = path.join(backendDir, 'venv', 'Scripts', 'pyinstaller.exe');
const managePyPath = path.join(backendDir, 'manage.py');

// Le nom final que l'exécutable aura dans le dossier 'born_dz'
const finalExecutableName = 'django_app.exe'; 
const outputFolder = path.join(buildDir, 'born_dz');

// 💡 CHEMIN VERS LES FICHIERS DE DONNÉES CLÉS
// Si settings.json est à C:\...\born_dz\settings.json, ce chemin est correct.
const settingsJsonPath = path.join(backendDir, 'settings.json'); 
const sqlitePath = path.join(backendDir, 'db.sqlite3');

// 💡 LISTE DE TOUTES VOS APPLICATIONS DJANGO (CRITIQUE pour le ModuleNotFoundError)
const djangoApps = [
    'user', 
    'chain', 
    'customer', 
    'KDS', 
    'manager', 
    'media',
    'menu', 
    'order', 
    'POS', 
    'restaurant', 
    'terminal',
    'website' // Ajoutez aussi 'website' ici
];

// Fonction utilitaire pour trouver le chemin de l'exécutable PyInstaller
function getPyInstallerExec() {
    if (process.platform === 'win32' && existsSync(pyinstallerPathWin)) {
        return pyinstallerPathWin;
    }
    if (existsSync(pyinstallerPath)) {
        console.log(`   PyInstaller trouvé à: ${pyinstallerPath}`);
        return pyinstallerPath;
    }
    try {
        const whichPath = execSync('which pyinstaller', { encoding: 'utf8' }).trim();
        if (whichPath) {
            console.log(`   PyInstaller trouvé via 'which': ${whichPath}`);
            return whichPath;
        }
    } catch (e) {
    }
    console.error(`   Erreur: PyInstaller introuvable. Assurez-vous qu'il est installé dans votre venv.`);
    process.exit(1);
}

function cleanupBuildDir() {
    console.log(`🔹 Nettoyage du répertoire de build: ${buildDir}`);
    try {
        if (existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildDir, { recursive: true });
    } catch (e) {
        console.error(`   Erreur lors du nettoyage: ${e.message}`);
        process.exit(1);
    }
}

function runPyInstaller() {
    const pyinstallerExec = getPyInstallerExec();
    cleanupBuildDir();
    
    // Vérification du fichier JSON si il doit exister
    if (existsSync(settingsJsonPath)) {
        console.log(`   Fichier de configuration JSON trouvé.`);
    } else {
        console.warn(`⚠️ AVERTISSEMENT: settings.json est introuvable à: ${settingsJsonPath}. Si vous ne l'utilisez pas, ignorez.`);
        // Note : Nous continuons le build, mais l'erreur de PyInstaller que vous avez eue précédemment était à cause de cela.
    }

    console.log(`🔹 Lancement de PyInstaller (en mode one-dir) avec ${djangoApps.length} applications...`);
    
    let args = [
        '--onedir', 
        '--distpath', buildDir, 
        '--name', 'born_dz',
        '--workpath', path.join(backendDir, 'build'),
        '--clean',
        
        // CORRECTION CLÉ pour le ModuleNotFoundError: ajouter chaque dossier d'application au PYTHONPATH
        ...djangoApps.map(app => `--paths=${path.join(backendDir, app)}`),

        // Inclusions des dépendances Django (très souvent requis)
        '--collect-all', 'django', 

        // --- Inclusion des fichiers de données ---
        
        // 1. Dossier de configuration principal du projet (contient settings.py, urls.py, etc.)
        `--add-data=${path.join(backendDir, 'born_dz')}${path.delimiter}born_dz`,
        
        // 2. Inclusion de toutes vos applications Django (en tant que données)
        ...djangoApps.map(app => 
            `--add-data=${path.join(backendDir, app)}${path.delimiter}${app}`
        ),

        // 3. Le dossier global 'templates'
        `--add-data=${path.join(backendDir, 'templates')}${path.delimiter}templates`,
        
        // 4. Le dossier statique (si existant)
        ...(existsSync(path.join(backendDir, 'static')) ? 
            [`--add-data=${path.join(backendDir, 'static')}${path.delimiter}static`] : 
            []
        ),
        
        // 5. Inclusion des fichiers à la racine (settings.json, db.sqlite3)
        // A. Base de données
        ...(existsSync(sqlitePath) ? 
            [`--add-data=${sqlitePath}${path.delimiter}.`] : 
            []
        ),
        // B. Fichier JSON
        ...(existsSync(settingsJsonPath) ? 
            [`--add-data=${settingsJsonPath}${path.delimiter}.`] : 
            []
        ),
        
        // L'entrée principale (manage.py)
        managePyPath
    ];

    
    const pyinstallerProcess = spawn(pyinstallerExec, args, { cwd: backendDir, shell: true });

    pyinstallerProcess.stdout.on('data', (data) => {
        console.log(`[PyInstaller]: ${data.toString().trim()}`);
    });

    pyinstallerProcess.stderr.on('data', (data) => {
        console.error(`[PyInstaller ERROR]: ${data.toString().trim()}`);
    });

    pyinstallerProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ PyInstaller a échoué avec le code ${code}.`);
            // Nous n'appelons pas process.exit(1) ici pour permettre à Electron Builder de continuer
            // L'erreur PyInstaller a déjà fait échouer le script Node.js.
            return;
        } else {
            console.log("✅ PyInstaller terminé. Vérification du binaire...");
            
            // --- Logique de renommage (adaptée pour --onedir) ---
            // En mode --onedir, l'exécutable est dans buildDir/born_dz/born_dz.exe
            const pyinstallerOutputBin = path.join(buildDir, 'born_dz', 'born_dz.exe'); 
            const targetDir = path.join(buildDir, 'born_dz'); // Le dossier final pour Electron Builder
            const targetPath = path.join(targetDir, finalExecutableName);

            if (!existsSync(targetDir)) {
                 fs.mkdirSync(targetDir, { recursive: true });
            }

            // On ne peut pas renommer dans le dossier 'born_dz' généré par PyInstaller en mode 'onedir'.
            // Electron Builder attend que le contenu du dossier soit copié dans 'resources/born_dz'.
            // Le fichier django_app.exe (le binaire renommé) est utilisé par main.js.

            // 1. Déplacer le binaire principal de `dist/python-build/born_dz/born_dz.exe` vers `dist/python-build/born_dz/django_app.exe`
            try {
                if (existsSync(pyinstallerOutputBin)) {
                    fs.renameSync(pyinstallerOutputBin, targetPath);
                    console.log(`   Exécutable PyInstaller renommé en: ${finalExecutableName}`);
                } else {
                     console.error(`   Erreur: Binaire PyInstaller 'born_dz.exe' introuvable dans le dossier de sortie PyInstaller.`);
                     process.exit(1);
                }
            } catch(e) {
                console.error(`   Erreur lors du renommage de l'exécutable: ${e.message}`);
                process.exit(1);
            }
            
            console.log("✅ PyInstaller terminé et prêt pour Electron Builder.");
        }
    });
}

runPyInstaller();