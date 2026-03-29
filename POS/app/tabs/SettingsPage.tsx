import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPosUrl, getRestaurantId } from '@/utils/serverConfig';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

interface Config {
  kitchen_printer_ip: string;
  kitchen_printer_port: string;
  kitchen_printer_enabled: boolean;
  tva_rate: string;
  ticket_header: string;
  ticket_footer: string;
  ticket_show_tva: boolean;
  delivery_modes: 'both' | 'sur_place_only' | 'emporter_only';
}

const DELIVERY_OPTIONS = [
  { value: 'both',           label: 'Sur place et Emporter' },
  { value: 'sur_place_only', label: 'Sur place uniquement' },
  { value: 'emporter_only',  label: 'Emporter uniquement' },
] as const;

export default function SettingsPage() {
  const theme = useKioskTheme();
  const [config, setConfig] = useState<Config>({
    kitchen_printer_ip: '',
    kitchen_printer_port: '9100',
    kitchen_printer_enabled: false,
    tva_rate: '0',
    ticket_header: '',
    ticket_footer: '',
    ticket_show_tva: false,
    delivery_modes: 'both',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const resId = getRestaurantId();
      const r = await fetch(`${getPosUrl()}/api/kiosk/config/?restaurant_id=${resId}`);
      if (r.ok) {
        const data = await r.json();
        setConfig({
          kitchen_printer_ip:      data.kitchen_printer_ip || '',
          kitchen_printer_port:    String(data.kitchen_printer_port || 9100),
          kitchen_printer_enabled: data.kitchen_printer_enabled || false,
          tva_rate:                String(data.tva_rate || 0),
          ticket_header:           data.ticket_header || '',
          ticket_footer:           data.ticket_footer || '',
          ticket_show_tva:         data.ticket_show_tva || false,
          delivery_modes:          data.delivery_modes || 'both',
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async () => {
    setSaving(true);
    try {
      const resId = getRestaurantId();
      const r = await fetch(`${getPosUrl()}/api/kiosk/config/?restaurant_id=${resId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitchen_printer_ip:      config.kitchen_printer_ip,
          kitchen_printer_port:    parseInt(config.kitchen_printer_port) || 9100,
          kitchen_printer_enabled: config.kitchen_printer_enabled,
          tva_rate:                parseFloat(config.tva_rate) || 0,
          ticket_header:           config.ticket_header,
          ticket_footer:           config.ticket_footer,
          ticket_show_tva:         config.ticket_show_tva,
          delivery_modes:          config.delivery_modes,
        }),
      });
      if (r.ok) Alert.alert('Succès', 'Paramètres sauvegardés');
      else Alert.alert('Erreur', 'Impossible de sauvegarder');
    } catch { Alert.alert('Erreur', 'Connexion impossible'); }
    setSaving(false);
  };

  const testPrinter = async () => {
    if (!config.kitchen_printer_ip) { Alert.alert('Erreur', 'Entrez une adresse IP'); return; }
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.testNetworkPrinter) {
        const result = await electronAPI.testNetworkPrinter(config.kitchen_printer_ip, parseInt(config.kitchen_printer_port));
        Alert.alert(result.success ? 'Succès ✓' : 'Erreur', result.success ? 'Imprimante accessible !' : `Erreur : ${result.error}`);
      } else {
        Alert.alert('Info', 'Test disponible uniquement depuis l\'app desktop');
      }
    } catch { Alert.alert('Erreur', 'Impossible de tester l\'imprimante'); }
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.primaryColor} />
    </View>;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar hidden />
      <View style={[s.header, { backgroundColor: theme.primaryColor }]}>
        <Text style={s.headerTitle}>Paramètres</Text>
        <TouchableOpacity onPress={save} style={s.saveBtn} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={s.saveBtnText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── Imprimante cuisine réseau ──────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="print" size={22} color={theme.primaryColor} />
            <Text style={[s.cardTitle, { color: theme.textColor }]}>Imprimante cuisine (réseau)</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Activée</Text>
            <Switch
              value={config.kitchen_printer_enabled}
              onValueChange={v => setConfig(c => ({ ...c, kitchen_printer_enabled: v }))}
              thumbColor={config.kitchen_printer_enabled ? theme.primaryColor : '#94a3b8'}
            />
          </View>
          <Text style={s.label}>Adresse IP</Text>
          <TextInput
            style={s.input}
            value={config.kitchen_printer_ip}
            onChangeText={t => setConfig(c => ({ ...c, kitchen_printer_ip: t }))}
            placeholder="ex: 192.168.1.200"
            keyboardType="numeric"
          />
          <Text style={s.label}>Port TCP</Text>
          <TextInput
            style={s.input}
            value={config.kitchen_printer_port}
            onChangeText={t => setConfig(c => ({ ...c, kitchen_printer_port: t }))}
            placeholder="9100"
            keyboardType="numeric"
          />
          <TouchableOpacity style={[s.testBtn, { borderColor: theme.primaryColor }]} onPress={testPrinter}>
            <Ionicons name="wifi" size={18} color={theme.primaryColor} />
            <Text style={[s.testBtnText, { color: theme.primaryColor }]}>Tester la connexion</Text>
          </TouchableOpacity>
        </View>

        {/* ── TVA & Ticket ───────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="receipt" size={22} color={theme.primaryColor} />
            <Text style={[s.cardTitle, { color: theme.textColor }]}>Ticket de caisse & TVA</Text>
          </View>
          <Text style={s.label}>Taux de TVA (%)</Text>
          <TextInput
            style={s.input}
            value={config.tva_rate}
            onChangeText={t => setConfig(c => ({ ...c, tva_rate: t }))}
            placeholder="0"
            keyboardType="numeric"
          />
          <View style={s.row}>
            <Text style={s.label}>Afficher la TVA sur le ticket</Text>
            <Switch
              value={config.ticket_show_tva}
              onValueChange={v => setConfig(c => ({ ...c, ticket_show_tva: v }))}
              thumbColor={config.ticket_show_tva ? theme.primaryColor : '#94a3b8'}
            />
          </View>
          <Text style={s.label}>En-tête du ticket</Text>
          <TextInput
            style={[s.input, { height: 64 }]}
            value={config.ticket_header}
            onChangeText={t => setConfig(c => ({ ...c, ticket_header: t }))}
            placeholder="Bienvenue chez nous !"
            multiline
          />
          <Text style={s.label}>Pied de page du ticket</Text>
          <TextInput
            style={[s.input, { height: 64 }]}
            value={config.ticket_footer}
            onChangeText={t => setConfig(c => ({ ...c, ticket_footer: t }))}
            placeholder="Merci de votre visite !"
            multiline
          />
        </View>

        {/* ── Mode de livraison borne ────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="location" size={22} color={theme.primaryColor} />
            <Text style={[s.cardTitle, { color: theme.textColor }]}>Mode de commande (borne)</Text>
          </View>
          {DELIVERY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.optionBtn, config.delivery_modes === opt.value && { backgroundColor: theme.primaryColor + '15', borderColor: theme.primaryColor }]}
              onPress={() => setConfig(c => ({ ...c, delivery_modes: opt.value }))}
            >
              <View style={[s.radio, config.delivery_modes === opt.value && { borderColor: theme.primaryColor }]}>
                {config.delivery_modes === opt.value && <View style={[s.radioInner, { backgroundColor: theme.primaryColor }]} />}
              </View>
              <Text style={[s.optionLabel, { color: theme.textColor }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },
  saveBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  content:     { padding: 20, gap: 16 },
  card:        { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, gap: 10 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTitle:   { fontSize: 17, fontWeight: '700' },
  label:       { fontSize: 13, color: '#64748b', fontWeight: '600' },
  input:       { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#f8fafc' },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  testBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  testBtnText: { fontWeight: '700', fontSize: 14 },
  optionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#94a3b8', justifyContent: 'center', alignItems: 'center' },
  radioInner:  { width: 12, height: 12, borderRadius: 6 },
});
