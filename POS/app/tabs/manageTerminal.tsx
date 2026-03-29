import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator, Switch, SafeAreaView,
  Modal, TextInput, Alert,
} from "react-native";
import { TabView, TabBar } from "react-native-tab-view";
import { LayoutGrid, Utensils, Settings2, RefreshCcw, Package, AlertTriangle, PlusCircle, MinusCircle } from "lucide-react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPosUrl } from "@/utils/serverConfig";

// --- Styles Constants ---
const COLORS = {
  primary: "#756fbf",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#DC2626",
  background: "#F8F9FA",
  card: "#FFFFFF",
  text: "#2C3E50",
  muted: "#64748B",
};

// Types
interface StockItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  unit_display: string;
  status: 'ok' | 'low' | 'critical' | 'out';
  category: string | null;
  min_threshold: number;
  critical_threshold: number;
  cost_price: number;
}

export default function ManageTerminal() {
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [data, setData] = useState<{ menuGroups: any[]; menus: any[]; options: any[] }>({
    menuGroups: [], menus: [], options: [],
  });
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "stock", title: "Inventaire" },
    { key: "menuGroups", title: "Groupes" },
    { key: "menus", title: "Menus" },
    { key: "options", title: "Options" },
  ]);

  // Modal réappro
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [processing, setProcessing] = useState(false);

  // ─── FETCH MENU DATA ───
  const fetchMenuData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const resId = await AsyncStorage.getItem("Employee_restaurant_id");
      const headers = { Authorization: `Bearer ${token}` };

      const [groups, menus, opts] = await Promise.all([
        axios.get(`${getPosUrl()}/menu/api/getGroupMenuList/${resId}/`, { headers }),
        axios.get(`${getPosUrl()}/menu/api/getAllMenu/${resId}/`, { headers }),
        axios.get(`${getPosUrl()}/menu/api/getStepOption/${resId}/`, { headers }),
      ]);

      setData({ menuGroups: groups.data, menus: menus.data, options: opts.data });
    } catch (error) {
      console.error("Fetch Menu Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── FETCH STOCK DATA ───
  const fetchStockData = async () => {
    setStockLoading(true);
    try {
      const resId = await AsyncStorage.getItem("Employee_restaurant_id");
      if (!resId) return;

      const res = await axios.get(
        `${getPosUrl()}/api/stock/items/?restaurant_id=${resId}`,
        { timeout: 10000 }
      );
      if (res.data?.success) {
        setStockItems(res.data.items || []);
      }
    } catch (error) {
      console.error("Fetch Stock Error:", error);
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
    fetchStockData();
  }, []);

  // ─── TOGGLE MENU AVAILABILITY ───
  const toggleStatus = async (type: string, id: number, currentValue: boolean) => {
    setUpdatingId(id);
    try {
      const token = await AsyncStorage.getItem("token");
      const endpoints: Record<string, string> = {
        menuGroup: "updateGroupMenu",
        menu: "updateMenu",
        option: "updateStepOption",
      };

      await axios.put(
        `${getPosUrl()}/menu/api/${endpoints[type]}/`,
        { id, avalaible: !currentValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setData(prev => ({
        ...prev,
        [type + "s"]: prev[type + "s" as keyof typeof prev].map((item: any) =>
          item.id === id ? { ...item, avalaible: !currentValue } : item
        ),
      }));
    } catch (error) {
      alert("Erreur de mise à jour");
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── STOCK ACTIONS ───
  const openRestockModal = (item: StockItem) => {
    setSelectedItem(item);
    setRestockQty("");
    setShowRestockModal(true);
  };

  const handleRestock = async () => {
    if (!selectedItem) return;
    const qty = parseFloat(restockQty);
    if (!qty || qty <= 0) {
      Alert.alert("Erreur", "Entrez une quantité valide.");
      return;
    }
    setProcessing(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(
        `${getPosUrl()}/api/stock/restock/`,
        { stock_item_id: selectedItem.id, quantity: qty, reason: 'Réappro depuis POS' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      setShowRestockModal(false);
      Alert.alert("OK", `${qty} ${selectedItem.unit_display} ajouté(s) à "${selectedItem.name}"`);
      fetchStockData(); // Rafraîchir
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de réapprovisionner.");
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickAdjust = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    try {
      const token = await AsyncStorage.getItem("token");
      if (delta > 0) {
        await axios.post(
          `${getPosUrl()}/api/stock/restock/`,
          { stock_item_id: item.id, quantity: delta, reason: 'Ajustement rapide +1' },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
      } else {
        await axios.post(
          `${getPosUrl()}/api/stock/adjust/`,
          { stock_item_id: item.id, new_quantity: newQty, reason: 'Ajustement rapide -1', type: 'adjustment' },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
      }
      // Update local
      setStockItems(prev => prev.map(si =>
        si.id === item.id ? { ...si, quantity: newQty, status: getLocalStatus(newQty, si) } : si
      ));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Erreur d'ajustement.");
    }
  };

  const getLocalStatus = (qty: number, item: StockItem): StockItem['status'] => {
    if (qty <= 0) return 'out';
    if (qty <= item.critical_threshold) return 'critical';
    if (qty <= item.min_threshold) return 'low';
    return 'ok';
  };

  // ─── STATUS HELPERS ───
  const getStatusColor = (status: string) => {
    if (status === 'out') return COLORS.danger;
    if (status === 'critical') return COLORS.warning;
    if (status === 'low') return '#3B82F6';
    return COLORS.success;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'out') return 'ÉPUISÉ';
    if (status === 'critical') return 'CRITIQUE';
    if (status === 'low') return 'BAS';
    return 'OK';
  };

  // ─── RENDER: STOCK TAB ───
  const renderStockItem = ({ item }: { item: StockItem }) => {
    const color = getStatusColor(item.status);
    const isAlert = item.status !== 'ok';

    return (
      <View style={[styles.stockCard, isAlert && { borderLeftWidth: 4, borderLeftColor: color }]}>
        <View style={styles.stockInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.stockName}>{item.name}</Text>
            {isAlert && <AlertTriangle size={16} color={color} />}
          </View>
          <Text style={styles.stockCategory}>{item.category || 'Sans catégorie'}</Text>
        </View>

        <View style={styles.stockRight}>
          {/* Quantité avec boutons +/- */}
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => handleQuickAdjust(item, -1)}
            >
              <MinusCircle size={22} color={COLORS.danger} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openRestockModal(item)}>
              <View style={[styles.qtyBadge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                <Text style={[styles.qtyValue, { color }]}>{item.quantity}</Text>
                <Text style={[styles.qtyUnit, { color }]}>{item.unit_display}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => handleQuickAdjust(item, 1)}
            >
              <PlusCircle size={22} color={COLORS.success} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.statusTag, { color }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
    );
  };

  // ─── RENDER: MENU ITEMS ───
  const renderMenuItem = ({ item }: { item: any }, type: string) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={[styles.menuStatusTag, { color: item.avalaible ? COLORS.success : COLORS.danger }]}>
          {item.avalaible ? "En stock" : "Épuisé"}
        </Text>
      </View>

      {updatingId === item.id ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <Switch
          value={item.avalaible}
          onValueChange={() => toggleStatus(type, item.id, item.avalaible)}
          trackColor={{ false: "#D1D1D1", true: "#C4B5FD" }}
          thumbColor={item.avalaible ? COLORS.primary : "#f4f3f4"}
        />
      )}
    </View>
  );

  // ─── RENDER SCENES ───
  const renderScene = ({ route }: { route: { key: string } }) => {
    if (route.key === 'stock') {
      // Trier : épuisés d'abord, puis critiques, puis bas, puis OK
      const sorted = [...stockItems].sort((a, b) => {
        const order = { out: 0, critical: 1, low: 2, ok: 3 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });

      const alertCount = stockItems.filter(s => s.status !== 'ok').length;

      return (
        <View style={{ flex: 1 }}>
          {/* Bandeau résumé */}
          {alertCount > 0 && (
            <View style={styles.alertBanner}>
              <AlertTriangle size={18} color={COLORS.warning} />
              <Text style={styles.alertBannerText}>
                {alertCount} produit(s) nécessitent attention
              </Text>
            </View>
          )}

          <FlatList
            data={sorted}
            renderItem={renderStockItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshing={stockLoading}
            onRefresh={fetchStockData}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Package size={48} color={COLORS.muted} />
                <Text style={styles.emptyText}>Aucun article en stock</Text>
                <Text style={styles.emptySubtext}>Configurez vos stocks depuis l'admin Django</Text>
              </View>
            }
          />
        </View>
      );
    }

    // Onglets menu (Groupes, Menus, Options)
    const dataSource = route.key === "menuGroups" ? data.menuGroups : route.key === "menus" ? data.menus : data.options;
    const type = route.key.slice(0, -1);

    return (
      <FlatList
        data={dataSource}
        renderItem={(props) => renderMenuItem(props, type)}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchMenuData}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion du Stock</Text>
        <TouchableOpacity onPress={() => { fetchMenuData(); fetchStockData(); }}>
          <RefreshCcw size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: Dimensions.get("window").width }}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: COLORS.primary, height: 3 }}
            style={{ backgroundColor: 'white' }}
            labelStyle={{ color: COLORS.text, fontWeight: '700', fontSize: 12 }}
            activeColor={COLORS.primary}
            inactiveColor={COLORS.muted}
            renderLabel={({ route, focused }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: focused ? COLORS.primary : COLORS.muted, fontWeight: '700', fontSize: 12 }}>
                  {route.title}
                </Text>
                {route.key === 'stock' && stockItems.filter(s => s.status !== 'ok').length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {stockItems.filter(s => s.status !== 'ok').length}
                    </Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
      />

      {/* ═══════════ MODAL RÉAPPRO ═══════════ */}
      <Modal visible={showRestockModal} transparent animationType="fade" onRequestClose={() => setShowRestockModal(false)}>
        <View style={ms.overlay}>
          <View style={ms.dialog}>
            <Text style={ms.title}>Réapprovisionner</Text>
            <Text style={ms.subtitle}>{selectedItem?.name}</Text>
            <Text style={ms.currentQty}>
              Stock actuel : {selectedItem?.quantity} {selectedItem?.unit_display}
            </Text>

            <View style={ms.inputRow}>
              <TextInput
                style={ms.input}
                placeholder="Quantité à ajouter"
                keyboardType="numeric"
                value={restockQty}
                onChangeText={setRestockQty}
                autoFocus
              />
              <Text style={ms.unit}>{selectedItem?.unit_display}</Text>
            </View>

            {restockQty ? (
              <Text style={ms.preview}>
                Nouveau stock : {(selectedItem?.quantity || 0) + (parseFloat(restockQty) || 0)} {selectedItem?.unit_display}
              </Text>
            ) : null}

            <View style={ms.buttons}>
              <TouchableOpacity
                style={ms.cancelBtn}
                onPress={() => setShowRestockModal(false)}
              >
                <Text style={ms.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.confirmBtn, processing && { opacity: 0.5 }]}
                onPress={handleRestock}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={ms.confirmText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════ STYLES ═══════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  listContent: { padding: 16 },

  // Alert banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  alertBannerText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 14,
  },

  // Tab badge
  tabBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },

  // Stock card
  stockCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  stockInfo: { flex: 1 },
  stockName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stockCategory: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  stockRight: { alignItems: 'center', gap: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { padding: 4 },
  qtyBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  qtyValue: { fontSize: 22, fontWeight: '900' },
  qtyUnit: { fontSize: 12, fontWeight: '600' },
  statusTag: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  // Menu cards
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardInfo: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  menuStatusTag: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.muted },
  emptySubtext: { fontSize: 14, color: COLORS.muted },
});

// Modal styles
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 420,
  },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 16, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  currentQty: { fontSize: 14, color: COLORS.muted, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  input: {
    flex: 1,
    height: 52,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  unit: { fontSize: 16, color: COLORS.muted, fontWeight: '600' },
  preview: { fontSize: 14, color: COLORS.success, fontWeight: '700', marginBottom: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelText: { fontWeight: '700', color: COLORS.muted, fontSize: 16 },
  confirmBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.success,
  },
  confirmText: { fontWeight: '800', color: 'white', fontSize: 16 },
});
