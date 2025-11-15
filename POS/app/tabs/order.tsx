import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView } from "react-native";

export default function OrderScreen() {
  interface Order {
    id: number;
    order_id: string;
    order_status: string;
    cash: boolean;
    created_at: string;
    total_price: number;
    items: {
      menu_name: string;
      quantity: number;
      solo: boolean;
      extra: boolean;
      composition: {
        step_name: string;
        option_name: string;
        option_price: number;
      }[];
    }[];
    paid?: number;
    refund?: number;
    cancelled?: number;
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("token");
        const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
        const response = await axios.get(`http://127.0.0.1:8000/order/api/getPOSorder/${restaurantId}/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        console.log("Commandes récupérées :", response.data.orders);
        setOrders(response.data.orders);
      } catch (error) {
        console.error("Erreur lors de la récupération des commandes :", error);
      }
    };

    fetchOrders();
  }, []);

  const handleAction = async (orderId: number, action: string) => {
    try {
      let updateData;
      if (action === "Valider") {
        updateData = { paid: 1, status: "confirmed" };
      } else if (action === "Annuler") {
        updateData = { cancelled: 1, status: "cancelled" };
      } else if (action === "Rembourser") {
        updateData = { refund: 1, status: "refund" };
      }

      const response = await axios.put(`http://127.0.0.1:8000/order/api/Updateorder/${orderId}/`, updateData);
      if (response.status === 200) {
        // Met à jour les données localement après une réponse 200
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId ? { ...order, ...updateData } : order
          )
        );
        console.log(`Commande mise à jour avec succès : ${action}`);
        window.location.reload(); // Recharger la page pour voir les changements
      }
    } catch (error) {
      console.error(`Erreur lors de l'action ${action} :`, error);
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const isPaid = item.paid;
    const isRefunded = item.refund;
    const isCancelled = item.cancelled;

    const containerStyle = isCancelled || isRefunded
      ? styles.greyOrder
      : item.order_status === "pending"
      ? styles.orangeOrder
      : isPaid
      ? styles.greenOrder
      : styles.unpaidOrder;

    return (
      <View style={[styles.orderContainer, containerStyle]}>
        <Text style={styles.orderNumber}>Commande #{item.order_id}</Text>
        <Text style={styles.orderContent}>
          Statut : {item.order_status.charAt(0).toUpperCase() + item.order_status.slice(1)}
        </Text>
        <Text style={styles.orderPrice}>Paiement : {item.cash ? "Cash" : "Carte"}</Text>
        <Text style={styles.orderDate}>Créée le : {new Date(item.created_at).toLocaleString()}</Text>
        <Text style={styles.orderPrice}>Prix total : {item.total_price} DA</Text>
        <TouchableOpacity
          style={styles.orderItem}
          onPress={() => {
            const details = item.items
              .map((orderItem, index) => {
          return (
            `${index + 1}. ${(orderItem.solo || orderItem.extra ? "Solo" : "Menu")} ${orderItem.menu_name}\n` +
            `Quantité: ${orderItem.quantity}\n` +
            (orderItem.composition.length > 0
              ? `Composition:\n${orderItem.composition
            .map(
              (option) =>
                `• ${option.step_name}: ${option.option_name} (+${option.option_price} DA)`
            )
            .join("\n")}`
              : "")
          );
              })
              .join("\n\n");

            alert(`Détails de la commande:\n\n${details}`);
          }}
        >
          <Text style={[styles.badge, styles.menuBadge,{fontSize:"14"}]}>Afficher le contenu de la commande</Text>
        </TouchableOpacity>
        <View style={styles.buttonContainer}>
          {isPaid ? (
            isRefunded ? (
              <Text style={styles.button}>Commande remboursée</Text>
            ) : isCancelled ? (
              <Text style={styles.button}>Commande annulée</Text>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.refundButton]}
                  onPress={() => handleAction(item.order_id, "Rembourser")}
                >
                  <Text style={styles.buttonText}>Rembourser</Text>
                </TouchableOpacity>
                <Text style={styles.buttonText}>Commande validée</Text>
              </>
            )
          ) : isCancelled ? (
            <Text style={styles.button}>Commande annulée</Text>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.validateButton]}
                onPress={() => handleAction(item.order_id, "Valider")}
              >
                <Text style={styles.buttonText}>Valider</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => handleAction(item.order_id, "Annuler")}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

      
      <View style={styles.columnsContainer}>
        {/* Colonne des commandes à confirmer */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>À confirmer</Text>
          <FlatList
            data={orders.filter((order) => order.order_status === "pending")}
            keyExtractor={(item) => item.order_id.toString()}
            renderItem={renderOrder}
          />
        </View>

        {/* Colonne des commandes confirmées */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Confirmées</Text>
          <FlatList
            data={orders.filter((order) => order.order_status === "confirmed")}
            keyExtractor={(item) => item.order_id.toString()}
            renderItem={renderOrder}
          />
        </View>

        {/* Colonne des commandes modifiées */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Prêt</Text>
          <FlatList
            data={orders.filter((order) => order.order_status === "ready")}
            keyExtractor={(item) => item.order_id.toString()}
            renderItem={renderOrder}
          />
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  }
,  
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f4f4f4",
  },
  orderContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  greyOrder: {
    backgroundColor: "#e0e0e0", // Gris pour les commandes annulées ou remboursées
  },
  orangeOrder: {
    backgroundColor: "#fff3cd", // Orange pour les commandes en attente de validation
  },
  greenOrder: {
    backgroundColor: "#d4edda", // Vert pour les commandes validées
  },
  unpaidOrder: {
    backgroundColor: "#f8d7da", // Rouge clair pour les commandes non payées
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  orderContent: {
    fontSize: 16,
    marginBottom: 8,
  },
  orderPrice: {
    fontSize: 16,
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 14,
    marginBottom: 8,
    color: "#666",
  },
  orderItemsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  orderItem: {
    marginBottom: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: "#444",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
  },
  refundButton: {
    backgroundColor: "#dc3545", // Rouge pour le remboursement
  },
  validateButton: {
    backgroundColor: "#28a745", // Vert pour valider
  },
  cancelButton: {
    backgroundColor: "#ffc107", // Orange pour annuler
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    flex: 1,
    marginHorizontal: 8,
    maxHeight: 1000, // ou Dimensions.get("window").height - marge
  },
  
  columnTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  
  orderDetail: {
    fontSize: 14,
    marginBottom: 4,
    color: "#555",
  },
  
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  
  soloBadge: {
    backgroundColor: "#6c757d", // gris
  },
  
  menuBadge: {
    backgroundColor: "#17a2b8", // bleu
  },
  
  compositionBlock: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#ccc",
  },
  
  compositionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
    color: "#333",
  },
  
  compositionItem: {
    fontSize: 13,
    color: "#444",
    marginBottom: 2,
  },
  
});