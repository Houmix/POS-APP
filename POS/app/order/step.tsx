import { router, useLocalSearchParams } from "expo-router";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, Dimensions } from "react-native";
import { useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { POS_URL } from "@/config";
import { useBorneSync } from '@/hooks/useBorneSync';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: "#FF6B00",
  success: "#28a745",
  bg: "#F8F9FA",
  text: "#1A1A1A",
  muted: "#666"
};

export default function MenuStepsScreen() {
    const { menuId, menuName, price } = useLocalSearchParams(); 
    const [steps, setSteps] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true); 
    const { getStepsForMenu } = useBorneSync(); 

    const currentStep = steps?.[currentStepIndex] ?? null;

    useEffect(() => {
        const loadSteps = async () => {
            setIsLoading(true);
            try {
                const data = await getStepsForMenu(menuId);
                setSteps(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false); 
            }
        };
        if (menuId) loadSteps();
    }, [menuId, getStepsForMenu]);

    // Calcul du prix total en temps réel (Base + Extras)
    const totalPrice = useMemo(() => {
        let extras = 0;
        steps.forEach(step => {
            const selectedIds = selectedOptions[step.id] || [];
            step.stepoptions.forEach(opt => {
                if (selectedIds.includes(opt.id)) {
                    extras += parseFloat(opt.option.extra_price || 0);
                }
            });
        });
        return parseFloat(price) + extras;
    }, [selectedOptions, steps, price]);

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) setCurrentStepIndex(currentStepIndex + 1);
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
    };

    const toggleOption = (stepId, optionId, isSingle, maxOptions) => {
        setSelectedOptions((prev) => {
          const current = prev[stepId] || [];
          if (isSingle) return { ...prev, [stepId]: [optionId] };
          if (current.includes(optionId)) return { ...prev, [stepId]: current.filter(id => id !== optionId) };
          if (maxOptions && current.length >= maxOptions) return prev;
          return { ...prev, [stepId]: [...current, optionId] };
        });
    };

    const addOrderToCart = async (newOrder) => {
        const existing = await AsyncStorage.getItem("orderList");
        const list = existing ? JSON.parse(existing) : [];
        await AsyncStorage.setItem("orderList", JSON.stringify([...list, newOrder]));
    };

    const goToCart = async () => {
      const order = {
          menuName,
          menuId,
          price: totalPrice,
          quantity: 1,
          // On s'assure que la structure correspond au backend
          steps: steps.map(step => ({
              stepId: step.id, // Ajout de l'ID de l'étape
              stepName: step.name,
              selectedOptions: step.stepoptions
                  .filter(opt => selectedOptions[step.id]?.includes(opt.id))
                  .map(opt => ({ 
                      optionId: opt.id, // On garde optionId pour le front (affichage)
                      option: opt.id,   // On AJOUTE 'option' pour le backend (Django)
                      optionName: opt.option.name, 
                      optionPrice: opt.option.extra_price 
                  }))
          }))
      };
      await addOrderToCart(order);
      router.push("/order/cart");
  };

    if (isLoading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Préparation des options...</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header avec progression */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push("/tabs/terminal")} style={styles.homeButton}>
                    <AntDesign name="arrowleft" size={28} color="black" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.menuTitle}>{menuName}</Text>
                    <Text style={styles.stepIndicator}>Étape {currentStepIndex + 1} sur {steps.length}</Text>
                </View>
                <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>{totalPrice} DA</Text>
                </View>
            </View>

            {/* Barre de progression visuelle */}
            <View style={styles.progressContainer}>
                {steps.map((_, i) => (
                    <View key={i} style={[styles.progressBar, i <= currentStepIndex ? styles.progressActive : styles.progressInactive]} />
                ))}
            </View>

            <View style={styles.stepTitleContainer}>
                <Text style={styles.stepTitle}>{currentStep.name}</Text>
                <Text style={styles.stepSubtitle}>
                    {currentStep.max_options === 1 ? "Choisissez 1 option" : `Choisissez jusqu'à ${currentStep.max_options} options`}
                </Text>
            </View>

            <FlatList
                data={currentStep.stepoptions}
                keyExtractor={(item) => item.id.toString()}
                numColumns={3}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                    const isSelected = selectedOptions[currentStep.id]?.includes(item.id);
                    return (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                            onPress={() => toggleOption(currentStep.id, item.id, currentStep.max_options === 1, currentStep.max_options)}
                        >
                            {isSelected && (
                                <View style={styles.checkBadge}>
                                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                                </View>
                            )}
                            <Image
                                source={{ uri: `${POS_URL}${item.option.photo}` }} 
                                style={styles.optionImage}
                                resizeMode="contain"
                            />
                            <Text style={styles.optionName}>{item.option.name}</Text>
                            {item.option.extra_price > 0 && (
                                <Text style={styles.optionExtra}>+{item.option.extra_price} DA</Text>
                            )}
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Barre de navigation basse */}
            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={handlePrevious} 
                    style={[styles.navButton, styles.backButton, currentStepIndex === 0 && { opacity: 0 }]}
                    disabled={currentStepIndex === 0}
                >
                    <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>

                {currentStepIndex < steps.length - 1 ? (
                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={(selectedOptions[currentStep.id]?.length || 0) === 0}
                        style={[styles.navButton, styles.nextButton, (selectedOptions[currentStep.id]?.length || 0) === 0 && styles.disabledButton]}
                    >
                        <Text style={styles.nextButtonText}>Suivant</Text>
                        <AntDesign name="arrowright" size={20} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={goToCart}
                        disabled={(selectedOptions[currentStep.id]?.length || 0) === 0}
                        style={[styles.navButton, styles.confirmButton, (selectedOptions[currentStep.id]?.length || 0) === 0 && styles.disabledButton]}
                    >
                        <Text style={styles.nextButtonText}>Terminer la commande</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontSize: 18, color: COLORS.muted },
    
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white' },
    homeButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
    headerInfo: { flex: 1, marginLeft: 15 },
    menuTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    stepIndicator: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
    priceBadge: { backgroundColor: '#FFF0E6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    priceText: { color: COLORS.primary, fontWeight: '800', fontSize: 18 },

    progressContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
    progressBar: { flex: 1, height: 6, borderRadius: 3 },
    progressActive: { backgroundColor: COLORS.primary },
    progressInactive: { backgroundColor: '#E2E8F0' },

    stepTitleContainer: { paddingHorizontal: 20, marginVertical: 15 },
    stepTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text },
    stepSubtitle: { fontSize: 16, color: COLORS.muted, marginTop: 4 },

    listContent: { padding: 12 },
    optionCard: {
        backgroundColor: 'white',
        width: (width - 60) / 3,
        margin: 8,
        borderRadius: 20,
        padding: 15,
        alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
        borderWidth: 2, borderColor: 'transparent'
    },
    optionCardSelected: { borderColor: COLORS.primary, backgroundColor: '#FFF9F5' },
    checkBadge: { position: 'absolute', top: 10, right: 10, zIndex: 1 },
    optionImage: { width: '80%', height: 100, marginBottom: 10 },
    optionName: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: COLORS.text },
    optionExtra: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 5 },

    footer: {
        flexDirection: 'row', 
        padding: 25, 
        backgroundColor: 'white', 
        borderTopWidth: 1, 
        borderTopColor: '#E2E8F0',
        gap: 15
    },
    navButton: { height: 70, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 },
    backButton: { flex: 1, backgroundColor: '#F1F5F9' },
    nextButton: { flex: 2, backgroundColor: COLORS.primary },
    confirmButton: { flex: 2, backgroundColor: COLORS.success },
    disabledButton: { backgroundColor: '#CBD5E1' },
    backButtonText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    nextButtonText: { fontSize: 20, fontWeight: '700', color: 'white' }
});