# =====================================================
# Script de Build Automatisé - Django + Electron
# =====================================================

# Couleurs pour les messages
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error-Custom { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning-Custom { Write-Host "⚠️  $args" -ForegroundColor Yellow }

# =====================================================
# CONFIGURATION - MODIFIEZ CES CHEMINS
# =====================================================
$PROJECT_ROOT = "C:\Users\HoumameLachache\Documents\POS-APP"
$DJANGO_DIR = Join-Path $PROJECT_ROOT "born_dz"
$ELECTRON_DIR = Join-Path $PROJECT_ROOT "my-desktop-app"
$VENV_PATH = Join-Path $DJANGO_DIR "venv"
$SPEC_FILE = Join-Path $DJANGO_DIR "born_dz.spec"

Write-Info "Configuration:"
Write-Host "  Django: $DJANGO_DIR"
Write-Host "  Electron: $ELECTRON_DIR"
Write-Host "  Venv: $VENV_PATH"
Write-Host ""

# =====================================================
# ÉTAPE 1: VÉRIFICATIONS PRÉLIMINAIRES
# =====================================================
Write-Info "ÉTAPE 1: Vérifications préliminaires..."

# Vérifier que les dossiers existent
if (-not (Test-Path $DJANGO_DIR)) {
    Write-Error-Custom "Le dossier Django n'existe pas: $DJANGO_DIR"
    exit 1
}

if (-not (Test-Path $ELECTRON_DIR)) {
    Write-Error-Custom "Le dossier Electron n'existe pas: $ELECTRON_DIR"
    exit 1
}

if (-not (Test-Path $VENV_PATH)) {
    Write-Error-Custom "L'environnement virtuel n'existe pas: $VENV_PATH"
    Write-Info "Créez-le avec: python -m venv venv"
    exit 1
}

if (-not (Test-Path $SPEC_FILE)) {
    Write-Warning-Custom "Le fichier .spec n'existe pas: $SPEC_FILE"
    Write-Info "Placez le fichier born_dz.spec dans le dossier Django"
    exit 1
}

Write-Success "Tous les dossiers existent"

# =====================================================
# ÉTAPE 2: ACTIVER VENV ET VÉRIFIER PACKAGES
# =====================================================
Write-Info "ÉTAPE 2: Vérification de l'environnement Python..."

$ACTIVATE_SCRIPT = Join-Path $VENV_PATH "Scripts\Activate.ps1"
if (-not (Test-Path $ACTIVATE_SCRIPT)) {
    Write-Error-Custom "Script d'activation introuvable: $ACTIVATE_SCRIPT"
    exit 1
}

# Activer le venv
& $ACTIVATE_SCRIPT

# Vérifier Python
$pythonVersion = python --version 2>&1
Write-Info "Version Python: $pythonVersion"

# Vérifier PyInstaller
try {
    $pyinstallerVersion = pyinstaller --version 2>&1
    Write-Success "PyInstaller installé: $pyinstallerVersion"
} catch {
    Write-Error-Custom "PyInstaller n'est pas installé"
    Write-Info "Installation de PyInstaller..."
    pip install pyinstaller
}

# Vérifier les packages critiques
Write-Info "Vérification des packages critiques..."
$criticalPackages = @("django", "daphne", "twisted", "autobahn", "channels", "zope.interface")
$missingPackages = @()

foreach ($package in $criticalPackages) {
    try {
        $result = pip show $package 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$package est installé"
        } else {
            $missingPackages += $package
        }
    } catch {
        $missingPackages += $package
    }
}

if ($missingPackages.Count -gt 0) {
    Write-Warning-Custom "Packages manquants: $($missingPackages -join ', ')"
    Write-Info "Installation des packages manquants..."
    $requirementsPath = Join-Path $DJANGO_DIR "requirements.txt"
    pip install -r $requirementsPath
} else {
    Write-Success "Tous les packages critiques sont installés"
}

# =====================================================
# ÉTAPE 3: NETTOYAGE
# =====================================================
Write-Info "ÉTAPE 3: Nettoyage des builds précédents..."

$dirsToClean = @(
    (Join-Path $DJANGO_DIR "build"),
    (Join-Path $DJANGO_DIR "dist"),
    (Join-Path $ELECTRON_DIR "dist"),
    (Join-Path $ELECTRON_DIR "dist\python-build")
)

foreach ($dir in $dirsToClean) {
    if (Test-Path $dir) {
        Write-Info "Suppression: $dir"
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Success "Nettoyage terminé"

# =====================================================
# ÉTAPE 4: BUILD PYINSTALLER
# =====================================================
Write-Info "ÉTAPE 4: Build PyInstaller..."

Set-Location $DJANGO_DIR

Write-Info "Lancement de PyInstaller..."
pyinstaller --clean $SPEC_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "PyInstaller a échoué (code: $LASTEXITCODE)"
    exit 1
}

Write-Success "Build PyInstaller réussi"

# Vérifier que l'exécutable a été créé
$execPath = Join-Path $ELECTRON_DIR "dist\python-build\born_dz\django_asgi_app.exe"
if (-not (Test-Path $execPath)) {
    Write-Error-Custom "L'exécutable n'a pas été créé: $execPath"
    exit 1
}

Write-Success "Exécutable créé: $execPath"

# =====================================================
# ÉTAPE 5: TEST DE L'EXÉCUTABLE (OPTIONNEL)
# =====================================================
Write-Warning-Custom "Voulez-vous tester l'exécutable Django avant de continuer? (y/n)"
$testChoice = Read-Host

if ($testChoice -eq "y" -or $testChoice -eq "Y") {
    Write-Info "Lancement de l'exécutable Django..."
    Write-Warning-Custom "Appuyez sur Ctrl+C pour arrêter le serveur"
    
    Set-Location (Join-Path $ELECTRON_DIR "dist\python-build\born_dz")
    & ".\django_asgi_app.exe"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "L'exécutable Django a échoué"
        Write-Info "Vérifiez les logs ci-dessus pour plus de détails"
        exit 1
    }
}

# =====================================================
# ÉTAPE 6: BUILD ELECTRON
# =====================================================
Write-Info "ÉTAPE 6: Build Electron..."

Set-Location $ELECTRON_DIR

Write-Info "Installation des dépendances npm..."
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "npm install a échoué"
    exit 1
}

Write-Info "Build Electron Windows..."
npm run build:win

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Build Electron a échoué"
    exit 1
}

Write-Success "Build Electron réussi"

# =====================================================
# ÉTAPE 7: VÉRIFICATIONS FINALES
# =====================================================
Write-Info "ÉTAPE 7: Vérifications finales..."

$installerPath = Join-Path $ELECTRON_DIR "dist\POS-Desktop Setup*.exe"
$installerFiles = Get-ChildItem -Path (Join-Path $ELECTRON_DIR "dist") -Filter "POS-Desktop Setup*.exe" -ErrorAction SilentlyContinue

if ($installerFiles.Count -gt 0) {
    Write-Success "Installateur créé:"
    foreach ($file in $installerFiles) {
        Write-Host "  📦 $($file.FullName)" -ForegroundColor Green
        Write-Host "  📊 Taille: $([math]::Round($file.Length / 1MB, 2)) MB"
    }
} else {
    Write-Warning-Custom "Aucun installateur trouvé dans dist/"
}

# =====================================================
# RÉSUMÉ
# =====================================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "           🎉 BUILD TERMINÉ AVEC SUCCÈS 🎉" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Dossier de sortie:" -ForegroundColor Cyan
Write-Host "   $ELECTRON_DIR\dist" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Testez l'installateur dans dist/" -ForegroundColor White
Write-Host "   2. Installez l'application sur votre machine" -ForegroundColor White
Write-Host "   3. Vérifiez que tout fonctionne correctement" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan