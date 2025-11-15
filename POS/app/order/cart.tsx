import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AntDesign from "@expo/vector-icons/AntDesign";

export default function CartPage() {
  const [orderList, setOrderList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setIsLoading(true);
        const storedOrders = await AsyncStorage.getItem("orderList");
        if (storedOrders) {
          setOrderList(JSON.parse(storedOrders));
        }
        console.log("Commandes récupérées :", orderList);
      } catch (error) {
        console.error("Erreur en récupérant les commandes :", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCart();
  }, []);

  const handlePay = async () => {
    try {
      console.log("Contenu de orderList :", orderList);
  
      const formattedOrder = orderList.map((order) => ({
        user: 0,
        menu: order.menuId,
        quantity: order.quantity || 1,
        options: Array.isArray(order.steps)
          ? order.steps.flatMap((step) =>
              step.selectedOptions.map((option) => ({
                step: step.stepId,
                option: option.optionId,
              }))
            )
          : [],
      }));
  
      await AsyncStorage.setItem("pendingOrder", JSON.stringify(formattedOrder));
      router.push("/order/location");
    } catch (error) {
      console.error("Erreur lors du paiement :", error);
    }
  };
  
  const updateCart = async (updatedOrderList) => {
    try {
      await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrderList));
      const fetchCart = async () => {
        try {
          setIsLoading(true);
          const storedOrders = await AsyncStorage.getItem("orderList");
          if (storedOrders) {
            setOrderList(JSON.parse(storedOrders));
          }
          console.log("Commandes récupérées :", orderList);
        } catch (error) {
          console.error("Erreur en récupérant les commandes :", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCart(); // Recharge les données après mise à jour
    } catch (error) {
      console.error("Erreur lors de la mise à jour du panier :", error);
    }
  };
  const removeMenu = (index) => {
    const updatedOrderList = [...orderList];
    updatedOrderList.splice(index, 1); // Supprime l'élément à l'index donné
    updateCart(updatedOrderList);
  };

  const increaseQuantity = (index) => {
    const updatedOrderList = [...orderList];
    updatedOrderList[index].quantity += 1; // Augmente la quantité de l'élément à l'index donné
    updateCart(updatedOrderList);
  };

  const decreaseQuantity = (index) => {
    const updatedOrderList = [...orderList];
    if (updatedOrderList[index].quantity > 1) {
      updatedOrderList[index].quantity -= 1; // Diminue la quantité de l'élément à l'index donné
      updateCart(updatedOrderList);
    }
  };

  const calculateMenuPrice = (menu) => {
    console.log("prix du menu:", menu);
    let basePrice = parseFloat(menu.price) || 0; // Convertit le prix de base en nombre
    let optionsPrice = 0;
  
    if (menu.steps && menu.steps.length > 0) {
      menu.steps.forEach((step) => {
        step.selectedOptions.forEach((option) => {
          optionsPrice += parseFloat(option.optionPrice) || 0; // Ajoute le prix des options sélectionnéess en nombre
        });
      });
    }
  
    return basePrice + optionsPrice; // Retourne le prix total du menu
  };
  
  const calculateTotalPrice = () => {
    return orderList.reduce((total, menu) => {
      const menuPrice = calculateMenuPrice(menu);
      return total + menuPrice * menu.quantity; // Multiplie par la quantité
    }, 0);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Chargement du panier...</Text>
      </View>
    );
  }

  if (orderList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyCart}>Votre panier est vide.</Text>
        <TouchableOpacity
          style={styles.addMoreButton}
          onPress={() => router.push("/tabs/terminal")}
        >
          <Text style={styles.addMoreText}>Ajouter des articles</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/tabs/terminal")}>
          <AntDesign name="home" size={50} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Panier  <AntDesign name="shoppingcart" size={40} color="black" /></Text>
      </View>
      <View style={styles.orderListContainer}>
        <FlatList
          data={orderList}
          numColumns={2} // Affiche les commandes en deux colonnes
          columnWrapperStyle={{ justifyContent: "flex-start" }} // Aligne les colonnes correctement
          keyExtractor={(item) => item.menuId.toString()}
          renderItem={({ item, index }) => {
            const menuPrice = calculateMenuPrice(item); // Calcule le prix du menu

            return (
              <View style={styles.orderBlock}>
                <View style={styles.titleContainer}>
                  <Text style={styles.menuName}>{item.menuName}</Text>
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => decreaseQuantity(index)}
                    >
                      <Text style={styles.quantityText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => increaseQuantity(index)}
                    >
                      <Text style={styles.quantityText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.menuPrice}>Prix : {menuPrice} DA</Text>
                <View style={styles.bottomContainer}>
                  {item.solo || item.extra ? (
                    <Text style={styles.soloText}>Solo</Text>
                  ) : (
                    item.steps.map((step, j) => (
                      <View key={j} style={styles.stepBlock}>
                        <Text style={styles.stepTitle}>{step.stepName}</Text>
                        {step.selectedOptions.length > 0 ? (
                          step.selectedOptions.map((opt, k) => (
                            <Text key={k} style={styles.option}>
                              • {opt.optionName} {parseFloat(opt.optionPrice) > 0 ? `(+${opt.optionPrice} DA)` : ""}
                            </Text>
                          ))
                        ) : (
                          <Text style={styles.option}>Aucune option sélectionnée</Text>
                        )}
                        
                      </View>
                    ))
                    )}
                  
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeMenu(index)}
                  >
                    <Text style={styles.removeText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.totalPrice}>Total : {calculateTotalPrice()} DA</Text>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePay}
        >
          <Text style={styles.payText}>Payer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f4f4f4", // Couleur de fond plus douce
    flexGrow: 1,
  },
  orderListContainer: {
    flex: 1,
    marginTop: 20,
  },
  orderBlock: {
    flexDirection: "column",
    margin: 10,
    padding: 15,
    width: "48%", // Chaque bloc occupe 48% de la largeur pour deux colonnes
    backgroundColor: "#ffffff", // Couleur de fond blanche
    borderRadius: 10,
    elevation: 3, // Ombre légère
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: "space-between", // Positionne les éléments correctement
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  menuName: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#333", // Couleur du texte
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    padding: 10,
    backgroundColor: "#e0e0e0", // Boutons gris clair
    borderRadius: 5,
    marginHorizontal: 5,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333", // Couleur du texte
  },
  quantityValue: {
    fontSize: 20,
    color: "#444",
    marginHorizontal: 5,
  },
  stepBlock: {
    marginBottom: 10,
  },
  stepTitle: {
    fontWeight: "bold",
    fontSize: 25,
    marginBottom: 4,
    color: "#555", // Couleur du texte
  },
  option: {
    fontSize: 25,
    marginLeft: 10,
    color: "#666", // Couleur du texte
  },
  removeButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#ff4d4d", // Rouge vif pour le bouton de suppression
    borderRadius: 5,
  },
  removeText: {
    color: "white",
    fontSize: 30,
    textAlign: "center",
    fontWeight: "bold",
  },
  bottomContainer: {
    flex: 2,
    
    justifyContent: "flex-end", // Positionne "Supprimer" et "Commande Solo" en bas
    marginTop: 10,
  },
  loading: {
    fontSize: 30,
    textAlign: "center",
    marginTop: 50,
    color: "#888", // Couleur du texte
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f4f4", // Couleur de fond douce
  },
  emptyCart: {
    fontSize: 30,
    textAlign: "center",
    marginBottom: 20,
    color: "#888", // Couleur du texte
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 50,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    color: "black", // Couleur bleue pour le titre
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    backgroundColor: "#ffffff", // Fond blanc pour le footer
    padding: 10,
    borderRadius: 10,
    elevation: 2,
  },
  addMoreButton: {
    padding: 12,
    width: "48%",
    backgroundColor: "#007bff", // Bleu vif pour le bouton "Ajouter"
    borderRadius: 8,
  },
  addMoreText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  payButton: {
    padding: 12,
    width: "48%",
    backgroundColor: "#28a745", // Vert vif pour le bouton "Payer"
    borderRadius: 8,
  },
  payText: {
    color: "white",
    fontSize:40,
    fontWeight: "bold",
    textAlign: "center",
  },
  soloText: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#444",
    marginTop: 10,
    textAlign: "center",
  },
  menuPrice: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#444",
    marginTop: 5,
  },
  totalPrice: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
});