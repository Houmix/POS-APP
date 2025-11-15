import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Alert, Image } from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons"; // Pour l'icône du panier
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function MenuScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // null par défaut
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // État pour le chargement
  const screenWidth = Dimensions.get("window").width; // Récupère la largeur de l'écran
  const itemWidth = (screenWidth - 5 * 20) / 4; // Calcule la largeur pour 4 éléments par ligne avec des marges

  useEffect(() => {
    const GetCategorie = async () => {
      try {
        setIsLoading(true); // Début du chargement
        const accessToken = await AsyncStorage.getItem("token");
        const response = await axios.get(`http://127.0.0.1:8000/menu/api/getGroupMenuList/1/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Token inséré dans la requête
          },
        });
        console.log("GroupMenus:", response.data);

        const availableCategories = response.data.filter((category) => category.avalaible); // Filtre les catégories disponibles
        setCategories(availableCategories);

        if (availableCategories.length > 0) {
          setSelectedCategory(availableCategories[0]); // Sélectionne le premier groupe disponible
        }

        await AsyncStorage.setItem("GroupMenu", JSON.stringify(availableCategories));
      } catch (error) {
        console.error("Erreur lors de la récupération des catégories", error);
      } finally {
        setIsLoading(false); // Fin du chargement
      }
    };
    GetCategorie();
  }, []);

  useEffect(() => {
    const GetMenu = async () => {
      try {
        setIsLoading(true); // Début du chargement
        const accessToken = await AsyncStorage.getItem("token");
        const response = await axios.get(`http://127.0.0.1:8000/menu/api/getAllMenu/1/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Token inséré dans la requête
          },
        });
        console.log("Menus:", response.data);
        setMenus(response.data);
        await AsyncStorage.setItem("Menu", JSON.stringify(response.data));
      } catch (error) {
        console.error("Erreur lors de la récupération des menus", error);
      } finally {
        setIsLoading(false); // Fin du chargement
      }
    };
    GetMenu();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement des données...</Text>
        <Text style={styles.loadingText}>Veuillez patienter.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barre du haut */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => router.push("/order/cart")}>
          <Ionicons name="cart-outline" size={45} color="black" />
        </TouchableOpacity>
      </View>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Menu latéral (catégories) */}
        <View style={styles.sidebar}>
          {categories
            .filter((category) => category.avalaible) // Filtre les catégories disponibles
            .map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory?.id === category.id && styles.selectedCategory,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                {/* Affiche la photo de la catégorie */}
                {category.photo && (
                  <Image
                    source={{ uri: `http://127.0.0.1:8000${category.photo}` }} // Ajoute le début de l'URL
                    style={styles.categoryImage}
                  />
                )}
                <Text style={styles.categoryText}>{category.name}</Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Grille des menus */}
        <View style={styles.menuGrid}>
          <FlatList
            data={menus.filter(
              (item) =>
                item.group_menu === selectedCategory?.id &&
                item.avalaible && // Filtre les menus disponibles
                categories.some((category) => category.id === item.group_menu && category.avalaible) // Vérifie si le groupe de menu est disponible
            )}
            numColumns={3} // Affiche 4 éléments par ligne
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.menuItem, { width: itemWidth }]} // Utilise une largeur dynamique
                onPress={async () => {
                  if (item.extra) {
                    // Si le menu est un extra, ajouter directement au panier
                    try {
                      const existingOrders: {
                        menuId: number;
                        menuName: string;
                        extra: boolean;
                        quantity: number;
                      }[] = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

                      const updatedOrders = [
                        ...existingOrders,
                        { menuId: item.id, menuName: item.name, extra: true, quantity: 1, price: item.price || 0 },
                      ];

                      await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
                      console.log("Extra ajouté au panier :", updatedOrders);

                      Alert.alert(
                        "Ajouté au panier",
                        `${item.name} a été ajouté en tant qu'extra.`
                      );
                    } catch (error) {
                      console.error("Erreur lors de l'ajout au panier :", error);
                    }
                  } else {
                    // Si le menu n'est pas un extra, proposer Solo ou En menu
                    const userChoice = window.confirm(
                      `Que souhaitez-vous faire avec ${item.name} ?\n\nCliquez sur "OK" pour Solo ou "Annuler" pour En menu.`
                    );

                    if (userChoice) {
                      // Action pour "Solo"
                      try {
                        const existingOrders: {
                          menuId: number;
                          menuName: string;
                          solo: boolean;
                          quantity: number;
                          steps: any[];
                        }[] = JSON.parse(await AsyncStorage.getItem("orderList") || "[]");

                        const updatedOrders = [
                          ...existingOrders,
                          { menuId: item.id, menuName: item.name, solo: true, quantity: 1, price: item.price, steps: [] },
                        ];

                        await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrders));
                        console.log("OrderList updated:", updatedOrders);

                        Alert.alert(
                          "Ajouté au panier",
                          `${item.name} a été ajouté en tant que commande solo.`
                        );
                      } catch (error) {
                        console.error("Erreur lors de l'ajout à la liste des commandes", error);
                      }
                    } else {
                      // Action pour "En menu"
                      router.push({
                        pathname: "/order/step",
                        params: {
                          menuId: item.id,
                          menuName: item.name,
                          price: item.price || 0, // Assurez-vous que le prix est défini
                        },
                      });
                    }
                  }
                }}
              >
                {/* Affiche la photo du menu */}
                {item.photo && (
                  <Image
                    source={{ uri: `http://127.0.0.1:8000${item.photo}` }} // Ajoute le début de l'URL
                    style={styles.menuImage}
                  />
                )}
                <Text style={styles.menuText}>{item.name}</Text>
                <Text style={styles.menuPrice}>{item.solo ? `(${item.solo_price})` : item.price} DA</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8", // Fond clair pour une apparence moderne
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    fontSize: 30,
    textAlign: "center",
    marginBottom: 10,
    color: "#333", // Texte sombre pour le contraste
  },
  header: {
    height: 70,
    backgroundColor: "#ffcc00", // Couleur jaune vif pour rappeler McDonald's
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    elevation: 5, // Ombre pour donner de la profondeur
  },
  title: {
    color: "#333", // Texte sombre pour le contraste
    fontSize: 30,
    fontWeight: "bold",
  },
  cartButton: {
    padding: 10,
    //backgroundColor: "#fff",
    borderRadius: 50, // Bouton arrondi
    elevation: 3, // Ombre légère
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: "25%", // Augmente la largeur pour une meilleure visibilité
    paddingVertical: 20,
    alignItems: "center",
    backgroundColor: "#fff", // Fond blanc pour le menu latéral
    elevation: 3, // Ombre légère
  },
  categoryButton: {
    borderRadius: 15, // Boutons arrondis
    padding: 15,
    width: "90%",
    margin: 10,
    alignItems: "center",
    backgroundColor: "#ffcc00", // Jaune vif pour les catégories
    elevation: 3, // Ombre légère
  },
  selectedCategory: {
    backgroundColor: "#ff9900", // Orange vif pour la catégorie sélectionnée
  },
  categoryText: {
    color: "#333", // Texte sombre pour le contraste
    fontSize: 30,
    fontWeight: "bold",
  },
  menuGrid: {
    flex: 1,
    flexDirection: "row", // Affiche les menus en ligne
    flexWrap: "wrap", // Permet de passer à la ligne suivante si nécessaire
    justifyContent: "space-between", // Répartit l'espace entre les éléments
    padding: 20,
  },
  menuItem: {
    height: 350, // Hauteur fixe pour chaque élément
    backgroundColor: "#fff", // Fond blanc pour les cartes
    margin: 10,
    borderRadius: 15, // Cartes arrondies
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5, // Ombre pour donner de la profondeur
  },
  menuImage: {
    width: "80%", // Ajuste la largeur de l'image pour s'adapter à l'espace
    height: 150,
    marginBottom: 10,
    borderRadius: 10, // Images légèrement arrondies
  },
  menuText: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333", // Texte sombre pour le contraste
  },
  menuPrice: {
    fontSize: 20,
    color: "#ff9900", // Orange vif pour les prix
    marginTop: 5,
    fontWeight: "bold",
  },
  categoryImage: {
    width: "100%",
    height: 250,
    marginBottom: 10,
    borderRadius: 10, // Images arrondies pour les catégories
  },
});

