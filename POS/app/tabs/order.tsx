import React, { useEffect, useState, useRef, useCallback } from "react";
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
    kds_status: string;
    delivery_type: string;
    customer_identifier?: string;
    cash: boolean;
    created_at: string;
    last_updated?: string;
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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // États Modale Détails
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // États Modale Remboursement (NOUVEAU)
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<number | null>(null);

  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // États Historique
  const [historyVisible, setHistoryVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const CLOUD_URL = 'https://borndz-production.up.railway.app';
  const PUSH_TS_KEY = 'last_push_to_cloud_ts';

  const connectWS = useCallback(() => {
    const posUrl = getPosUrl();
    if (!posUrl) return;
    const wsUrl = posUrl.replace(/^http/, 'ws') + '/ws/kds/';

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'kds_message') return;
        const { type, order_id, kds_status: newKdsStatus } = msg.data;

        if (type === 'new_order') {
          fetchOrders();
        } else if (type === 'order_updated') {
          if (newKdsStatus === 'delivered') {
            setOrders(prev => prev.filter(o => o.order_id !== order_id));
          } else {
            setOrders(prev =>
              prev.map(o =>
                o.order_id === order_id
                  ? { ...o, kds_status: newKdsStatus || o.kds_status }
                  : o
              )
            );
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connectWS, 4000);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    fetchOrders();
    connectWS();
    pushLocalToCloud(false); // silencieux au démarrage
    const pushInterval = setInterval(() => pushLocalToCloud(false), 5 * 60 * 1000);
    // Rafraîchissement automatique toutes les 2 secondes (fallback si WS indisponible)
    const autoRefreshInterval = setInterval(() => fetchOrders(), 2000);
    return () => {
      clearInterval(pushInterval);
      clearInterval(autoRefreshInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-ouvrir la commande quand le scan QR correspond exactement à un order_id
  useEffect(() => {
    if (!searchQuery) return;
    const id = parseInt(searchQuery.trim(), 10);
    if (isNaN(id)) return;
    const match = orders.find(o => o.order_id === id);
    if (match) {
      openOrderDetails(match);
      setSearchQuery('');
    }
  }, [searchQuery, orders]);

  const fetchOrders = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      
      const response = await axios.get(
        `${getPosUrl()}/order/api/getPOSorder/${restaurantId}/`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      const ordersWithSortKey = response.data.orders.map((o: Order) => ({
          ...o,
          last_updated: o.created_at 
      }));

      setOrders(ordersWithSortKey);
    } catch (error) {
      console.error("❌ Erreur récupération commandes:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  // --- NOUVELLE LOGIQUE DE REMBOURSEMENT ---
  const confirmRefund = (orderId: number) => {
    // Au lieu d'une alerte, on ouvre notre modale personnalisée
    setOrderToRefund(orderId);
    setRefundModalVisible(true);
  };

  const executeRefund = () => {
    if (orderToRefund) {
        handleAction(orderToRefund, "Rembourser");
        setRefundModalVisible(false);
        setOrderToRefund(null);
    }
  };
  const handlePrinting = async (ticketContent, qrContent = '') => {
    if (!window.electronAPI?.printTicket) {
        console.error("❌ API Electron non disponible.");
        return { success: false, error: "Lien avec le matériel manquant" };
    }
    try {
        const result = await window.electronAPI.printTicket(ticketContent, qrContent);
        return result;
    } catch (error) {
        console.error("❌ Erreur de communication imprimante:", error);
        return { success: false, error: error.message };
    }
  };
  // --- PUSH LOCAL → CLOUD (commandes + fidélité) ---
  const pushLocalToCloud = async (showAlert = true) => {
    if (pushing) return;
    setPushing(true);
    try {
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      if (!restaurantId) return;

      // Récupérer le timestamp de la dernière sync réussie (déduplication)
      const lastPushTs = await AsyncStorage.getItem(PUSH_TS_KEY);
      const sinceParam = lastPushTs ? `&since=${lastPushTs}` : '';

      // Étape 1 : exporter les données locales nouvelles uniquement
      const exportRes = await axios.get(
        `${getPosUrl()}/api/sync/export-for-cloud/?restaurant_id=${restaurantId}${sinceParam}`,
        { timeout: 15000 }
      );
      if (!exportRes.data.success) return;

      const { changes, counts } = exportRes.data;
      if (!changes || changes.length === 0) return; // rien de nouveau

      // Étape 2 : pousser vers le cloud
      const pushRes = await axios.post(
        `${CLOUD_URL}/api/sync/push/`,
        {
          restaurant_id: parseInt(restaurantId),
          terminal_uuid: 'pos-local',
          changes,
        },
        { timeout: 30000 }
      );

      if (pushRes.data.success) {
        // Mémoriser le timestamp pour ne pas re-envoyer les mêmes données
        await AsyncStorage.setItem(PUSH_TS_KEY, new Date().toISOString());
        if (showAlert) {
          Alert.alert('Upload ✓', `${counts?.orders ?? 0} commande(s) • ${counts?.loyalty_profiles ?? 0} profil(s) fidélité envoyés au cloud.`);
        }
      }
    } catch (e: any) {
      if (showAlert) {
        Alert.alert('Erreur upload', e?.message || 'Impossible d\'envoyer les données au cloud.');
      }
    } finally {
      setPushing(false);
    }
  };

  // --- SYNC CLOUD ---
  const handleSyncCloud = async () => {
    setSyncing(true);
    try {
      const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
      if (!restaurantId) {
        Alert.alert('Erreur sync', 'Aucun restaurant configuré (Employee_restaurant_id manquant).');
        return;
      }
      const CLOUD_URL = 'https://borndz-production.up.railway.app';

      // Étape 1 : récupérer le snapshot depuis le cloud
      let snapshotRes: any;
      try {
        snapshotRes = await axios.get(
          `${CLOUD_URL}/api/sync/snapshot/?restaurant_id=${restaurantId}`,
          { timeout: 45000 }
        );
      } catch (cloudErr: any) {
        const status = cloudErr.response?.status;
        const serverMsg = cloudErr.response?.data?.error;
        if (status === 404) {
          Alert.alert('Erreur sync', `Restaurant #${restaurantId} introuvable sur le cloud.\n\n${serverMsg || ''}`);
        } else if (cloudErr.code === 'ECONNABORTED') {
          Alert.alert('Erreur sync', 'Le serveur cloud met trop de temps à répondre (cold start Railway ?). Réessaie dans 30 secondes.');
        } else {
          Alert.alert('Erreur sync cloud', `HTTP ${status || '?'} — ${serverMsg || cloudErr.message}`);
        }
        return;
      }

      if (!snapshotRes.data.success) {
        Alert.alert('Erreur sync', snapshotRes.data.error || 'Snapshot cloud invalide');
        return;
      }

      // Étape 2 : appliquer localement
      let applyRes: any;
      try {
        applyRes = await axios.post(
          `${getPosUrl()}/api/sync/apply-snapshot/`,
          snapshotRes.data,
          { timeout: 30000 }
        );
      } catch (localErr: any) {
        const serverMsg = localErr.response?.data?.error;
        Alert.alert('Erreur sync locale', `Impossible d'appliquer le snapshot.\n${serverMsg || localErr.message}`);
        return;
      }

      if (!applyRes.data.success) {
        Alert.alert('Erreur sync locale', applyRes.data.error || 'Échec de la sync locale');
        return;
      }

      const applied = applyRes.data.applied || {};
      Alert.alert('Sync terminée ✓', `Données synchronisées depuis le cloud.\nMenus: ${applied.menu ?? '?'} • Catégories: ${applied.group_menu ?? '?'}`);
      await fetchOrders();
    } finally {
      setSyncing(false);
    }
  };

  // --- LIVRER ---
  const handleDeliver = async (orderId: number) => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      await axios.put(
        `${getPosUrl()}/order/api/Updateorder/${orderId}/`,
        { kds_status: 'delivered' },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setOrders(prev => prev.filter(o => o.order_id !== orderId));
    } catch (error: any) {
      console.error("❌ Erreur livraison:", error);
      Alert.alert("Erreur", "Impossible de marquer la commande comme livrée.");
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
      const { ticket_content, qr_content } = response.data;
      const printResult = await handlePrinting(ticket_content, qr_content || '');

      Alert.alert("Succès", "Ticket envoyé à l'imprimante");
      
      if (printResult.success) {
        console.log("✅ Impression et découpe terminées");
      } else {
          throw new Error(printResult.error);
      }

      } catch (error) {
          console.error("❌ Erreur Process:", error);
          Alert.alert("Erreur", "Impossible de générer le ticket");
      } finally {
          setPrinting(false);
        };

  }
  // --- FILTRE HISTORIQUE ---
  const getHistoryOrders = () => {
    // Calcul des dates de référence
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayStr = today.toLocaleDateString("fr-FR");
    const yesterdayStr = yesterday.toLocaleDateString("fr-FR");

    return orders.filter(order => {
      const orderDateStr = new Date(order.created_at).toLocaleDateString("fr-FR");
      
      // On vérifie si la date de la commande correspond à aujourd'hui OU hier
      const isRecent = orderDateStr === todayStr || orderDateStr === yesterdayStr;
      
      return isRecent; 
      
    }).sort((a, b) => {
        const dateA = new Date(a.last_updated || a.created_at).getTime();
        const dateB = new Date(b.last_updated || b.created_at).getTime();
        return dateB - dateA;
    });
  };

  // --- Valider une commande espèces (envoie sur KDS) ---
  const validateCashOrder = async (orderId: number) => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      await axios.put(
        `${getPosUrl()}/order/api/validateOrder/${orderId}/`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setOrders(prev =>
        prev.map(o => o.order_id === orderId
          ? { ...o, kds_status: "new", order_status: "confirmed" }
          : o
        )
      );
    } catch (error: any) {
      console.error("❌ Erreur validation:", error);
      Alert.alert("Erreur", "Impossible de valider la commande.");
    }
  };

  // --- LOGIQUE D'ACTION ---
  const handleAction = async (orderId: number, action: string) => {
    try {
      console.log(`🚀 Exécution Action: ${action} sur #${orderId}`);

      let updateData: any = {};
      if (action === "Valider") updateData = { paid: true, status: "in_progress" };
      else if (action === "Annuler") updateData = { cancelled: true, status: "cancelled" };
      else if (action === "Rembourser") updateData = { refund: true, status: "refund" };
      else if (action === "Prête") updateData = { status: "ready" };

      const accessToken = await AsyncStorage.getItem("token");

      const response = await axios.put(
        `${getPosUrl()}/order/api/Updateorder/${orderId}/`,
        updateData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (response.status === 200) {
        const nowIso = new Date().toISOString();

        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.order_id === orderId 
              ? { 
                  ...order, 
                  ...updateData, 
                  order_status: updateData.status || order.order_status,
                  last_updated: nowIso 
                } 
              : order
          )
        );
        
        if (modalVisible && selectedOrder?.order_id === orderId) {
            if(action === "Rembourser" || action === "Annuler") {
                setModalVisible(false);
                setSelectedOrder(null);
            } else {
                setSelectedOrder(prev => prev ? ({ 
                    ...prev, 
                    ...updateData, 
                    order_status: updateData.status || prev.order_status 
                }) : null);
            }
        }
      }
    } catch (error: any) {
      console.error(`❌ Erreur ${action}:`, error);
      Alert.alert("Erreur", `Impossible de ${action.toLowerCase()} la commande.`);
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

  // --- RENDER: NOUVELLE MODALE REMBOURSEMENT ---
  const renderRefundConfirmationModal = () => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={refundModalVisible}
        onRequestClose={() => setRefundModalVisible(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertIconContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
            </View>
            <Text style={styles.alertTitle}>Rembourser la commande ?</Text>
            <Text style={styles.alertMessage}>
              Vous êtes sur le point de rembourser la commande #{orderToRefund}.{"\n"}
              Cette action est <Text style={{fontWeight:'bold'}}>irréversible</Text>.
            </Text>

            <View style={styles.alertButtons}>
                <TouchableOpacity 
                    style={styles.alertBtnCancel} 
                    onPress={() => setRefundModalVisible(false)}
                >
                    <Text style={styles.alertBtnCancelText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.alertBtnConfirm} 
                    onPress={executeRefund}
                >
                    <Text style={styles.alertBtnConfirmText}>Oui, Rembourser</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // --- RENDER: HISTORIQUE MODAL ---
// --- RENDER: HISTORIQUE MODAL (Complet) ---
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
            
            {/* --- HEADER --- */}
            <View style={styles.historyHeader}>
              <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
                <View style={styles.historyIconBadge}>
                    <MaterialCommunityIcons name="history" size={24} color="#6366F1" />
                </View>
                <View>
                    <Text style={styles.historyTitle}>Historique </Text>
                    <Text style={styles.historySubtitle}>{historyOrders.length} commandes récentes</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.closeHistoryBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* --- LISTE --- */}
            <ScrollView style={styles.historyList} contentContainerStyle={{paddingBottom: 20}}>
              {historyOrders.length === 0 ? (
                 <View style={styles.emptyHistory}>
                    <MaterialCommunityIcons name="receipt-text-outline" size={48} color="#CBD5E1" />
                    <Text style={{color: "#94A3B8", marginTop: 10}}>Aucune commande récente</Text>
                 </View>
              ) : (
                historyOrders.map((order) => {
                  // --- LOGIQUE DE DATE ---
                  const orderDate = new Date(order.created_at);
                  const today = new Date();
                  // Comparaison stricte des dates (jour/mois/année) sans l'heure
                  const isToday = orderDate.toDateString() === today.toDateString();
                  const timeStr = orderDate.toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'});

                  return (
                    <View key={order.order_id} style={styles.historyCard}>
                      <View style={styles.historyInfo}>
                          
                          {/* Ligne ID + Badges */}
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
                              ) : order.paid ? (
                              <View style={[styles.miniBadge, {backgroundColor: '#DCFCE7'}]}>
                                  <Text style={{color: '#166534', fontSize: 10, fontWeight: '700'}}>PAYÉ</Text>
                              </View>
                              ) : (
                              <View style={[styles.miniBadge, {backgroundColor: '#FFEDD5'}]}>
                                  <Text style={{color: '#C2410C', fontSize: 10, fontWeight: '700'}}>NON PAYÉE</Text>
                              </View>
                              )}
                          </View>

                          {/* Ligne Heure (Modifiée) */}
                          <Text style={styles.historyTime}>
                              <Text style={{
                                  fontWeight: isToday ? '400' : '700', 
                                  color: isToday ? '#64748B' : '#6366F1' // Violet si c'était Hier
                              }}>
                                  {isToday ? "Auj." : "Hier"}
                              </Text>
                              {" " + timeStr} • {order.items.length} articles
                          </Text>

                          <Text style={styles.historyPrice}>{order.total_price} DA</Text>
                      </View>

                      {/* Actions */}
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
                  );
                })
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
          <View style={styles.infoRow}>
            {(() => {
              const dtype = order.delivery_type || (order.takeaway ? 'emporter' : 'sur_place');
              return (
                <>
                  <MaterialCommunityIcons
                    name={dtype === "emporter" ? "bag-personal" : dtype === "livraison" ? "moped" : "silverware-fork-knife"}
                    size={16}
                    color="#666"
                  />
                  <Text style={styles.infoText}>
                    {dtype === "emporter" ? "À emporter" : dtype === "livraison" ? "Livraison" : "Sur place"}
                  </Text>
                </>
              );
            })()}
          </View>
          {order.customer_identifier ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={16} color="#756fbf" />
              <Text style={[styles.infoText, { color: "#756fbf" }]}>{order.customer_identifier}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => openOrderDetails(order)}
        >
          <MaterialCommunityIcons name="eye" size={18} color="#007bff" />
          <Text style={styles.detailsButtonText}>Voir les détails</Text>
        </TouchableOpacity>

        <View style={styles.actionsContainer}>
          {/* Colonne "À valider" : espèces en attente de validation caissier */}
          {order.kds_status === "pending_validation" && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.validateButton]}
                onPress={() => validateCashOrder(order.order_id)}
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

          {/* Colonne "Prête" : imprimer + livrer */}
          {order.kds_status === "done" && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#28a745" }]}
                onPress={() => handleReprint(order.order_id)}
                disabled={printing}
              >
                <MaterialCommunityIcons name="printer" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Imprimer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#0ea5e9" }]}
                onPress={() => handleDeliver(order.order_id)}
              >
                <MaterialCommunityIcons name="check-all" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Livré</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Rembourser (si payé) */}
          {isPaid && !isRefunded && !isCancelled && order.kds_status !== "pending_validation" && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#6c757d" }]}
              onPress={() => confirmRefund(order.order_id)}
            >
              <MaterialCommunityIcons name="undo" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Rembourser</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderColumn = (title: string, status: string | string[], icon: any) => {
    const statusList = Array.isArray(status) ? status : [status];
    const filteredOrders = orders.filter((order) => {
      const matchesStatus = statusList.includes(order.kds_status);
      const matchesSearch = order.order_id.toString().includes(searchQuery);
      return matchesStatus && matchesSearch;
    });

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

            <TouchableOpacity
                style={[styles.refreshButton, {backgroundColor: pushing ? '#94a3b8' : '#10b981'}]}
                onPress={() => pushLocalToCloud(true)}
                disabled={pushing}
            >
                <MaterialCommunityIcons name={pushing ? "loading" : "cloud-upload"} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.refreshButton, {backgroundColor: syncing ? '#94a3b8' : '#0ea5e9'}]}
                onPress={handleSyncCloud}
                disabled={syncing}
            >
                <MaterialCommunityIcons name={syncing ? "loading" : "cloud-sync"} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Colonnes Kanban KDS */}
      <View style={styles.columnsContainer}>
        {renderColumn("À valider", "pending_validation", "clock-outline")}
        {renderColumn("En préparation", ["new", "in_progress"], "chef-hat")}
        {renderColumn("Prête", "done", "check-circle")}
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
                    <MaterialCommunityIcons name="receipt-text" size={32} color="#ff9900" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.modalTitle}>Commande #{selectedOrder.order_id}</Text>
                      <Text style={styles.modalSubtitle}>{new Date(selectedOrder.created_at).toLocaleString("fr-FR")}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                    <MaterialCommunityIcons name="close" size={28} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalInfos}>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons name={selectedOrder.cash ? "cash" : "credit-card"} size={24} color="#666" />
                    <Text style={styles.modalInfoText}>{selectedOrder.cash ? "Paiement Cash" : "Paiement Carte"}</Text>
                  </View>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons name={selectedOrder.takeaway ? "bag-personal" : "silverware-fork-knife"} size={24} color="#666" />
                    <Text style={styles.modalInfoText}>{selectedOrder.takeaway ? "À emporter" : "Sur place"}</Text>
                  </View>
                  <View style={styles.modalInfoBox}>
                    <MaterialCommunityIcons name={getStatusIcon(selectedOrder.order_status)} size={24} color={getStatusColor(selectedOrder.order_status)} />
                    <Text style={styles.modalInfoText}>{getStatusLabel(selectedOrder.order_status)}</Text>
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
                        <Text style={styles.modalItemName}>{item.solo || item.extra ? "Solo/Extra " : ""}{item.menu_name}</Text>
                      </View>
                      {item.composition.length > 0 && (
                        <View style={styles.modalComposition}>
                          {item.composition.map((option, idx) => (
                            <View key={idx} style={styles.modalOption}>
                              <MaterialCommunityIcons name="chevron-right" size={16} color="#999" />
                              <Text style={styles.modalOptionStep}>{option.step_name}:</Text>
                              <Text style={styles.modalOptionName}>{option.option_name}</Text>
                              {option.option_price > 0 && <Text style={styles.modalOptionPrice}>+{option.option_price} DA</Text>}
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
                  <Text style={styles.modalTotalAmount}>{selectedOrder.total_price} DA</Text>
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
                        <MaterialCommunityIcons name="close-circle" size={20} color="#dc3545" />
                        <Text style={[styles.modalStatusText, { color: "#dc3545" }]}>Annulée</Text>
                      </View>
                    ) : (
                      // 🔔 CLICK ICI -> OUVRE LA NOUVELLE MODALE
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
                      <MaterialCommunityIcons name="close-circle" size={20} color="#dc3545" />
                      <Text style={[styles.modalStatusText, { color: "#dc3545" }]}>Annulée</Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#28a745" }]}
                        onPress={() => handleAction(selectedOrder.order_id, "Valider")}
                      >
                        <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                        <Text style={styles.modalActionText}>Valider</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: "#ffc107" }]}
                        onPress={() => handleAction(selectedOrder.order_id, "Annuler")}
                      >
                        <MaterialCommunityIcons name="close-circle" size={22} color="#fff" />
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
      {/* Modale Confirmation Remboursement (NOUVEAU) */}
      {renderRefundConfirmationModal()}
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
  
  // MODALE PRINCIPALE
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

  // STYLES NOUVELLE MODALE ALERT
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    backgroundColor: "white",
    borderRadius: 16,
    width: 320,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  alertIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FEE2E2", // Rouge très clair
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  alertButtons: {
    flexDirection: "row",
    gap: 12,
    width: '100%',
  },
  alertBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  alertBtnCancelText: {
    color: "#64748B",
    fontWeight: "600",
  },
  alertBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#dc3545",
    alignItems: "center",
  },
  alertBtnConfirmText: {
    color: "white",
    fontWeight: "700",
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