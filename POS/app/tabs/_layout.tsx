

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'terminal') {
            iconName = 'receipt-outline';
          } else if (route.name === 'order') {
            iconName = 'person-outline';
          } else if (route.name === 'manageTerminal') {
            iconName = 'person-outline';
          } else if (route.name === 'kpi') {
            iconName = 'attach-money-outline';
          }
          else if (route.name === 'MenuAdminPage') {
            iconName = 'restaurant-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    />
  );
}
