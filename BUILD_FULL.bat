@echo off
TITLE CONSTRUCTION FINALE V2
COLOR 0E
cls

echo ==========================================
echo 1. NETTOYAGE
echo ==========================================
taskkill /F /IM daphne.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
rd /s /q "my-desktop-app\dist" 2>nul
rd /s /q "my-desktop-app\backend_dist" 2>nul

echo.
echo ==========================================
echo 2. BUILD BACKEND (Django)
echo ==========================================
cd born_dz
call venv\Scripts\activate
:: On utilise ton fichier spec existant
pyinstaller --clean --noconfirm born_dz.spec
cd ..

:: Vérification
if not exist "born_dz\dist\django_asgi_app\django_asgi_app.exe" (
    echo [ERREUR] L'exe Django n'a pas ete cree. Verifie born_dz.spec
    pause
    exit
)

echo.
echo ==========================================
echo 3. PREPARATION FICHIERS POUR ELECTRON
echo ==========================================
:: On crée un dossier temporaire dans my-desktop-app pour stocker l'exe
mkdir "my-desktop-app\backend_dist"
:: On copie tout le contenu du dossier généré par PyInstaller
xcopy /E /I /Y "born_dz\dist\django_asgi_app" "my-desktop-app\backend_dist"

echo.
echo ==========================================
echo 4. BUILD FRONTEND (Electron)
echo ==========================================
cd my-desktop-app
:: Installation de npm si besoin
call npm install
:: Lancement du build final
call npm run dist

echo.
echo ==========================================
echo FINI ! L'installeur est dans my-desktop-app\dist
echo ==========================================
pause