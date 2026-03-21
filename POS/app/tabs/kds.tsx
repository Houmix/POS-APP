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
  kds_status: string;
  customer_identifier: string;
  delivery_type: string;
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
  { key: 'new',               label: 'Nouvelles',       color: '#f59e0b', bg: '#fffbeb', icon: 'inbox'        as const },
  { key: 'in_progress',       label: 'En préparation',  color: '#3b82f6', bg: '#eff6ff', icon: 'zap'          as const },
  { key: 'done',              label: 'Prêtes',           color: '#10b981', bg: '#f0fdf4', icon: 'check-circle' as const },
];

const NEXT_KDS_STATUS: Record<string, string> = {
  new:         'in_progress',
  in_progress: 'done',
};
const ACTION_LABEL: Record<string, string> = {
  new:         '▶  Commencer',
  in_progress: '✓  Marquer prêt',
};
const ACTION_COLOR: Record<string, string> = {
  new:         '#f59e0b',
  in_progress: '#3b82f6',
};

export default function KDSScreen() {
  const theme = useKioskTheme();

  const [orders, setOrders]         = useState<KDSOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus]     = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [clock, setClock]           = useState(new Date());
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

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
        const { type, order_id, kds_status: newKdsStatus } = msg.data;

        if (type === 'new_order') {
          fetchOrders();
        } else if (type === 'order_updated') {
          if (newKdsStatus === 'delivered') {
            setOrders(prev => prev.filter(o => o.order_id !== order_id));
          } else {
            setOrders(prev =>
              prev.map(o =>
                o.order_id === order_id ? { ...o, kds_status: newKdsStatus || o.kds_status } : o
              )
            );
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

  const printTicket = async (orderId: number) => {
    if (printingId !== null) return;
    setPrintingId(orderId);
    try {
      const token = await AsyncStorage.getItem('token');
      const r = await fetch(`${getPosUrl()}/order/api/generateTicket/${orderId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      const { ticket_content } = data;
      if (ticket_content && (window as any).electronAPI?.printTicket) {
        await (window as any).electronAPI.printTicket(ticket_content);
      }
    } catch (e) {
      console.error('[KDS] print error:', e);
    } finally {
      setPrintingId(null);
    }
  };

  const updateStatus = async (order: KDSOrder) => {
    if (updatingId !== null) return;
    setUpdatingId(order.order_id);
    try {
      if (order.kds_status === 'pending_validation') {
        // Valider la commande espèces → envoyer en cuisine
        const r = await fetch(`${getPosUrl()}/order/api/validateOrder/${order.order_id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });
        if (r.ok) {
          setOrders(prev =>
            prev.map(o => o.order_id === order.order_id
              ? { ...o, kds_status: 'new', order_status: 'confirmed' }
              : o)
          );
        }
      } else {
        const next = NEXT_KDS_STATUS[order.kds_status];
        if (!next) return;
        const r = await fetch(`${getPosUrl()}/order/api/Updateorder/${order.order_id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kds_status: next }),
        });
        if (r.ok) {
          setOrders(prev =>
            prev.map(o => o.order_id === order.order_id ? { ...o, kds_status: next } : o)
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

  const DELIVERY_LABEL: Record<string, string> = {
    sur_place: 'Sur place',
    emporter:  'Emporter',
    livraison: 'Livraison',
  };
  const DELIVERY_COLOR: Record<string, string> = {
    sur_place: '#64748b',
    emporter:  '#f59e0b',
    livraison: '#f97316',
  };

  const renderCard = (order: KDSOrder) => {
    const { text: elapsed, minutes } = getElapsed(order.created_at);
    const isUrgent   = minutes >= 10;
    const col        = COLUMNS.find(c => c.key === order.kds_status);
    const isUpdating = updatingId === order.order_id;
    const isPrinting = printingId === order.order_id;
    const deliveryLabel = DELIVERY_LABEL[order.delivery_type] || (order.take_away ? 'Emporter' : 'Sur place');
    const deliveryColor = DELIVERY_COLOR[order.delivery_type] || '#64748b';

    return (
      <View key={order.order_id} style={[styles.card, { borderTopColor: col?.color || '#94a3b8' }]}>

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.orderId}>#{String(order.order_id).padStart(3, '0')}</Text>
            <View style={[styles.badge, { backgroundColor: deliveryColor }]}>
              <Text style={styles.badgeText}>{deliveryLabel}</Text>
            </View>
            {order.cash && (
              <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
                <Feather name="dollar-sign" size={10} color="white" />
                <Text style={styles.badgeText}>Espèces</Text>
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
        {order.customer_identifier ? (
          <View style={styles.identifierRow}>
            <Feather name="user" size={12} color="#64748b" />
            <Text style={styles.identifierText}>{order.customer_identifier}</Text>
          </View>
        ) : null}

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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Print button */}
            <TouchableOpacity
              style={[styles.printBtn, isPrinting && styles.btnDisabled]}
              onPress={() => printTicket(order.order_id)}
              disabled={printingId !== null}
            >
              {isPrinting
                ? <ActivityIndicator size="small" color="white" />
                : <Feather name="printer" size={16} color="white" />
              }
            </TouchableOpacity>
            {/* Action button */}
            {ACTION_LABEL[order.kds_status] && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: ACTION_COLOR[order.kds_status] },
                  isUpdating && styles.btnDisabled,
                ]}
                onPress={() => updateStatus(order)}
                disabled={updatingId !== null}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.actionBtnText}>{ACTION_LABEL[order.kds_status]}</Text>
                }
              </TouchableOpacity>
            )}
          </View>
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
            .filter(o => o.kds_status === col.key)
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

  identifierRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 6 },
  identifierText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  divider:     { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 14 },

  itemsBlock:  { paddingHorizontal: 14, paddingVertical: 10 },
  itemName:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  itemQty:     { color: '#3b82f6', fontWeight: '900' },
  optLine:     { fontSize: 12, color: '#64748b', marginLeft: 4 },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 },
  totalText:   { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  actionBtn:   { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 130, alignItems: 'center' },
  actionBtnText:{ color: 'white', fontWeight: '800', fontSize: 13 },
  printBtn:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#64748b', justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
});
