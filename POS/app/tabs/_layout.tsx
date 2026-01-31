import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: "#6366F1",
  inactive: "#94A3B8",
  background: "#FFFFFF",
  border: "#E2E8F0"
};

export default function TabLayout() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        console.log("🔍 _layout: Données utilisateur brutes:", userData);

        if (userData) {
          const user = JSON.parse(userData);
          // Sécurité : on vérifie si role_name existe, sinon on regarde role
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
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Logique stricte pour déterminer l'accès
  // On met tout en minuscule pour éviter les erreurs de casse (Manager vs manager)
  const roleLower = userRole ? userRole.toLowerCase() : '';
  const isManager = roleLower === 'manager' || roleLower === 'owner';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: { marginBottom: -4 },
      }}
    >
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list-circle" : "list-circle-outline"} size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="manageTerminal"
        options={{
          title: 'Stocks',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* REGLAGE MANAGER : Si pas manager, href: null cache l'onglet */}
      <Tabs.Screen
        name="MenuAdminPage"
        options={{
          title: 'Menu',
          // ⚠️ CORRECTION : On utilise 'undefined' au lieu du chemin '/MenuAdminPage'
          // Cela laisse Expo Router trouver le fichier automatiquement
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="kpi"
        options={{
          title: 'Stats',
          // ⚠️ CORRECTION : Idem ici, 'undefined' si manager, 'null' sinon
          href: isManager ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
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
});