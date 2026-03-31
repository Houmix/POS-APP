import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPosUrl } from '@/utils/serverConfig';
import { useLanguage } from '@/contexts/LanguageContext';

// ==========================================
// 🖨️ FONCTION D'IMPRESSION SÉRIE (RS232)
// ==========================================
const handlePrinting = async (ticketContent, qrContent = '') => {
    // Vérification de l'API exposée par preload.js
    if (!window.electronAPI?.printTicket) {
        console.error("❌ API Electron non disponible.");
        return { success: false, error: "Lien avec le matériel manquant" };
    }

    try {
        console.log("🖨️ Envoi du ticket + QR code via Electron...");
        const result = await window.electronAPI.printTicket(ticketContent, qrContent);
        return result;
    } catch (error) {
        console.error("❌ Erreur de communication imprimante:", error);
        return { success: false, error: error.message };
    }
};

export default function ConfirmationPage() {
    const router = useRouter(); 
    const { t, isRTL } = useLanguage();
    const [isPrinting, setIsPrinting] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [orderId, setOrderId] = useState(null);

    // ==========================================
    // 🔹 LOGIQUE PRINCIPALE
    // ==========================================
    const processOrderAndPrint = async () => {
        try {
            // 1. Récupération des données locales
            const token = await AsyncStorage.getItem("token");
            const id = await AsyncStorage.getItem("lastOrderId");
            
            if (!id || !token) {
                throw new Error(t('errors.loading_data'));
            }

            setOrderId(id);
            setIsPrinting(true);
            setStatusMessage(`${t('confirmation.printing')}...`);

            // 2. Récupération du ticket et du contenu QR depuis Django
            console.log(`📡 Récupération data commande ${id}...`);
            const response = await axios.get(
                `${getPosUrl()}/order/api/generateTicket/${id}/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // On s'attend à recevoir ticket_content et qr_content (texte brut)
            const { ticket_content, qr_content } = response.data;

            if (!ticket_content) {
                throw new Error("Contenu du ticket vide.");
            }

            // 3. Impression ticket + QR code
            const printResult = await handlePrinting(ticket_content, qr_content || '');

            if (printResult.success) {
                console.log("✅ Impression et découpe terminées");
                setStatusMessage(t('confirmation.print_success'));
            } else {
                throw new Error(printResult.error);
            }

        } catch (error) {
            console.error("❌ Erreur Process:", error);
            setStatusMessage(`${t('confirmation.print_failed')} : ${error.message}`);
        } finally {
            setIsPrinting(false);
            // Redirection immédiate après impression
            await AsyncStorage.multiRemove(["lastOrderId", "orderList", "pendingOrder"]);
            router.push("/tabs/terminal");
        }
    };

    useEffect(() => {
        processOrderAndPrint();
    }, []);

    return (
        <View style={[styles.container, isRTL && { direction: 'rtl' }]}>
            <Text style={styles.title}>{t('confirmation.title')}</Text>
            
            <View style={styles.statusBox}>
                {isPrinting ? (
                    <ActivityIndicator size="large" color="#007bff" style={{marginBottom: 15}} />
                ) : (
                    <Text style={styles.successIcon}>✅</Text>
                )}
                
                <Text style={styles.message}>{statusMessage}</Text>

                {orderId && (
                    <Text style={styles.orderIdText}>
                        {t('confirmation.order_number')}: {orderId}
                    </Text>
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
        fontSize: 35,
        fontWeight: 'bold',
        color: '#28a745',
        marginBottom: 30,
        textAlign: 'center',
    },
    statusBox: {
        alignItems: 'center',
        padding: 30,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        width: '80%',
        elevation: 5,
    },
    successIcon: {
        fontSize: 50,
        marginBottom: 10,
    },
    message: {
        fontSize: 22,
        color: '#333',
        textAlign: 'center',
        fontWeight: '500',
    },
    orderIdText: {
        fontSize: 18,
        color: '#666',
        marginTop: 15,
        fontFamily: 'monospace',
    },
    footerNote: {
        marginTop: 50,
        fontSize: 16,
        color: '#999',
    }
});