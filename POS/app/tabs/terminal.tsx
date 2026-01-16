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
} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POS_URL } from "@/config"; 
import Feather from '@expo/vector-icons/Feather'; 
import { Ionicons } from '@expo/vector-icons';
import { useBorneSync } from "@/hooks/useBorneSync.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function MenuScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartCount, setCartCount] = useState(0); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);

  const width = Dimensions.get("window").width;
  const itemMargin = width > 700 ? 20 : 10;
  const numColumns =
    width >= 700  ? 3 :
    width >= 500  ? 2 :
    1;
  const sidebarPercent = width > 700 ? 25 : 35; 
  const sidebarWidth = `${sidebarPercent}%`;
  const menuGridWidth = 100 - sidebarPercent;

  const innerGridWidth = (width * menuGridWidth / 100);
  const itemWidth = (innerGridWidth - itemMargin * (numColumns + 1)) / numColumns;

  const updateCartCount = async () => {
    try {
      const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");
      const count = existingOrders.reduce((total, item) => total + (item.quantity || 1), 0);
      setCartCount(count);
    } catch (error) {
      console.error("Erreur lors de la récupération du compteur de panier", error);
      setCartCount(0);
    }
  };

  const { categories, menus, isLoading } = useBorneSync();
  
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories]);

  const handleOpenModal = (item) => {
    setSelectedItemForModal(item);
    setIsModalVisible(true);
  };
  
  const handleSoloAdd = async () => {
    if (!selectedItemForModal) return;

    try {
      const item = selectedItemForModal;
      const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

      const updatedOrders = [
        ...existingOrders,
        { 
          menuId: item.id, 
          menuName: item.name, 
          solo: true, 
          quantity: 1, 
          price: item.solo_price || item.price || 0,
          steps: [] 
        },
      ];

      await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
      await updateCartCount();
      setIsModalVisible(false);

      Alert.alert(
        t('terminal.added_success'),
        `${item.name} ${t('terminal.added_solo')}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Erreur lors de l'ajout solo :", error);
      Alert.alert(t('error'), t('terminal.error_add'));
    }
  };
  
  const handleMenuAdd = () => {
    if (!selectedItemForModal) return;

    const item = selectedItemForModal;
    setIsModalVisible(false);
    
    router.push({
        pathname: "/order/step",
        params: {
            menuId: item.id,
            menuName: item.name,
            price: item.price || 0,
        },
    });
  };

  const handleAddToCart = async (item) => {
    if (item.extra) {
      try {
        const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

        const updatedOrders = [
          ...existingOrders,
          { menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0 },
        ];
        
        await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
        await updateCartCount();

        Alert.alert(
          t('terminal.added_success'),
          `${item.name} ${t('terminal.added_extra')}`,
          [{ text: "OK" }]
        );
      } catch (error) {
        console.error("Erreur lors de l'ajout au panier :", error);
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
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)} 
      >
        <TouchableOpacity 
            style={modalStyles.centeredView}
            activeOpacity={1}
            onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={modalStyles.modalView}>
            <Text style={modalStyles.modalTitle}>
              {selectedItemForModal.name}
            </Text>
            <Text style={modalStyles.modalSubtitle}>
              {t('terminal.choose_order_type')}
            </Text>

            <View style={modalStyles.buttonContainer}>
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.buttonSolo]}
                onPress={handleSoloAdd}
              >
                <Text style={modalStyles.textStyle}>{t('terminal.solo')}</Text>
                <Text style={modalStyles.textStyleSmall}>
                    ({selectedItemForModal.solo_price || selectedItemForModal.price || 0} {t('terminal.solo_price')})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[modalStyles.button, modalStyles.buttonMenu]}
                onPress={handleMenuAdd}
              >
                <Text style={modalStyles.textStyle}>{t('terminal.in_menu')}</Text>
                <Text style={modalStyles.textStyleSmall}>
                    ({t('terminal.in_menu_subtitle')})
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
                style={modalStyles.closeButton} 
                onPress={() => setIsModalVisible(false)}
            >
                <Text style={modalStyles.closeButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff9900" /> 
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
    <View style={[styles.container, isRTL && { direction: 'rtl' }]}>
      {/* Header */}
      <View style={styles.header}>
  <Image 
    source={require('@/assets/logo.png')} 
    style={styles.logoImage} 
    resizeMode="contain"
  />
  
  <View style={styles.headerRight}>
    {/* Sélecteur de langue DIRECTEMENT dans le header (UX Simplifiée) */}
    <LanguageSelector />

    {/* Bouton panier */}
    <TouchableOpacity 
      style={styles.cartButton} 
      onPress={() => router.push("/order/cart")}
    >
      <Feather name="shopping-cart" size={45} color="black" />
      {cartCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
</View>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Sidebar catégories */}
        <ScrollView 
          style={[styles.sidebar, { width: sidebarWidth }]} 
          contentContainerStyle={styles.sidebarContent}
        >
          {categories
            .filter((category) => category.avalaible)
            .map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory?.id === category.id && styles.selectedCategory,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                {category.photo && (
                  <Image
                    source={{ uri: `${POS_URL}${category.photo}` }}
                    style={styles.categoryImage}
                  />
                )}
                <Text 
                  style={[
                    styles.categoryText,
                    selectedCategory?.id === category.id && styles.selectedCategoryText 
                  ]}
                >
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
                  {item.photo && (
                    <Image
                      source={{ uri: `${POS_URL}${item.photo}` }}
                      style={styles.menuImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuText} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.menuPrice}>
                      {item.extra == 1 ? `+${item.price}` : item.solo_price == 1 ? `${item.solo_price} ${item.price} DA` : `${item.price} DA`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.menuGrid}
            />
          )}
        </View>
      </View>
      
      
      {/* Modales */}
      <ChoiceModal />
    </View>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    width: 150,
    height: 50,
  },
  container: {
    flex: 1,
    backgroundColor: "white", 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  loadingText: {
    fontSize: 30,
    textAlign: "center",
    marginTop: 20,
    color: "#333",
    fontWeight: 'bold',
  },
  header: {
    height: 100,
    backgroundColor: "#ffc300", 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    elevation: 8,
    shadowColor: "#000",
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  languageButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'white',
    elevation: 5,
  },
  cartButton: {
    padding: 15,
    borderRadius: 10,
    elevation: 5,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    right: 5,
    top: 5,
    backgroundColor: 'red',
    borderRadius: 15,
    minWidth: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    zIndex: 1,
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    backgroundColor: "#333", 
    elevation: 5,
  },
  sidebarContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  categoryButton: {
    borderRadius: 10,
    padding: 15,
    width: "90%",
    marginBottom: 15,
    alignItems: "center",
    backgroundColor: "#555",
    elevation: 3,
    minHeight: 80, 
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: "#ff9900",
    borderWidth: 4,
    borderColor: "#fff", 
  },
  selectedCategoryText: {
    color: "#333",
  },
  categoryImage: {
    width: "100%",
    height: 100,
    marginBottom: 10,
    borderRadius: 8,
  },
  categoryText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  menuGridContainer: {
    padding: 10, 
  },
  menuGrid: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  menuItem: {
    height: 300,
    aspectRatio: 1, 
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    marginBottom: 20,
  },
  menuImage: {
    width: "100%",
    height: "60%",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  menuInfo: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: "40%",
  },
  menuText: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    flexWrap: 'wrap',
  },
  menuPrice: {
    fontSize: 28, 
    color: "#e74c3c", 
    fontWeight: "bold",
    marginTop: 5,
  },
  emptyGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGridText: {
    fontSize: 30,
    color: '#999',
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '70%',
    maxWidth: 600,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 40,
    fontWeight: "bold",
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 24,
    marginBottom: 30,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  button: {
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    minHeight: 120,
    width: '48%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSolo: {
    backgroundColor: "#007bff",
  },
  buttonMenu: {
    backgroundColor: "#ff9900",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 30,
  },
  textStyleSmall: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 15,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  }
});