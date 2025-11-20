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
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Assurez-vous que ces imports fonctionnent dans votre environnement
import { POS_URL, idRestaurant } from "@/config"; 
import Feather from '@expo/vector-icons/Feather'; 

export default function MenuScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0); 

  // --- NOUVEAUX ÉTATS POUR LA MODALE (Logique du premier code) ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  // ---------------------------------------------------------------

  const width = Dimensions.get("window").width;
  // --- LOGIQUE RESPONSIVE (Utilisation de l'héritage du premier code) ---
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
  // -------------------------
  

  // Fonction pour mettre à jour le compteur du panier (Logique du premier code)
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


  // --- USE EFFECT (Logique du premier code avec idRestaurant) ---
  useEffect(() => {
    // Met à jour le compteur du panier au montage
    updateCartCount(); 

    const GetCategorie = async () => {
      try {
        setIsLoading(true);
        const accessToken = await AsyncStorage.getItem("token");
        // Utilisation de idRestaurant comme dans le premier code
        const response = await axios.get(`${POS_URL}/menu/api/getGroupMenuList/${idRestaurant}/`, { 
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const availableCategories = response.data.filter((category) => category.avalaible);
        setCategories(availableCategories);

        if (availableCategories.length > 0) {
          setSelectedCategory(availableCategories[0]);
        }

        await AsyncStorage.setItem("GroupMenu", JSON.stringify(availableCategories));
      } catch (error) {
        console.error("Erreur lors de la récupération des catégories", error);
        Alert.alert("Erreur", "Impossible de charger les catégories.");
      } 
      // NOTE : setIsLoading(false) est déplacé dans le second useEffect pour s'assurer que les menus sont aussi chargés.
    };
    GetCategorie();
  }, []);

  useEffect(() => {
    const GetMenu = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("token");
        // Utilisation de idRestaurant comme dans le premier code
        const response = await axios.get(`${POS_URL}/menu/api/getAllMenu/${idRestaurant}/`, { 
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setMenus(response.data);
        await AsyncStorage.setItem("Menu", JSON.stringify(response.data));
      } catch (error) {
        console.error("Erreur lors de la récupération des menus", error);
        Alert.alert("Erreur", "Impossible de charger les menus.");
      } finally {
        setIsLoading(false); // FIN du chargement après les deux appels
      }
    };
    GetMenu();
  }, []);
  // -----------------------------


  // --- LOGIQUE MODALE (Identique au premier code) ---

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
      setIsModalVisible(false); // Ferme la modale

      Alert.alert(
        "✅ Ajouté !",
        `${item.name} a été ajouté en tant que commande solo.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Erreur lors de l'ajout solo :", error);
      Alert.alert("Erreur", "Impossible d'ajouter le produit en mode solo.");
    }
  };
  
  const handleMenuAdd = () => {
    if (!selectedItemForModal) return;

    const item = selectedItemForModal;
    setIsModalVisible(false); // Ferme la modale
    
    // Chemin d'accès mis à jour vers "/step" ou votre chemin correcte pour les étapes
    router.push({
        pathname: "/order/step",
        params: {
            menuId: item.id,
            menuName: item.name,
            price: item.price || 0,
        },
    });
  };

  // --- LOGIQUE AJOUT AU PANIER (Identique au premier code) ---

  const handleAddToCart = async (item) => {
    
    if (item.extra) {
      // Si le menu est un extra, ajouter directement au panier
      try {
        const existingOrders = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

        const updatedOrders = [
          ...existingOrders,
          { menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0 },
        ];
        
        await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
        await updateCartCount(); // Mise à jour du compteur

        Alert.alert(
          "✅ Ajouté !",
          `${item.name} a été ajouté en tant qu'extra.`,
          [{ text: "OK" }]
        );
      } catch (error) {
        console.error("Erreur lors de l'ajout au panier :", error);
        Alert.alert("Erreur", "Impossible d'ajouter l'extra au panier.");
      }
    } else {
      // Ouvre la modale pour choisir Solo/Menu
      handleOpenModal(item);
    }
  };

  // --- COMPOSANT MODAL (Identique au premier code) ---
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
            onPress={() => setIsModalVisible(false)} // Fermer en cliquant à l'extérieur
        >
          {/* Empêche la fermeture quand on clique sur la fenêtre elle-même */}
          <TouchableOpacity activeOpacity={1} style={modalStyles.modalView}>
            <Text style={modalStyles.modalTitle}>
              {selectedItemForModal.name}
            </Text>
            <Text style={modalStyles.modalSubtitle}>
              Comment souhaitez-vous commander cet article ?
            </Text>

            <View style={modalStyles.buttonContainer}>
              {/* BOUTON SOLO */}
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.buttonSolo]}
                onPress={handleSoloAdd}
              >
                <Text style={modalStyles.textStyle}>Solo</Text>
                <Text style={modalStyles.textStyleSmall}>
                    ({selectedItemForModal.solo_price || selectedItemForModal.price || 0} DA)
                </Text>
              </TouchableOpacity>

              {/* BOUTON EN MENU */}
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.buttonMenu]}
                onPress={handleMenuAdd}
              >
                <Text style={modalStyles.textStyle}>En Menu</Text>
                <Text style={modalStyles.textStyleSmall}>
                    (Ajouter étapes et compléments)
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
                style={modalStyles.closeButton} 
                onPress={() => setIsModalVisible(false)}
            >
                <Text style={modalStyles.closeButtonText}>Annuler</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };
  // -------------------------

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Utilise ActivityIndicator pour un meilleur indicateur de chargement */}
        <ActivityIndicator size="large" color="#ff9900" /> 
        <Text style={styles.loadingText}>Chargement des menus...</Text>
      </View>
    );
  }
  
  // Filtrage des menus
  const filteredMenus = menus.filter(
    (item) =>
      item.group_menu === selectedCategory?.id &&
      item.avalaible &&
      categories.some((category) => category.id === item.group_menu && category.avalaible)
  );

  return (
    <View style={styles.container}>
      {/* Barre du haut (Identique au premier code) */}
      <View style={styles.header}>
        <Text style={styles.title}>NomResto</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => router.push("/cart")}> {/* Chemin vers le panier corrigé */}
          <Feather name="shopping-cart" size={45} color="black" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Menu latéral (catégories - Identique au premier code) */}
        <ScrollView style={[styles.sidebar, { width: sidebarWidth }]} contentContainerStyle={styles.sidebarContent}>
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
                {/* Affiche l'image uniquement si elle est disponible */}
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

        {/* Grille des menus (Identique au premier code) */}
        <View style={[styles.menuGridContainer, { width: `${menuGridWidth}%` }]}>
          {filteredMenus.length === 0 ? (
            <View style={styles.emptyGrid}>
              <Text style={styles.emptyGridText}>Aucun produit disponible dans cette catégorie.</Text>
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
                      {item.extra ? `+${item.price}` : item.solo_price ? `${item.solo_price} DA` : `${item.price} DA`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.menuGrid}
            />
          )}
        </View>
      </View>
      
      {/* APPEL DE LA MODALE */}
      <ChoiceModal />

    </View>
  );
}

// --- STYLES (Identiques au premier code) ---
const styles = StyleSheet.create({
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
  // --- Header ---
  header: {
    height: 100, // Hauteur fixe pour le Header
    backgroundColor: "#ffc300", 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    elevation: 8,
    shadowColor: "#000",
  },
  title: {
    color: "#333",
    fontSize: 45,
    fontWeight: "900",
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
  // --- Contenu et Sidebar ---
  content: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    // width est géré en ligne (width: sidebarWidth)
    backgroundColor: "#333", 
    elevation: 5,
  },
  sidebarContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  categoryButton: {
    borderRadius: 10,
    padding: 15, // Plus de padding vertical
    width: "90%",
    marginBottom: 15,
    alignItems: "center",
    backgroundColor: "#555",
    elevation: 3,
    // Hauteur minimale pour les boutons sans image
    minHeight: 80, 
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: "#ff9900", // Orange vif pour la sélection
    borderWidth: 4,
    borderColor: "#fff", 
    // Correction de l'inversion de couleur de texte pour le bouton sélectionné
  },
  selectedCategoryText: {
    color: "#333", // Texte noir pour le bouton sélectionné (fond orange)
  },
  categoryImage: {
    width: "100%",
    height: 100, // Réduit la hauteur des images pour laisser plus de place au texte si nécessaire
    marginBottom: 10,
    borderRadius: 8,
  },
  categoryText: {
    color: "#fff", // Texte blanc par défaut (fond gris foncé)
    fontSize: 28, // Grande taille
    fontWeight: "bold",
    textAlign: "center",
  },
  // --- Grille des Menus ---
  menuGridContainer: {
    // width est géré en ligne (width: `${menuGridWidth}%`)
    padding: 10, 
  },
  menuGrid: {
    // Assure que les items commencent en haut à gauche
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
    marginBottom: 20, // Ajout de marge en bas pour espacer les lignes
  },
  menuImage: {
    width: "100%",
    height: "60%", // Laisse 40% pour l'info pour être sûr de ne pas tronquer
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
    fontSize: 22, // Légèrement réduit pour éviter le débordement
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

// --- STYLES MODALE (Identiques au premier code) ---
const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Fond semi-transparent
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '70%', // Largeur adaptée à une borne
    maxWidth: 600,
    position: 'relative', // Pour placer le bouton Annuler
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
    backgroundColor: "#007bff", // Bleu plus neutre pour Solo
  },
  buttonMenu: {
    backgroundColor: "#ff9900", // Orange vif pour Menu
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