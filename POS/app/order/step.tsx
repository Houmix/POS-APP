import { router, useLocalSearchParams } from "expo-router";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, Dimensions } from "react-native";
import { useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { getPosUrl } from "@/utils/serverConfig";
import { useBorneSync } from '@/hooks/useBorneSync';
import { useLanguage } from '@/contexts/LanguageContext';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: "#ff69b4",
  success: "#28a745",
  bg: "#F8F9FA",
  text: "#1A1A1A",
  muted: "#666"
};

export default function MenuStepsScreen() {
    // 1. OBLIGATOIRE : Récupérer isSolo pour déclencher la logique
    const { menuId, menuName, price, isSolo } = useLocalSearchParams(); 
    const isMenuSolo = isSolo === 'true' || isSolo === true;

    const [steps, setSteps] = useState<any[]>([]);
    const [selectedOptions, setSelectedOptions] = useState<any>({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true); 
    const { getStepsForMenu } = useBorneSync(); 
    const { t, isRTL } = useLanguage();

    const currentStep = steps?.[currentStepIndex] ?? null;

    useEffect(() => {
        const loadSteps = async () => {
            setIsLoading(true);
            try {
                const data = await getStepsForMenu(menuId);
                
                // 2. FILTRER : On enlève la boisson et les frites si c'est solo
                let finalSteps = data;
                if (isMenuSolo) {
                    finalSteps = data.filter((step: any) => {
                        const stepName = step.name.toLowerCase();
                        return stepName !== 'boisson' && stepName !== 'accompagnement';
                    });
                }
                setSteps(finalSteps);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false); 
            }
        };
        if (menuId) loadSteps();
    }, [menuId, getStepsForMenu, isMenuSolo]);

    // Calcul du prix total en temps réel (Base + Extras)
    const totalPrice = useMemo(() => {
        let extras = 0;
        steps.forEach(step => {
            const selectedIds = selectedOptions[step.id] || [];
            step.stepoptions.forEach((opt: any) => {
                if (selectedIds.includes(opt.id)) {
                    extras += parseFloat(opt.option.extra_price || 0);
                }
            });
        });
        return parseFloat(price as string) + extras;
    }, [selectedOptions, steps, price]);

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) setCurrentStepIndex(currentStepIndex + 1);
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
    };

    const toggleOption = (stepId: number, optionId: number, isSingle: boolean, maxOptions: number) => {
        setSelectedOptions((prev: any) => {
          const current = prev[stepId] || [];
          if (isSingle) return { ...prev, [stepId]: [optionId] };
          if (current.includes(optionId)) return { ...prev, [stepId]: current.filter((id: number) => id !== optionId) };
          if (maxOptions && current.length >= maxOptions) return prev;
          return { ...prev, [stepId]: [...current, optionId] };
        });
    };

    const addOrderToCart = async (newOrder: any) => {
        const existing = await AsyncStorage.getItem("orderList");
        const list = existing ? JSON.parse(existing) : [];

        // Fonction pour comparer deux configurations d'options
        const areOptionsEqual = (steps1: any[], steps2: any[]) => {
            if (!steps1 && !steps2) return true;
            if (!steps1 || !steps2) return false;
            if (steps1.length !== steps2.length) return false;

            for (const step1 of steps1) {
                const step2 = steps2.find(s => s.stepId === step1.stepId);
                if (!step2) return false;

                // On trie les IDs d'options pour comparer correctement même si l'ordre de clic diffère
                const opts1 = step1.selectedOptions.map((o: any) => o.optionId).sort();
                const opts2 = step2.selectedOptions.map((o: any) => o.optionId).sort();

                if (opts1.length !== opts2.length) return false;
                if (!opts1.every((val: any, idx: number) => val === opts2[idx])) return false;
            }
            return true;
        };

        // On cherche un produit 100% identique dans le panier
        const existingIndex = list.findIndex((item: any) => 
            item.menuId === newOrder.menuId &&
            item.solo === newOrder.solo &&
            item.extra === newOrder.extra &&
            areOptionsEqual(item.steps, newOrder.steps)
        );

        if (existingIndex >= 0) {
            // S'il existe déjà, on augmente juste sa quantité
            list[existingIndex].quantity += newOrder.quantity;
        } else {
            // Sinon, on l'ajoute comme nouvelle ligne
            list.push(newOrder);
        }

        await AsyncStorage.setItem("orderList", JSON.stringify(list));
    };

    const goToCart = async () => {
      const order = {
          menuName: isMenuSolo ? `${menuName} (Solo)` : menuName,
          menuId,
          price: parseFloat(price as string),
          quantity: 1,
          solo: isMenuSolo, // 3. CRUCIAL : Indique au backend que c'est un solo
          extra: false,
          steps: steps.map(step => ({
              stepId: step.id,
              stepName: step.name,
              selectedOptions: step.stepoptions
                  .filter((opt: any) => selectedOptions[step.id]?.includes(opt.id))
                  .map((opt: any) => ({ 
                      optionId: opt.id,
                      option: opt.id,
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
            <Text style={styles.loadingText}>{t('step.preparation')}</Text>
        </View>
    );

    if (!currentStep) return null;

    const getStepSubtitle = () => {
        if (currentStep.max_options === 1) return t('step.choose_one');
        return `${t('step.choose_up_to')} ${currentStep.max_options} ${t('step.options')}`;
    };

    return (
        <SafeAreaView style={[styles.container, isRTL && { direction: 'rtl' }]}>
            {/* Header avec progression */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push("/tabs/terminal")} style={styles.homeButton}>
                    <AntDesign name={isRTL ? "arrowright" : "arrowleft"} size={28} color="black" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.menuTitle}>{isMenuSolo ? `${menuName} (Solo)` : menuName}</Text>
                    <Text style={styles.stepIndicator}>
                        {t('step.title')} {currentStepIndex + 1} {t('step.of')} {steps.length}
                    </Text>
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
                <Text style={styles.stepSubtitle}>{getStepSubtitle()}</Text>
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
                            <Image source={{ uri: `${getPosUrl()}${item.option.photo}` }} style={styles.optionImage} resizeMode="contain" />
                            <Text style={styles.optionName}>{item.option.name}</Text>
                            {item.option.extra_price > 0 && <Text style={styles.optionExtra}>+{item.option.extra_price} DA</Text>}
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Barre de navigation basse */}
            <View style={[styles.footer, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity onPress={handlePrevious} style={[styles.navButton, styles.backButton, currentStepIndex === 0 && { opacity: 0 }]} disabled={currentStepIndex === 0}>
                    <Text style={styles.backButtonText}>{t('back')}</Text>
                </TouchableOpacity>

                {currentStepIndex < steps.length - 1 ? (
                    <TouchableOpacity onPress={handleNext} disabled={(selectedOptions[currentStep.id]?.length || 0) === 0} style={[styles.navButton, styles.nextButton, (selectedOptions[currentStep.id]?.length || 0) === 0 && styles.disabledButton]}>
                        <Text style={styles.nextButtonText}>{t('next')}</Text>
                        <AntDesign name={isRTL ? "arrowleft" : "arrowright"} size={20} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={goToCart} disabled={(selectedOptions[currentStep.id]?.length || 0) === 0} style={[styles.navButton, styles.confirmButton, (selectedOptions[currentStep.id]?.length || 0) === 0 && styles.disabledButton]}>
                        <Text style={styles.nextButtonText}>{t('step.finish_order')}</Text>
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
    optionCard: { backgroundColor: 'white', width: (width - 60) / 3, margin: 8, borderRadius: 20, padding: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 2, borderColor: 'transparent' },
    optionCardSelected: { borderColor: COLORS.primary, backgroundColor: '#FFF9F5' },
    checkBadge: { position: 'absolute', top: 10, right: 10, zIndex: 1 },
    optionImage: { width: '80%', height: 100, marginBottom: 10 },
    optionName: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: COLORS.text },
    optionExtra: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 5 },
    footer: { flexDirection: 'row', padding: 25, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 15 },
    navButton: { height: 70, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 },
    backButton: { flex: 1, backgroundColor: '#F1F5F9' },
    nextButton: { flex: 2, backgroundColor: COLORS.primary },
    confirmButton: { flex: 2, backgroundColor: COLORS.success },
    disabledButton: { backgroundColor: '#CBD5E1' },
    backButtonText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    nextButtonText: { fontSize: 20, fontWeight: '700', color: 'white' }
});