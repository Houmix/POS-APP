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
    // Fonction pour récupérer le rôle stocké lors du Login
    const checkUserRole = async () => {
      try {
        // Supposons que vous stockiez l'objet user complet en JSON string
        const userData = await AsyncStorage.getItem('user'); 
        if (userData) {
          const user = JSON.parse(userData);
          // Ici on utilise le 'role_name' ajouté à l'étape 1
          setUserRole(user.role_name); 
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

  // Définir qui est Manager (Manager ou Owner)
  const isManager = userRole === 'manager' || userRole === 'owner';

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
      {/* 1. Caisse - Accessible à tous les employés */}
      <Tabs.Screen
        name="terminal"
        options={{
          title: 'Caisse',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calculator" : "calculator-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* 2. Commandes - Accessible à tous les employés */}
      <Tabs.Screen
        name="order"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list-circle" : "list-circle-outline"} size={26} color={color} />
          ),
        }}
      />

      {/* 3. Stocks - Accessible à tous les employés */}
      <Tabs.Screen
        name="manageTerminal"
        options={{
          title: 'Stocks',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* 4. Menu - RÉSERVÉ MANAGER */}
      <Tabs.Screen
        name="MenuAdminPage"
        options={{
          title: 'Menu',
          // Si ce n'est pas un manager, href: null cache l'onglet complètement
          href: isManager ? '/MenuAdminPage' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color} />
          ),
        }}
      />

      {/* 5. Stats (KPI) - RÉSERVÉ MANAGER */}
      <Tabs.Screen
        name="kpi"
        options={{
          title: 'Stats',
          href: isManager ? '/kpi' : null,
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