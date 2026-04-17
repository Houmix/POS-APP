import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPosUrl } from '@/utils/serverConfig';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

interface BorneInfo {
  borne_id: string;
  restaurant_id: string;
  channel: string;
}

const COMMANDS = [
  { key: 'update_all',    label: 'Mettre à jour tout',   icon: 'refresh-circle',    color: '#3b82f6' },
  { key: 'update_images', label: 'Mettre à jour images',  icon: 'image',             color: '#8b5cf6' },
  { key: 'reset_data',    label: 'Réinitialiser données', icon: 'trash',             color: '#dc2626' },
  { key: 'reboot',        label: 'Redémarrer',            icon: 'power',             color: '#f59e0b' },
  { key: 'disable',       label: 'Désactiver',            icon: 'eye-off',           color: '#ef4444' },
  { key: 'enable',        label: 'Activer',               icon: 'eye',               color: '#10b981' },
];

export default function BornesPage() {
  const theme = useKioskTheme();
  const [bornes, setBornes] = useState<BorneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const fetchBornes = useCallback(async () => {
    try {
      const r = await fetch(`${getPosUrl()}/api/bornes/`);
      if (r.ok) setBornes(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBornes();
    const interval = setInterval(fetchBornes, 5000);
    return () => clearInterval(interval);
  }, [fetchBornes]);

  const sendCommand = async (command: string, borneId?: string) => {
    const url = borneId
      ? `${getPosUrl()}/api/bornes/command/${borneId}/`
      : `${getPosUrl()}/api/bornes/command/`;
    const label = COMMANDS.find(c => c.key === command)?.label || command;
    const target = borneId ? `Borne ${borneId}` : 'toutes les bornes';

    Alert.alert(
      `${label}`,
      `Envoyer "${label}" à ${target} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: command === 'disable' ? 'destructive' : 'default',
          onPress: async () => {
            setSending(`${command}_${borneId || 'all'}`);
            try {
              await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
              });
            } catch { Alert.alert('Erreur', 'Impossible d\'envoyer la commande'); }
            setSending(null);
          },
        },
      ]
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar hidden />
      <View style={[s.header, { backgroundColor: theme.primaryColor }]}>
        <Text style={s.headerTitle}>Gestion des bornes</Text>
        <View style={s.headerRight}>
          <View style={[s.countBadge, { backgroundColor: bornes.length > 0 ? '#10b981' : '#64748b' }]}>
            <Text style={s.countText}>{bornes.length} connectée{bornes.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity onPress={fetchBornes} style={s.refreshBtn}>
            <Ionicons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Section : Toutes les bornes */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textColor }]}>Toutes les bornes</Text>
          <View style={s.commandGrid}>
            {COMMANDS.map(cmd => (
              <TouchableOpacity
                key={cmd.key}
                style={[s.cmdCard, { borderColor: cmd.color + '40' }]}
                onPress={() => sendCommand(cmd.key)}
                disabled={sending !== null}
              >
                {sending === `${cmd.key}_all`
                  ? <ActivityIndicator size="small" color={cmd.color} />
                  : <Ionicons name={cmd.icon as any} size={28} color={cmd.color} />
                }
                <Text style={[s.cmdLabel, { color: theme.textColor }]}>{cmd.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section : Bornes individuelles */}
        <Text style={[s.sectionTitle, { color: theme.textColor, marginTop: 24 }]}>Bornes actives</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primaryColor} style={{ marginTop: 24 }} />
        ) : bornes.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="tablet-landscape-outline" size={60} color="#94a3b8" />
            <Text style={s.emptyText}>Aucune borne connectée</Text>
          </View>
        ) : (
          bornes.map(borne => (
            <View key={borne.borne_id} style={s.borneCard}>
              <View style={s.borneHeader}>
                <View style={[s.onlineDot, { backgroundColor: '#10b981' }]} />
                <Text style={[s.borneId, { color: theme.primaryColor }]}>{borne.borne_id}</Text>
                <Text style={s.borneResto}>Restaurant #{borne.restaurant_id}</Text>
              </View>
              <View style={s.commandGrid}>
                {COMMANDS.map(cmd => (
                  <TouchableOpacity
                    key={cmd.key}
                    style={[s.cmdCardSmall, { borderColor: cmd.color + '40' }]}
                    onPress={() => sendCommand(cmd.key, borne.borne_id)}
                    disabled={sending !== null}
                  >
                    {sending === `${cmd.key}_${borne.borne_id}`
                      ? <ActivityIndicator size="small" color={cmd.color} />
                      : <Ionicons name={cmd.icon as any} size={22} color={cmd.color} />
                    }
                    <Text style={[s.cmdLabelSmall, { color: theme.textColor }]}>{cmd.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:   { fontSize: 22, fontWeight: '800', color: 'white' },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countBadge:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  countText:     { color: 'white', fontWeight: '700', fontSize: 13 },
  refreshBtn:    { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
  content:       { padding: 20, gap: 12 },
  section:       { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  commandGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cmdCard:       { width: 130, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'white', gap: 8, elevation: 1 },
  cmdLabel:      { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cmdCardSmall:  { width: 100, alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, backgroundColor: 'white', gap: 6, elevation: 1 },
  cmdLabelSmall: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  borneCard:     { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, gap: 12 },
  borneHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot:     { width: 10, height: 10, borderRadius: 5 },
  borneId:       { fontSize: 18, fontWeight: '800' },
  borneResto:    { fontSize: 13, color: '#94a3b8', marginLeft: 'auto' },
  empty:         { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText:     { fontSize: 16, color: '#94a3b8', fontWeight: '600' },
});
