import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';

const COLORS = {
  primary: "#6366F1",    // Indigo (assorti au KPI)
  inactive: "#94A3B8",   // Gris bleuâtre
  background: "#FFFFFF",
  border: "#E2E8F0"
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Souvent préférable pour un POS
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
      <Tabs.Screen
        name="MenuAdminPage"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kpi"
        options={{
          title: 'Stats',
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
    // Ombre pour l'effet de profondeur
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