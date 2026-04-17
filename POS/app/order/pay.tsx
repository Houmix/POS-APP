import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Feather } from "@expo/vector-icons";
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

// Types
interface StockAlert {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    status: 'low' | 'critical' | 'out';
    auto_disable: boolean;
}

export default function PaymentScreen() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const [order, setOrder] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Stock alerts
    const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
    const [showStockModal, setShowStockModal] = useState(false);
    const [restockQty, setRestockQty] = useState<Record<number, string>>({});
    const [processingStock, setProcessingStock] = useState(false);

    useEffect(() => {
        const loadOrder = async () => {
            const allKeys = await AsyncStorage.getAllKeys();
            const allItems = await AsyncStorage.multiGet(allKeys);
            console.log("Stored items in session:", allItems);
            try {
                const stored = await AsyncStorage.getItem("pendingOrder");
                if (stored) {
                    setOrder(JSON.parse(stored));
                } else {
                    setErrorMessage(t('errors.no_order'));
                }
            } catch (err) {
                setErrorMessage(t('errors.loading_data'));
            }
        };
        loadOrder();
    }, []);

    const processPayment = async (paymentMethod: number) => {
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            const Employee_id = await AsyncStorage.getItem("Employee_id");
            const restaurantId = getRestaurantId();

            // Lire le type de service depuis des clés AsyncStorage séparées (fiable)
            const takeawayValue = await AsyncStorage.getItem("orderTakeaway");
            const isTakeaway = takeawayValue === "true";
            const deliveryType = await AsyncStorage.getItem("orderDeliveryType") || 'sur_place';
            const customerIdentifier = await AsyncStorage.getItem("orderCustomerIdentifier") || '';

            const dataToSend = {
                user: Employee_id,
                items: order,
                restaurant: parseInt(restaurantId || "0", 10),
                takeaway: isTakeaway,
                delivery_type: deliveryType,
                customer_identifier: customerIdentifier,
            };

            console.log("Données à envoyer :", dataToSend);
            const accessToken = await AsyncStorage.getItem("token");

            const response = await axios.post(
                `${getPosUrl()}/order/api/createOrder/${paymentMethod}/`,
                dataToSend,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.status === 200 || response.status === 201) {
                await AsyncStorage.removeItem("pendingOrder");
                await AsyncStorage.removeItem("orderTakeaway");
                await AsyncStorage.removeItem("orderDeliveryType");
                await AsyncStorage.removeItem("orderCustomerIdentifier");
                await AsyncStorage.setItem("lastOrderId", response.data.order_id.toString());

                // Vérifier s'il y a des alertes stock
                const alerts: StockAlert[] = response.data.stock_alerts || [];
                if (alerts.length > 0) {
                    setStockAlerts(alerts);
                    setRestockQty({});
                    setShowStockModal(true);
                    // On ne redirige pas tout de suite — on attend la décision
                } else {
                    router.push("/order/confirmation");
                }

                // Sync en arrière-plan (non bloquant)
                try {
                    await window.syncAPI?.queueChange('order', 'create', order);
                    for (const item of (order as any).items || []) {
                        await window.syncAPI?.queueChange('order_item', 'create', item);
                    }
                } catch (syncErr) {
                    console.warn("Sync queue error (non-bloquant):", syncErr);
                }

                return order;
            } else {
                setErrorMessage(t('errors.create_order'));
                Alert.alert(t('error'), t('errors.create_order'));
            }
        } catch (error) {
            console.error("Erreur lors de la création de la commande", error);
            setErrorMessage(t('errors.create_order'));
            Alert.alert(t('error'), t('errors.network'));
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Actions stock ---

    const handleRestock = async (stockItemId: number) => {
        const qtyStr = restockQty[stockItemId];
        const qty = parseFloat(qtyStr);
        if (!qty || qty <= 0) {
            Alert.alert("Erreur", "Entrez une quantité valide.");
            return;
        }
        setProcessingStock(true);
        try {
            const accessToken = await AsyncStorage.getItem("token");
            await axios.post(
                `${getPosUrl()}/api/stock/restock/`,
                { stock_item_id: stockItemId, quantity: qty, reason: 'Réapprovisionnement depuis caisse' },
                { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
            );
            // Retirer cet item des alertes
            setStockAlerts(prev => prev.filter(a => a.id !== stockItemId));
            Alert.alert("OK", "Stock mis à jour !");
        } catch (e: any) {
            Alert.alert("Erreur", e?.message || "Impossible de mettre à jour le stock.");
        } finally {
            setProcessingStock(false);
        }
    };

    const handleMarkUnavailable = async (stockItemId: number, itemName: string) => {
        setProcessingStock(true);
        try {
            const accessToken = await AsyncStorage.getItem("token");
            // Mettre la quantité à 0 et le flag auto_disable fera le reste côté backend
            await axios.post(
                `${getPosUrl()}/api/stock/adjust/`,
                {
                    stock_item_id: stockItemId,
                    new_quantity: 0,
                    reason: `Marqué indisponible depuis caisse – ${itemName}`,
                    type: 'adjustment',
                },
                { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
            );
            // Retirer cet item des alertes
            setStockAlerts(prev => prev.filter(a => a.id !== stockItemId));
            Alert.alert("OK", `"${itemName}" marqué comme indisponible. Les produits liés seront désactivés.`);
        } catch (e: any) {
            Alert.alert("Erreur", e?.message || "Impossible de modifier le stock.");
        } finally {
            setProcessingStock(false);
        }
    };

    const handleCloseStockModal = () => {
        setShowStockModal(false);
        setStockAlerts([]);
        router.push("/order/confirmation");
    };

    const getStatusColor = (status: string) => {
        if (status === 'out') return '#DC2626';
        if (status === 'critical') return '#F59E0B';
        return '#3B82F6';
    };

    const getStatusLabel = (status: string) => {
        if (status === 'out') return 'ÉPUISÉ';
        if (status === 'critical') return 'CRITIQUE';
        return 'BAS';
    };

    const card = () => processPayment(1);
    const cash = () => processPayment(0);

    return (
        <View style={[styles.main, isRTL && { direction: 'rtl' }]}>
            <View style={styles.titleBox}>
                <Text style={styles.title}>{t('payment.title')}</Text>
            </View>

            <View style={styles.container}>
                <TouchableOpacity
                    style={[styles.box, isProcessing && styles.boxDisabled]}
                    onPress={cash}
                    disabled={isProcessing}
                >
                    <Text style={styles.text}>{t('payment.cash')}</Text>
                    <Ionicons name="cash-outline" size={400} color={isProcessing ? "#ccc" : "black"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.box, isProcessing && styles.boxDisabled]}
                    onPress={card}
                    disabled={isProcessing}
                >
                    <Text style={styles.text}>{t('payment.card')}</Text>
                    <AntDesign name="creditcard" size={400} color={isProcessing ? "#ccc" : "black"} />
                </TouchableOpacity>
            </View>

            {isProcessing && (
                <View style={styles.processingContainer}>
                    <Text style={styles.processingText}>{t('payment.processing')}</Text>
                </View>
            )}

            {errorMessage && !isProcessing ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}

            {/* ═══════════ MODAL ALERTE STOCK ═══════════ */}
            <Modal visible={showStockModal} transparent animationType="fade" onRequestClose={handleCloseStockModal}>
                <View style={ms.overlay}>
                    <View style={ms.dialog}>
                        {/* Header */}
                        <View style={ms.header}>
                            <View style={ms.headerIcon}>
                                <Feather name="alert-triangle" size={28} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={ms.headerTitle}>Alerte Stock</Text>
                                <Text style={ms.headerSubtitle}>
                                    {stockAlerts.length} produit(s) en stock bas ou épuisé
                                </Text>
                            </View>
                        </View>

                        {/* Liste des alertes */}
                        <ScrollView style={ms.body} contentContainerStyle={{ paddingBottom: 20 }}>
                            {stockAlerts.map(alert => (
                                <View key={alert.id} style={ms.alertCard}>
                                    {/* Info produit */}
                                    <View style={ms.alertHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={ms.alertName}>{alert.name}</Text>
                                            <Text style={ms.alertQty}>
                                                Restant : {alert.quantity} {alert.unit}
                                            </Text>
                                        </View>
                                        <View style={[ms.badge, { backgroundColor: getStatusColor(alert.status) + '20' }]}>
                                            <Text style={[ms.badgeText, { color: getStatusColor(alert.status) }]}>
                                                {getStatusLabel(alert.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Question */}
                                    <Text style={ms.question}>Il en reste encore ?</Text>

                                    {/* Actions */}
                                    <View style={ms.actions}>
                                        {/* OUI → Réapprovisionner */}
                                        <View style={ms.restockRow}>
                                            <TextInput
                                                style={ms.input}
                                                placeholder="Qté"
                                                keyboardType="numeric"
                                                value={restockQty[alert.id] || ''}
                                                onChangeText={text => setRestockQty(prev => ({ ...prev, [alert.id]: text }))}
                                            />
                                            <Text style={ms.unitLabel}>{alert.unit}</Text>
                                            <TouchableOpacity
                                                style={[ms.btnRestock, processingStock && { opacity: 0.5 }]}
                                                onPress={() => handleRestock(alert.id)}
                                                disabled={processingStock}
                                            >
                                                <Feather name="plus-circle" size={18} color="white" />
                                                <Text style={ms.btnText}>Réapprovisionner</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* NON → Retirer */}
                                        <TouchableOpacity
                                            style={[ms.btnRemove, processingStock && { opacity: 0.5 }]}
                                            onPress={() => handleMarkUnavailable(alert.id, alert.name)}
                                            disabled={processingStock}
                                        >
                                            <Feather name="x-circle" size={18} color="#DC2626" />
                                            <Text style={ms.btnRemoveText}>Non, retirer le produit (plus dispo)</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        {/* Footer */}
                        <TouchableOpacity style={ms.closeBtn} onPress={handleCloseStockModal}>
                            <Text style={ms.closeBtnText}>
                                {stockAlerts.length === 0 ? 'Continuer' : 'Ignorer et continuer'}
                            </Text>
                            <Feather name="arrow-right" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════ STYLES ═══════════

const styles = StyleSheet.create({
    main: {
        flex: 1,
        flexDirection: 'column',
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
    },
    titleBox: {
        height: "20%",
        flexDirection: "row",
        display: "flex",
        justifyContent: "center",
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    container: {
        height: "70%",
        width: "85%",
        flexDirection: "row",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        backgroundColor: "white",
    },
    box: {
        width: "48%",
        height: "90%",
        backgroundColor: "white",
        borderRadius: 15,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    boxDisabled: {
        opacity: 0.5,
    },
    title: {
        color: "#0056b3",
        fontSize: 38,
        fontWeight: "bold",
        textAlign: "center",
    },
    text: {
        color: "black",
        fontSize: 36,
        fontWeight: "bold",
        textDecorationLine: "none",
        marginBottom: 20,
    },
    processingContainer: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#e3f2fd',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2196f3',
    },
    processingText: {
        color: '#1976d2',
        fontSize: 16,
        fontWeight: '600',
    },
    errorContainer: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#ffebee',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorText: {
        color: '#c62828',
        fontSize: 16,
        fontWeight: '600',
    },
});

// Modal styles
const ms = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    dialog: {
        backgroundColor: 'white',
        borderRadius: 24,
        width: '100%',
        maxWidth: 650,
        maxHeight: '85%',
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 16,
    },
    headerIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1E293B',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    body: {
        padding: 20,
    },
    alertCard: {
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    alertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    alertName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    alertQty: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '800',
    },
    question: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 12,
    },
    actions: {
        gap: 10,
    },
    restockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        width: 80,
        height: 44,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        backgroundColor: 'white',
    },
    unitLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    btnRestock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#22C55E',
        height: 44,
        borderRadius: 12,
    },
    btnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
    },
    btnRemove: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FEF2F2',
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    btnRemoveText: {
        color: '#DC2626',
        fontWeight: '700',
        fontSize: 14,
    },
    closeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#3B82F6',
        margin: 20,
        marginTop: 0,
        height: 56,
        borderRadius: 16,
    },
    closeBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
    },
});
