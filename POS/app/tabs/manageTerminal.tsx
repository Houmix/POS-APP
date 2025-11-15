import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TabView, SceneMap } from "react-native-tab-view";

export default function ManageTerminal() {
  const [menuGroups, setMenuGroups] = useState([]);
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "menuGroups", title: "Groupes de menus" },
    { key: "menus", title: "Menus" },
    { key: "options", title: "Options" },
  ]);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("token");
        const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");

        const menuGroupResponse = await axios.get(
          `http://127.0.0.1:8000/menu/api/getGroupMenuList/${restaurantId}/`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const menuResponse = await axios.get(
          `http://127.0.0.1:8000/menu/api/getAllMenu/${restaurantId}/`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const optionResponse = await axios.get(
          `http://127.0.0.1:8000/menu/api/getStepOption/${restaurantId}/`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        setMenuGroups(menuGroupResponse.data);
        setMenus(menuResponse.data);
        setOptions(optionResponse.data);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      }
    };

    fetchData();
  }, []);

  const toggleAvalaible = async (type, id, currentValue) => {
    try {
      const accessToken = await AsyncStorage.getItem("token");
      const endpoint =
        type === "menuGroup"
          ? `http://127.0.0.1:8000/menu/api/updateGroupMenu/`
          : type === "menu"
          ? `http://127.0.0.1:8000/menu/api/updateMenu/`
          : `http://127.0.0.1:8000/menu/api/updateStepOption/`;

      const response = await axios.put(
        endpoint,
        { id, avalaible: !currentValue },
        {
          headers: {
        Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 200) {
        if (type === "menuGroup") {
          setMenuGroups((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, avalaible: !currentValue } : item
            )
          );
        } else if (type === "menu") {
          setMenus((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, avalaible: !currentValue } : item
            )
          );
        } else if (type === "option") {
          setOptions((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, avalaible: !currentValue } : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour :", error);
    }
  };

  const renderList = (data, type) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.itemContainer}>
          <Text style={styles.itemText}>{item.name}</Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              item.avalaible ? styles.buttonOn : styles.buttonOff,
            ]}
            onPress={() => toggleAvalaible(type, item.id, item.avalaible)}
          >
            <Text style={styles.buttonText}>
              {item.avalaible ? "On" : "Off"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );

  const renderScene = SceneMap({
    menuGroups: () => renderList(menuGroups, "menuGroup"),
    menus: () => renderList(menus, "menu"),
    options: () => renderList(options, "option"),
  });

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: Dimensions.get("window").width }}
    />
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  itemText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonOn: {
    backgroundColor: "#28a745",
  },
  buttonOff: {
    backgroundColor: "#dc3545",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
