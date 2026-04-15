import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, ActivityIndicator, StatusBar,
  Animated,
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

  // ── État mise à jour logiciel ──
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateErrorMsg, setUpdateErrorMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('…');
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── État sync cloud ──
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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

  // ── Listeners mise à jour ──
  useEffect(() => {
    const api = (window as any).updaterAPI;
    if (!api) return;
    // Récupérer la version de l'app
    api.getVersion?.().then((v: string) => {
      if (v) setAppVersion(`V${v}`);
    }).catch(() => {});
    // Récupérer l'état actuel au montage
    api.getStatus?.().then((s: any) => {
      if (s) {
        setUpdateStatus(s.status || 'idle');
        setUpdateProgress(s.progress || 0);
        setUpdateVersion(s.version || null);
        if (s.progress > 0) {
          Animated.timing(progressAnim, { toValue: s.progress, duration: 200, useNativeDriver: false }).start();
        }
      }
    });
    api.onUpdateAvailable?.((version: string) => {
      setUpdateStatus('downloading');
      setUpdateVersion(version);
      setUpdateProgress(0);
      setUpdateErrorMsg(null);
    });
    api.onUpdateProgress?.((pct: number) => {
      setUpdateStatus('downloading');
      setUpdateProgress(pct);
      Animated.timing(progressAnim, { toValue: pct, duration: 300, useNativeDriver: false }).start();
    });
    api.onUpdateDownloaded?.((version: string) => {
      setUpdateStatus('downloaded');
      setUpdateVersion(version);
      setUpdateProgress(100);
      Animated.timing(progressAnim, { toValue: 100, duration: 300, useNativeDriver: false }).start();
    });
    api.onUpdateNotAvailable?.(() => {
      setUpdateStatus('not-available');
      setUpdateErrorMsg(null);
    });
    api.onUpdateError?.((msg: string) => {
      setUpdateStatus('error');
      setUpdateErrorMsg(msg || 'Erreur inconnue');
    });
  }, []);

  const checkForUpdate = async () => {
    const api = (window as any).updaterAPI;
    if (!api) { Alert.alert('Info', 'Disponible uniquement depuis l\'app desktop'); return; }
    setUpdateStatus('checking');
    setUpdateProgress(0);
    setUpdateErrorMsg(null);
    progressAnim.setValue(0);
    try {
      const result = await api.checkForUpdate();
      if (result?.status === 'error') {
        setUpdateStatus('error');
        setUpdateErrorMsg(result.message || 'Impossible de vérifier');
      } else if (result?.status === 'noRelease') {
        setUpdateStatus('not-available');
      }
    } catch (e: any) {
      setUpdateStatus('error');
      setUpdateErrorMsg(e?.message || 'Impossible de vérifier les mises à jour');
    }
    // Les listeners gèreront la suite (available/not-available/progress/downloaded)
  };

  const installUpdate = async () => {
    const api = (window as any).updaterAPI;
    if (api) api.installUpdate();
  };

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

  // ── Resync complète depuis le cloud ──
  const forceResyncFromCloud = async () => {
    const syncApi = (window as any).syncAPI;
    if (!syncApi) { Alert.alert('Info', 'Disponible uniquement depuis l\'app desktop'); return; }
    Alert.alert(
      'Resynchronisation complète',
      'Cela va supprimer toutes les données locales et les retélécharger depuis le cloud. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Resynchroniser', style: 'destructive', onPress: async () => {
            setSyncStatus('syncing');
            setSyncMessage('Suppression des données locales…');
            try {
              const result = await syncApi.forceReset();
              if (result === true || result?.bootstrapped) {
                setSyncStatus('done');
                setSyncMessage('Synchronisation terminée ! Redémarrage recommandé.');
              } else {
                setSyncStatus('error');
                setSyncMessage('Échec de la synchronisation. Vérifiez la connexion au cloud.');
              }
            } catch (e: any) {
              setSyncStatus('error');
              setSyncMessage(e?.message || 'Erreur lors de la synchronisation');
            }
          }
        }
      ]
    );
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

        {/* ── Synchronisation cloud ───────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="cloud-sync" size={22} color={theme.primaryColor} />
            <Text style={[s.cardTitle, { color: theme.textColor }]}>Synchronisation cloud</Text>
          </View>
          <Text style={[s.label, { lineHeight: 18 }]}>
            Resynchronise le menu, les catégories, les options et les employés depuis le serveur cloud. Utile si des éléments supprimés en ligne apparaissent encore.
          </Text>

          {syncStatus === 'syncing' && (
            <View style={[s.row, { gap: 8 }]}>
              <ActivityIndicator size="small" color={theme.primaryColor} />
              <Text style={[s.label, { color: theme.primaryColor }]}>{syncMessage || 'Synchronisation…'}</Text>
            </View>
          )}
          {syncStatus === 'done' && (
            <View style={[s.row, { gap: 8 }]}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={[s.label, { color: '#10b981', flex: 1 }]}>{syncMessage}</Text>
            </View>
          )}
          {syncStatus === 'error' && (
            <View style={[s.row, { gap: 8 }]}>
              <Ionicons name="warning" size={18} color="#ef4444" />
              <Text style={[s.label, { color: '#ef4444', flex: 1 }]}>{syncMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.updateBtn, { backgroundColor: theme.primaryColor, opacity: syncStatus === 'syncing' ? 0.5 : 1 }]}
            onPress={forceResyncFromCloud}
            disabled={syncStatus === 'syncing'}
          >
            <Ionicons name="sync" size={18} color="white" />
            <Text style={s.updateBtnText}>Resynchroniser depuis le cloud</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mise à jour du logiciel ────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="cloud-download" size={22} color={theme.primaryColor} />
            <Text style={[s.cardTitle, { color: theme.textColor }]}>Mise à jour du logiciel</Text>
          </View>

          <View style={s.row}>
            <Text style={[s.label, { flex: 1 }]}>Version actuelle</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textColor }}>{appVersion}</Text>
          </View>

          {/* Barre de progression */}
          {(updateStatus === 'downloading' || updateStatus === 'downloaded') && (
            <View style={{ gap: 6 }}>
              <View style={s.row}>
                <Text style={s.label}>
                  {updateStatus === 'downloaded'
                    ? `Version ${updateVersion || ''} prête à installer`
                    : `Téléchargement${updateVersion ? ` v${updateVersion}` : ''}…`
                  }
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primaryColor }}>
                  {updateProgress}%
                </Text>
              </View>
              <View style={s.progressTrack}>
                <Animated.View
                  style={[
                    s.progressFill,
                    {
                      backgroundColor: updateStatus === 'downloaded' ? '#10b981' : theme.primaryColor,
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Statut */}
          {updateStatus === 'checking' && (
            <View style={[s.row, { gap: 8 }]}>
              <ActivityIndicator size="small" color={theme.primaryColor} />
              <Text style={s.label}>Vérification en cours…</Text>
            </View>
          )}
          {updateStatus === 'not-available' && (
            <View style={[s.row, { gap: 8 }]}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={[s.label, { color: '#10b981' }]}>Le logiciel est à jour</Text>
            </View>
          )}
          {updateStatus === 'error' && (
            <View style={[s.row, { gap: 8 }]}>
              <Ionicons name="warning" size={18} color="#ef4444" />
              <Text style={[s.label, { color: '#ef4444', flex: 1 }]}>{updateErrorMsg || 'Erreur de vérification'}</Text>
            </View>
          )}

          {/* Boutons */}
          {updateStatus === 'downloaded' ? (
            <TouchableOpacity
              style={[s.updateBtn, { backgroundColor: '#10b981' }]}
              onPress={installUpdate}
            >
              <Ionicons name="download" size={18} color="white" />
              <Text style={s.updateBtnText}>Installer et redémarrer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.updateBtn, { backgroundColor: theme.primaryColor, opacity: updateStatus === 'checking' || updateStatus === 'downloading' ? 0.5 : 1 }]}
              onPress={checkForUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            >
              <Ionicons name="refresh" size={18} color="white" />
              <Text style={s.updateBtnText}>Mettre à jour le logiciel</Text>
            </TouchableOpacity>
          )}
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
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },
  updateBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  updateBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
