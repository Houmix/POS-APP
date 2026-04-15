import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, Dimensions, Modal, Image, ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKioskTheme } from "@/contexts/KioskThemeContext";
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";

const { width } = Dimensions.get("window");

const COLORS = {
  success: "#22C55E",
  danger: "#EF4444",
  muted: "#64748B",
  text: "#1E293B",
};

export default function CartPage() {
  const [orderList, setOrderList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [crossSellItems, setCrossSellItems] = useState<any[]>([]);
  const [showCrossSell, setShowCrossSell] = useState(false);
  const [crossSellQty, setCrossSellQty] = useState<Record<number, number>>({});

  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const theme = useKioskTheme();

  useEffect(() => {
    fetchCart();
    fetchCrossSellItems();
  }, []);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem("orderList");
      if (stored) setOrderList(JSON.parse(stored));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCrossSellItems = async () => {
    try {
      const restaurantId = getRestaurantId();
      if (!restaurantId) return;
      const res = await axios.get(
        `${getPosUrl()}/menu/api/crosssell/?restaurant_id=${restaurantId}`,
        { timeout: 4000 }
      );
      setCrossSellItems(res.data || []);
    } catch (e) {
      console.warn("Cross-sell fetch error:", e);
    }
  };

  const updateCart = async (newList: any[]) => {
    setOrderList(newList);
    await AsyncStorage.setItem("orderList", JSON.stringify(newList));
  };

  const changeQuantity = (index: number, delta: number) => {
    const newList = [...orderList];
    const newQty = newList[index].quantity + delta;
    if (newQty > 0) {
      newList[index].quantity = newQty;
      updateCart(newList);
    } else {
      removeMenu(index);
    }
  };

  const removeMenu = (index: number) => {
    const newList = orderList.filter((_, i) => i !== index);
    updateCart(newList);
  };

  const calculateMenuPrice = (menu: any) => {
    const base = parseFloat(menu.price) || 0;
    const extras = menu.steps?.reduce((sum: number, step: any) =>
      sum + step.selectedOptions.reduce((optSum: number, opt: any) => optSum + (parseFloat(opt.optionPrice) || 0), 0)
    , 0) || 0;
    return base + extras;
  };

  const totalPrice = useMemo(() => {
    return orderList.reduce((acc, item) => acc + (calculateMenuPrice(item) * item.quantity), 0);
  }, [orderList]);

  const handleValidatePress = () => {
    if (crossSellItems.length > 0) {
      setCrossSellQty({});
      setShowCrossSell(true);
    } else {
      proceedToPayment(orderList);
    }
  };

  const adjustCrossSellQty = (id: number, delta: number) => {
    setCrossSellQty(prev => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleCrossSellConfirm = async () => {
    const newItems = Object.entries(crossSellQty)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = crossSellItems.find(i => i.id === parseInt(id));
        return {
          menuId: item.id,
          menuName: item.name,
          price: parseFloat(item.price),
          quantity: qty,
          extra: true,
          solo: false,
          steps: [],
        };
      });

    const updatedList = [...orderList, ...newItems];
    await updateCart(updatedList);
    setShowCrossSell(false);
    proceedToPayment(updatedList);
  };

  const proceedToPayment = async (list: any[]) => {
    const formattedOrder = list.map(order => ({
      menu: order.menuId,
      quantity: order.quantity,
      solo: order.solo || false,
      extra: order.extra || false,
      options: order.steps?.flatMap((s: any) => s.selectedOptions.map((o: any) => ({ step: s.stepId, option: o.optionId }))) || [],
    }));
    await AsyncStorage.setItem("pendingOrder", JSON.stringify(formattedOrder));
    router.push("/order/location");
  };

  if (orderList.length === 0 && !isLoading) {
    return (
      <View style={[styles.emptyContainer, isRTL && { direction: 'rtl' }]}>
        <Ionicons name="cart-outline" size={100} color={COLORS.muted} />
        <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
        <Text style={styles.emptyMessage}>{t('cart.empty_message')}</Text>
        <TouchableOpacity style={[styles.startOrderButton, { backgroundColor: theme.primaryColor }]} onPress={() => router.push("/tabs/terminal")}>
          <Text style={styles.startOrderText}>{t('cart.start_order')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.backgroundColor }, isRTL && { direction: 'rtl' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/tabs/terminal")}>
          <AntDesign name={isRTL ? "arrowright" : "arrowleft"} size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cart.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={orderList}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[styles.cartItem, { backgroundColor: theme.cardBgColor }]}>
            <View style={styles.itemHeader}>
              <View style={{flex: 1}}>
                <Text style={[styles.itemName, { color: theme.textColor }]}>{item.menuName}</Text>
                <Text style={styles.itemPriceUnit}>
                  {calculateMenuPrice(item)} DA {t('cart.unit_price')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeMenu(index)} style={styles.deleteIcon}>
                <Feather name="trash-2" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              {item.steps?.map((step: any, i: number) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepName}>{step.stepName} : </Text>
                  <Text style={[styles.optionNames, { color: theme.textColor }]}>
                    {step.selectedOptions.map((o: any) => o.optionName).join(", ")}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, -1)}>
                  <AntDesign name="minus" size={20} color={theme.textColor} />
                </TouchableOpacity>
                <Text style={[styles.qtyValue, { color: theme.textColor }]}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, 1)}>
                  <AntDesign name="plus" size={20} color={theme.textColor} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.itemTotalPrice, { color: theme.primaryColor }]}>
                {(calculateMenuPrice(item) * item.quantity).toLocaleString()} DA
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footerCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('cart.total')}</Text>
          <Text style={[styles.totalAmount, { color: theme.textColor }]}>{totalPrice.toLocaleString()} DA</Text>
        </View>
        <TouchableOpacity style={[styles.payButton, { backgroundColor: COLORS.success }]} onPress={handleValidatePress}>
          <Text style={styles.payButtonText}>{t('cart.validate')}</Text>
          <AntDesign name={isRTL ? "arrowleft" : "arrowright"} size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* MODAL CROSS-SELL */}
      <Modal visible={showCrossSell} transparent animationType="fade" onRequestClose={() => setShowCrossSell(false)}>
        <View style={csStyles.overlay}>
          <View style={csStyles.dialog}>

            {/* Header */}
            <View style={csStyles.dialogHeader}>
              <View>
                <Text style={[csStyles.title, { color: theme.primaryColor }]}>Voulez-vous ajouter quelque chose ?</Text>
                <Text style={csStyles.subtitle}>Suggestions pour compléter la commande</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCrossSell(false)} style={csStyles.closeBtn}>
                <Feather name="x" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Grille d'articles */}
            <ScrollView contentContainerStyle={csStyles.itemsGrid} showsVerticalScrollIndicator={false}>
              {crossSellItems.map(item => {
                const qty = crossSellQty[item.id] || 0;
                return (
                  <View key={item.id} style={[csStyles.card, { backgroundColor: theme.cardBgColor }]}>
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={csStyles.itemImage} resizeMode="cover" />
                    ) : (
                      <View style={[csStyles.itemImage, csStyles.imagePlaceholder]}>
                        <Ionicons name="fast-food" size={36} color={theme.categoryTextColor} />
                      </View>
                    )}
                    <View style={csStyles.cardInfo}>
                      <Text style={[csStyles.itemName, { color: theme.textColor }]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[csStyles.itemPrice, { color: theme.primaryColor }]}>{item.price} DA</Text>
                    </View>
                    <View style={csStyles.qtyRow}>
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={[csStyles.addBtn, { backgroundColor: theme.primaryColor }]}
                          onPress={() => adjustCrossSellQty(item.id, 1)}
                        >
                          <AntDesign name="plus" size={18} color="white" />
                        </TouchableOpacity>
                      ) : (
                        <View style={csStyles.qtyControls}>
                          <TouchableOpacity style={csStyles.qtyBtn} onPress={() => adjustCrossSellQty(item.id, -1)}>
                            <AntDesign name="minus" size={16} color={theme.textColor} />
                          </TouchableOpacity>
                          <Text style={[csStyles.qtyValue, { color: theme.textColor }]}>{qty}</Text>
                          <TouchableOpacity style={csStyles.qtyBtn} onPress={() => adjustCrossSellQty(item.id, 1)}>
                            <AntDesign name="plus" size={16} color={theme.textColor} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View style={csStyles.footer}>
              <TouchableOpacity
                style={csStyles.skipBtn}
                onPress={() => { setShowCrossSell(false); proceedToPayment(orderList); }}
              >
                <Text style={csStyles.skipText}>Non merci</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[csStyles.confirmBtn, { backgroundColor: COLORS.success }]}
                onPress={handleCrossSellConfirm}
              >
                <Text style={csStyles.confirmText}>
                  {Object.values(crossSellQty).some(q => q > 0) ? 'Ajouter et valider' : 'Valider sans ajouter'}
                </Text>
                <AntDesign name="arrowright" size={20} color="white" />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, backgroundColor: 'white',
  },
  backButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  listContent: { padding: 16 },
  cartItem: {
    borderRadius: 20, padding: 20, marginBottom: 15,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 20, fontWeight: '700' },
  itemPriceUnit: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  deleteIcon: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  optionsList: { marginVertical: 15, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#E2E8F0' },
  stepRow: { flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' },
  stepName: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  optionNames: { fontSize: 13, flex: 1 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  qtyBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 18, fontWeight: '700', marginHorizontal: 15 },
  itemTotalPrice: { fontSize: 20, fontWeight: '800' },
  footerCard: {
    backgroundColor: 'white', padding: 25,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 16, color: COLORS.muted, fontWeight: '600' },
  totalAmount: { fontSize: 28, fontWeight: '900' },
  payButton: {
    height: 70, borderRadius: 20, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  payButtonText: { color: 'white', fontSize: 22, fontWeight: '800' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.muted, marginTop: 20, textAlign: 'center' },
  emptyMessage: { fontSize: 16, color: COLORS.muted, marginTop: 10, textAlign: 'center' },
  startOrderButton: { marginTop: 30, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15 },
  startOrderText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

const csStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  dialog: {
    backgroundColor: 'white', borderRadius: 28, width: '100%', maxWidth: 900,
    maxHeight: '85%', overflow: 'hidden',
    elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
  },
  dialogHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.muted },
  closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 20 },
  card: {
    width: (width - 200) / 4,
    minWidth: 160, maxWidth: 220,
    borderRadius: 16, overflow: 'hidden',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  itemImage: { width: '100%', height: 160, backgroundColor: '#F8F9FA' },
  imagePlaceholder: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { padding: 12, paddingBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '900' },
  qtyRow: { paddingHorizontal: 12, paddingBottom: 14, alignItems: 'flex-start' },
  addBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 2 },
  qtyBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 15, fontWeight: '700', marginHorizontal: 12 },
  footer: {
    flexDirection: 'row', gap: 14, padding: 20,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  skipBtn: {
    flex: 1, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  skipText: { fontSize: 16, fontWeight: '700', color: COLORS.muted },
  confirmBtn: {
    flex: 2, height: 60, borderRadius: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  confirmText: { fontSize: 16, fontWeight: '800', color: 'white' },
});
