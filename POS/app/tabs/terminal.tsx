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
  // ❌ SUPPRIMÉ : PanResponder n'est plus nécessaire
} from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import { POS_URL } from "@/config"; 
import Feather from '@expo/vector-icons/Feather'; 
import { useBorneSync } from "@/hooks/useBorneSync.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function MenuScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  
  // États des données
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartCount, setCartCount] = useState(0); 
  
  // États des Modales
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isInactivityModalVisible, setIsInactivityModalVisible] = useState(false);

  // Hook de synchronisation
  const { categories, menus, isLoading } = useBorneSync();

  // Variables de Timer
  const mainTimerRef = useRef(null);      
  const secondaryTimerRef = useRef(null); 

  // --- CALCULS DE LAYOUT ---
  const width = Dimensions.get("window").width;
  const itemMargin = width > 700 ? 20 : 10;
  const numColumns = width >= 700 ? 3 : width >= 500 ? 2 : 1;
  const sidebarPercent = width > 700 ? 25 : 30; 
  const sidebarWidth = `${sidebarPercent}%`;
  const menuGridWidth = 100 - sidebarPercent;
  const innerGridWidth = (width * menuGridWidth / 100);
  const itemWidth = (innerGridWidth - itemMargin * (numColumns + 1)) / numColumns;

  // ✅ FONCTION DE RESET DES TIMERS (à définir selon votre logique)
  const resetMainTimer = () => {
    // Votre logique de reset timer ici
    if (mainTimerRef.current) {
      clearTimeout(mainTimerRef.current);
    }
    if (secondaryTimerRef.current) {
      clearTimeout(secondaryTimerRef.current);
    }
    // Relancer les timers si nécessaire
  };

  // ✅ GESTIONNAIRE D'ACTIVITÉ UTILISATEUR (remplace PanResponder)
  const handleUserActivity = () => {
    resetMainTimer();
    // Vous pouvez ajouter d'autres logiques ici
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
    handleUserActivity(); // Reset timer
    setSelectedItemForModal(item);
    setIsModalVisible(true);
  };
  
  const handleSoloAdd = async () => {
    if (!selectedItemForModal) return;
    handleUserActivity();
    try {
      const item = selectedItemForModal;
      const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

      // Vérifier si le produit solo existe déjà
      const existingIndex = existingOrders.findIndex(order => 
        order.menuId === item.id && order.solo === true
      );

      if (existingIndex !== -1) {
        // Si oui, on augmente la quantité
        existingOrders[existingIndex].quantity += 1;
      } else {
        // Sinon, on ajoute une nouvelle ligne
        existingOrders.push({ 
          menuId: item.id, 
          menuName: item.name, 
          solo: true, 
          quantity: 1, 
          price: item.solo_price || item.price || 0, 
          steps: [] 
        });
      }

      await AsyncStorage.setItem("orderList", JSON.stringify(existingOrders));
      await updateCartCount();
      setIsModalVisible(false);
      
      Alert.alert(t('terminal.added_success'), `${item.name} ${t('terminal.added_solo')}`, [{ text: "OK", onPress: resetMainTimer }]);
    } catch (error) {
      Alert.alert(t('error'), t('terminal.error_add'));
    }
};
  
  const handleMenuAdd = () => {
    if (!selectedItemForModal) return;
    handleUserActivity(); // Reset timer
    const item = selectedItemForModal;
    setIsModalVisible(false);

    router.push({
        pathname: "/order/step",
        params: { menuId: item.id, menuName: item.name, price: item.price || 0 },
    });
  };

  const handleAddToCart = async (item) => {
    handleUserActivity(); // Reset timer
    if (item.extra) {
      try {
        const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
        const updatedOrders = [...existingOrders, { 
            menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0 
        }];
        await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
        await updateCartCount();
        
        Alert.alert(t('terminal.added_success'), `${item.name} ${t('terminal.added_extra')}`, [{ text: "OK", onPress: resetMainTimer }]);
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
            {/* Image du Produit */}
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

              {/* Barre d'actions Footer */}
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
                    {/* On garde le titre "En Menu" */}
                    <Text style={[modalStyles.btnLabel, { color: 'white' }]}>{t('terminal.in_menu')}</Text>
                    
                    {/* ✅ REMPLACÉ : t('terminal.in_menu_subtitle') par le prix */}
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

  // ✅ MODAL D'INACTIVITÉ (à définir selon votre besoin)
  const InactivityModal = () => {
    return (
      <Modal animationType="fade" transparent={true} visible={isInactivityModalVisible}>
        <View style={modalStyles.centeredView}>
          <View style={modalStyles.alertView}>
            <Text style={modalStyles.alertTitle}>{t('terminal.inactivity_title')}</Text>
            <Text style={modalStyles.alertMessage}>{t('terminal.inactivity_message')}</Text>
            <TouchableOpacity 
              style={modalStyles.alertButtonContinue}
              onPress={() => {
                setIsInactivityModalVisible(false);
                handleUserActivity();
              }}
            >
              <Text style={modalStyles.alertButtonTextWhite}>{t('terminal.continue')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={modalStyles.alertButtonCancel}
              onPress={() => router.push("/")}
            >
              <Text style={modalStyles.alertButtonTextRed}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    // ✅ REMPLACÉ : onTouchStart simple au lieu de panResponder.panHandlers
    <View 
      style={[styles.container, isRTL && { direction: 'rtl' }]} 
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
                          {item.extra == 1 ? `+${item.price}` : item.solo_price == 1 ? `${item.solo_price}` : `${item.price}`} <Text style={{fontSize: 14}}>DA</Text>
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
      <InactivityModal />
      
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
    paddingHorizontal: 25, elevation: 6, shadowColor: "#000"
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  cartButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Fond plus sombre pour focus
  },
  productCard: {
    backgroundColor: "white",
    borderRadius: 30,
    width: '75%',
    maxWidth: 800,
    overflow: 'hidden', // Pour que l'image respecte les bords arrondis
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  productImageFull: {
    width: '100%',
    height: 300,
  },
  productDetails: {
    padding: 30,
  },
  modalTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: '#1e293b',
    marginBottom: 15,
  },
  descriptionSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#ff69b4',
    fontWeight: '700',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 18,
    color: '#64748b',
    lineHeight: 26,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 25,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  backButtonText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
  mainButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  actionBtn: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 18,
    minWidth: 160,
    alignItems: 'center',
  },
  btnSolo: {
    backgroundColor: '#f1f5f9',
  },
  btnMenu: {
    backgroundColor: '#5e9bdd',
  },
  btnLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  btnPrice: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  // On ajuste le texte pour le bouton Menu qui est bleu
  btnMenuText: {
    color: 'white',
  },
  btnSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  // Surcharge pour les textes du bouton bleu
  btnMenuLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  }
});