import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
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

    const eatin = async () => {
        try {
            const stored = await AsyncStorage.getItem("pendingOrder");
            if (stored) {
                const orderData = JSON.parse(stored);
                orderData.takeaway = false;
                await AsyncStorage.setItem("pendingOrder", JSON.stringify(orderData));
                console.log("Commande mise à jour pour Sur Place :", orderData);
                router.push("/order/pay");
            } else {
                setErrorMessage(t('errors.no_order'));
                Alert.alert(t('error'), t('errors.no_order'));
            }
        } catch (err) {
            console.error("Erreur lors de la mise à jour de la commande :", err);
            setErrorMessage(t('errors.loading_data'));
            Alert.alert(t('error'), t('errors.loading_data'));
        }
    };

    const takeaway = async () => {
        try {
            const stored = await AsyncStorage.getItem("pendingOrder");
            if (stored) {
                const orderData = JSON.parse(stored);
                orderData.takeaway = true;
                await AsyncStorage.setItem("pendingOrder", JSON.stringify(orderData));
                console.log("Commande mise à jour pour A Emporter :", orderData);
                router.push("/order/pay");
            } else {
                setErrorMessage(t('errors.no_order'));
                Alert.alert(t('error'), t('errors.no_order'));
            }
        } catch (err) {
            console.error("Erreur lors de la mise à jour de la commande :", err);
            setErrorMessage(t('errors.loading_data'));
            Alert.alert(t('error'), t('errors.loading_data'));
        }
    };

    return (
        <View style={[styles.main, isRTL && { direction: 'rtl' }]}>
            <View style={styles.titleBox}>
                <Text style={styles.title}>{t('location.title')}</Text>
            </View>

            <View style={styles.container}>
                <TouchableOpacity 
                    style={styles.box} 
                    onPress={() => eatin()}
                >
                    <Text style={styles.text}>{t('location.eat_in')}</Text>
                    <MaterialIcons name="table-restaurant" size={400} color="black" />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.box} 
                    onPress={() => takeaway()}
                >
                    <Text style={styles.text}>{t('location.takeaway')}</Text>
                    <MaterialIcons name="food-bank" size={400} color="black" />
                </TouchableOpacity>
            </View>

            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
        </View>
    );
}

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