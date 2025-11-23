import { router, useLocalSearchParams } from "expo-router";
import { View, Text, FlatList, StyleSheet,TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import axios from "axios"; // Gardé uniquement pour d'autres fonctions si nécessaire (mais non utilisé ici)
import AsyncStorage from "@react-native-async-storage/async-storage";
import AntDesign from '@expo/vector-icons/AntDesign';
import { POS_URL } from "@/config";

// ⭐ IMPORTATION DU HOOK DE SYNCHRONISATION
import { useBorneSync } from '@/hooks/useBorneSync';

export default function MenuStepsScreen() {
    const {menuId} = useLocalSearchParams(); 
    const {menuName} = useLocalSearchParams(); 
    const {price} = useLocalSearchParams(); 
    
    const [steps, setSteps] = useState([]); // Initialisé à []
    const [selectedOptions, setSelectedOptions] = useState({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true); 
    
    // ⭐ Utilisation du hook et récupération de la fonction de cache des étapes
    const { getStepsForMenu } = useBorneSync(); 

    const currentStep = steps?.[currentStepIndex] ?? null;


    // Remplacement de la fonction locale par celle du hook (qui gère cache/API/token)
    useEffect( () => {
        const loadSteps = async () => {
            setIsLoading(true);
            try {
                // ⭐ APPEL DU HOOK : getStepsForMenu gère la logique complexe (cache, invalidation, API, token)
                const data = await getStepsForMenu(menuId);
                setSteps(data);
                console.log("Étapes récupérées via Hook:", data);
            } catch (error) {
                console.error("Erreur lors du chargement des étapes via Hook:", error);
            } finally {
                setIsLoading(false); 
            }
        };
        // Assurez-vous que menuId est défini avant de charger
        if (menuId) {
            loadSteps();
        } else {
            setIsLoading(false);
        }
    // Dépendance à getStepsForMenu garantit le rechargement si la cache est invalidée
    }, [menuId, getStepsForMenu]); 

    // --- Reste du code inchangé (handleNext, handlePrevious, toggleOption, buildOrder, etc.) ---
    
    const handleNext = () => {
        // ⭐ CORRECTION 4: Incrémenter l'index
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(currentStepIndex + 1) // Ajout de + 1
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
    
    // ... (addOrderToCart, buildOrder, goToCart, isStepValid, areAllStepsValid restent inchangés) ...
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
      // Assurez-vous que steps est un tableau avant d'appeler .map
      if (!steps || steps.length === 0) return null; 

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
          optionPrice: opt.option.extra_price || 0, 
        })),
        })),
      };
      
        return addOrderToCart(order);
    };
      
    const goToCart = async () => {
        const order = buildOrder();
        if (order) {
            try {
              // Note: buildOrder appelle déjà addOrderToCart, donc 'order' n'est pas la commande elle-même.
              // La logique ci-dessous doit être revue si vous voulez stocker l'objet 'order' ici.
              // En supposant que buildOrder a déjà mis à jour la liste dans AsyncStorage via addOrderToCart:
              router.push("/(tabs)/cart"); 
            } catch (error) {
              console.error("Erreur en enregistrant la commande :", error);
            }
        } else {
            console.warn("Impossible de construire la commande.");
        }
    };
    
    const isStepValid = (step) => {
        const selected = selectedOptions[step?.id] || [];
        // Ceci valide que l'utilisateur a sélectionné au moins une option
        return selected.length > 0;
    };

    const areAllStepsValid = () => {
      // S'assurer que steps est défini avant d'appeler .every
      return steps && steps.every((step) => {
        const selected = selectedOptions[step.id] || [];
        return selected.length > 0;
      });
    };
    
    
    // --- RENDU ---
    
    // ⭐ GESTION DU CHARGEMENT (CORRECTION 5)
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Chargement des étapes...</Text>
            </View>
        );
    }
    
    // Gérer le cas où la liste steps est vide après le chargement
    if (!currentStep || steps.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Aucune étape trouvée pour ce menu.</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/menu")} style={{marginTop: 20}}>
                    <Text style={{color: '#007bff'}}>Retour au menu</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
          {/* Barre du haut avec le bouton Home */}
          <View style={styles.header}>
            <TouchableOpacity
              style={{
                padding: 12,
                borderRadius: 8,
                marginRight: 10,
                
              }}
              onPress={() => router.push("/(tabs)/menu")}
            >
            <AntDesign name="home" size={45} color="black" />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 30, fontWeight: "bold" }}>
              Étapes
            </Text>
          </View>
    
          <>
            {/* Le reste du rendu est inclus ici car nous avons géré le cas isLoading ci-dessus */}
            <FlatList
              data={currentStep.stepoptions}
              keyExtractor={(item) => item.id.toString()}
              numColumns={4}
              renderItem={({ item }) => {
                const isSelected = selectedOptions[currentStep.id]?.includes(item.id);
                const isSingleChoice = currentStep.max_options === 1; 
                const maxOptions = currentStep.max_options; 
    
                return (
                  <TouchableOpacity
                    style={[
                      styles.OptionItem,
                      isSelected && styles.OptionItemSelected,
                    ]}
                    onPress={() => toggleOption(currentStep.id, item.id, isSingleChoice, maxOptions)}
                  >
                    {item.option.photo && (
                      <Image
                        source={{ uri: `${POS_URL}${item.option.photo}` }} 
                        style={styles.optionImage}
                      />
                    )}
                    <Text style={{fontSize:20}}>{item.option.name}</Text>
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
                <Text style={{ color: "#fff",fontSize:30, padding:20, borderRadius:8 }}>Précédent</Text>
              </TouchableOpacity>
              
              <Text style={{ fontSize: 45, fontWeight: "bold", marginBottom: 8, padding:20 }}>
                {currentStep.name}
              </Text>

              {currentStepIndex < steps.length - 1 ? (
                <TouchableOpacity
                  onPress={handleNext} // Utilisation de la fonction handleNext
                  disabled={!isStepValid(currentStep)}
                  style={[
                    {
                      padding:12,
                      backgroundColor: !isStepValid(currentStep) ? "#ccc" : "#28a745",
                      borderRadius: 8,
                      
                    },
                  ]}
                >
                  <Text style={{ padding: 20, color: "#fff", borderRadius: 8, fontSize:30 }}>Suivant</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={goToCart}
                  disabled={!areAllStepsValid()} 
                  style={[
                    styles.goToCartButton,
                    {
                      backgroundColor: !areAllStepsValid() ? "#ccc" : "green", 
                    },
                  ]}
                >
                  <Text
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      color: !areAllStepsValid() ? "#666" : "white", 
                      fontSize: 30, // Assurez-vous que le style goToCartButtonText est inclus ou défini
                    }}
                  >
                    Aller au panier
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        </View>
      );
    }

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        padding: 16,
        backgroundColor: "white",
      },
      // ⭐ NOUVEAU STYLE POUR CENTRER LE CHARGEMENT
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: "white", // Correspond au fond du container
      },
      loadingText: {
        marginTop: 10,
        fontSize: 20,
        color: '#333',
      },
      // ... (Autres styles restent inchangés)
      header: {
        height: 60,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
      },
      OptionItem: {
        width: "22%", 
        height: 300, 
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
        width: 160, 
        height: 120, 
        marginBottom: 10,
        borderRadius: 8, 
      },
      optionPrice: {
        fontSize: 16, 
        color: "#888",
        marginTop: 5,
      },
      goToCartButton: {
        padding: 20, borderRadius: 8, fontSize:35
      },
    });