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
  Platform
} from "react-native";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import { POS_URL } from "@/config"; 
import Feather from '@expo/vector-icons/Feather'; 
import { useBorneSync } from "@/hooks/useBorneSync.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

// ⏱️ TEMPS D'INACTIVITÉ (15 minutes en millisecondes)
const INACTIVITY_LIMIT = 15 * 60 * 1000; 

export default function MenuScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  
  // États des données
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartCount, setCartCount] = useState(0); 
  
  // États des Modales
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  
  // Hook de synchronisation
  const { categories, menus, isLoading } = useBorneSync();

  // ⏱️ VARIABLE DE RÉFÉRENCE POUR LE TIMER
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- CALCULS DE LAYOUT ---
  const width = Dimensions.get("window").width;
  const itemMargin = width > 700 ? 20 : 10;
  const numColumns = width >= 700 ? 3 : width >= 500 ? 2 : 1;
  const sidebarPercent = width > 700 ? 25 : 30; 
  const sidebarWidth = `${sidebarPercent}%`;
  const menuGridWidth = 100 - sidebarPercent;
  const innerGridWidth = (width * menuGridWidth / 100);
  const itemWidth = (innerGridWidth - itemMargin * (numColumns + 1)) / numColumns;

  // ✅ FONCTION DE DÉCONNEXION (Utilisée par le bouton et le timer)
  const performLogout = async (auto = false) => {
    try {
        await AsyncStorage.clear();
        if (auto) console.log("Déconnexion automatique par inactivité");
        router.replace("/");
    } catch (e) {
        console.error("Erreur logout:", e);
    }
  };

  // ✅ GESTIONNAIRE DU TIMER
  const resetInactivityTimer = useCallback(() => {
    // 1. On efface le timer précédent s'il existe
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // 2. On lance un nouveau timer de 15 min
    inactivityTimerRef.current = setTimeout(() => {
      // Action à effectuer après 15 min
      performLogout(true); 
    }, INACTIVITY_LIMIT);
  }, []);

  // ✅ DÉTECTION D'ACTIVITÉ (Appelé à chaque touch sur l'écran)
  const handleUserActivity = () => {
    resetInactivityTimer();
  };

  // ✅ EFFET : Lancer le timer au montage du composant
  useEffect(() => {
    resetInactivityTimer(); // Premier lancement

    // Nettoyage si on quitte la page
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  // --- BOUTON MANUEL DE DÉCONNEXION ---
  const handleLogoutPress = async () => {
    if (Platform.OS === 'web') { 
            performLogout();
    } else {
        Alert.alert(
            "Déconnexion",
            "Voulez-vous vraiment quitter le terminal ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Déconnexion", style: 'destructive', onPress: () => performLogout() }
            ]
        );
    }
  };
  
  // --- LOGIQUE PANIER ET MENU ---
  const updateCartCount = async () => {
    try {
      const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
      const count = existingOrders.reduce((total, item) => total + (item.quantity || 1), 0);
      setCartCount(count);
    } catch (error) {
      setCartCount(0);
    }
  };

  useEffect(() => {
    updateCartCount();
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories]);

  const handleOpenModal = (item) => {
    handleUserActivity(); 
    setSelectedItemForModal(item);
    setIsModalVisible(true);
  };
  
  const handleSoloAdd = () => {
    if (!selectedItemForModal) return;
    handleUserActivity();
    const item = selectedItemForModal;
    setIsModalVisible(false);

    // On envoie le client vers la composition AVEC le mode Solo activé
    router.push({
        pathname: "/order/step",
        params: { 
            menuId: item.id, 
            menuName: item.name, 
            price: item.solo_price || item.price || 0, 
            isSolo: 'true' // <--- C'est ce mot magique qui dira à step.tsx de cacher les boissons/frites
        },
    });
  };

  const handleMenuAdd = () => {
    if (!selectedItemForModal) return;
    handleUserActivity(); 
    const item = selectedItemForModal;
    setIsModalVisible(false);

    // On envoie le client vers la composition en mode Menu complet (par défaut)
    router.push({
        pathname: "/order/step",
        params: { 
            menuId: item.id, 
            menuName: item.name, 
            price: item.price || 0, 
            isSolo: 'false'
        },
    });
  };

  const handleAddToCart = async (item) => {
    handleUserActivity(); 
    if (item.extra) {
      try {
        const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
        
        // On vérifie si cet Extra existe déjà dans le panier
        const existingIndex = existingOrders.findIndex(order => 
            order.menuId === item.id && order.extra === true
        );

        if (existingIndex !== -1) {
            // S'il existe, on augmente la quantité
            existingOrders[existingIndex].quantity += 1;
        } else {
            // Sinon on crée une nouvelle entrée
            existingOrders.push({ 
                menuId: item.id, 
                menuName: item.name, 
                extra: true, 
                quantity: 1, 
                price: item.price || 0,
                steps: [] // Toujours mettre un array vide pour éviter les erreurs de lecture
            });
        }

        await AsyncStorage.setItem("orderList", JSON.stringify(existingOrders));
        await updateCartCount();
        
        Alert.alert(t('terminal.added_success'), `${item.name} ${t('terminal.added_extra')}`, [{ text: "OK", onPress: resetInactivityTimer }]);
      } catch (error) {
        Alert.alert(t('error'), t('errors.add_cart'));
      }
    } else {
      handleOpenModal(item);
    }
  };

  const ChoiceModal = () => {
    if (!selectedItemForModal) return null;
    return (
      <Modal 
        animationType="slide" 
        transparent={true} 
        visible={isModalVisible} 
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity 
          style={modalStyles.centeredView} 
          activeOpacity={1} 
          onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={modalStyles.productCard}>
            {selectedItemForModal.photo && (
              <Image 
                source={{ uri: `${POS_URL}${selectedItemForModal.photo}` }} 
                style={modalStyles.productImageFull} 
                resizeMode="cover" 
              />
            )}

            <View style={modalStyles.productDetails}>
              <Text style={modalStyles.modalTitle}>{selectedItemForModal.name}</Text>
              
              <View style={modalStyles.descriptionSection}>
                <Text style={modalStyles.descriptionText}>
                  {selectedItemForModal.description || "Délicieuse préparation artisanale avec des produits frais sélectionnés avec soin."}
                </Text>
              </View>

              <View style={modalStyles.footerActions}>
                <TouchableOpacity 
                  style={modalStyles.backButton} 
                  onPress={() => setIsModalVisible(false)}
                >
                  <Feather name="arrow-left" size={20} color="#94a3b8" />
                  <Text style={modalStyles.backButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>

                <View style={modalStyles.mainButtons}>
                  <TouchableOpacity style={[modalStyles.actionBtn, modalStyles.btnSolo]} onPress={handleSoloAdd}>
                    <Text style={modalStyles.btnLabel}>{t('terminal.solo')}</Text>
                    <Text style={modalStyles.btnPrice}>{selectedItemForModal.solo_price || selectedItemForModal.price || 0} DA</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[modalStyles.actionBtn, modalStyles.btnMenu]} onPress={handleMenuAdd}>
                    <Text style={[modalStyles.btnLabel, { color: 'white' }]}>{t('terminal.in_menu')}</Text>
                    <Text style={modalStyles.btnSubtitle}>
                      {selectedItemForModal.price || 0} DA
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0056b3" /> 
        <Text style={styles.loadingText}>{t('terminal.loading_menus')}</Text>
      </View>
    );
  }
  
  const filteredMenus = menus.filter(
    (item) =>
      item.group_menu === selectedCategory?.id &&
      item.avalaible &&
      categories.some((category) => category.id === item.group_menu && category.avalaible)
  );

  return (
    <View 
      style={[styles.container, isRTL && { direction: 'rtl' }]} 
      // 🔥 DÉTECTION GLOBALE D'ACTIVITÉ : Reset le timer à chaque touche
      onTouchStart={handleUserActivity}
      onResponderGrant={handleUserActivity}
    >
      
      {/* HEADER AVEC DÉGRADÉ */}
      <LinearGradient
       colors={['#0056b3', '#ff69b4']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={styles.headerRight}>
          <LanguageSelector />
          <TouchableOpacity style={styles.cartButton} onPress={() => router.push("/order/cart")}>
            <Feather name="shopping-cart" size={35} color="white" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* BOUTON DÉCONNEXION MANUEL */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogoutPress}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} 
          >
             <Feather name="log-out" size={24} color="white" />
          </TouchableOpacity>

        </View>
      </LinearGradient>

      {/* Contenu principal */}
      <View style={styles.content}>
        
        {/* Sidebar catégories */}
        <ScrollView style={[styles.sidebar, { width: sidebarWidth }]} contentContainerStyle={styles.sidebarContent}>
          {categories.filter((category) => category.avalaible).map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory?.id === category.id && styles.selectedCategory,
                ]}
                onPress={() => {
                  handleUserActivity();
                  setSelectedCategory(category);
                }}
              >
                {category.photo && <Image source={{ uri: `${POS_URL}${category.photo}` }} style={styles.categoryImage} />}
                <Text style={[styles.categoryText, selectedCategory?.id === category.id && styles.selectedCategoryText]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        {/* Grille des menus */}
        <View style={[styles.menuGridContainer, { width: `${menuGridWidth}%` }]}>
          {filteredMenus.length === 0 ? (
            <View style={styles.emptyGrid}>
              <Text style={styles.emptyGridText}>{t('terminal.no_products')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMenus}
              numColumns={numColumns}
              key={numColumns} 
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.menuItem, { width: itemWidth, margin: itemMargin / 2 }]}
                  onPress={() => handleAddToCart(item)}
                >
                  {item.photo && <Image source={{ uri: `${POS_URL}${item.photo}` }} style={styles.menuImage} resizeMode="cover" />}
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuText} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.priceActionContainer}>
                      <Text style={styles.menuPrice}>
                        {/* CORRECTION : On affiche item.solo_price s'il existe, sinon on se rabat sur item.price */}
                        {item.extra == 1 
                          ? `+${item.solo_price}` 
                          : (item.price && parseFloat(item.price) > 0) 
                              ? `${item.price}` 
                              : `${item.solo_price}`
                        } 
                        <Text style={{fontSize: 14}}> DA</Text>
                      </Text>
                      <View style={styles.addButton}>
                        <Feather name="plus" size={20} color="white" />
                      </View>
                  </View>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.menuGrid}
            />
          )}
        </View>
      </View>
      
      <ChoiceModal />
      
    </View>
  );
}

const styles = StyleSheet.create({
  logoImage: { width: 250, height: 150 },
  container: { flex: 1, backgroundColor: "#F8F9FA" }, 
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" },
  loadingText: { fontSize: 24, textAlign: "center", marginTop: 20, color: "#1e293b", fontWeight: '600' },
  
  header: {
    height: 90, 
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", 
    paddingHorizontal: 25, elevation: 6, shadowColor: "#000", zIndex: 100 
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  cartButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  
  logoutButton: { 
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255, 0, 0, 0.25)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.3)' 
  },

  cartBadge: {
    position: 'absolute', right: -6, top: -6, backgroundColor: 'red', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white'
  },
  cartBadgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  
  content: { flex: 1, flexDirection: "row" },
  
  sidebar: { backgroundColor: "#1e293b", elevation: 5 }, 
  sidebarContent: { paddingVertical: 20, alignItems: "center" },
  categoryButton: {
    borderRadius: 10, padding: 10, width: "85%", marginBottom: 5, alignItems: "center",
    backgroundColor: "transparent", minHeight: 90, justifyContent: 'center'
  },
  selectedCategory: { 
    backgroundColor: "#334155", borderLeftWidth: 4, borderColor: "#ff69b4" 
  },
  selectedCategoryText: { color: "#ff69b4", fontWeight: '700' }, 
  categoryImage: { width: "100%", height: 130, marginBottom: 10, borderRadius: 10, backgroundColor: 'white' }, 
  categoryText: { color: "#94a3b8", fontSize: 15, fontWeight: "600", textAlign: "center" },
  
  menuGridContainer: { padding: 15 },
  menuGrid: { justifyContent: "flex-start", alignItems: "flex-start" },
  menuItem: {
    height: 280, aspectRatio: 0.8, backgroundColor: "#fff", borderRadius: 20, overflow: 'hidden',
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8,
    elevation: 3, marginBottom: 20
  },
  menuImage: { width: "100%", height: "55%" },
  menuInfo: { padding: 15, flex: 1, justifyContent: 'space-between' },
  menuText: { fontSize: 17, fontWeight: "700", textAlign: "left", color: "#1e293b", marginBottom: 5 },
  priceActionContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuPrice: { fontSize: 20, color: "#0056b3", fontWeight: "800" }, 
  addButton: { 
    backgroundColor: "#ff69b4", width: 36, height: 36, borderRadius: 18, 
    justifyContent: 'center', alignItems: 'center', elevation: 2 
  },
  emptyGrid: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyGridText: { fontSize: 20, color: '#94a3b8', textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
  },
  productCard: {
    backgroundColor: "white", borderRadius: 30, width: '75%', maxWidth: 800,
    overflow: 'hidden', elevation: 20, shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
  },
  productImageFull: { width: '100%', height: 300 },
  productDetails: { padding: 30 },
  modalTitle: { fontSize: 36, fontWeight: "900", color: '#1e293b', marginBottom: 15 },
  descriptionSection: { marginBottom: 40 },
  descriptionText: { fontSize: 18, color: '#64748b', lineHeight: 26 },
  footerActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 25,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  backButtonText: { fontSize: 18, color: '#94a3b8', fontWeight: '600' },
  mainButtons: { flexDirection: 'row', gap: 15 },
  actionBtn: {
    paddingVertical: 15, paddingHorizontal: 25, borderRadius: 18, minWidth: 160, alignItems: 'center',
  },
  btnSolo: { backgroundColor: '#f1f5f9' },
  btnMenu: { backgroundColor: '#5e9bdd' },
  btnLabel: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  btnPrice: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  btnSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
});