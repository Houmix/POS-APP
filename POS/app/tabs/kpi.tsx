import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  RefreshControl, SafeAreaView, Dimensions 
} from 'react-native';
import { 
  TrendingUp, ShoppingBag, CreditCard, 
  Package, CheckCircle2, XCircle, ChevronRight 
} from 'lucide-react-native';
import axios from 'axios';
import { POS_URL, idRestaurant } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Thème de couleurs "Modern Dashboard"
const COLORS = {
  primary: "#6366F1", // Indigo moderne
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  bg: "#F1F5F9",
  card: "#FFFFFF",
  textHeader: "#1E293B",
  textSub: "#64748B"
};

export default function KPI() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchKpis = async () => {
        try {
            const token = await AsyncStorage.getItem("token");
            const response = await axios.get(`${POS_URL}/order/api/kpi/${idRestaurant}`, {
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

    useEffect(() => { fetchKpis(); }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchKpis();
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loaderText}>Chargement des performances...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView 
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                {/* HEADER */}
                <View style={styles.headerSection}>
                    <Text style={styles.headerSubtitle}>Résumé des ventes</Text>
                    <Text style={styles.headerTitle}>Tableau de Bord</Text>
                </View>

                {/* MAIN KPI (Revenue) */}
                <View style={styles.mainCard}>
                    <View style={styles.mainCardContent}>
                        <View>
                            <Text style={styles.mainCardLabel}>Chiffre d'Affaires Total</Text>
                            <Text style={styles.mainCardValue}>
                                {data?.total_revenue?.toLocaleString()} <Text style={styles.currency}>DA</Text>
                            </Text>
                        </View>
                        <View style={styles.iconCircle}>
                            <TrendingUp color="white" size={28} />
                        </View>
                    </View>
                    <View style={styles.mainCardFooter}>
                        <Text style={styles.footerText}>Mise à jour en temps réel</Text>
                    </View>
                </View>

                {/* GRID KPI */}
                <View style={styles.grid}>
                    <KpiCard 
                        label="Commandes" 
                        value={data?.total_orders} 
                        icon={<ShoppingBag size={20} color={COLORS.info} />}
                        color={COLORS.info}
                    />
                    <KpiCard 
                        label="Panier Moyen" 
                        value={`${data?.average_cart?.toFixed(0)} DA`} 
                        icon={<CreditCard size={20} color={COLORS.warning} />}
                        color={COLORS.warning}
                    />
                    <KpiCard 
                        label="À Emporter" 
                        value={data?.take_away_count} 
                        icon={<Package size={20} color={COLORS.primary} />}
                        color={COLORS.primary}
                    />
                    <KpiCard 
                        label="Taux Succès" 
                        value={data?.total_orders > 0 ? `${((data.completed_orders / data.total_orders) * 100).toFixed(0)}%` : "0%"} 
                        icon={<CheckCircle2 size={20} color={COLORS.success} />}
                        color={COLORS.success}
                    />
                </View>

                {/* STATUS BREAKDOWN */}
                <Text style={styles.sectionTitle}>Détails des opérations</Text>
                <View style={styles.statusContainer}>
                    <StatusRow 
                        label="Commandes Complétées" 
                        count={data?.completed_orders} 
                        color={COLORS.success} 
                        icon={<CheckCircle2 size={18} color={COLORS.success} />}
                    />
                    <View style={styles.divider} />
                    <StatusRow 
                        label="Commandes Annulées" 
                        count={data?.cancelled_orders} 
                        color={COLORS.danger} 
                        icon={<XCircle size={18} color={COLORS.danger} />}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Composants internes pour la lisibilité
const KpiCard = ({ label, value, icon, color }) => (
    <View style={styles.smallCard}>
        <View style={[styles.smallIconBg, { backgroundColor: color + '15' }]}>
            {icon}
        </View>
        <Text style={styles.smallLabel}>{label}</Text>
        <Text style={styles.smallValue}>{value}</Text>
    </View>
);

const StatusRow = ({ label, count, color, icon }) => (
    <View style={styles.statusRow}>
        <View style={styles.statusInfo}>
            {icon}
            <Text style={styles.statusLabel}>{label}</Text>
        </View>
        <Text style={[styles.statusCount, { color }]}>{count}</Text>
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },
    container: { flex: 1, padding: 20 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
    loaderText: { marginTop: 10, color: COLORS.textSub, fontWeight: '500' },
    
    headerSection: { marginBottom: 25 },
    headerSubtitle: { color: COLORS.textSub, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    headerTitle: { color: COLORS.textHeader, fontSize: 28, fontWeight: '800' },

    mainCard: { 
        backgroundColor: COLORS.primary, 
        borderRadius: 20, 
        padding: 20, 
        marginBottom: 20,
        elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10
    },
    mainCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mainCardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    mainCardValue: { color: 'white', fontSize: 32, fontWeight: '800', marginTop: 5 },
    currency: { fontSize: 16, fontWeight: '400' },
    iconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 15 },
    mainCardFooter: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    footerText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    smallCard: { 
        backgroundColor: 'white', width: (width - 55) / 2, padding: 16, borderRadius: 18, marginBottom: 15,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5
    },
    smallIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    smallLabel: { color: COLORS.textSub, fontSize: 13, fontWeight: '600' },
    smallValue: { color: COLORS.textHeader, fontSize: 18, fontWeight: '700', marginTop: 4 },

    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textHeader, marginTop: 10, marginBottom: 15 },
    statusContainer: { backgroundColor: 'white', borderRadius: 18, padding: 5, marginBottom: 30 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    statusInfo: { flexDirection: 'row', alignItems: 'center' },
    statusLabel: { marginLeft: 12, color: COLORS.textHeader, fontWeight: '600', fontSize: 15 },
    statusCount: { fontSize: 16, fontWeight: '700' },
    divider: { height: 1, backgroundColor: COLORS.bg, marginHorizontal: 15 }
});