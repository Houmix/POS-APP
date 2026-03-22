import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

export default function LocationScreen() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const [order, setOrder] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [customerIdentifier, setCustomerIdentifier] = useState("");

    useEffect(() => {
        const loadOrder = async () => {
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

    const selectLocation = async (deliveryType: 'sur_place' | 'emporter' | 'livraison') => {
        try {
            const stored = await AsyncStorage.getItem("pendingOrder");
            if (!stored) {
                Alert.alert(t('error'), t('errors.no_order'));
                return;
            }
            const orderData = JSON.parse(stored);
            orderData.takeaway = deliveryType !== 'sur_place';
            orderData.delivery_type = deliveryType;
            orderData.customer_identifier = customerIdentifier.trim();
            await AsyncStorage.setItem("pendingOrder", JSON.stringify(orderData));
            router.push("/order/pay");
        } catch (err) {
            console.error("Erreur location :", err);
            Alert.alert(t('error'), t('errors.loading_data'));
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.main}>
            <View style={styles.titleBox}>
                <Text style={styles.title}>{t('location.title')}</Text>
            </View>

            {/* Numéro de téléphone pour la fidélité */}
            <View style={styles.identifierBox}>
                <Text style={styles.identifierLabel}>📱 N° de téléphone (fidélité)</Text>
                <TextInput
                    style={styles.identifierInput}
                    placeholder="ex: 0550123456 — optionnel"
                    placeholderTextColor="#94a3b8"
                    value={customerIdentifier}
                    onChangeText={setCustomerIdentifier}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    maxLength={14}
                />
            </View>

            <View style={styles.container}>
                <TouchableOpacity style={styles.box} onPress={() => selectLocation('sur_place')}>
                    <Text style={styles.text}>Sur place</Text>
                    <MaterialIcons name="table-restaurant" size={120} color="#0056b3" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.box} onPress={() => selectLocation('emporter')}>
                    <Text style={styles.text}>À emporter</Text>
                    <MaterialIcons name="food-bank" size={120} color="#0056b3" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.box, styles.boxDelivery]} onPress={() => selectLocation('livraison')}>
                    <Text style={styles.text}>Livraison</Text>
                    <MaterialIcons name="delivery-dining" size={120} color="#f97316" />
                </TouchableOpacity>
            </View>

            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    main: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        paddingVertical: 30,
    },
    titleBox: {
        marginBottom: 10,
        paddingHorizontal: 20,
    },
    title: {
        color: "#0056b3",
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
    },
    identifierBox: {
        width: "80%",
        marginBottom: 24,
    },
    identifierLabel: {
        fontSize: 14,
        color: "#64748b",
        fontWeight: "600",
        marginBottom: 8,
    },
    identifierInput: {
        borderWidth: 1.5,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 16,
        color: "#0f172a",
        backgroundColor: "#f8fafc",
    },
    container: {
        flexDirection: "row",
        flexWrap: "wrap",
        width: "90%",
        justifyContent: "center",
        gap: 16,
    },
    box: {
        width: 200,
        height: 200,
        backgroundColor: "white",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 2,
        borderColor: "#e2e8f0",
    },
    boxDelivery: {
        borderColor: "#fed7aa",
        backgroundColor: "#fff7ed",
    },
    text: {
        color: "#0f172a",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10,
        textAlign: "center",
    },
    errorContainer: {
        marginTop: 20,
        backgroundColor: '#ffebee',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
        fontWeight: '600',
    },
});
