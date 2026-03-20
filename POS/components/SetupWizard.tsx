// components/SetupWizard.tsx
// Premier démarrage du POS : connexion au compte ClickGo (cloud),
// vérification de licence, téléchargement et application de toutes les données.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import axios from 'axios';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// URL du serveur cloud ClickGo (master)
const CLOUD_URL = 'https://borndz-production.up.railway.app';
// Serveur local Django (toujours localhost sur le POS)
const LOCAL_URL = 'http://127.0.0.1:8000';

type Step = 'credentials' | 'syncing' | 'done' | 'error';

interface Props {
  onSetupComplete: () => void;
}

export default function SetupWizard({ onSetupComplete }: Props) {
  const [step, setStep] = useState<Step>('credentials');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleSetup = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez renseigner vos identifiants ClickGo.');
      return;
    }
    setError(null);
    setStep('syncing');
    setLogs([]);

    try {
      // ── 1. Connexion au cloud ──────────────────────────────────────────────
      addLog('Connexion au serveur ClickGo...');
      let loginRes: any;
      try {
        loginRes = await axios.post(
          `${CLOUD_URL}/user/api/employee/token/`,
          { phone: phone.trim(), password },
          { timeout: 10000 }
        );
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          throw new Error('Identifiants incorrects. Vérifiez votre téléphone et mot de passe.');
        }
        throw new Error('Impossible de joindre le serveur ClickGo. Vérifiez votre connexion internet.');
      }

      const { restaurant_id, user } = loginRes.data;
      const roleName: string = (user?.role_name || '').toLowerCase();

      if (!['manager', 'owner'].includes(roleName)) {
        throw new Error('Seul un Manager ou le Propriétaire peut configurer cette installation.');
      }
      if (!restaurant_id) {
        throw new Error('Aucun restaurant associé à ce compte.');
      }

      addLog(`✓ Connecté — Restaurant #${restaurant_id}`);

      // ── 2. Vérification de la licence sur le cloud ─────────────────────────
      addLog('Vérification de la licence...');
      const licRes = await axios.get(
        `${CLOUD_URL}/api/license/restaurant-status/?restaurant_id=${restaurant_id}`,
        { timeout: 8000 }
      );
      if (!licRes.data.valid) {
        const reason = licRes.data.reason;
        if (reason === 'expired') {
          throw new Error('La licence de ce restaurant a expiré. Contactez le support ClickGo.');
        }
        throw new Error('Aucune licence active pour ce restaurant. Contactez le support ClickGo.');
      }
      const expiresAt: string | null = licRes.data.expires_at || null;
      addLog(`✓ Licence valide (expire : ${expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR') : '—'})`);

      // ── 3. Téléchargement du snapshot complet (menus, config, etc.) ────────
      addLog('Téléchargement des données du restaurant...');
      const snapshotRes = await axios.get(
        `${CLOUD_URL}/api/sync/snapshot/?restaurant_id=${restaurant_id}`,
        { timeout: 30000 }
      );
      if (!snapshotRes.data.success) {
        throw new Error('Échec du téléchargement des données cloud.');
      }
      const snapshot = snapshotRes.data;
      addLog(`✓ Données reçues : ${snapshot.group_menus?.length ?? 0} catégories, ${snapshot.menus?.length ?? 0} menus`);

      // ── 4. Application du snapshot sur le Django local ─────────────────────
      addLog('Application des données en local...');
      const applyRes = await axios.post(
        `${LOCAL_URL}/api/sync/apply-snapshot/`,
        snapshot,
        { timeout: 30000 }
      );
      if (!applyRes.data.success) {
        throw new Error('Échec de l\'application des données en local.');
      }
      const applied = applyRes.data.applied || {};
      addLog(`✓ Importé : ${applied.group_menu ?? 0} catégories, ${applied.menu ?? 0} menus, ${applied.option ?? 0} options`);

      // ── 5. Synchronisation de la licence en local ──────────────────────────
      addLog('Synchronisation de la licence en local...');
      await axios.post(
        `${LOCAL_URL}/api/license/sync-local/`,
        {
          restaurant_id,
          restaurant_name: snapshot.restaurant?.name || '',
          plan: licRes.data.plan || 'standard',
          features: licRes.data.features || [],
          expires_at: expiresAt,
          status: 'active',
        },
        { timeout: 8000 }
      );
      addLog('✓ Licence enregistrée en local');

      addLog('✅ Configuration terminée !');
      setStep('done');

      // Laisser l'utilisateur voir le résumé puis passer à l'app
      setTimeout(onSetupComplete, 2000);

    } catch (e: any) {
      const msg = e?.message || 'Erreur inattendue';
      addLog(`❌ ${msg}`);
      setError(msg);
      setStep('error');
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (step === 'credentials') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.logo}>⚙️</Text>
          <Text style={styles.title}>Configuration initiale</Text>
          <Text style={styles.subtitle}>
            Connectez-vous à votre compte ClickGo{'\n'}pour initialiser ce poste.
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#fca5a5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Téléphone (compte ClickGo)"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
          />

          <View style={styles.pwRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Mot de passe"
              placeholderTextColor="#64748b"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <MaterialCommunityIcons name={showPassword ? 'eye' : 'eye-off'} size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleSetup}>
            <MaterialCommunityIcons name="cloud-download" size={20} color="#fff" />
            <Text style={styles.btnText}>Initialiser et synchroniser</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Ces identifiants sont ceux de votre compte manager sur le portail ClickGo.
          </Text>
        </View>
      </View>
    );
  }

  if (step === 'syncing' || step === 'done') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.logo}>{step === 'done' ? '✅' : '⏳'}</Text>
          <Text style={styles.title}>
            {step === 'done' ? 'Configuration réussie !' : 'Synchronisation en cours...'}
          </Text>
          <ScrollView style={styles.logBox} contentContainerStyle={{ paddingVertical: 8 }}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>{log}</Text>
            ))}
          </ScrollView>
          {step === 'syncing' && <ActivityIndicator size="large" color="#756fbf" style={{ marginTop: 16 }} />}
        </View>
      </View>
    );
  }

  // error
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>❌</Text>
        <Text style={styles.title}>Erreur de configuration</Text>
        <ScrollView style={styles.logBox} contentContainerStyle={{ paddingVertical: 8 }}>
          {logs.map((log, i) => (
            <Text key={i} style={[styles.logLine, log.startsWith('❌') && { color: '#fca5a5' }]}>{log}</Text>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.btn} onPress={() => { setStep('credentials'); setLogs([]); }}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 36,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logo: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1 },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 14 },
  eyeBtn: { padding: 14, marginLeft: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#756fbf',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 28,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 20, lineHeight: 18 },
  logBox: {
    width: '100%',
    maxHeight: 220,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  logLine: { color: '#94a3b8', fontSize: 13, marginBottom: 6, fontFamily: 'monospace' },
});
