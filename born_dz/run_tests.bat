@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         SCRIPTS DE TEST ET BUILD - POS Desktop            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Détecter le dossier courant
set CURRENT_DIR=%cd%

REM Vérifier si on est dans le bon dossier
if not exist "run_daphne.py" (
    echo ❌ Erreur: Vous devez lancer ce script depuis le dossier born_dz/
    echo.
    echo    cd C:\Users\VotreNom\Documents\POS-APP\born_dz
    echo    .\run_tests.bat
    echo.
    pause
    exit /b 1
)

REM Vérifier que le venv existe
if not exist "venv\Scripts\activate.bat" (
    echo ❌ Erreur: Environnement virtuel non trouvé
    echo.
    echo Créez-le avec: python -m venv venv
    echo.
    pause
    exit /b 1
)

:menu
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                    MENU PRINCIPAL                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo   [1] Tester l'environnement (avant build)
echo   [2] Build PyInstaller (créer l'exécutable)
echo   [3] Tester l'exécutable Django
echo   [4] Build complet (PyInstaller + Electron)
echo   [5] Nettoyer les builds précédents
echo   [6] Réinstaller les dépendances
echo   [Q] Quitter
echo.
set /p choice="Votre choix: "

if /i "%choice%"=="1" goto test_env
if /i "%choice%"=="2" goto build_pyinstaller
if /i "%choice%"=="3" goto test_exe
if /i "%choice%"=="4" goto build_full
if /i "%choice%"=="5" goto clean
if /i "%choice%"=="6" goto reinstall
if /i "%choice%"=="Q" goto end
goto menu

:test_env
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    TEST DE L'ENVIRONNEMENT
echo ═══════════════════════════════════════════════════════════
echo.
call venv\Scripts\activate.bat
python test_environment.py
echo.
echo.
pause
goto menu

:build_pyinstaller
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    BUILD PYINSTALLER
echo ═══════════════════════════════════════════════════════════
echo.

REM Vérifier le fichier .spec
if not exist "born_dz.spec" (
    echo ❌ Fichier born_dz.spec non trouvé!
    echo    Placez-le dans le dossier born_dz/
    echo.
    pause
    goto menu
)

call venv\Scripts\activate.bat

echo Nettoyage des builds précédents...
if exist "build" rmdir /s /q build
if exist "dist" rmdir /s /q dist

echo.
echo Lancement de PyInstaller...
echo.
pyinstaller --clean born_dz.spec

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build PyInstaller réussi!
    echo.
    echo Exécutable créé dans:
    echo   ..\my-desktop-app\dist\python-build\born_dz\django_asgi_app.exe
    echo.
) else (
    echo.
    echo ❌ Build PyInstaller échoué!
    echo.
)

pause
goto menu

:test_exe
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    TEST DE L'EXÉCUTABLE DJANGO
echo ═══════════════════════════════════════════════════════════
echo.

set EXE_PATH=..\my-desktop-app\dist\python-build\born_dz\django_asgi_app.exe

if not exist "%EXE_PATH%" (
    echo ❌ Exécutable non trouvé!
    echo    Lancez d'abord le build PyInstaller (option 2)
    echo.
    pause
    goto menu
)

echo Lancement du serveur Django...
echo Appuyez sur Ctrl+C pour arrêter
echo.

cd ..\my-desktop-app\dist\python-build\born_dz
django_asgi_app.exe

cd %CURRENT_DIR%
pause
goto menu

:build_full
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    BUILD COMPLET (PyInstaller + Electron)
echo ═══════════════════════════════════════════════════════════
echo.

REM Build PyInstaller
echo [1/2] Build PyInstaller...
call venv\Scripts\activate.bat

if exist "build" rmdir /s /q build
if exist "dist" rmdir /s /q dist

pyinstaller --clean born_dz.spec

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build PyInstaller échoué!
    pause
    goto menu
)

echo ✅ Build PyInstaller réussi
echo.

REM Build Electron
echo [2/2] Build Electron...
cd ..\my-desktop-app

call npm install
call npm run build:win

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ BUILD COMPLET RÉUSSI!
    echo.
    echo Installateur créé dans:
    echo   my-desktop-app\dist\POS-Desktop Setup 1.0.0.exe
    echo.
) else (
    echo.
    echo ❌ Build Electron échoué!
    echo.
)

cd %CURRENT_DIR%
pause
goto menu

:clean
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    NETTOYAGE DES BUILDS
echo ═══════════════════════════════════════════════════════════
echo.

echo Nettoyage des dossiers de build...

REM Django
if exist "build" (
    echo   Suppression: born_dz\build\
    rmdir /s /q build
)
if exist "dist" (
    echo   Suppression: born_dz\dist\
    rmdir /s /q dist
)

REM Electron
cd ..\my-desktop-app
if exist "dist" (
    echo   Suppression: my-desktop-app\dist\
    rmdir /s /q dist
)
if exist "build" (
    echo   Suppression: my-desktop-app\build\
    rmdir /s /q build
)

cd %CURRENT_DIR%

echo.
echo ✅ Nettoyage terminé
echo.
pause
goto menu

:reinstall
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo    RÉINSTALLATION DES DÉPENDANCES
echo ═══════════════════════════════════════════════════════════
echo.

call venv\Scripts\activate.bat

echo Mise à jour de pip...
python -m pip install --upgrade pip

echo.
echo Installation des dépendances...
pip install -r requirements.txt

echo.
echo Installation de PyInstaller...
pip install pyinstaller

echo.
echo ✅ Réinstallation terminée
echo.
pause
goto menu

:end
echo.
echo Au revoir!
echo.
exit /b 0