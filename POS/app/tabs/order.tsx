import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  RefreshControl,
  Modal,
  Alert,
  TextInput
  
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POS_URL } from "@/config";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function OrderScreen() {
  // 1. Interface alignée avec la réponse Django (POSOrderGet)
  interface Order {
    order_id: number; // Utilise order_id comme clé principale
    order_status: string;
    cash: boolean;
    created_at: string;
    total_price: number;
    takeaway: boolean;
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
    paid?: boolean;
    refund?: boolean;
    cancelled?: boolean;
    // On garde 'id' optionnel au cas où, mais on privilégie order_id
    id?: number; 
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      
      console.log("🔍 Récupération commandes pour restaurant:", restaurantId);
      
      const response = await axios.get(
        `${POS_URL}/order/api/getPOSorder/${restaurantId}/`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      console.log("✅ Commandes récupérées:", response.data.orders.length);
      setOrders(response.data.orders);
    } catch (error) {
      console.error("❌ Erreur récupération commandes:", error);
      Alert.alert("Erreur", "Impossible de charger les commandes");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  // 2. Logique Dynamique corrigée
  const handleAction = async (orderId: number, action: string) => {
    try {
      console.log(`🔄 Action ${action} sur commande #${orderId}`);
      
      let updateData: any = {};
      
      // Définition des nouveaux états selon l'action
      if (action === "Valider") {
        updateData = { paid: true, status: "in_progress" };
      } else if (action === "Annuler") {
        updateData = { cancelled: true, status: "cancelled" };
      } else if (action === "Rembourser") {
        updateData = { refund: true, status: "refund" };
      } else if (action === "Prête") {
        updateData = { refund: true, status: "ready" };
      }

      const accessToken = await AsyncStorage.getItem("token");
      
      // Appel API
      const response = await axios.put(
        `${POS_URL}/order/api/Updateorder/${orderId}/`,
        updateData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.status === 200) {
        console.log(`✅ Commande #${orderId} mise à jour: ${action}`);
        
        // MISE À JOUR DYNAMIQUE : On modifie l'état local immédiatement
        // React va détecter le changement de 'order_status' et bouger la carte de colonne
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            // IMPORTANT : On compare avec order_id car c'est ce que Django renvoie
            order.order_id === orderId 
              ? { 
                  ...order, 
                  ...updateData, 
                  order_status: updateData.status // C'est ce champ qui fait bouger la carte
                } 
              : order
          )
        );
        
        // Si la modale est ouverte sur cette commande, on la met à jour aussi ou on ferme
        if (modalVisible && selectedOrder?.order_id === orderId) {
            setModalVisible(false);
            setSelectedOrder(null);
        }
        
        // Feedback visuel optionnel (peut être retiré si trop intrusif)
        // Alert.alert("Succès", `Commande ${action} avec succès`);
      }
    } catch (error: any) {
      console.error(`❌ Erreur ${action}:`, error);
      Alert.alert("Erreur", `Impossible de ${action.toLowerCase()} la commande`);
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return "clock-outline";
      case "in_progress": return "chef-hat";
      case "ready": return "check-circle";
      case "cancelled": return "close-circle";
      case "refund": return "undo";
      default: return "information";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#ff9900";
      case "in_progress": return "#007bff";
      case "ready": return "#28a745";
      case "cancelled": return "#dc3545";
      case "refund": return "#6c757d";
      default: return "#6c757d";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "En attente";
      case "in_progress": return "En cours";
      case "ready": return "Prête";
      case "cancelled": return "Annulée";
      case "refund": return "Remboursée";
      default: return status;
    }
  };

  const renderOrderCard = (order: Order) => {
    const isPaid = order.paid;
    const isRefunded = order.refund;
    const isCancelled = order.cancelled;
    const statusColor = getStatusColor(order.order_status);

    return (
      <View
        key={order.order_id} // Clé unique correcte
        style={[styles.orderCard, { borderLeftColor: statusColor }]}
      >
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <MaterialCommunityIcons
                name={getStatusIcon(order.order_status)}
                size={20}
                color="#fff"
              />
            </View>
            <View>
              <Text style={styles.orderNumber}>#{order.order_id}</Text>
              <Text style={styles.orderTime}>
                {new Date(order.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.orderPrice}>{order.total_price} DA</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name={order.cash ? "cash" : "credit-card"}
              size={16}
              color="#666"
            />
            <Text style={styles.infoText}>{order.cash ? "Cash" : "Carte"}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
            <Text style={styles.infoText}>{order.items.length} article(s)</Text>
          </View>
          {order.takeaway && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="bag-personal" size={16} color="#666" />
              <Text style={styles.infoText}>À emporter</Text>
            </View>
          )}
        </View>

        {/* Bouton détails */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => openOrderDetails(order)}
        >
          <MaterialCommunityIcons name="eye" size={18} color="#007bff" />
          <Text style={styles.detailsButtonText}>Voir les détails</Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isPaid ? (
            isRefunded ? (
              <View style={[styles.statusBadgeInline, { backgroundColor: "#e0e0e0" }]}>
                <MaterialCommunityIcons name="undo" size={16} color="#666" />
                <Text style={{ color: "#666", fontWeight: "600", marginLeft: 8 }}>
                  Remboursée
                </Text>
              </View>
            ) : isCancelled ? (
              <View style={[styles.statusBadgeInline, { backgroundColor: "#f8d7da" }]}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#dc3545" />
                <Text style={{ color: "#dc3545", fontWeight: "600", marginLeft: 8 }}>
                  Annulée
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
        {order.order_status === "in_progress" && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#28a745" }]}
            onPress={() => handleAction(order.order_id, "Prête")}
          >
            <MaterialCommunityIcons name="check-all" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Prête</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, styles.refundButton]}
          onPress={() => handleAction(order.order_id, "Rembourser")}
        >
          <MaterialCommunityIcons name="undo" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Rembourser</Text>
        </TouchableOpacity>
      </View>
              
            )
          ) : isCancelled ? (
            <View style={[styles.statusBadgeInline, { backgroundColor: "#f8d7da" }]}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#dc3545" />
              <Text style={{ color: "#dc3545", fontWeight: "600", marginLeft: 8 }}>
                Annulée
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.validateButton]}
                onPress={() => handleAction(order.order_id, "Valider")}
              >
                <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Valider</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleAction(order.order_id, "Annuler")}
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

  const renderColumn = (title: string, status: string, icon: any) => {
    // Filtrage combiné : Statut + Recherche par numéro
    const filteredOrders = orders.filter((order) => {
      const matchesStatus = order.order_status === status;
      // On vérifie si order_id contient la chaîne recherchée
      const matchesSearch = order.order_id.toString().includes(searchQuery);
      
      return matchesStatus && matchesSearch;
    });
  
    const statusColor = getStatusColor(status);

    return (
      <View style={styles.columnWrapper}>
        {/* Header */}
        <View style={[styles.columnHeader, { borderBottomColor: statusColor }]}>
          <MaterialCommunityIcons name={icon} size={24} color={statusColor} />
          <Text style={[styles.columnTitle, { color: statusColor }]}>{title}</Text>
          <View style={[styles.countBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.countText}>{filteredOrders.length}</Text>
          </View>
        </View>

        {/* Liste */}
        <ScrollView
          style={styles.scrollColumn}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyColumn}>
              <MaterialCommunityIcons name="inbox-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucune commande</Text>
            </View>
          ) : (
            filteredOrders.map((order) => renderOrderCard(order))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
  <View style={{ flex: 1 }}>
    <Text style={styles.headerTitle}>Gestion des Commandes</Text>
    <View style={styles.searchContainer}>
      <MaterialCommunityIcons name="magnify" size={20} color="#999" />
      <TextInput
        style={styles.searchInput}
        placeholder="Rechercher un N° (#123...)"
        value={searchQuery}
        onChangeText={setSearchQuery}
        keyboardType="numeric"
      />
      {searchQuery !== "" && (
        <TouchableOpacity onPress={() => setSearchQuery("")}>
          <MaterialCommunityIcons name="close-circle" size={18} color="#999" />
        </TouchableOpacity>
      )}
    </View>
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

      {/* Modale des détails */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {selectedOrder && (
              <>
                {/* Header de la modale */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <MaterialCommunityIcons
                      name="receipt-text"
                      size={32}
                      color="#ff9900"
                    />
                    <View style={{ marginLeft: 12 }}>
                      {/* Utilisation de order_id */}
                      <Text style={styles.modalTitle}>
                        Commande #{selectedOrder.order_id}
                      </Text>
                      <Text style={styles.modalSubtitle}>
                        {new Date(selectedOrder.created_at).toLocaleString("fr-FR")}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons name="close" size={28} color="#333" />
                  </TouchableOpacity>
                </View>

                {/* Infos générales */}
                <View style={styles.modalInfos}>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons
                      name={selectedOrder.cash ? "cash" : "credit-card"}
                      size={24}
                      color="#666"
                    />
                    <Text style={styles.modalInfoText}>
                      {selectedOrder.cash ? "Paiement Cash" : "Paiement Carte"}
                    </Text>
                  </View>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons
                      name={selectedOrder.takeaway ? "bag-personal" : "silverware-fork-knife"}
                      size={24}
                      color="#666"
                    />
                    <Text style={styles.modalInfoText}>
                      {selectedOrder.takeaway ? "À emporter" : "Sur place"}
                    </Text>
                  </View>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons
                      name={getStatusIcon(selectedOrder.order_status)}
                      size={24}
                      color={getStatusColor(selectedOrder.order_status)}
                    />
                    <Text style={styles.modalInfoText}>
                      {getStatusLabel(selectedOrder.order_status)}
                    </Text>
                  </View>
                </View>

                {/* Liste des articles */}
                <View style={styles.modalDivider} />
                <Text style={styles.modalSectionTitle}>Articles commandés</Text>

                <ScrollView style={styles.modalItemsList}>
                  {selectedOrder.items.map((item, index) => (
                    <View key={index} style={styles.modalItem}>
                      <View style={styles.modalItemHeader}>
                        <View style={styles.modalItemQty}>
                          <Text style={styles.modalItemQtyText}>{item.quantity}x</Text>
                        </View>
                        <Text style={styles.modalItemName}>
                          {item.solo || item.extra ? "Solo/Extra " : ""}
                          {item.menu_name}
                        </Text>
                      </View>

                      {/* Composition */}
                      {item.composition.length > 0 && (
                        <View style={styles.modalComposition}>
                          {item.composition.map((option, idx) => (
                            <View key={idx} style={styles.modalOption}>
                              <MaterialCommunityIcons
                                name="chevron-right"
                                size={16}
                                color="#999"
                              />
                              <Text style={styles.modalOptionStep}>
                                {option.step_name}:
                              </Text>
                              <Text style={styles.modalOptionName}>
                                {option.option_name}
                              </Text>
                              {option.option_price > 0 && (
                                <Text style={styles.modalOptionPrice}>
                                  +{option.option_price} DA
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>

                {/* Total */}
                <View style={styles.modalDivider} />
                <View style={styles.modalTotal}>
                  <Text style={styles.modalTotalLabel}>TOTAL</Text>
                  <Text style={styles.modalTotalAmount}>
                    {selectedOrder.total_price} DA
                  </Text>
                </View>

                {/* Actions dans la modale */}
                <View style={styles.modalActions}>
                  {selectedOrder.paid ? (
                    selectedOrder.refund ? (
                      <View style={styles.modalStatusBadge}>
                        <MaterialCommunityIcons name="undo" size={20} color="#666" />
                        <Text style={styles.modalStatusText}>Remboursée</Text>
                      </View>
                    ) : selectedOrder.cancelled ? (
                      <View style={styles.modalStatusBadge}>
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={20}
                          color="#dc3545"
                        />
                        <Text style={[styles.modalStatusText, { color: "#dc3545" }]}>
                          Annulée
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#dc3545" }]}
                        onPress={() => handleAction(selectedOrder.order_id, "Rembourser")}
                      >
                        <MaterialCommunityIcons name="undo" size={22} color="#fff" />
                        <Text style={styles.modalActionText}>Rembourser</Text>
                      </TouchableOpacity>
                    )
                  ) : selectedOrder.cancelled ? (
                    <View style={styles.modalStatusBadge}>
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={20}
                        color="#dc3545"
                      />
                      <Text style={[styles.modalStatusText, { color: "#dc3545" }]}>
                        Annulée
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#28a745" }]}
                        onPress={() => handleAction(selectedOrder.order_id, "Valider")}
                      >
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color="#fff"
                        />
                        <Text style={styles.modalActionText}>Valider</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#ffc107" }]}
                        onPress={() => handleAction(selectedOrder.order_id, "Annuler")}
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={22}
                          color="#fff"
                        />
                        <Text style={styles.modalActionText}>Annuler</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    flexWrap: "wrap",
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
  detailsButton: {
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
  detailsButtonText: {
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
  statusBadgeInline: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  
  // MODALE
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxWidth: 700,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },
  modalInfos: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
    flexWrap: "wrap",
  },
  modalInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalInfoText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 24,
    marginVertical: 8,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalItemsList: {
    maxHeight: 300,
    paddingHorizontal: 24,
  },
  modalItem: {
    marginBottom: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  modalItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  modalItemQty: {
    backgroundColor: "#ff9900",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  modalItemQtyText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  modalComposition: {
    marginTop: 8,
    paddingLeft: 12,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 6,
  },
  modalOptionStep: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  modalOptionName: {
    fontSize: 13,
    color: "#333",
    flex: 1,
  },
  modalOptionPrice: {
    fontSize: 13,
    color: "#28a745",
    fontWeight: "700",
  },
  modalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#f8f9fa",
  },
  modalTotalLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333",
  },
  modalTotalAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ff6b35",
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  modalActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  modalStatusBadge: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e0e0e0",
  },
  modalStatusText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#666",
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 10,
    height: 40,
    maxWidth: 300,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0, // Important pour Android
  },
});