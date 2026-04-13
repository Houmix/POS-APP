import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { CashierSessionProvider } from "@/contexts/CashierSessionContext";
import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveRestaurantId, getPosUrl, loadServerUrl } from "@/utils/serverConfig";
import SetupWizard from "@/components/SetupWizard";
const LICENSE_EXPIRY_KEY = 'pos_license_expires_at';

type AppState =
  | 'loading'        // démarrage
  | 'no_server'      // Django local injoignable
  | 'first_setup'    // DB vide → SetupWizard
  | 'no_license'     // licence expirée/absente
  | 'ready';         // tout OK → écran login employé

async function getCachedExpiry(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LICENSE_EXPIRY_KEY); } catch { return null; }
}
async function setCachedExpiry(v: string | null) {
  if (v) await AsyncStorage.setItem(LICENSE_EXPIRY_KEY, v);
  else await AsyncStorage.removeItem(LICENSE_EXPIRY_KEY);
}
function cacheStillValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

export default function RootLayout() {
  const [appState, setAppState] = useState<AppState>('loading');

  const init = useCallback(async () => {
    setAppState('loading');

    // ── 1. Serveur accessible ? ─────────────────────────────────────────
    await loadServerUrl(); // charge l'URL sauvegardée ou détecte automatiquement
    const serverUrl = getPosUrl();
    let restaurantId: number | null = null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${serverUrl}/api/sync/discover/`, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        restaurantId = data.restaurant_id || null;
        // Synchroniser la clé serverConfig avec ce que retourne le serveur local
        if (restaurantId) await saveRestaurantId(restaurantId.toString());
      }
    } catch {
      // Serveur injoignable
      const cached = await getCachedExpiry();
      if (cacheStillValid(cached)) {
        // Licence en cache valide → on laisse passer (mode dégradé)
        setAppState('ready');
      } else {
        setAppState('no_server');
      }
      return;
    }

    // ── 2. DB vide (pas encore initialisée) ? ────────────────────────────────
    if (!restaurantId) {
      setAppState('first_setup');
      return;
    }

    // ── 3. Vérification de la licence en local ────────────────────────────────
    try {
      const res = await fetch(
        `${serverUrl}/api/license/restaurant-status/?restaurant_id=${restaurantId}`
      );
      const data = await res.json();
      if (data.valid) {
        await setCachedExpiry(data.expires_at || null);
        setAppState('ready');
      } else {
        await setCachedExpiry(null);
        setAppState('no_license');
      }
    } catch {
      // Erreur inattendue → mode optimiste si cache valide
      const cached = await getCachedExpiry();
      setAppState(cacheStillValid(cached) ? 'ready' : 'no_license');
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  const handleSetupComplete = useCallback(() => { init(); }, [init]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (appState === 'loading') {
    return (
      <View style={styles.splash}>
        <Text style={styles.brand}>ClickGo</Text>
        <ActivityIndicator size="large" color="#756fbf" style={{ marginTop: 24 }} />
        <Text style={styles.sub}>Démarrage...</Text>
      </View>
    );
  }

  if (appState === 'no_server') {
    return (
      <View style={styles.splash}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Serveur local indisponible</Text>
        <Text style={styles.sub}>
          Le service Django ne répond pas.{'\n'}
          Vérifiez que le serveur est bien lancé sur ce poste.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={init}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (appState === 'first_setup') {
    return <SetupWizard onSetupComplete={handleSetupComplete} />;
  }

  if (appState === 'no_license') {
    return (
      <View style={styles.splash}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Licence inactive</Text>
        <Text style={styles.sub}>
          Aucune licence active pour ce restaurant.{'\n'}
          Contactez le support ClickGo pour activer votre abonnement.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={init}>
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={async () => {
            // Permet de refaire le setup (ex: changement de restaurant)
            setAppState('first_setup');
          }}
        >
          <Text style={[styles.btnText, { color: '#94a3b8' }]}>Reconfigurer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ready → app normale
  return (
    <KioskThemeProvider>
      <LanguageProvider>
        <CashierSessionProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(order)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </CashierSessionProvider>
      </LanguageProvider>
    </KioskThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  brand: { fontSize: 42, fontWeight: '900', color: '#756fbf', letterSpacing: 2 },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 12, textAlign: 'center' },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: {
    backgroundColor: '#756fbf', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
    minWidth: 220, alignItems: 'center', marginTop: 12,
  },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
