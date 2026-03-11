import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { getPosUrl, getRestaurantId } from "@/utils/serverConfig";
import Feather from "@expo/vector-icons/Feather";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useBorneSync } from "@/hooks/useBorneSync.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKioskTheme } from "@/contexts/KioskThemeContext";
import axios from "axios";

const INACTIVITY_LIMIT = 15 * 60 * 1000;

const DANGER = "#EF4444";
const SUCCESS = "#22C55E";
const MUTED = "#64748B";

export default function MenuScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const theme = useKioskTheme();

  const { categories, menus, isLoading, fetchAndCacheAllData } = useBorneSync();
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // ── Cart ──────────────────────────────────────────────────────────
  const [orderList, setOrderList] = useState<any[]>([]);

  const refreshCart = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("orderList");
      setOrderList(stored ? JSON.parse(stored) : []);
    } catch { setOrderList([]); }
  }, []);

  const updateCart = async (newList: any[]) => {
    setOrderList(newList);
    await AsyncStorage.setItem("orderList", JSON.stringify(newList));
  };

  const changeQuantity = (index: number, delta: number) => {
    const newList = [...orderList];
    const qty = newList[index].quantity + delta;
    if (qty > 0) { newList[index].quantity = qty; updateCart(newList); }
    else { updateCart(newList.filter((_, i) => i !== index)); }
  };

  const removeItem = (index: number) => updateCart(orderList.filter((_, i) => i !== index));

  const calculateMenuPrice = (item: any) => {
    const base = parseFloat(item.price) || 0;
    const extras = item.steps?.reduce((s: number, step: any) =>
      s + step.selectedOptions.reduce((o: number, opt: any) => o + (parseFloat(opt.optionPrice) || 0), 0), 0) || 0;
    return base + extras;
  };

  const totalPrice = useMemo(
    () => orderList.reduce((acc, item) => acc + calculateMenuPrice(item) * item.quantity, 0),
    [orderList]
  );

  const cartCount = useMemo(
    () => orderList.reduce((acc, item) => acc + (item.quantity || 1), 0),
    [orderList]
  );

  // ── Cross-sell ────────────────────────────────────────────────────
  const [crossSellItems, setCrossSellItems] = useState<any[]>([]);
  const [showCrossSell, setShowCrossSell] = useState(false);
  const [crossSellQty, setCrossSellQty] = useState<Record<number, number>>({});

  const fetchCrossSell = async () => {
    try {
      const restaurantId = getRestaurantId();
      if (!restaurantId) return;
      const res = await axios.get(
        `${getPosUrl()}/menu/api/crosssell/?restaurant_id=${restaurantId}`,
        { timeout: 4000 }
      );
      setCrossSellItems(res.data || []);
    } catch { /* silencieux */ }
  };

  const proceedToPayment = async (list: any[]) => {
    const formattedOrder = list.map((order) => ({
      menu: order.menuId,
      quantity: order.quantity,
      solo: order.solo || false,
      extra: order.extra || false,
      options: order.steps?.flatMap((s: any) =>
        s.selectedOptions.map((o: any) => ({ step: s.stepId, option: o.optionId }))
      ) || [],
    }));
    await AsyncStorage.setItem("pendingOrder", JSON.stringify(formattedOrder));
    router.push("/order/location");
  };

  const handleValidateCart = () => {
    if (orderList.length === 0) return;
    if (crossSellItems.length > 0) {
      setCrossSellQty({});
      setShowCrossSell(true);
    } else {
      proceedToPayment(orderList);
    }
  };

  const handleCrossSellConfirm = async () => {
    const extras = Object.entries(crossSellQty)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = crossSellItems.find((i) => i.id === parseInt(id));
        return { menuId: item.id, menuName: item.name, price: parseFloat(item.price), quantity: qty, extra: true, solo: false, steps: [] };
      });
    const updated = [...orderList, ...extras];
    await updateCart(updated);
    setShowCrossSell(false);
    proceedToPayment(updated);
  };

  // ── Inactivity timer ──────────────────────────────────────────────
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = async (auto = false) => {
    try {
      if (auto) console.log("Déconnexion automatique");
      const serverUrl = await AsyncStorage.getItem("SERVER_URL_KEY");
      const restaurantId = await AsyncStorage.getItem("RESTAURANT_ID_KEY");
      await AsyncStorage.clear();
      if (serverUrl) await AsyncStorage.setItem("SERVER_URL_KEY", serverUrl);
      if (restaurantId) await AsyncStorage.setItem("RESTAURANT_ID_KEY", restaurantId);
      router.replace("/");
    } catch (e) { console.error("Erreur logout:", e); }
  };

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => performLogout(true), INACTIVITY_LIMIT);
  }, []);

  const handleUserActivity = () => resetInactivityTimer();

  const handleLogoutPress = () => {
    if (Platform.OS === "web") {
      performLogout();
    } else {
      Alert.alert("Déconnexion", "Voulez-vous vraiment quitter le terminal ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnexion", style: "destructive", onPress: () => performLogout() },
      ]);
    }
  };

  // ── Refresh ───────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await AsyncStorage.setItem("steps_cache_invalidated", "true");
      await fetchAndCacheAllData();
      const token = await AsyncStorage.getItem("token");
      if (getPosUrl() && token) {
        await fetch(`${getPosUrl()}/api/sync/force-refresh/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally { setIsRefreshing(false); }
  };

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCrossSell();
    resetInactivityTimer();
    return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, []);

  // Rafraîchir le panier à chaque fois qu'on revient sur cet écran (ex: retour de /order/step)
  useFocusEffect(useCallback(() => { refreshCart(); }, [refreshCart]));

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) setSelectedCategory(categories[0]);
  }, [categories]);

  // ── Solo/Menu modal ───────────────────────────────────────────────
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const handleAddToCart = async (item: any) => {
    handleUserActivity();
    if (item.extra) {
      const existing = [...orderList];
      const idx = existing.findIndex((o) => o.menuId === item.id && o.extra === true);
      if (idx !== -1) existing[idx].quantity += 1;
      else existing.push({ menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0, steps: [] });
      await updateCart(existing);
    } else if (item.offer_menu_choice === false) {
      router.push({ pathname: "/order/step", params: { menuId: item.id, menuName: item.name, price: item.solo_price || item.price || 0, isSolo: "false" } });
    } else {
      setSelectedItem(item);
      setIsModalVisible(true);
    }
  };

  const handleSoloAdd = () => {
    if (!selectedItem) return;
    setIsModalVisible(false);
    router.push({ pathname: "/order/step", params: { menuId: selectedItem.id, menuName: selectedItem.name, price: selectedItem.solo_price || selectedItem.price || 0, isSolo: "true" } });
  };

  const handleMenuAdd = () => {
    if (!selectedItem) return;
    setIsModalVisible(false);
    router.push({ pathname: "/order/step", params: { menuId: selectedItem.id, menuName: selectedItem.name, price: selectedItem.price || 0, isSolo: "false" } });
  };

  // ── Layout ────────────────────────────────────────────────────────
  const screenWidth = Dimensions.get("window").width;
  const SIDEBAR_W = 130;
  const CART_W = 280;
  const menuAreaW = screenWidth - SIDEBAR_W - CART_W;
  const numCols = menuAreaW >= 600 ? 3 : 2;
  const cardW = (menuAreaW - 16 * (numCols + 1)) / numCols;

  const filteredMenus = menus.filter(
    (item) => item.group_menu === selectedCategory?.id && item.avalaible &&
      categories.some((c) => c.id === item.group_menu && c.avalaible)
  );

  // ── Render menu card ──────────────────────────────────────────────
  const renderMenuCard = (item: any) => {
    const imageSource = item.photo ? { uri: `${getPosUrl()}${item.photo}` } : require("@/assets/logo.png");
    const price = item.extra ? `+${item.solo_price}` : item.price && parseFloat(item.price) > 0 ? item.price : item.solo_price;
    const style = theme.cardStyle || "gradient";

    if (style === "macdo") {
      return (
        <TouchableOpacity key={item.id} style={[styles.card, { width: cardW, backgroundColor: theme.cardBgColor }]} onPress={() => handleAddToCart(item)} activeOpacity={0.85}>
          <Image source={imageSource} style={{ width: "100%", height: cardW * 0.6 }} resizeMode="cover" />
          <View style={{ padding: 8 }}>
            <Text style={{ color: theme.textColor, fontWeight: "700", fontSize: 12 }} numberOfLines={2}>{item.name}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <Text style={{ color: theme.secondaryColor, fontWeight: "900", fontSize: 13 }}>{price} DA</Text>
              <View style={[styles.addBtn, { backgroundColor: theme.secondaryColor }]}><Feather name="plus" size={14} color="white" /></View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (style === "magazine") {
      return (
        <TouchableOpacity key={item.id} style={[styles.card, { width: cardW, aspectRatio: 0.8 }]} onPress={() => handleAddToCart(item)} activeOpacity={0.85}>
          <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={{ position: "absolute", top: 8, left: 8, right: 8, backgroundColor: "rgba(15,23,42,0.65)", borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ backgroundColor: theme.secondaryColor, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 }}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>{price} DA</Text>
            </View>
            <View style={{ backgroundColor: "white", width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" }}>
              <Feather name="plus" size={16} color={theme.primaryColor} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // gradient (défaut)
    return (
      <TouchableOpacity key={item.id} style={[styles.card, { width: cardW, aspectRatio: 0.75 }]} onPress={() => handleAddToCart(item)} activeOpacity={0.85}>
        <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={styles.cardOverlay}>
          <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.secondaryColor, fontWeight: "900", fontSize: 14 }}>{price} DA</Text>
            <View style={[styles.addBtn, { backgroundColor: theme.secondaryColor }]}><Feather name="plus" size={14} color="white" /></View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
        <Text style={{ fontSize: 18, color: MUTED, marginTop: 16, fontWeight: "600" }}>{t("terminal.loading_menus")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]} onTouchStart={handleUserActivity}>

      {/* ── TOP BAR ────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { backgroundColor: theme.primaryColor }]}>
        {theme.logoUrl
          ? <Image source={{ uri: theme.logoUrl }} style={styles.logo} resizeMode="contain" />
          : <Image source={require("@/assets/logo.png")} style={styles.logo} resizeMode="contain" />
        }
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity style={styles.topBtn} onPress={handleRefresh} disabled={isRefreshing}>
            {isRefreshing
              ? <ActivityIndicator size="small" color="white" />
              : <Feather name="refresh-cw" size={18} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.topBtn, { backgroundColor: "rgba(239,68,68,0.3)" }]} onPress={handleLogoutPress}>
            <Feather name="log-out" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <View style={styles.main}>

        {/* ── SIDEBAR CATÉGORIES ──────────────────────────────────── */}
        <ScrollView style={[styles.sidebar, { backgroundColor: theme.sidebarColor }]} contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
          {categories.filter((c) => c.avalaible).map((category) => {
            const isSelected = selectedCategory?.id === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.catBtn, { backgroundColor: isSelected ? theme.selectedCategoryBgColor : "transparent" }, isSelected && { borderLeftColor: theme.secondaryColor, borderLeftWidth: 3 }]}
                onPress={() => { handleUserActivity(); setSelectedCategory(category); }}
              >
                {category.photo && (
                  <Image
                    source={{ uri: `${getPosUrl()}${category.photo}` }}
                    style={styles.catImage}
                    resizeMode="contain"
                  />
                )}
                <Text style={[styles.catText, { color: isSelected ? "white" : theme.categoryTextColor }]} numberOfLines={2}>{category.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── GRILLE MENUS ────────────────────────────────────────── */}
        <View style={[styles.menuArea, { width: menuAreaW }]}>
          {filteredMenus.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="fast-food-outline" size={48} color={MUTED} />
              <Text style={{ color: MUTED, marginTop: 12, fontSize: 15 }}>{t("terminal.no_products")}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMenus}
              numColumns={numCols}
              key={numCols}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => renderMenuCard(item)}
              contentContainerStyle={{ padding: 12, gap: 12 }}
              columnWrapperStyle={numCols > 1 ? { gap: 12 } : undefined}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* ── PANEL PANIER ────────────────────────────────────────── */}
        <View style={styles.cartPanel}>
          {/* Header panier */}
          <View style={[styles.cartHeader, { backgroundColor: theme.primaryColor }]}>
            <Feather name="shopping-bag" size={16} color="white" />
            <Text style={styles.cartTitle}>Commande</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </View>

          {/* Liste des articles */}
          {orderList.length === 0 ? (
            <View style={styles.cartEmpty}>
              <Feather name="shopping-cart" size={36} color="#CBD5E1" />
              <Text style={styles.cartEmptyText}>Panier vide</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 8 }} showsVerticalScrollIndicator={false}>
              {orderList.map((item, index) => (
                <View key={index} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={2}>{item.menuName}</Text>
                    {item.steps?.map((step: any, i: number) => (
                      <Text key={i} style={styles.cartItemOption} numberOfLines={1}>
                        {step.stepName} : {step.selectedOptions.map((o: any) => o.optionName).join(", ")}
                      </Text>
                    ))}
                    <Text style={styles.cartItemPrice}>{(calculateMenuPrice(item) * item.quantity).toLocaleString()} DA</Text>
                  </View>
                  <View style={styles.cartItemRight}>
                    <TouchableOpacity onPress={() => removeItem(index)} style={styles.cartDeleteBtn}>
                      <Feather name="trash-2" size={13} color={DANGER} />
                    </TouchableOpacity>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, -1)}>
                        <AntDesign name="minus" size={12} color="#475569" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(index, 1)}>
                        <AntDesign name="plus" size={12} color="#475569" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Footer total + valider */}
          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={[styles.totalAmount, { color: theme.primaryColor }]}>{totalPrice.toLocaleString()} DA</Text>
            </View>
            <TouchableOpacity
              style={[styles.validateBtn, { backgroundColor: orderList.length === 0 ? "#CBD5E1" : SUCCESS }]}
              onPress={handleValidateCart}
              disabled={orderList.length === 0}
            >
              <Feather name="check-circle" size={18} color="white" />
              <Text style={styles.validateText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── MODAL SOLO / MENU ──────────────────────────────────────── */}
      <Modal animationType="fade" transparent visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            {selectedItem?.photo && (
              <Image source={{ uri: `${getPosUrl()}${selectedItem.photo}` }} style={styles.modalImage} resizeMode="cover" />
            )}
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
              <Text style={styles.modalDesc}>{selectedItem?.description || "Délicieuse préparation artisanale."}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setIsModalVisible(false)}>
                  <Feather name="x" size={16} color={MUTED} />
                  <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity style={styles.btnSolo} onPress={handleSoloAdd}>
                    <Text style={styles.btnSoloLabel}>Solo</Text>
                    <Text style={styles.btnSoloPrice}>{selectedItem?.solo_price || selectedItem?.price || 0} DA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnMenu, { backgroundColor: theme.primaryColor }]} onPress={handleMenuAdd}>
                    <Text style={styles.btnMenuLabel}>Menu</Text>
                    <Text style={styles.btnMenuPrice}>{selectedItem?.price || 0} DA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL CROSS-SELL ───────────────────────────────────────── */}
      <Modal visible={showCrossSell} transparent animationType="fade" onRequestClose={() => setShowCrossSell(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: "80%", maxWidth: 800, maxHeight: "80%" }]}>
            <View style={styles.csHeader}>
              <View>
                <Text style={[styles.csTitle, { color: theme.primaryColor }]}>Voulez-vous ajouter quelque chose ?</Text>
                <Text style={styles.csSubtitle}>Suggestions pour compléter la commande</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCrossSell(false)} style={styles.topBtn}>
                <Feather name="x" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.csGrid} showsVerticalScrollIndicator={false}>
              {crossSellItems.map((item) => {
                const qty = crossSellQty[item.id] || 0;
                return (
                  <View key={item.id} style={[styles.csCard, { backgroundColor: theme.cardBgColor }]}>
                    {item.photo_url
                      ? <Image source={{ uri: item.photo_url }} style={styles.csImage} resizeMode="cover" />
                      : <View style={[styles.csImage, { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" }]}><Ionicons name="fast-food" size={28} color={MUTED} /></View>
                    }
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textColor }} numberOfLines={2}>{item.name}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "900", color: theme.primaryColor, marginTop: 4 }}>{item.price} DA</Text>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingBottom: 12 }}>
                      {qty === 0 ? (
                        <TouchableOpacity style={[styles.csAddBtn, { backgroundColor: theme.primaryColor }]} onPress={() => setCrossSellQty(p => ({ ...p, [item.id]: 1 }))}>
                          <AntDesign name="plus" size={14} color="white" />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.csQtyRow}>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => setCrossSellQty(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}>
                            <AntDesign name="minus" size={12} color="#475569" />
                          </TouchableOpacity>
                          <Text style={{ fontWeight: "700", minWidth: 20, textAlign: "center" }}>{qty}</Text>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => setCrossSellQty(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))}>
                            <AntDesign name="plus" size={12} color="#475569" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.csFooter}>
              <TouchableOpacity style={styles.csSkip} onPress={() => { setShowCrossSell(false); proceedToPayment(orderList); }}>
                <Text style={{ color: MUTED, fontWeight: "700" }}>Non merci</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.csConfirm, { backgroundColor: SUCCESS }]} onPress={handleCrossSellConfirm}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
                  {Object.values(crossSellQty).some((q) => q > 0) ? "Ajouter et valider" : "Valider"}
                </Text>
                <AntDesign name="arrowright" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Top bar
  topBar: {
    height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, elevation: 4, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, zIndex: 10,
  },
  logo: { height: 40, width: 120 },
  topBtn: { padding: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)" },

  // Layout
  main: { flex: 1, flexDirection: "row" },

  // Sidebar
  sidebar: { width: 130, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.08)" },
  catBtn: {
    paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: 8, marginBottom: 4,
    borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "transparent", alignItems: "center",
  },
  catImage: { width: 70, height: 70, marginBottom: 6, borderRadius: 8 },
  catText: { fontSize: 12, fontWeight: "600", textAlign: "center" },

  // Menu grid
  menuArea: { flex: 1 },
  card: { borderRadius: 14, overflow: "hidden", backgroundColor: "transparent", elevation: 3, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8 },
  cardOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 10, paddingTop: 30 },
  cardText: { color: "white", fontWeight: "700", fontSize: 12, marginBottom: 6 },
  addBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },

  // Cart panel
  cartPanel: { width: 280, backgroundColor: "white", borderLeftWidth: 1, borderLeftColor: "#E2E8F0", flexDirection: "column" },
  cartHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  cartTitle: { color: "white", fontWeight: "700", fontSize: 14, flex: 1 },
  cartBadge: { backgroundColor: "white", borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  cartBadgeText: { fontSize: 11, fontWeight: "800", color: "#1e293b" },
  cartEmpty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  cartEmptyText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  cartItem: { flexDirection: "row", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  cartItemName: { fontSize: 13, fontWeight: "700", color: "#1e293b", lineHeight: 18 },
  cartItemOption: { fontSize: 10, color: MUTED, marginTop: 2 },
  cartItemPrice: { fontSize: 13, fontWeight: "800", color: "#1e293b", marginTop: 6 },
  cartItemRight: { alignItems: "center", gap: 8 },
  cartDeleteBtn: { padding: 4, backgroundColor: "#FEF2F2", borderRadius: 6 },
  qtyRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2 },
  qtyBtn: { width: 26, height: 26, justifyContent: "center", alignItems: "center" },
  qtyText: { fontSize: 13, fontWeight: "700", minWidth: 18, textAlign: "center", color: "#1e293b" },
  cartFooter: { borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 14, gap: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: MUTED, fontWeight: "600" },
  totalAmount: { fontSize: 22, fontWeight: "900" },
  validateBtn: { height: 50, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  validateText: { color: "white", fontWeight: "800", fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "white", borderRadius: 24, width: "65%", maxWidth: 700, overflow: "hidden", elevation: 20 },
  modalImage: { width: "100%", height: 220 },
  modalBody: { padding: 24 },
  modalTitle: { fontSize: 28, fontWeight: "900", color: "#1e293b", marginBottom: 10 },
  modalDesc: { fontSize: 15, color: MUTED, lineHeight: 22, marginBottom: 24 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 20 },
  modalCancel: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalCancelText: { color: MUTED, fontWeight: "600", fontSize: 15 },
  btnSolo: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center" },
  btnSoloLabel: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  btnSoloPrice: { fontSize: 12, color: MUTED },
  btnMenu: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, alignItems: "center" },
  btnMenuLabel: { fontSize: 15, fontWeight: "800", color: "white" },
  btnMenuPrice: { fontSize: 12, color: "rgba(255,255,255,0.75)" },

  // Cross-sell
  csHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  csTitle: { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  csSubtitle: { fontSize: 13, color: MUTED },
  csGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, padding: 16 },
  csCard: { width: 160, borderRadius: 14, overflow: "hidden", elevation: 3 },
  csImage: { width: "100%", height: 110 },
  csAddBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  csQtyRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2 },
  csFooter: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  csSkip: { flex: 1, height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" },
  csConfirm: { flex: 2, height: 50, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
});
