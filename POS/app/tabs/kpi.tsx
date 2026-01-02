import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import axios from 'axios';
import { POS_URL, idRestaurant } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface KpiData {
    total_revenue: number;
    total_orders: number;
    average_cart: number;
    completed_orders: number;
    cancelled_orders: number;
    take_away_count: number;
}

export default function KPI() {
    const [data, setData] = useState<KpiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const restaurantId = idRestaurant; // Remplacez par l'ID réel du restaurant si nécessaire

    const fetchKpis = async () => {
        try {
            const token = await AsyncStorage.getItem("token");
            const response = await axios.get(`${POS_URL}/order/api/kpi/${restaurantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(response.data);
        } catch (error) {
            console.error("Erreur KPI:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchKpis();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchKpis();
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#007bff" style={styles.loader} />;
    }

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <Text style={styles.header}>Tableau de Bord KPI</Text>

            <View style={styles.grid}>
                {/* Chiffre d'affaires */}
                <View style={[styles.card, { borderLeftColor: '#28a745' }]}>
                    <Text style={styles.cardLabel}>Chiffre d'Affaires Total</Text>
                    <Text style={styles.cardValue}>{data?.total_revenue.toLocaleString()} DA</Text>
                </View>

                {/* Nombre de commandes */}
                <View style={[styles.card, { borderLeftColor: '#007bff' }]}>
                    <Text style={styles.cardLabel}>Commandes Totales</Text>
                    <Text style={styles.cardValue}>{data?.total_orders}</Text>
                </View>

                {/* Panier Moyen */}
                <View style={[styles.card, { borderLeftColor: '#ffc107' }]}>
                    <Text style={styles.cardLabel}>Panier Moyen</Text>
                    <Text style={styles.cardValue}>{data?.average_cart.toFixed(2)} DA</Text>
                </View>

                {/* Ventes à emporter */}
                <View style={[styles.card, { borderLeftColor: '#17a2b8' }]}>
                    <Text style={styles.cardLabel}>Ventes à Emporter</Text>
                    <Text style={styles.cardValue}>{data?.take_away_count}</Text>
                </View>
            </View>

            <View style={styles.statusSection}>
                <Text style={styles.subHeader}>Répartition des Statuts</Text>
                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>✅ Complétées: {data?.completed_orders}</Text>
                    <Text style={styles.statusText}>❌ Annulées: {data?.cancelled_orders}</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
    loader: { flex: 1, justifyContent: 'center' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
    subHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#666' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
        backgroundColor: '#fff',
        width: '48%',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderLeftWidth: 5,
        // Shadow for iOS/Android
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 5 },
    cardValue: { fontSize: 18, fontWeight: 'bold', color: '#222' },
    statusSection: { marginTop: 10, backgroundColor: '#fff', padding: 15, borderRadius: 10 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
    statusText: { fontSize: 16, fontWeight: '500' }
});