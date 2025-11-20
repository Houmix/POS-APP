import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useEffect, useState } from "react";export default function IndexScreen() {
    // ✅ Pay.js
const router = useRouter();
const [order, setOrder] = useState([]);
const [errorMessage, setErrorMessage] = useState("");

useEffect(() => {
  const loadOrder = async () => {
    const allKeys = await AsyncStorage.getAllKeys();
    const allItems = await AsyncStorage.multiGet(allKeys);
    console.log("Stored items in session:", allItems);
    try {
      const stored = await AsyncStorage.getItem("pendingOrder");
      if (stored) {
        setOrder(JSON.parse(stored));
      } else {
        setErrorMessage("Aucune commande trouvée.");
      }
    } catch (err) {
      setErrorMessage("Erreur de lecture de la commande.");
    }
  };
  loadOrder();
}, []);

const eatin = async () => {
  try {
    const stored = await AsyncStorage.getItem("pendingOrder");
    if (stored) {
      const orderData = JSON.parse(stored);
      orderData.takeaway = false; // Ajoute ou met à jour le champ takeaway à false
      await AsyncStorage.setItem("pendingOrder", JSON.stringify(orderData)); // Met à jour la commande dans AsyncStorage
      console.log("Commande mise à jour pour Sur Place :", orderData);
      router.push("/order/pay"); // Redirection vers la page de paiement
    } else {
      setErrorMessage("Aucune commande trouvée.");
    }
  } catch (err) {
    console.error("Erreur lors de la mise à jour de la commande :", err);
    setErrorMessage("Erreur lors de la mise à jour de la commande.");
  }
};

const takeaway = async () => {
  try {
    const stored = await AsyncStorage.getItem("pendingOrder");
    if (stored) {
      const orderData = JSON.parse(stored);
      orderData.takeaway = true; // Ajoute ou met à jour le champ takeaway à true
      await AsyncStorage.setItem("pendingOrder", JSON.stringify(orderData)); // Met à jour la commande dans AsyncStorage
      console.log("Commande mise à jour pour A Emporter :", orderData);
      router.push("/order/pay"); // Redirection vers la page de paiement
    } else {
      setErrorMessage("Aucune commande trouvée.");
    }
  } catch (err) {
    console.error("Erreur lors de la mise à jour de la commande :", err);
    setErrorMessage("Erreur lors de la mise à jour de la commande.");
  }
};

    return (
    <View style={styles.main}>

        <View style={styles.container}>
        <TouchableOpacity 
            style={styles.box} 
            onPress={() => eatin()}
        >
            <Text style={styles.text}>Sur Place</Text>
            <MaterialIcons name="table-restaurant" size={400} color="black" />
      
        </TouchableOpacity>

        <TouchableOpacity 
            style={styles.box} 
            onPress={() => takeaway()}
        >
            <Text style={styles.text}>A Emporter</Text>
            <MaterialIcons name="food-bank" size={400} color="black" />
        </TouchableOpacity>
        </View>
    </View>
    );
}


const styles = StyleSheet.create({

    main: {
        flex:1,
        flexDirection:'column',
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        
    },
    textBox: {
        height:"20%",
        flexDirection:"row",
        display:"flex",
        justifyContent: "center",
        alignItems: 'center',
    },
    container: {
        height:"70%",
        width:"45%",
        flexDirection:"row",
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20, // Espacement entre les boutons
        backgroundColor: "white",
    },
    box: {
        width: "100%",
        height: "100%",
        backgroundColor: "white",
        borderRadius: 15,
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5, // Ombre pour Android
    },
    title: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine:"underline",
    },
    text: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine: "none", // Supprime le soulignement du lien
    },
});
