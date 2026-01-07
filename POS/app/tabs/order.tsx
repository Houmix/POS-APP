import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Dimensions, RefreshControl } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POS_URL, idRestaurant } from "@/config";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

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
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      const response = await axios.get(`${POS_URL}/order/api/getPOSorder/${restaurantId}/`, {
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const handleAction = async (orderId: number, action: string) => {
    try {
      let updateData;
      if (action === "Valider") {
        updateData = { paid: 1, status: "in_progress" };
      } else if (action === "Annuler") {
        updateData = { cancelled: 1, status: "cancelled" };
      } else if (action === "Rembourser") {
        updateData = { refund: 1, status: "refund" };
      }

      const response = await axios.put(`${POS_URL}/order/api/Updateorder/${orderId}/`, updateData);
      if (response.status === 200) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId ? { ...order, ...updateData } : order
          )
        );
        console.log(`Commande mise à jour avec succès : ${action}`);
      }
    } catch (error) {
      console.error(`Erreur lors de l'action ${action} :`, error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "clock-outline";
      case "in_progress":
        return "chef-hat";
      case "ready":
        return "check-circle";
      default:
        return "information";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#ff9900";
      case "in_progress":
        return "#007bff";
      case "ready":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const isPaid = item.paid;
    const isRefunded = item.refund;
    const isCancelled = item.cancelled;
    const statusColor = getStatusColor(item.order_status);

    return (
      <View style={[styles.orderCard, { borderLeftColor: statusColor }]}>
        {/* Header de la commande */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <MaterialCommunityIcons name={getStatusIcon(item.order_status)} size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.orderNumber}>#{item.order_id}</Text>
              <Text style={styles.orderTime}>
                {new Date(item.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.orderPrice}>{item.total_price} DA</Text>
          </View>
        </View>

        {/* Infos de la commande */}
        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name={item.cash ? "cash" : "credit-card"} size={16} color="#666" />
            <Text style={styles.infoText}>{item.cash ? "Cash" : "Carte"}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="package-multiple" size={16} color="#666" />
            <Text style={styles.infoText}>{item.items.length} article(s)</Text>
          </View>
        </View>

        {/* Contenu de la commande */}
        <TouchableOpacity
          style={styles.contentButton}
          onPress={() => {
            const details = item.items
              .map((orderItem, index) => {
                return (
                  `${index + 1}. ${orderItem.solo || orderItem.extra ? "Solo" : "Menu"} ${orderItem.menu_name}\n` +
                  `   Quantité: ${orderItem.quantity}\n` +
                  (orderItem.composition.length > 0
                    ? `   Composition:\n${orderItem.composition
                        .map((option) => `   • ${option.step_name}: ${option.option_name}`)
                        .join("\n")}`
                    : "")
                );
              })
              .join("\n\n");

            alert(`Détails de la commande:\n\n${details}`);
          }}
        >
          <MaterialCommunityIcons name="eye" size={18} color="#007bff" />
          <Text style={styles.contentButtonText}>Voir les détails</Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isPaid ? (
            isRefunded ? (
              <View style={[styles.statusText, { backgroundColor: "#e0e0e0" }]}>
                <MaterialCommunityIcons name="undo" size={16} color="#666" />
                <Text style={{ color: "#666", fontWeight: "600", marginLeft: 8 }}>Remboursée</Text>
              </View>
            ) : isCancelled ? (
              <View style={[styles.statusText, { backgroundColor: "#f8d7da" }]}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#dc3545" />
                <Text style={{ color: "#dc3545", fontWeight: "600", marginLeft: 8 }}>Annulée</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.refundButton]}
                onPress={() => handleAction(item.id, "Rembourser")}
              >
                <MaterialCommunityIcons name="undo" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Rembourser</Text>
              </TouchableOpacity>
            )
          ) : isCancelled ? (
            <View style={[styles.statusText, { backgroundColor: "#f8d7da" }]}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#dc3545" />
              <Text style={{ color: "#dc3545", fontWeight: "600", marginLeft: 8 }}>Annulée</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.validateButton]}
                onPress={() => handleAction(item.id, "Valider")}
              >
                <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Valider</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleAction(item.id, "Annuler")}
              >
                <MaterialCommunityIcons name="close-circle" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderColumn = (title: string, status: string, icon: string) => {
    const filteredOrders = orders.filter((order) => order.order_status === status);
    const statusColor = getStatusColor(status);

    return (
      <View style={styles.columnWrapper}>
        {/* Titre de la colonne */}
        <View style={[styles.columnHeader, { borderBottomColor: statusColor }]}>
          <MaterialCommunityIcons name={icon} size={24} color={statusColor} />
          <Text style={[styles.columnTitle, { color: statusColor }]}>{title}</Text>
          <View style={[styles.countBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.countText}>{filteredOrders.length}</Text>
          </View>
        </View>

        {/* Liste des commandes */}
        <ScrollView
          style={styles.scrollColumn}
          scrollEnabled={filteredOrders.length > 0}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyColumn}>
              <MaterialCommunityIcons name="inbox-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucune commande</Text>
            </View>
          ) : (
            filteredOrders.map((order) => (
              <View key={order.order_id}>
                {renderOrder({ item: order })}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion des Commandes</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length} commande{orders.length > 1 ? "s" : ""} en total
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Colonnes */}
      <View style={styles.columnsContainer}>
        {renderColumn("À confirmer", "pending", "clock-outline")}
        {renderColumn("En cours", "in_progress", "chef-hat")}
        {renderColumn("Prête", "ready", "check-circle")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ff9900",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ff9900",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  columnsContainer: {
    flex: 1,
    flexDirection: "row",
    padding: 12,
  },
  columnWrapper: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 3,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 12,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  scrollColumn: {
    flex: 1,
  },
  emptyColumn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  orderCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
  },
  orderTime: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  priceContainer: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff6b35",
  },
  orderInfo: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  contentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#e7f3ff",
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: "center",
    gap: 8,
  },
  contentButtonText: {
    color: "#007bff",
    fontWeight: "600",
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  validateButton: {
    backgroundColor: "#28a745",
  },
  refundButton: {
    backgroundColor: "#dc3545",
  },
  cancelButton: {
    backgroundColor: "#ffc107",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  statusText: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});