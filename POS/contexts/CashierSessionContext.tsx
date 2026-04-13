import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getPosUrl } from '@/utils/serverConfig';
import { AppState, AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// ─── Configuration ──────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 60_000;       // Ping toutes les 60s
const INACTIVITY_TIMEOUT_MS = 30 * 60_000;  // 30 min d'inactivité
const WARNING_BEFORE_MS = 5 * 60_000;       // Alerte 5 min avant déconnexion

interface CashierSessionContextType {
  sessionId: number | null;
  showTimeoutWarning: boolean;
  remainingSeconds: number;
  registerActivity: () => void;
  startSession: () => Promise<void>;
  endSession: (reason?: string) => Promise<void>;
}

const CashierSessionContext = createContext<CashierSessionContextType>({
  sessionId: null,
  showTimeoutWarning: false,
  remainingSeconds: 0,
  registerActivity: () => {},
  startSession: async () => {},
  endSession: async () => {},
});

export const useCashierSession = () => useContext(CashierSessionContext);

export function CashierSessionProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<number | null>(null);

  // Garde sessionIdRef synchronisé
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ─── Démarrer une session ─────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.post(`${getPosUrl()}/user/api/cashier-session/start/`, {}, { headers });
      const id = res.data.session_id;
      setSessionId(id);
      sessionIdRef.current = id;
      await AsyncStorage.setItem('cashier_session_id', id.toString());
      lastActivityRef.current = Date.now();
      console.log('Cashier session started:', id);
    } catch (err) {
      console.error('Erreur démarrage session caissier:', err);
    }
  }, []);

  // ─── Terminer une session ─────────────────────────────────────────────────
  const endSession = useCallback(async (reason = 'manual') => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const headers = await getAuthHeader();
      await axios.post(`${getPosUrl()}/user/api/cashier-session/end/`, {
        session_id: sid,
        reason,
      }, { headers });
      console.log('Cashier session ended:', sid, reason);
    } catch (err) {
      console.error('Erreur fin session caissier:', err);
    }
    setSessionId(null);
    sessionIdRef.current = null;
    await AsyncStorage.removeItem('cashier_session_id');
  }, []);

  // ─── Enregistrer une activité (touch, navigation, etc.) ──────────────────
  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showTimeoutWarning) {
      setShowTimeoutWarning(false);
    }
  }, [showTimeoutWarning]);

  // ─── Heartbeat (envoi périodique au serveur) ──────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    heartbeatRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const headers = await getAuthHeader();
        await axios.post(`${getPosUrl()}/user/api/cashier-session/heartbeat/`, {
          session_id: sid,
        }, { headers });
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sessionId]);

  // ─── Vérification d'inactivité ───────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    inactivityRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeLeft = INACTIVITY_TIMEOUT_MS - elapsed;

      if (timeLeft <= 0) {
        // Timeout : déconnexion
        setShowTimeoutWarning(false);
        endSession('timeout').then(() => {
          navigation.reset({ index: 0, routes: [{ name: 'index' as never }] });
        });
      } else if (timeLeft <= WARNING_BEFORE_MS) {
        // Afficher l'alerte
        setShowTimeoutWarning(true);
        setRemainingSeconds(Math.ceil(timeLeft / 1000));
      } else {
        setShowTimeoutWarning(false);
      }
    }, 1000);

    return () => {
      if (inactivityRef.current) clearInterval(inactivityRef.current);
    };
  }, [sessionId, endSession, navigation]);

  // ─── Gestion background/foreground ────────────────────────────────────────
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        // Reprend l'activité quand l'app revient au premier plan
        registerActivity();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [registerActivity]);

  // ─── Restaurer session au montage ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const storedId = await AsyncStorage.getItem('cashier_session_id');
      if (storedId) {
        const id = parseInt(storedId, 10);
        setSessionId(id);
        sessionIdRef.current = id;
        lastActivityRef.current = Date.now();
      }
    })();
  }, []);

  return (
    <CashierSessionContext.Provider value={{
      sessionId,
      showTimeoutWarning,
      remainingSeconds,
      registerActivity,
      startSession,
      endSession,
    }}>
      {children}
    </CashierSessionContext.Provider>
  );
}
