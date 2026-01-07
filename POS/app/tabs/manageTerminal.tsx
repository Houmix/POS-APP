import React, { useEffect, useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Dimensions, ActivityIndicator, Switch, SafeAreaView 
} from "react-native";
import { TabView, TabBar } from "react-native-tab-view";
import { LayoutGrid, Utensils, Settings2, RefreshCcw } from "lucide-react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POS_URL } from "@/config";

// --- Styles Constants ---
const COLORS = {
  primary: "#756fbf", // Orange Fast-food
  success: "#2ECC71",
  danger: "#E74C3C",
  background: "#F8F9FA",
  card: "#FFFFFF",
  text: "#2C3E50",
  muted: "#756fbf"
};

export default function ManageTerminal() {
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [data, setData] = useState({ menuGroups: [], menus: [], options: [] });
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "menuGroups", title: "Groupes", icon: <LayoutGrid size={18} color="white" /> },
    { key: "menus", title: "Menus", icon: <Utensils size={18} color="white" /> },
    { key: "options", title: "Options", icon: <Settings2 size={18} color="white" /> },
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const resId = await AsyncStorage.getItem("Employee_restaurant_id");
      const headers = { Authorization: `Bearer ${token}` };

      const [groups, menus, opts] = await Promise.all([
        axios.get(`${POS_URL}/menu/api/getGroupMenuList/${resId}/`, { headers }),
        axios.get(`${POS_URL}/menu/api/getAllMenu/${resId}/`, { headers }),
        axios.get(`${POS_URL}/menu/api/getStepOption/${resId}/`, { headers }),
      ]);

      setData({ menuGroups: groups.data, menus: menus.data, options: opts.data });
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleStatus = async (type, id, currentValue) => {
    setUpdatingId(id);
    try {
      const token = await AsyncStorage.getItem("token");
      const endpoints = {
        menuGroup: "updateGroupMenu",
        menu: "updateMenu",
        option: "updateStepOption"
      };

      await axios.put(
        `${POS_URL}/menu/api/${endpoints[type]}/`,
        { id, avalaible: !currentValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Mise à jour locale optimiste
      setData(prev => ({
        ...prev,
        [type + "s"]: prev[type + "s"].map(item => 
          item.id === id ? { ...item, avalaible: !currentValue } : item
        )
      }));
    } catch (error) {
      alert("Erreur de mise à jour");
    } finally {
      setUpdatingId(null);
    }
  };

  const renderItem = ({ item }, type) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={[styles.statusTag, { color: item.avalaible ? COLORS.success : COLORS.danger }]}>
          {item.avalaible ? "En stock" : "Épuisé"}
        </Text>
      </View>
      
      {updatingId === item.id ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <Switch
          value={item.avalaible}
          onValueChange={() => toggleStatus(type, item.id, item.avalaible)}
          trackColor={{ false: "#D1D1D1", true: "#FFD5B8" }}
          thumbColor={item.avalaible ? COLORS.primary : "#f4f3f4"}
        />
      )}
    </View>
  );

  const renderScene = ({ route }) => {
    const dataSource = route.key === "menuGroups" ? data.menuGroups : route.key === "menus" ? data.menus : data.options;
    const type = route.key.slice(0, -1); // retire le 's' pour matcher le type de toggleStatus

    return (
      <FlatList
        data={dataSource}
        renderItem={(props) => renderItem(props, type)}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchData}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion du Stock</Text>
        <TouchableOpacity onPress={fetchData}><RefreshCcw size={24} color={COLORS.text} /></TouchableOpacity>
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: Dimensions.get("window").width }}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: COLORS.primary, height: 3 }}
            style={{ backgroundColor: 'white' }}
            labelStyle={{ color: COLORS.text, fontWeight: '700', fontSize: 12 }}
            activeColor={COLORS.primary}
            inactiveColor={COLORS.muted}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white'
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  listContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Shadow pour iOS/Android
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardInfo: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: "600", color: COLORS.text, marginBottom: 4 },
  statusTag: { fontSize: 13, fontWeight: "700", textTransform: 'uppercase' }
});