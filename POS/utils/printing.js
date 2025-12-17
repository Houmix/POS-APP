// NOTE: L'objet 'window.electronAPI' est injecté par votre fichier main.js (voir Étape 3)
// Cette fonction doit être appelée dans votre composant React après la finalisation de la commande

const printTicket = async (orderId, ticketContent) => {
    if (!window.electronAPI) {
        console.error("L'API Electron n'est pas disponible. Mode Web ?");
        alert("Impression non disponible. Veuillez exécuter via Electron.");
        return;
    }

    try {
        console.log(`Tentative d'impression pour la commande ${orderId}...`);
        
        // Envoie le contenu du ticket au processus Main d'Electron
        // Le processus Main gérera la communication avec l'imprimante
        const success = await window.electronAPI.printTicket(ticketContent); 

        if (success) {
            console.log("Impression terminée avec succès.");
        } else {
            console.error("Échec de l'impression.");
        }
        return success;
        
    } catch (error) {
        console.error("Erreur IPC d'impression:", error);
        return false;
    }
};

// Exemple d'appel après la création de la commande :
// printTicket(orderId, response.data.ticket_content);