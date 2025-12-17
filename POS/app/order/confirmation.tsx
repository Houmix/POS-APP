import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Assurez-vous que l'URL est bien importée
import { POS_URL } from '@/config'; 

// ==========================================
// 🖨️ FONCTION D'IMPRESSION (TEXTE BRUT)
// ==========================================
const handlePrinting = async (ticketContent) => {
    // Vérifie si l'API Electron est disponible
    if (!window.electronAPI?.printTicket) {
        console.error("❌ API Electron non disponible.");
        return { success: false, error: "API Electron non trouvée (mode web ?)" };
    }

    try {
        console.log("🖨️ Envoi du ticket à Electron...");
        
        // ⚠️ IMPORTANT : ticketContent doit être du TEXTE BRUT, pas du HTML
        // Le backend Django doit retourner du texte formaté, pas du HTML
        const result = await window.electronAPI.printTicket(ticketContent);
        
        if (result.success) {
            console.log(`✅ Impression réussie sur ${result.printer}`);
        } else {
            console.error(`❌ Échec impression: ${result.error}`);
        }
        
        return result; // { success: true, printer: "POS-80" } ou { success: false, error: "..." }

    } catch (error) {
        console.error("❌ Erreur IPC lors de l'impression:", error);
        return { success: false, error: error.message };
    }
};

export default function ConfirmationPage() {
    const router = useRouter(); 
    const [orderId, setOrderId] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Traitement de la commande...");

    // ==========================================
    // 🔹 LOGIQUE D'IMPRESSION
    // ==========================================
    const printTicket = async (id, token) => {
        if (!id || !token) {
            console.error("❌ Token ou ID manquant");
            setStatusMessage("Erreur : Token ou ID de commande manquant.");
            return false; 
        }

        setIsPrinting(true);
        setStatusMessage(`Impression du ticket pour commande n°${id}...`);

        try {
            console.log(`📡 Récupération du ticket depuis Django (Commande ${id})...`);
            
            // 1️⃣ Appel API Django pour récupérer le contenu du ticket
            const response = await axios.get(
                `${POS_URL}/order/api/generateTicket/${id}/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.status !== 200) {
                throw new Error(`Erreur ${response.status} lors de la récupération du ticket`);
            }

            // 2️⃣ Récupérer le contenu du ticket
            const ticketContent = response.data.ticket_content;
            
            if (!ticketContent) {
                throw new Error("Le ticket est vide");
            }

            console.log(`📄 Ticket reçu (${ticketContent.length} caractères)`);
            
            // ⚠️ VÉRIFICATION IMPORTANTE : Le contenu doit être du TEXTE BRUT
            if (ticketContent.includes('<html>') || ticketContent.includes('<!DOCTYPE')) {
                console.warn("⚠️ ATTENTION : Le backend retourne du HTML au lieu de texte brut !");
                console.warn("⚠️ Cela peut causer une impression blanche.");
                console.warn("⚠️ Modifiez votre backend Django pour retourner du texte brut.");
            }

            // 3️⃣ Envoyer à Electron pour impression
            const printResult = await handlePrinting(ticketContent);

            if (printResult.success) {
                console.log(`✅ Impression terminée sur ${printResult.printer}`);
                setStatusMessage(`✅ Impression réussie ! Redirection...`);
                return true;
            } else {
                console.error(`❌ Échec: ${printResult.error}`);
                setStatusMessage(`❌ Échec de l'impression : ${printResult.error}`);
                return false;
            }

        } catch (error) {
            console.error("❌ Erreur critique:", error);
            setStatusMessage(`❌ Erreur : ${error.message}`);
            return false;
        } finally {
            setIsPrinting(false);
        }
    };

    // ==========================================
    // 🔹 EFFETS DE CYCLE DE VIE
    // ==========================================

    // 1️⃣ Récupération des données depuis AsyncStorage
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = await AsyncStorage.getItem("token");
                const id = await AsyncStorage.getItem("lastOrderId");
                
                console.log(`📦 Données récupérées - ID: ${id}, Token: ${token ? 'présent' : 'absent'}`);
                
                setAccessToken(token);
                setOrderId(id);
            } catch (error) {
                console.error("❌ Erreur récupération données:", error);
                setStatusMessage("Erreur de chargement des données");
            }
        };
        fetchData();
    }, []);

    // 2️⃣ Déclenchement de l'impression et redirection
    useEffect(() => {
        let redirectTimer;
        
        const processAndRedirect = async () => {
            console.log("🚀 Démarrage du processus d'impression...");
            
            // Lancer l'impression
            const success = await printTicket(orderId, accessToken);
            
            // Délai avant redirection
            const delay = success ? 2000 : 4000; // 2s si succès, 4s si échec
            
            console.log(`⏱️ Redirection dans ${delay}ms...`);
            
            redirectTimer = setTimeout(() => {
                console.log("🔄 Redirection vers terminal...");
                AsyncStorage.removeItem("lastOrderId"); 
                router.push("/tabs/terminal"); 
            }, delay);
        };

        // Démarrer seulement si les données sont disponibles
        if (orderId && accessToken) {
            processAndRedirect();
        } else {
            console.log("⏳ En attente des données (orderId, accessToken)...");
        }

        // Nettoyage
        return () => {
            if (redirectTimer) {
                clearTimeout(redirectTimer);
                console.log("🧹 Timer de redirection nettoyé");
            }
        };
    }, [orderId, accessToken, router]); 

    // ==========================================
    // 🔹 RENDU
    // ==========================================
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Commande Confirmée !</Text>
            
            <View style={styles.statusBox}>
                {isPrinting && (
                    <ActivityIndicator 
                        size="large" 
                        color="#007bff" 
                        style={{marginBottom: 10}} 
                    />
                )}
                
                <Text style={styles.message}>
                    {statusMessage}
                </Text>

                {orderId && (
                    <Text style={styles.orderIdText}>
                        Numéro de commande: {orderId}
                    </Text>
                )}

                {/* Debug info (à retirer en production) */}
                {__DEV__ && (
                    <View style={styles.debugBox}>
                        <Text style={styles.debugText}>
                            🔧 Debug: electronAPI = {window.electronAPI ? '✅ Présent' : '❌ Absent'}
                        </Text>
                        <Text style={styles.debugText}>
                            Token: {accessToken ? '✅ OK' : '❌ Manquant'}
                        </Text>
                        <Text style={styles.debugText}>
                            Order ID: {orderId || 'N/A'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: 'green',
        marginBottom: 40,
    },
    statusBox: {
        alignItems: 'center',
        padding: 20,
        borderRadius: 10,
        backgroundColor: '#f5f5f5',
    },
    message: {
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    orderIdText: {
        fontSize: 16,
        color: '#666',
        marginTop: 10,
    },
    debugBox: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    debugText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#666',
        marginVertical: 2,
    },
});