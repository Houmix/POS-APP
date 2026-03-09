import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPosUrl, getRestaurantId } from '@/utils/serverConfig';
import Feather from '@expo/vector-icons/Feather';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

interface OrderOption {
  step_name: string;
  option_name: string;
  option_price: number;
}
interface OrderItem {
  menu_name: string;
  quantity: number;
  solo: boolean;
  extra: boolean;
  composition: OrderOption[];
}
interface KDSOrder {
  order_id: number;
  order_status: string;
  cash: boolean;
  paid: boolean;
  take_away: boolean;
  created_at: string;
  total_price: number;
  items: OrderItem[];
  cancelled: boolean;
  refund: boolean;
}

const COLUMNS = [
  { key: 'pending',     label: 'Nouvelles',      color: '#f59e0b', bg: '#fffbeb', icon: 'inbox'        as const },
  { key: 'in_progress', label: 'En préparation', color: '#3b82f6', bg: '#eff6ff', icon: 'zap'          as const },
  { key: 'ready',       label: 'Prêtes',         color: '#10b981', bg: '#f0fdf4', icon: 'check-circle' as const },
];

const NEXT_STATUS: Record<string, string> = {
  pending:     'in_progress',
  in_progress: 'ready',
  ready:       'delivered',
};
const ACTION_LABEL: Record<string, string> = {
  pending:     '▶  Commencer',
  in_progress: '✓  Marquer prêt',
  ready:       '⬆  Livré',
};
const ACTION_COLOR: Record<string, string> = {
  pending:     '#f59e0b',
  in_progress: '#3b82f6',
  ready:       '#10b981',
};

export default function KDSScreen() {
  const theme = useKioskTheme();

  const [orders, setOrders]         = useState<KDSOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus]     = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [clock, setClock]           = useState(new Date());
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const wsRef           = useRef<WebSocket | null>(null);
  const restaurantIdRef = useRef<string | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const resId = restaurantIdRef.current;
      if (!resId) return;
      const r = await fetch(`${getPosUrl()}/order/api/kds/orders/${resId}/`);
      if (r.ok) {
        const data = await r.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error('[KDS] fetch error:', e);
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
        const { type, order_id, status: newStatus } = msg.data;

        if (type === 'new_order') {
          fetchOrders();
        } else if (type === 'order_updated') {
          setOrders(prev => {
            if (['delivered', 'cancelled', 'completed'].includes(newStatus)) {
              return prev.filter(o => o.order_id !== order_id);
            }
            return prev.map(o =>
              o.order_id === order_id ? { ...o, order_status: newStatus } : o
            );
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connectWS, 4000);
    };
    ws.onerror = () => setWsStatus('disconnected');
  }, [fetchOrders]);

  const updateStatus = async (order: KDSOrder) => {
    const next = NEXT_STATUS[order.order_status];
    if (!next || updatingId !== null) return;
    setUpdatingId(order.order_id);
    try {
      const r = await fetch(`${getPosUrl()}/order/api/Updateorder/${order.order_id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (r.ok) {
        if (['delivered', 'completed'].includes(next)) {
          setOrders(prev => prev.filter(o => o.order_id !== order.order_id));
        } else {
          setOrders(prev =>
            prev.map(o => o.order_id === order.order_id ? { ...o, order_status: next } : o)
          );
        }
      }
    } catch (e) {
      console.error('[KDS] update error:', e);
    } finally {
      setUpdatingId(null);
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

    return () => {
      clearInterval(clockInterval);
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
    const diff = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return { text: `${m}m ${String(s).padStart(2, '0')}s`, minutes: m };
  };

  const renderCard = (order: KDSOrder) => {
    const { text: elapsed, minutes } = getElapsed(order.created_at);
    const isUrgent   = minutes >= 10;
    const col        = COLUMNS.find(c => c.key === order.order_status);
    const isUpdating = updatingId === order.order_id;

    return (
      <View key={order.order_id} style={[styles.card, { borderTopColor: col?.color || '#94a3b8' }]}>

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.orderId}>#{String(order.order_id).padStart(3, '0')}</Text>
            {order.take_away && (
              <View style={styles.badge}>
                <Feather name="package" size={10} color="white" />
                <Text style={styles.badgeText}>Emporter</Text>
              </View>
            )}
            {!order.cash && (
              <View style={[styles.badge, { backgroundColor: '#6366f1' }]}>
                <Feather name="credit-card" size={10} color="white" />
                <Text style={styles.badgeText}>CB</Text>
              </View>
            )}
          </View>
          <Text style={[styles.elapsed, { color: isUrgent ? '#ef4444' : '#94a3b8' }]}>
            {isUrgent ? '⚠ ' : ''}{elapsed}
          </Text>
        </View>

        {/* Items */}
        <View style={styles.divider} />
        <View style={styles.itemsBlock}>
          {order.items.map((item, idx) => (
            <View key={idx} style={{ marginBottom: 8 }}>
              <Text style={styles.itemName}>
                <Text style={styles.itemQty}>{item.quantity}×  </Text>
                {item.menu_name}
                {item.solo ? ' (solo)' : item.extra ? ' (+extra)' : ''}
              </Text>
              {item.composition.map((opt, oi) => (
                <Text key={oi} style={styles.optLine}>
                  {'  └ '}{opt.option_name}
                  {opt.option_price > 0 ? ` (+${opt.option_price} DA)` : ''}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.divider} />
        <View style={styles.cardFooter}>
          <Text style={styles.totalText}>{order.total_price.toFixed(0)} DA</Text>
          {NEXT_STATUS[order.order_status] && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: ACTION_COLOR[order.order_status] },
                isUpdating && styles.btnDisabled,
              ]}
              onPress={() => updateStatus(order)}
              disabled={updatingId !== null}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.actionBtnText}>{ACTION_LABEL[order.order_status]}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
        <Text style={styles.loadingText}>Chargement du KDS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primaryColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Feather name="monitor" size={22} color="white" />
          <Text style={styles.headerTitle}>Cuisine — KDS</Text>
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

      {/* Kanban columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanban}
      >
        {COLUMNS.map(col => {
          const colOrders = orders
            .filter(o => o.order_status === col.key)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          return (
            <View key={col.key} style={[styles.column, { backgroundColor: col.bg }]}>

              {/* Column header */}
              <View style={[styles.colHeader, { borderBottomColor: col.color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name={col.icon} size={18} color={col.color} />
                  <Text style={[styles.colTitle, { color: col.color }]}>{col.label}</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: col.color }]}>
                  <Text style={styles.countText}>{colOrders.length}</Text>
                </View>
              </View>

              {/* Cards */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 12, gap: 12 }}
                refreshControl={
                  col.key === 'pending'
                    ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={col.color} />
                    : undefined
                }
              >
                {colOrders.length === 0 ? (
                  <View style={styles.emptyCol}>
                    <Feather name="inbox" size={36} color={col.color} style={{ opacity: 0.3 }} />
                    <Text style={[styles.emptyText, { color: col.color }]}>Aucune commande</Text>
                  </View>
                ) : (
                  colOrders.map(o => renderCard(o))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#f1f5f9' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 16 },

  header: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: 'white' },
  headerBtn:   { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  clock:       { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  wsIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  wsDot:       { width: 8, height: 8, borderRadius: 4 },
  wsLabel:     { fontSize: 12, color: 'white', fontWeight: '600' },

  kanban:      { padding: 12, gap: 12, alignItems: 'flex-start' },
  column: {
    width: 320, borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  colHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 2 },
  colTitle:    { fontSize: 16, fontWeight: '800' },
  countBadge:  { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  countText:   { color: 'white', fontWeight: '800', fontSize: 14 },
  emptyCol:    { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyText:   { fontSize: 13, opacity: 0.4, fontWeight: '600' },

  card: {
    backgroundColor: 'white', borderRadius: 14, borderTopWidth: 4,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  orderId:     { fontSize: 20, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f59e0b', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { color: 'white', fontSize: 10, fontWeight: '700' },
  elapsed:     { fontSize: 13, fontWeight: '700' },

  divider:     { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 14 },

  itemsBlock:  { paddingHorizontal: 14, paddingVertical: 10 },
  itemName:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  itemQty:     { color: '#3b82f6', fontWeight: '900' },
  optLine:     { fontSize: 12, color: '#64748b', marginLeft: 4 },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 },
  totalText:   { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  actionBtn:   { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 130, alignItems: 'center' },
  actionBtnText:{ color: 'white', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
});
