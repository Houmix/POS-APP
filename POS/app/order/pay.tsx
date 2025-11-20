import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { POS_URL, idRestaurant } from "@/config";
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

const card = async () => {
  try {
    const Employee_id = await AsyncStorage.getItem("Employee_id");
    const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
    const dataToSend = {
        user: Employee_id, // Assurez-vous que userId est récupéré correctement
        items: order,  // ordre est un tableau déjà bien structuré
        
        restaurant: parseInt( restaurantId || "0", 10), // Assurez-vous que restaurantId est récupéré correctement
      };
    console.log("Données à envoyer :", dataToSend);
    const accessToken = await AsyncStorage.getItem("token");
    const response = await axios.post(
      `${POS_URL}/order/api/createOrder/1/`,
      dataToSend,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 200 || response.status === 201) {
      router.push("/order/confirmation");
    } else {
      setErrorMessage("Commande non envoyée");
    }
  } catch (error) {
    console.error("Erreur lors de la création de la commande", error);
    setErrorMessage("Erreur lors de la création de la commande");
  }
};

    const cash = async () => {
        try {
          const Employee_id = await AsyncStorage.getItem("Employee_id");
          const restaurantId = await AsyncStorage.getItem("Employee_restaurant_id");
            const dataToSend = {
                user: Employee_id, // Assurez-vous que userId est récupéré correctement
                items: order,  // ordre est un tableau déjà bien structuré
                
                restaurant: parseInt(restaurantId || "0", 10), // Assurez-vous que restaurantId est récupéré correctement
              };
            console.log("Données à envoyer :", dataToSend);
            const accessToken = await AsyncStorage.getItem("token");
            const response = await axios.post(
              `${POS_URL}/order/api/createOrder/0/`,
               dataToSend,
               {
                    headers: {
                        Authorization: `Bearer ${accessToken}`, // Token inséré dans la requête
                        "Content-Type": "application/json", // Spécifiez le type de contenu
                    },
                }
            );
            if (response.status === 200 || response.status === 201) {
                router.push("/order/confirmation");
            } else {
                setErrorMessage("Commande non envoyée");
            }
        } catch (error) {
            console.error("Erreur lors de la création de la commande", error);
        }
    };

    return (
      <View style={styles.main}>

      <View style={styles.container}>
      <TouchableOpacity 
          style={styles.box} 
          onPress={() => cash()}
      >
          <Text style={styles.text}>Espece</Text>
          <Ionicons name="cash-outline" size={400} color="black" />
      </TouchableOpacity>

      <TouchableOpacity 
          style={styles.box} 
          onPress={() => card()}
      >
          <Text style={styles.text}>Carte</Text>
          <AntDesign name="creditcard" size={400} color="black" />
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
