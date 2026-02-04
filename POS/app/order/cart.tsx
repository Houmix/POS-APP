import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#ff69b4",
  success: "#22C55E",
  danger: "#EF4444",
  bg: "#F8F9FA",
  card: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B"
};

export default function CartPage() {
  const [orderList, setOrderList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    fetchCart();
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

  const updateCart = async (newList) => {
    setOrderList(newList);
    await AsyncStorage.setItem("orderList", JSON.stringify(newList));
  };

  const changeQuantity = (index, delta) => {
    const newList = [...orderList];
    const newQty = newList[index].quantity + delta;
    if (newQty > 0) {
      newList[index].quantity = newQty;
      updateCart(newList);
    } else {
      removeMenu(index);
    }
  };

  const removeMenu = (index) => {
    const newList = orderList.filter((_, i) => i !== index);
    updateCart(newList);
  };

  const calculateMenuPrice = (menu) => {
    const base = parseFloat(menu.price) || 0;
    const extras = menu.steps?.reduce((sum, step) => 
      sum + step.selectedOptions.reduce((optSum, opt) => optSum + (parseFloat(opt.optionPrice) || 0), 0)
    , 0) || 0;
    return base + extras;
  };

  const totalPrice = useMemo(() => {
    return orderList.reduce((acc, item) => acc + (calculateMenuPrice(item) * item.quantity), 0);
  }, [orderList]);

  const handlePay = async () => {
    const formattedOrder = orderList.map(order => ({
      menu: order.menuId,
      quantity: order.quantity,
      // --- CORRECTION ICI ---
      // On transfère bien les propriétés solo et extra
      solo: order.solo || false, 
      extra: order.extra || false,
      // ---------------------
      options: order.steps?.flatMap(s => s.selectedOptions.map(o => ({ step: s.stepId, option: o.optionId }))) || []
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
        <TouchableOpacity style={styles.startOrderButton} onPress={() => router.push("/tabs/terminal")}>
          <Text style={styles.startOrderText}>{t('cart.start_order')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isRTL && { direction: 'rtl' }]}>
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
          <View style={styles.cartItem}>
            <View style={styles.itemHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.itemName}>{item.menuName}</Text>
                <Text style={styles.itemPriceUnit}>
                  {calculateMenuPrice(item)} DA {t('cart.unit_price')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeMenu(index)} style={styles.deleteIcon}>
                <Feather name="trash-2" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              {item.steps?.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepName}>{step.stepName} : </Text>
                  <Text style={styles.optionNames}>
                    {step.selectedOptions.map(o => o.optionName).join(", ")}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, -1)}>
                  <AntDesign name="minus" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, 1)}>
                  <AntDesign name="plus" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotalPrice}>
                {(calculateMenuPrice(item) * item.quantity).toLocaleString()} DA
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footerCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('cart.total')}</Text>
          <Text style={styles.totalAmount}>{totalPrice.toLocaleString()} DA</Text>
        </View>
        <TouchableOpacity style={styles.payButton} onPress={handlePay}>
          <Text style={styles.payButtonText}>{t('cart.validate')}</Text>
          <AntDesign name={isRTL ? "arrowleft" : "arrowright"} size={24} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20, 
    backgroundColor: 'white' 
  },
  backButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  
  listContent: { padding: 16 },
  cartItem: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 15,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  itemPriceUnit: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  deleteIcon: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  
  optionsList: { marginVertical: 15, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#E2E8F0' },
  stepRow: { flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' },
  stepName: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  optionNames: { fontSize: 13, color: COLORS.text, flex: 1 },
  
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  qtyBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 18, fontWeight: '700', marginHorizontal: 15 },
  itemTotalPrice: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  footerCard: { 
    backgroundColor: 'white', 
    padding: 25, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30,
    elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 16, color: COLORS.muted, fontWeight: '600' },
  totalAmount: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  payButton: { 
    backgroundColor: COLORS.success, 
    height: 70, 
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12 
  },
  payButtonText: { color: 'white', fontSize: 22, fontWeight: '800' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.muted, marginTop: 20, textAlign: 'center' },
  emptyMessage: { fontSize: 16, color: COLORS.muted, marginTop: 10, textAlign: 'center' },
  startOrderButton: { marginTop: 30, backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15 },
  startOrderText: { color: 'white', fontWeight: '700', fontSize: 16 }
});