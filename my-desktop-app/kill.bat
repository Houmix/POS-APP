@echo off
chcp 65001 >nul
title Libération du Port 8000

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║           LIBERATION DU PORT 8000                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo 🔍 Recherche des processus sur le port 8000...
echo.

REM Trouver les processus utilisant le port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    set PID=%%a
    if not "!PID!"=="" (
        echo 🔴 Processus trouvé : PID !PID!
        
        REM Afficher le nom du processus
        for /f "tokens=1" %%b in ('tasklist /fi "pid eq !PID!" /fo csv /nh') do (
            echo    Nom : %%b
        )
        
        REM Tuer le processus
        taskkill /f /pid !PID! 2>nul
        if !errorlevel! equ 0 (
            echo    ✅ Processus terminé
        ) else (
            echo    ⚠️  Impossible de terminer (peut nécessiter les droits admin)
        )
        echo.
    )
)

echo.
echo 🔍 Vérification finale...
netstat -ano | findstr ":8000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Le port 8000 est encore utilisé !
    echo.
    echo 💡 Solutions :
    echo    1. Lancez ce script en tant qu'Administrateur
    echo    2. Redémarrez votre ordinateur
    echo    3. Utilisez un autre port
    echo.
) else (
    echo ✅ Port 8000 libéré avec succès !
    echo.
    echo 🚀 Vous pouvez maintenant lancer l'application
    echo.
)

pause