// ==========================================
// 🖨️ HANDLER D'IMPRESSION FINAL (TEXTE BRUT)
// À intégrer dans votre main.js principal
// ==========================================

const { ipcMain } = require('electron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const POS_PRINTER_NAME = "POS-80"; // ⚠️ Ajustez selon votre imprimante

/**
 * Handler d'impression pour tickets POS
 * Utilise la commande Windows Out-Printer (texte brut)
 * Fonctionne comme imprimer un .txt avec Ctrl+P
 */
ipcMain.handle("print-ticket", async (event, ticketText) => {
    let tempFilePath = null;

    try {
        console.log(`[Impression] Début sur "${POS_PRINTER_NAME}"`);

        // 1️⃣ Créer un fichier texte temporaire
        tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);
        fs.writeFileSync(tempFilePath, ticketText, 'utf-8');
        console.log(`[Impression] Fichier créé: ${tempFilePath}`);

        // 2️⃣ Envoyer à l'imprimante via PowerShell
        const command = `powershell -Command "Get-Content '${tempFilePath}' | Out-Printer -Name '${POS_PRINTER_NAME}'"`;
        
        console.log(`[Impression] Envoi à l'imprimante...`);
        execSync(command, { 
            encoding: 'utf-8',
            timeout: 5000,
            windowsHide: true // Cache la fenêtre PowerShell
        });
        
        console.log(`[Impression] ✅ Succès`);

        // 3️⃣ Nettoyer le fichier temporaire après un délai
        setTimeout(() => {
            try {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`[Impression] Fichier temporaire supprimé`);
                }
            } catch (cleanupError) {
                // Ignore les erreurs de nettoyage
            }
        }, 2000);

        return { 
            success: true, 
            printer: POS_PRINTER_NAME 
        };

    } catch (error) {
        console.error(`[Impression] ❌ Erreur: ${error.message}`);
        
        // Essayer de nettoyer même en cas d'erreur
        if (tempFilePath) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                // Ignore
            }
        }

        return { 
            success: false, 
            error: error.message 
        };
    }
});

/**
 * Handler optionnel : Lister les imprimantes disponibles
 */
ipcMain.handle("get-available-printers", async () => {
    try {
        const command = `powershell -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"`;
        const output = execSync(command, { encoding: 'utf-8', timeout: 3000 });
        const printers = JSON.parse(output);
        
        // S'assurer que c'est toujours un tableau
        const printerList = Array.isArray(printers) ? printers : [printers];
        
        return { 
            success: true, 
            printers: printerList.map(p => ({
                name: p.Name,
                status: p.PrinterStatus
            }))
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// ==========================================
// 📤 EXPORTS (si vous utilisez des modules)
// ==========================================
module.exports = {
    setupPrintHandlers: () => {
        console.log('[Impression] Handlers installés');
        console.log(`[Impression] Imprimante par défaut: ${POS_PRINTER_NAME}`);
    }
};