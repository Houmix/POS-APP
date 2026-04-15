import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPosUrl, getRestaurantId } from '@/utils/serverConfig';
import Feather from '@expo/vector-icons/Feather';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

interface OrderItem {
  menu_name: string;
  quantity: number;
  solo: boolean;
  extra: boolean;
  composition: { step_name: string; option_name: string; option_price: number }[];
}
interface ServerOrder {
  order_id: number;
  kds_status: string;
  delivery_type: string;
  take_away: boolean;
  customer_identifier: string;
  created_at: string;
  total_price: number;
  items: OrderItem[];
}

const DELIVERY_LABEL: Record<string, string> = {
  sur_place: 'Sur place',
  emporter: 'Emporter',
  livraison: 'Livraison',
};
const DELIVERY_COLOR: Record<string, string> = {
  sur_place: '#64748b',
  emporter: '#f59e0b',
  livraison: '#f97316',
};

export default function ServerScreen() {
  const theme = useKioskTheme();

  const [orders, setOrders]         = useState<ServerOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus]     = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [clock, setClock]           = useState(new Date());
  const [deliveringId, setDeliveringId] = useState<number | null>(null);

  const wsRef           = useRef<WebSocket | null>(null);
  const restaurantIdRef = useRef<string | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const resId = restaurantIdRef.current;
      if (!resId) return;
      const r = await fetch(`${getPosUrl()}/order/api/kds/orders/${resId}/?include_pending=1`);
      if (r.ok) {
        const data = await r.json();
        // Serveur ne voit que les commandes prêtes à distribuer
        const doneOrders = (data.orders || []).filter((o: ServerOrder) => o.kds_status === 'done');
        setOrders(doneOrders);
      }
    } catch (e) {
      console.error('[Server] fetch error:', e);
    }
  }, []);

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
    setWsStatus('connecting');

    ws.onopen = () => {
      setWsStatus('connected');
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
          } else if (newKdsStatus === 'done') {
            // Une commande est prête → la faire apparaître
            fetchOrders();
          } else {
            // Plus prête → disparaît de l'écran serveur
            setOrders(prev => prev.filter(o => o.order_id !== order_id));
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connectWS, 4000);
    };
    ws.onerror = () => setWsStatus('disconnected');
  }, [fetchOrders]);

  const handleDeliver = async (orderId: number) => {
    if (deliveringId !== null) return;
    setDeliveringId(orderId);
    try {
      const token = await AsyncStorage.getItem('token');
      const r = await fetch(`${getPosUrl()}/order/api/Updateorder/${orderId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kds_status: 'delivered' }),
      });
      if (r.ok) {
        setOrders(prev => prev.filter(o => o.order_id !== orderId));
      } else {
        Alert.alert('Erreur', 'Impossible de marquer la commande comme livrée.');
      }
    } catch (e) {
      console.error('[Server] deliver error:', e);
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setDeliveringId(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      let resId = getRestaurantId();
      if (!resId) resId = await AsyncStorage.getItem('restaurant_id');
      restaurantIdRef.current = resId;
      await fetchOrders();
      setLoading(false);
      connectWS();
    };
    init();

    const clockInterval = setInterval(() => setClock(new Date()), 1000);
    // Rafraîchissement toutes les 3s pour les environments sans WS fiable
    const pollInterval = setInterval(() => fetchOrders(), 3000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(pollInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const getElapsed = (createdAt: string) => {
    if (!createdAt) return { text: '—', minutes: 0 };
    const ts = new Date(createdAt).getTime();
    if (isNaN(ts)) return { text: '—', minutes: 0 };
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return { text: `${m}m${String(s).padStart(2, '0')}`, minutes: m };
  };

  const renderCard = (order: ServerOrder) => {
    const { text: elapsed, minutes } = getElapsed(order.created_at);
    const isUrgent = minutes >= 5;
    const isDelivering = deliveringId === order.order_id;
    const dtype = order.delivery_type || (order.take_away ? 'emporter' : 'sur_place');
    const deliveryLabel = DELIVERY_LABEL[dtype] || dtype;
    const deliveryColor = DELIVERY_COLOR[dtype] || '#64748b';

    return (
      <View key={order.order_id} style={[styles.card, isUrgent && styles.cardUrgent]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.orderId}>#{String(order.order_id).padStart(3, '0')}</Text>
            <View style={[styles.badge, { backgroundColor: deliveryColor }]}>
              <Text style={styles.badgeText}>{deliveryLabel}</Text>
            </View>
          </View>
          <Text style={[styles.elapsed, { color: isUrgent ? '#ef4444' : '#94a3b8' }]}>
            {isUrgent ? '⚠ ' : ''}{elapsed}
          </Text>
        </View>

        {order.customer_identifier ? (
          <View style={styles.identifierRow}>
            <Feather name="user" size={13} color="#64748b" />
            <Text style={styles.identifierText}>{order.customer_identifier}</Text>
          </View>
        ) : null}

        {/* Items */}
        <View style={styles.divider} />
        <View style={styles.itemsBlock}>
          {order.items.map((item, idx) => (
            <View key={idx} style={{ marginBottom: 6 }}>
              <Text style={styles.itemName}>
                <Text style={styles.itemQty}>{item.quantity}×  </Text>
                {item.menu_name}
                {item.solo ? ' (solo)' : item.extra ? ' (+extra)' : ''}
              </Text>
              {item.composition.map((opt, oi) => (
                <Text key={oi} style={styles.optLine}>{'  └ '}{opt.option_name}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* Bouton Livrer */}
        <View style={styles.divider} />
        <TouchableOpacity
          style={[styles.deliverBtn, isDelivering && styles.deliverBtnDisabled]}
          onPress={() => handleDeliver(order.order_id)}
          disabled={deliveringId !== null}
        >
          {isDelivering
            ? <ActivityIndicator size="small" color="white" />
            : <Feather name="check-circle" size={20} color="white" />
          }
          <Text style={styles.deliverBtnText}>
            {isDelivering ? 'En cours...' : 'Marquer Livré'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primaryColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Feather name="truck" size={22} color="white" />
          <Text style={styles.headerTitle}>Service — Distribution</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.wsIndicator}>
            <View style={[styles.wsDot, {
              backgroundColor:
                wsStatus === 'connected'  ? '#4ade80' :
                wsStatus === 'connecting' ? '#fbbf24' : '#f87171',
            }]} />
            <Text style={styles.wsLabel}>
              {wsStatus === 'connected' ? 'En ligne' : wsStatus === 'connecting' ? 'Connexion…' : 'Hors ligne'}
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.headerBtn}>
            <Feather name="refresh-cw" size={18} color="white" />
          </TouchableOpacity>
          <Text style={styles.clock}>
            {clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        </View>
      </View>

      {/* Compteur */}
      <View style={styles.counterBar}>
        <Feather name="package" size={16} color={theme.primaryColor} />
        <Text style={[styles.counterText, { color: theme.primaryColor }]}>
          {orders.length} commande{orders.length !== 1 ? 's' : ''} prête{orders.length !== 1 ? 's' : ''} à distribuer
        </Text>
      </View>

      {/* Liste des commandes prêtes */}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {orders.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={64} color="#d1fae5" />
            <Text style={styles.emptyTitle}>Tout est distribué !</Text>
            <Text style={styles.emptySubtitle}>Aucune commande en attente de distribution.</Text>
          </View>
        ) : (
          orders
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map(renderCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 16 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: { color: 'white', fontWeight: '700', fontSize: 18 },
  headerBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  clock: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'monospace' },
  wsIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  wsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },

  counterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  counterText: { fontWeight: '700', fontSize: 15 },

  list: { padding: 16, gap: 14, flexDirection: 'row', flexWrap: 'wrap' },

  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    borderTopWidth: 4, borderTopColor: '#10b981',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    width: 300, minWidth: 260,
  },
  cardUrgent: { borderTopColor: '#ef4444' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, flexDirection: 'row', gap: 4, alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  elapsed: { fontSize: 12, fontWeight: '600' },

  identifierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  identifierText: { color: '#64748b', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },

  itemsBlock: { gap: 4 },
  itemName: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  itemQty: { color: '#64748b', fontWeight: '700' },
  optLine: { fontSize: 12, color: '#94a3b8', marginLeft: 8 },

  deliverBtn: {
    backgroundColor: '#10b981', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  deliverBtnDisabled: { backgroundColor: '#94a3b8' },
  deliverBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, width: '100%' },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#059669', marginTop: 16 },
  emptySubtitle: { fontSize: 15, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
});
