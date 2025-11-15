const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
// Utiliser 'fs' pour les suppressions, car 'rimraf' nécessite parfois une installation séparée
// Pour la suppression récursive sur Node 12+, on utilise fs.rmSync.
const { rmdirSync, existsSync } = fs;

const backendDir = path.join(__dirname, '..', '..', 'born_dz');
const buildDir = path.join(__dirname, '..', 'dist', 'python-build');
const pyinstallerPath = path.join(backendDir, 'venv', 'bin', 'pyinstaller');
const pyinstallerPathWin = path.join(backendDir, 'venv', 'Scripts', 'pyinstaller.exe');
const managePyPath = path.join(backendDir, 'manage.py');

// Fonction utilitaire pour trouver le chemin de l'exécutable PyInstaller
function getPyInstallerExec() {
if (process.platform === 'win32' && existsSync(pyinstallerPathWin)) {
return pyinstallerPathWin;
}
if (existsSync(pyinstallerPath)) {
console.log(` PyInstaller trouvé à: ${pyinstallerPath}`);
return pyinstallerPath;
}
// Fallback générique si le venv n'est pas dans le répertoire parent
try {
const whichPath = execSync('which pyinstaller', { encoding: 'utf8' }).trim();
if (whichPath) {
console.log(` PyInstaller trouvé via 'which': ${whichPath}`);
return whichPath;
}
} catch (e) {
// Ignorer l'erreur de which
}
console.error("❌ ERREUR FATALE: PyInstaller non trouvé.");
console.error(` Vérifiez que votre venv est à: ${path.join(backendDir, 'venv')}`);
console.error(" Exécutez 'pip install pyinstaller' dans votre environnement virtuel.");
process.exit(1);
}

// Fonction pour supprimer un répertoire de manière récursive
function removeDir(dir) {
if (existsSync(dir)) {
try {
// Utilise l'API native de Node.js
fs.rmSync(dir, { recursive: true, force: true });
} catch(e) {
console.warn(` Avertissement de nettoyage (échec de suppression de ${dir}):`, e.message);
}
}
}

function runPyInstaller() {
console.log("🔹 Démarrage du bundling Python avec PyInstaller...");

// Nettoyage des dossiers de sortie précédents
removeDir(buildDir);
removeDir(path.join(backendDir, 'build')); // Dossier temporaire PyInstaller
removeDir(path.join(backendDir, 'dist')); // Dossier PyInstaller dans le backend (à ne pas confondre avec dist Electron)
console.log(" Nettoyage des dossiers de build PyInstaller terminé.");


// 1. Déterminer l'exécutable PyInstaller
const pyInstallerExec = getPyInstallerExec();
if (!pyInstallerExec) return; // Devrait quitter dans getPyInstallerExec()

// 2. Préparer les arguments
const pyInstallerArgs = [
'--onedir',
// Fichiers de configuration et de sortie
'--distpath', buildDir,
'--name', 'born_dz',
'--workpath', path.join(backendDir, 'build'),
// Modules Django (collect-all doit être avant les scripts ou data)
'--collect-all', 'django',
// --- Inclusion des fichiers de données (CORRECTION COMPLÈTE) ---
// 1. Dossier de configuration principal du projet (born_dz/settings.py)
'--add-data', `${path.join(backendDir, 'born_dz')}${path.delimiter}born_dz`,
// 2. L'application 'website'
'--add-data', `${path.join(backendDir, 'website')}${path.delimiter}website`,

// 3. L'application 'user' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'user')}${path.delimiter}user`,
// 3. L'application 'chain' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'chain')}${path.delimiter}chain`,
// 3. L'application 'customer' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'customer')}${path.delimiter}customer`,
// 3. L'application 'KDS' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'KDS')}${path.delimiter}KDS`,
// 3. L'application 'manager' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'manager')}${path.delimiter}manager`,
// 3. L'application 'media' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'media')}${path.delimiter}media`,
// 3. L'application 'menu' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'menu')}${path.delimiter}menu`,
// 3. L'application 'order' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'order')}${path.delimiter}order`,
// 3. L'application 'POS' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'POS')}${path.delimiter}POS`,
// 3. L'application 'restaurant' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'restaurant')}${path.delimiter}restaurant`,
// 3. L'application 'static' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'static')}${path.delimiter}static`,
// 3. L'application 'staticfiles' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'staticfiles')}${path.delimiter}staticfiles`,
// 3. L'application 'terminal' (Correction ModuleNotFoundError)
'--add-data', `${path.join(backendDir, 'terminal')}${path.delimiter}terminal`,


// 4. Le dossier global 'templates'
'--add-data', `${path.join(backendDir, 'templates')}${path.delimiter}templates`,
// 5. Le dossier statique (très souvent requis)
// Vérifie si le dossier 'static' existe avant de l'ajouter
...(fs.existsSync(path.join(backendDir, 'static')) ?
['--add-data', `${path.join(backendDir, 'static')}${path.delimiter}static`] :
[]
),

// 6. Base de données
'--add-data', `${path.join(backendDir, 'db.sqlite3')}${path.delimiter}.`,

// L'entrée principale (manage.py)
managePyPath
];

console.log(` Exécution: ${pyInstallerExec} ${pyInstallerArgs.join(' ')}`);

// 3. Exécuter PyInstaller
const child = spawn(pyInstallerExec, pyInstallerArgs, {
cwd: backendDir,
stdio: 'inherit',
});

child.on('error', (err) => {
console.error(`❌ Échec de PyInstaller (Erreur d'exécution du binaire): ${err.message}`);
process.exit(1);
});
child.on('close', (code) => {
if (code !== 0) {
console.error(`❌ Échec de PyInstaller (code de sortie ${code}).`);
console.error(" Vérifiez les messages d'erreur au-dessus pour les modules manquants.");
process.exit(1);
} else {
console.log(`✅ Bundling Python réussi! Exécutable dans: ${buildDir}`);
// Étape post-PyInstaller : Renommer l'exécutable
const finalExecutableName = process.platform === 'win32' ? 'django_app.exe' : 'django_app';
//const pyinstallerOutputBin = path.join(buildDir, 'born_dz', 'manage');
//const targetPath = path.join(buildDir, 'born_dz', finalExecutableName);
const outputFolder = path.join(buildDir, 'born_dz');
const files = fs.readdirSync(outputFolder);
const exeFile = files.find(f => f.endsWith('.exe') || !path.extname(f));

if (!exeFile) {
  console.error(`❌ Erreur: Aucun binaire PyInstaller trouvé dans ${outputFolder}`);
  process.exit(1);
}

const targetPath = path.join(outputFolder, finalExecutableName);
fs.renameSync(path.join(outputFolder, exeFile), targetPath);
console.log(` Exécutable PyInstaller renommé en: ${finalExecutableName}`);

try {
if (existsSync(pyinstallerOutputBin)) {
// PyInstaller crée un exécutable nommé d'après le script (manage.py -> manage)
fs.renameSync(pyinstallerOutputBin, targetPath);
console.log(` Exécutable PyInstaller renommé en: ${finalExecutableName}`);
} else {
// Si le binaire est le nom du package dans certains cas (born_dz)
const alternativeBin = path.join(buildDir, 'born_dz', 'born_dz');
if (existsSync(alternativeBin)) {
fs.renameSync(alternativeBin, targetPath);
console.log(` Exécutable PyInstaller renommé en: ${finalExecutableName}`);
} else {
console.error(` Erreur: Binaire PyInstaller 'manage' ou 'born_dz' introuvable dans le dossier de sortie.`);
process.exit(1);
}
}
} catch(e) {
console.error(` Erreur lors du renommage de l'exécutable: ${e.message}`);
if (!existsSync(targetPath)) {
console.error("Le binaire final n'a pas été créé correctement. Vérifiez les logs PyInstaller.");
process.exit(1);
}
}
console.log("✅ PyInstaller terminé et prêt pour Electron Builder.");
}
});
}

runPyInstaller();