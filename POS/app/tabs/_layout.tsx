import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKioskTheme } from '@/contexts/KioskThemeContext';
import { useCashierSession } from '@/contexts/CashierSessionContext';

const COLORS = {
  inactive: "#94A3B8",
  background: "#FFFFFF",
  border: "#E2E8F0"
};

export default function TabLayout() {
  const theme = useKioskTheme();
  const { showTimeoutWarning, remainingSeconds, registerActivity } = useCashierSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        console.log("🔍 _layout: Données utilisateur brutes:", userData);

        if (userData) {
          const user = JSON.parse(userData);
          const role = user.role_name || user.role?.role || '';
          console.log("🔍 _layout: Rôle détecté:", role);
          setUserRole(role);
        }
      } catch (e) {
        console.error("Erreur récupération role", e);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
      </View>
    );
  }

  // Logique stricte pour déterminer l'accès
  const roleLower = userRole ? userRole.toLowerCase() : '';

  // 1. Droit "Manager" : Accès total (Caisse + Commandes + Stocks + Menu + Stats)
  // Concerne : Manager et Owner
  const isManager = roleLower === 'manager' || roleLower === 'owner';

  // 2. Droit "Staff" : Accès opérationnel (Caisse + Commandes + Stocks)
  // Concerne : Manager, Owner et Cashier. (Le Customer est exclu ici)
  const isStaff = roleLower === 'manager' || roleLower === 'owner' || roleLower === 'cashier';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={registerActivity} onTouchStart={registerActivity}>
      {/* Bannière d'alerte inactivité */}
      {showTimeoutWarning && (
        <View style={styles.timeoutBanner}>
          <Ionicons name="time-outline" size={20} color="#fff" />
          <Text style={styles.timeoutText}>
            Déconnexion dans {formatTime(remainingSeconds)} — Touchez l'écran pour rester connecté
          </Text>
          <TouchableOpacity onPress={registerActivity} style={styles.timeoutBtn}>
            <Text style={styles.timeoutBtnText}>Je suis là</Text>
          </TouchableOpacity>
        </View>
      )}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryColor,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: { marginBottom: -4 },
      }}
    >
      {/* Tout le monde a accès à la Caisse (y compris Customer) */}
      <Tabs.Screen
        name="terminal"
        options={{
          title: 'Caisse',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calculator" : "calculator-outline"} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="order"
        options={{
          title: 'Commandes',
          // Si staff (Manager/Owner/Cashier) -> Visible, sinon (Customer) -> Caché
          href: isStaff ? undefined : null, 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list-circle" : "list-circle-outline"} size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="manageTerminal"
        options={{
          title: 'Stocks',
          // Masqué en V2 — géré via ClickGo Manager
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Cuisine KDS : visible pour tout le staff */}
      <Tabs.Screen
        name="kds"
        options={{
          title: 'Cuisine',
          href: isStaff ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flame" : "flame-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Écran serveur (distribution) : visible pour tout le staff */}
      <Tabs.Screen
        name="server"
        options={{
          title: 'Service',
          href: isStaff ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bicycle" : "bicycle-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Seuls Owner et Manager accèdent à l'admin du Menu */}
      <Tabs.Screen
        name="MenuAdminPage"
        options={{
          title: 'Menu',
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Seuls Owner et Manager accèdent aux Stats */}
      <Tabs.Screen
        name="kpi"
        options={{
          title: 'Stats',
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Gestion des bornes — Manager/Owner uniquement */}
      <Tabs.Screen
        name="BornesPage"
        options={{
          title: 'Bornes',
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "tablet-landscape" : "tablet-landscape-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* Paramètres (imprimante cuisine, ticket, TVA, livraison) — Manager/Owner */}
      <Tabs.Screen
        name="SettingsPage"
        options={{
          title: 'Paramètres',
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: Platform.OS === 'ios' ? 88 : 65,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    paddingTop: 10,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Bannière timeout
  timeoutBanner: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  timeoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  timeoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  timeoutBtnText: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 13,
  },
});