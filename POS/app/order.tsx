import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Platform 
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPosUrl } from "@/utils/serverConfig";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function OrderScreen() {
  // 1. Interface
  interface Order {
    order_id: number; 
    order_status: string;
    cash: boolean;
    created_at: string;
    last_updated?: string; // Pour le tri
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
    id?: number; 
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // --- ÉTATS POUR L'HISTORIQUE ---
  const [historyVisible, setHistoryVisible] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      
      console.log("🔍 Récupération commandes pour restaurant:", restaurantId);
      
      const response = await axios.get(
        `${getPosUrl()}/order/api/getPOSorder/${restaurantId}/`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      // On initialise last_updated avec created_at au chargement
      const ordersWithSortKey = response.data.orders.map((o: Order) => ({
          ...o,
          last_updated: o.created_at 
      }));

      setOrders(ordersWithSortKey);
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

  // --- FONCTION DE SÉCURITÉ (DEBUGGÉE) ---
  const confirmRefund = (orderId: number) => {
    console.log("🛑 Tentative de remboursement pour la commande #", orderId);
    
    const title = "Confirmation de remboursement";
    const message = `Êtes-vous sûr de vouloir rembourser la commande #${orderId} ?\nCette action est irréversible.`;

    // Vérification explicite de la plateforme
    if (Platform.OS === 'web') {
        const confirm = window.confirm(`${title}\n\n${message}`);
        if (confirm) {
            handleAction(orderId, "Rembourser");
        }
    } else {
        Alert.alert(
          title,
          message,
          [
            { text: "Annuler", style: "cancel", onPress: () => console.log("Remboursement annulé") },
            { 
              text: "Oui, Rembourser", 
              style: "destructive", 
              onPress: () => handleAction(orderId, "Rembourser") 
            }
          ]
        );
    }
  };

  // --- IMPRESSION ---
  const handleReprint = async (orderId: number) => {
    try {
      setPrinting(true);
      const token = await AsyncStorage.getItem("token");
      
      const response = await axios.get(
        `${getPosUrl()}/order/api/generateTicket/${orderId}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("🖨️ Ticket envoyé");
      Alert.alert("Succès", "Ticket envoyé à l'imprimante");

    } catch (error) {
      console.error("Erreur impression:", error);
      Alert.alert("Erreur", "Impossible de générer le ticket");
    } finally {
      setPrinting(false);
    }
  };

  // --- FILTRE HISTORIQUE ROBUSTE ---
  const getHistoryOrders = () => {
    // Utilisation de toLocaleDateString pour ignorer l'heure et comparer juste la date
    const todayStr = new Date().toLocaleDateString("fr-FR");

    return orders.filter(order => {
      const orderDateStr = new Date(order.created_at).toLocaleDateString("fr-FR");
      const isSameDay = orderDateStr === todayStr;
      
      // Est-ce terminé ?
      const isFinished = order.paid || order.cancelled || order.refund;

      return isSameDay && isFinished;
    }).sort((a, b) => {
        // Tri plus récent en haut
        const dateA = new Date(a.last_updated || a.created_at).getTime();
        const dateB = new Date(b.last_updated || b.created_at).getTime();
        return dateB - dateA;
    });
  };

  // --- LOGIQUE D'ACTION ---
  const handleAction = async (orderId: number, action: string) => {
    try {
      console.log(`🚀 Exécution Action: ${action} sur #${orderId}`);
      
      let updateData: any = {};
      
      if (action === "Valider") {
        updateData = { paid: true, status: "in_progress" };
      } else if (action === "Annuler") {
        updateData = { cancelled: true, status: "cancelled" };
      } else if (action === "Rembourser") {
        updateData = { refund: true, status: "refund" };
      } else if (action === "Prête") {
        updateData = { status: "ready" }; 
      }

      const accessToken = await AsyncStorage.getItem("token");
      
      const response = await axios.put(
        `${getPosUrl()}/order/api/Updateorder/${orderId}/`,
        updateData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.status === 200) {
        console.log(`✅ Succès API: ${action}`);
        
        // Mise à jour locale immédiate
        const nowIso = new Date().toISOString();

        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.order_id === orderId 
              ? { 
                  ...order, 
                  ...updateData, 
                  order_status: updateData.status || order.order_status,
                  last_updated: nowIso // Remonte la commande en haut
                } 
              : order
          )
        );
        
        // Gestion de la modale après action
        if (modalVisible && selectedOrder?.order_id === orderId) {
            // Si c'est un remboursement ou une annulation, on ferme la modale
            if(action === "Rembourser" || action === "Annuler") {
                setModalVisible(false);
                setSelectedOrder(null);
            } else {
                // Sinon on met à jour l'affichage dans la modale
                setSelectedOrder(prev => prev ? ({ 
                    ...prev, 
                    ...updateData, 
                    order_status: updateData.status || prev.order_status 
                }) : null);
            }
        }
      }
    } catch (error: any) {
      console.error(`❌ Erreur dans handleAction (${action}):`, error);
      Alert.alert("Erreur API", `Impossible de ${action.toLowerCase()} la commande. Vérifiez votre connexion.`);
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

  // --- RENDER: HISTORIQUE MODAL ---
  const renderHistoryModal = () => {
    const historyOrders = getHistoryOrders();

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyVisible}
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historyContent}>
            
            <View style={styles.historyHeader}>
              <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
                <View style={styles.historyIconBadge}>
                    <MaterialCommunityIcons name="history" size={24} color="#6366F1" />
                </View>
                <View>
                    <Text style={styles.historyTitle}>Historique du Jour</Text>
                    <Text style={styles.historySubtitle}>{historyOrders.length} commandes aujourd'hui</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.closeHistoryBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historyList} contentContainerStyle={{paddingBottom: 20}}>
              {historyOrders.length === 0 ? (
                 <View style={styles.emptyHistory}>
                    <MaterialCommunityIcons name="receipt-text-outline" size={48} color="#CBD5E1" />
                    <Text style={{color: "#94A3B8", marginTop: 10}}>Aucune commande terminée aujourd'hui</Text>
                 </View>
              ) : (
                historyOrders.map((order) => (
                  <View key={order.order_id} style={styles.historyCard}>
                    <View style={styles.historyInfo}>
                        <View style={styles.historyIdRow}>
                            <Text style={styles.historyId}>#{order.order_id}</Text>
                            {order.refund ? (
                                <View style={[styles.miniBadge, {backgroundColor: '#FEE2E2'}]}>
                                    <Text style={{color: '#EF4444', fontSize: 10, fontWeight: '700'}}>REMBOURSÉ</Text>
                                </View>
                            ) : order.cancelled ? (
                                <View style={[styles.miniBadge, {backgroundColor: '#FEF3C7'}]}>
                                    <Text style={{color: '#D97706', fontSize: 10, fontWeight: '700'}}>ANNULÉ</Text>
                                </View>
                            ) : (
                                <View style={[styles.miniBadge, {backgroundColor: '#DCFCE7'}]}>
                                    <Text style={{color: '#166534', fontSize: 10, fontWeight: '700'}}>PAYÉ</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.historyTime}>
                            {new Date(order.created_at).toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})} • {order.items.length} articles
                        </Text>
                        <Text style={styles.historyPrice}>{order.total_price} DA</Text>
                    </View>

                    <View style={styles.historyActions}>
                        <TouchableOpacity 
                            style={styles.iconBtnInfo} 
                            onPress={() => handleReprint(order.order_id)}
                            disabled={printing}
                        >
                            <MaterialCommunityIcons name="printer" size={20} color="#3B82F6" />
                        </TouchableOpacity>

                        {!order.refund && !order.cancelled && (
                             <TouchableOpacity 
                                style={styles.iconBtnDanger} 
                                onPress={() => confirmRefund(order.order_id)}
                             >
                                <MaterialCommunityIcons name="undo" size={20} color="#EF4444" />
                             </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                            style={styles.iconBtnDefault} 
                            onPress={() => {
                                setHistoryVisible(false);
                                setTimeout(() => openOrderDetails(order), 300);
                            }}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderOrderCard = (order: Order) => {
    const isPaid = order.paid;
    const isRefunded = order.refund;
    const isCancelled = order.cancelled;
    const statusColor = getStatusColor(order.order_status);

    return (
      <View
        key={order.order_id}
        style={[styles.orderCard, { borderLeftColor: statusColor }]}
      >
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

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => openOrderDetails(order)}
        >
          <MaterialCommunityIcons name="eye" size={18} color="#007bff" />
          <Text style={styles.detailsButtonText}>Voir les détails</Text>
        </TouchableOpacity>

        {/* --- ACTIONS SUR LA CARTE PRINCIPALE (SANS LE BOUTON REMBOURSER) --- */}
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
              // Juste le bouton PRÊTE ici, le Remboursement est dans les détails
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {order.order_status === "in_progress" && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: "#28a745" }]}
                    onPress={() => handleAction(order.order_id, "Prête")}
                  >
                    <MaterialCommunityIcons name="check-all" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Prête</Text>
                  </TouchableOpacity>
                )}
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
    // 1. Filtrer
    const filteredOrders = orders.filter((order) => {
      const matchesStatus = order.order_status === status;
      const matchesSearch = order.order_id.toString().includes(searchQuery);
      return matchesStatus && matchesSearch;
    });

    // 2. TRI INTELLIGENT : Utilise last_updated (Modification récente en haut)
    filteredOrders.sort((a, b) => {
        const timeA = new Date(a.last_updated || a.created_at).getTime();
        const timeB = new Date(b.last_updated || b.created_at).getTime();
        return timeB - timeA;
    });
  
    const statusColor = getStatusColor(status);

    return (
      <View style={styles.columnWrapper}>
        <View style={[styles.columnHeader, { borderBottomColor: statusColor }]}>
          <MaterialCommunityIcons name={icon} size={24} color={statusColor} />
          <Text style={[styles.columnTitle, { color: statusColor }]}>{title}</Text>
          <View style={[styles.countBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.countText}>{filteredOrders.length}</Text>
          </View>
        </View>

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

        <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
            <TouchableOpacity 
                style={[styles.refreshButton, {backgroundColor: '#6366F1'}]}
                onPress={() => setHistoryVisible(true)}
            >
                <MaterialCommunityIcons name="history" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Colonnes Kanban */}
      <View style={styles.columnsContainer}>
        {renderColumn("À confirmer", "pending", "clock-outline")}
        {renderColumn("En cours", "in_progress", "chef-hat")}
        {renderColumn("Prête", "ready", "check-circle")}
      </View>

      {/* Modale Historique */}
      {renderHistoryModal()}

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
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <MaterialCommunityIcons
                      name="receipt-text"
                      size={32}
                      color="#ff9900"
                    />
                    <View style={{ marginLeft: 12 }}>
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

                <View style={styles.modalDivider} />
                <View style={styles.modalTotal}>
                  <Text style={styles.modalTotalLabel}>TOTAL</Text>
                  <Text style={styles.modalTotalAmount}>
                    {selectedOrder.total_price} DA
                  </Text>
                </View>

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
                      // 🔔 LE BOUTON REMBOURSER EST ICI (DANS LA MODALE)
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#dc3545" }]}
                        onPress={() => confirmRefund(selectedOrder.order_id)}
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
    paddingVertical: 0, 
  },

  // STYLES HISTORIQUE (PANNEAU MODERNE)
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end', 
  },
  historyContent: {
    backgroundColor: '#F8FAFC',
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
    padding: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  historyIconBadge: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center'
  },
  historyTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  historySubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  closeHistoryBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 50, borderWidth: 1, borderColor: '#E2E8F0' },
  
  historyList: { flex: 1 },
  emptyHistory: { alignItems: 'center', marginTop: 50 },

  historyCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyInfo: { flex: 1 },
  historyIdRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  historyId: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyTime: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  historyPrice: { fontSize: 15, fontWeight: '700', color: '#6366F1' },

  historyActions: { flexDirection: 'row', gap: 8 },
  iconBtnInfo: { 
    width: 36, height: 36, borderRadius: 10, 
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' 
  },
  iconBtnDanger: { 
    width: 36, height: 36, borderRadius: 10, 
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' 
  },
  iconBtnDefault: { 
    width: 36, height: 36, borderRadius: 10, 
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' 
  },
});