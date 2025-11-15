import { router, useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, FlatList, StyleSheet,TouchableOpacity, Image } from "react-native";
import { useEffect, useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AntDesign from '@expo/vector-icons/AntDesign';
export default function MenuStepsScreen() {
    const {menuId} = useLocalSearchParams(); //Récupère l'ID enregistré juste avant
    const {menuName} = useLocalSearchParams(); //Récupère l'ID enregistré juste avant
    const {price} = useLocalSearchParams(); //Récupère l'ID enregistré juste avant
    const [steps, setSteps] = useState();
    const [selectedOptions, setSelectedOptions] = useState({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    
    const currentStep = steps?.[currentStepIndex] ?? null;


    useEffect( () => {
        const steps = async () => {
            try {
                const accessToken = await AsyncStorage.getItem("token")
                const response = await axios.get(`http://127.0.0.1:8000/menu/api/stepListByMenu/${menuId}/`,{
                    headers: {
                      Authorization: `Bearer ${accessToken}` //Token inséré dans la requête
                    }
                  });
                setSteps(response.data); // Tu dois retourner les étapes + leurs options dans l’API
                console.log("Étapes récupérées :", response.data);
            } catch (error) {
                console.error("Erreur lors de la récupération des étapes :", error);
            }
        };
        steps();
    }, [menuId]);

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(currentStepIndex)
        }
      };
    
    const handlePrevious = () => {
    if (currentStepIndex > 0) {
        setCurrentStepIndex(currentStepIndex - 1);
    }
    };
    const toggleOption = (stepId, optionId, isSingle, maxOptions) => {
        setSelectedOptions((prev) => {
          const current = prev[stepId] || [];
    
          if (isSingle) {
            return {
              ...prev,
              [stepId]: [optionId],
            };
          } else {
            if (current.includes(optionId)) {
              return {
                ...prev,
                [stepId]: current.filter((id) => id !== optionId),
              };
            } else {
              if (maxOptions && current.length >= maxOptions) {
                // Limite atteinte, on ne fait rien
                return prev;
              }
              return {
                ...prev,
                [stepId]: [...current, optionId],
              };
            }
          }
        });
    };
    
    
    const addOrderToCart = async (newOrder) => {
      try {
        const existingOrders = await AsyncStorage.getItem("orderList");
        const orderList = existingOrders ? JSON.parse(existingOrders) : [];
      
        const updatedOrderList = [...orderList, newOrder];
      
        await AsyncStorage.setItem("orderList", JSON.stringify(updatedOrderList));
        console.log("Commande ajoutée avec succès !");
        console.log("Liste des commandes mise à jour :", updatedOrderList);
      } catch (error) {
        console.error("Erreur lors de l'ajout de la commande :", error);
      }
    };
    const buildOrder = () => {
      const order = {
        menuName: menuName,
        menuId: menuId,
        price : price,
        quantity: 1,
        steps: steps.map((step) => ({
        stepName: step.name,
        stepId: step.id,
        solo: false,
        extra: false,
        selectedOptions: step.stepoptions.filter((opt) =>
          selectedOptions[step.id]?.includes(opt.id)
        ).map((opt) => ({
          optionId: opt.id,
          optionName: opt.option.name,
          optionPrice: opt.option.extra_price || 0, // Assurez-vous de gérer le prix par défaut
        })),
        })),
      };
      
        return addOrderToCart(order);
    };
      
    const goToCart = async () => {
        const order = buildOrder();
        try {
          await AsyncStorage.setItem("currentOrder", JSON.stringify(order));
          router.push("/order/cart");
        } catch (error) {
          console.error("Erreur en enregistrant la commande :", error);
        }
    };
    const isStepValid = (step) => {
        const selected = selectedOptions[step?.id] || [];
        return selected.length > 0;
    };

    const areAllStepsValid = () => {
      return steps.every((step) => {
        const selected = selectedOptions[step.id] || [];
        return selected.length > 0;
      });
    };
    
    
    return (
        <View style={{ flex: 1, padding: 16 }}>
          {/* Barre du haut avec le bouton Home */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <TouchableOpacity
              style={{
                padding: 12,
                borderRadius: 8,
                marginRight: 10,
                
              }}
              onPress={() => router.push("/tabs/terminal")}
            >
            <AntDesign name="home" size={45} color="black" />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 30, fontWeight: "bold" }}>
              Étapes
            </Text>
          </View>
    
          {currentStep ? (
            <>
              <FlatList
                data={currentStep.stepoptions}
                keyExtractor={(item) => item.id.toString()}
                numColumns={4}
                renderItem={({ item }) => {
                  const isSelected = selectedOptions[currentStep.id]?.includes(item.id);
                  const isSingleChoice = currentStep.max_options === 1; // automatique basé sur max_options
                  const maxOptions = currentStep.max_options; // récupère depuis l'étape
    
                  return (
                    <TouchableOpacity
                      style={[
                        styles.OptionItem,
                        isSelected && styles.OptionItemSelected,
                      ]}
                      onPress={() => toggleOption(currentStep.id, item.id, isSingleChoice, maxOptions)}
                    >
                      {/* Affiche la photo de l'option */}
                      {item.option.photo && (
                        <Image
                          source={{ uri: `http://127.0.0.1:8000${item.option.photo}` }} // Ajoute le début de l'URL
                          style={styles.optionImage}
                        />
                      )}
                      {/* Affiche le nom de l'option */}
                      <br></br>
                      <Text style={{fontSize:20}}>{item.option.name}</Text>
                      {/* Affiche le prix supplémentaire si disponible */}
                      {typeof parseFloat(item.option.extra_price) === "number" && item.option.extra_price > 0 && (
                        <Text style={styles.optionPrice}>+ {item.option.extra_price} DA</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
    
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
                <TouchableOpacity
                  onPress={handlePrevious}
                  disabled={currentStepIndex === 0}
                  style={{
                    padding: 12,
                    backgroundColor: currentStepIndex === 0 ? "#ccc" : "#007bff",
                    borderRadius: 8,
                    
                  }}
                >
                  <Text style={{ color: "#fff",fontSize:35 }}>Précédent</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 35, fontWeight: "bold", marginBottom: 8 }}>
                  {currentStep.name}
                </Text>
                {currentStepIndex < steps.length - 1 ? (
                  <TouchableOpacity
                    onPress={() => setCurrentStepIndex(currentStepIndex + 1)}
                    disabled={!isStepValid(currentStep)}
                    style={[
                      {
                        backgroundColor: !isStepValid(currentStep) ? "#ccc" : "#28a745",
                        borderRadius: 8,
                        
                      },
                    ]}
                  >
                    <Text style={{ padding: 20, color: "#fff", borderRadius: 8, fontSize:35 }}>Suivant</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => goToCart()}
                    disabled={!areAllStepsValid()} // Désactive le bouton si toutes les étapes ne sont pas valides
                    style={[
                      styles.goToCartButton,
                      {
                        backgroundColor: !areAllStepsValid() ? "#ccc" : "orange", // Change la couleur en fonction de la validité
                      },
                    ]}
                  >
                    <Text
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        color: !areAllStepsValid() ? "#666" : "white", // Change la couleur du texte en fonction de la validité
                      }}
                    >
                      Aller au panier
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <Text>Chargement des étapes...</Text>
          )}
        </View>
      );
    }

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: "#f4f4f4",
      },
      /* 🛒 Barre du haut */
      header: {
        height: 60,
        backgroundColor: "#093e80",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
      },
      title: {
        color: "white",
        fontSize: 30,
        fontWeight: "bold",
      },
      cartButton: {
        padding: 10,
      },
      /* 📜 Menu latéral (Gauche) */
      sidebar: {
        width: "20%",
        paddingVertical: 20,
        alignItems: "center",
      },
      categoryButton: {
        padding: 15,
        width: "80%",
        margin: 15,
        alignItems: "center",
        backgroundColor: "white",
      },
      selectedCategory: {
        backgroundColor: "#d9d5d4",
      },
      categoryText: {
        color: "black",
        fontSize: 30,
      },
      /* 🍔 Grille des menus */
      menuGrid: {
        width: "80%",
        padding: 20,
      },
      OptionItem: {
        width: "22%", // Ajuste la largeur pour 4 éléments par ligne
        height: 300, // Augmente la hauteur des blocs
        backgroundColor: "white",
        margin: 15,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        borderWidth: 2,
        borderColor: "#ccc",
      },
      OptionItemSelected: {
        borderColor: "green",
      },
      optionImage: {
        width: 160, // Augmente la largeur des images
        height: 120, // Augmente la hauteur des images
        marginBottom: 10,
        borderRadius: 8, // Ajoute des coins arrondis aux images
      },
      menuText: {
        fontSize: 40, // Augmente la taille du texte
        fontWeight: "bold",
        textAlign: "center",
        color: "#333",
      },
      optionPrice: {
        fontSize: 16, // Augmente la taille du texte pour le prix
        color: "#888",
        marginTop: 5,
      },
      goToCartButton: {
        padding: 20, borderRadius: 8, fontSize:35
      },
    });

