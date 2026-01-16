import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { POS_URL } from '@/config'; 
import { useLanguage } from '@/contexts/LanguageContext';

// ==========================================
// 🖨️ FONCTION D'IMPRESSION (TEXTE BRUT)
// ==========================================
const handlePrinting = async (ticketContent) => {
    if (!window.electronAPI?.printTicket) {
        console.error("❌ API Electron non disponible.");
        return { success: false, error: "API Electron non trouvée (mode web ?)" };
    }

    try {
        console.log("🖨️ Envoi du ticket à Electron...");
        const result = await window.electronAPI.printTicket(ticketContent);
        
        if (result.success) {
            console.log(`✅ Impression réussie sur ${result.printer}`);
        } else {
            console.error(`❌ Échec impression: ${result.error}`);
        }
        
        return result;

    } catch (error) {
        console.error("❌ Erreur IPC lors de l'impression:", error);
        return { success: false, error: error.message };
    }
};

export default function ConfirmationPage() {
    const router = useRouter(); 
    const { t, isRTL } = useLanguage();
    const [orderId, setOrderId] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        setStatusMessage(t('confirmation.processing'));
    }, [t]);

    // ==========================================
    // 🔹 LOGIQUE D'IMPRESSION
    // ==========================================
    const printTicket = async (id, token) => {
        if (!id || !token) {
            console.error("❌ Token ou ID manquant");
            setStatusMessage(t('errors.loading_data'));
            return false; 
        }

        setIsPrinting(true);
        setStatusMessage(`${t('confirmation.printing')}${id}...`);

        try {
            console.log(`📡 Récupération du ticket depuis Django (Commande ${id})...`);
            
            const response = await axios.get(
                `${POS_URL}/order/api/generateTicket/${id}/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.status !== 200) {
                throw new Error(`Erreur ${response.status} lors de la récupération du ticket`);
            }

            const ticketContent = response.data.ticket_content;
            
            if (!ticketContent) {
                throw new Error(t('errors.loading_data'));
            }

            console.log(`📄 Ticket reçu (${ticketContent.length} caractères)`);
            
            if (ticketContent.includes('<html>') || ticketContent.includes('<!DOCTYPE')) {
                console.warn("⚠️ ATTENTION : Le backend retourne du HTML au lieu de texte brut !");
                console.warn("⚠️ Cela peut causer une impression blanche.");
                console.warn("⚠️ Modifiez votre backend Django pour retourner du texte brut.");
            }

            const printResult = await handlePrinting(ticketContent);

            if (printResult.success) {
                console.log(`✅ Impression terminée sur ${printResult.printer}`);
                setStatusMessage(t('confirmation.print_success'));
                return true;
            } else {
                console.error(`❌ Échec: ${printResult.error}`);
                setStatusMessage(`${t('confirmation.print_failed')} : ${printResult.error}`);
                return false;
            }

        } catch (error) {
            console.error("❌ Erreur critique:", error);
            setStatusMessage(`${t('error')} : ${error.message}`);
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
                setStatusMessage(t('errors.loading_data'));
            }
        };
        fetchData();
    }, []);

    // 2️⃣ Déclenchement de l'impression et redirection
    useEffect(() => {
        let redirectTimer;
        
        const processAndRedirect = async () => {
            console.log("🚀 Démarrage du processus d'impression...");
            
            const success = await printTicket(orderId, accessToken);
            
            const delay = success ? 2000 : 4000;
            
            console.log(`⏱️ Redirection dans ${delay}ms...`);
            
            redirectTimer = setTimeout(() => {
                console.log("🔄 Redirection vers terminal...");
                AsyncStorage.removeItem("lastOrderId"); 
                router.push("/tabs/terminal"); 
            }, delay);
        };

        if (orderId && accessToken) {
            processAndRedirect();
        } else {
            console.log("⏳ En attente des données (orderId, accessToken)...");
        }

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
        <View style={[styles.container, isRTL && { direction: 'rtl' }]}>
            <Text style={styles.title}>{t('confirmation.title')}</Text>
            
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
                        {t('confirmation.order_number')}: {orderId}
                    </Text>
                )}

                {/* Debug info (à retirer en production)
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
                )} */}
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
        textAlign: 'center',
    },
    statusBox: {
        alignItems: 'center',
        padding: 20,
        borderRadius: 10,
        backgroundColor: '#f5f5f5',
        minWidth: '60%',
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
        textAlign: 'center',
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