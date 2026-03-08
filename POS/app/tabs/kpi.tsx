import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  RefreshControl, SafeAreaView, Dimensions, TouchableOpacity, Platform, Modal, Button 
} from 'react-native';
import { 
  TrendingUp, ShoppingBag, CreditCard, 
  Package, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock as ClockIcon, 
  X as XIcon, Filter, Check, RefreshCw 
} from 'lucide-react-native';
import axios from 'axios';
import { getPosUrl, getRestaurantId } from '@/utils/serverConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- IMPORTS WEB ---
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"; 
import { fr } from 'date-fns/locale';
import { setHours, setMinutes } from 'date-fns';

registerLocale('fr', fr);

const { width } = Dimensions.get('window');

const COLORS = {
  primary: "#6366F1", 
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  textHeader: "#1E293B",
  textSub: "#64748B",
  border: "#E2E8F0",
  overlay: "rgba(0,0,0,0.5)"
};

// --- CONFIG FILTRES TYPES ---
const TYPE_FILTERS = [
    { id: 'paid', label: 'Payée', color: COLORS.success, icon: CheckCircle2 },
    { id: 'unpaid', label: 'Non Payée', color: COLORS.warning, icon: ClockIcon },
    { id: 'cancelled', label: 'Annulée', color: COLORS.danger, icon: XCircle },
    { id: 'refunded', label: 'Remboursée', color: COLORS.info, icon: Filter }
];

// --- CSS DATEPICKER WEB (Inchangé) ---
const MODERN_DATEPICKER_CSS = `
  .react-datepicker {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    border: 1px solid ${COLORS.border} !important;
    border-radius: 16px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .react-datepicker__header { background-color: white !important; border-bottom: 1px solid ${COLORS.border} !important; padding-top: 15px !important; }
  .react-datepicker__current-month { color: ${COLORS.textHeader} !important; font-weight: 800 !important; font-size: 1rem !important; margin-bottom: 10px; }
  .react-datepicker__day-name { color: ${COLORS.textSub} !important; font-weight: 600 !important; width: 2.5rem !important; }
  .react-datepicker__day { width: 2.5rem !important; line-height: 2.5rem !important; margin: 0.1rem !important; border-radius: 50% !important; font-weight: 500; transition: all 0.2s ease; }
  .react-datepicker__day:hover { background-color: ${COLORS.bg} !important; border-radius: 50% !important; }
  .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected { background-color: ${COLORS.primary} !important; color: white !important; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4); }
  .react-datepicker__day--today { color: ${COLORS.primary}; font-weight: 800; position: relative; }
  .react-datepicker__day--today::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background-color: ${COLORS.primary}; border-radius: 50%; }
  .react-datepicker__day--selected.react-datepicker__day--today::after { background-color: white; }
  .react-datepicker__time-container { border-left: 1px solid ${COLORS.border} !important; width: 100px !important; }
  .react-datepicker__header--time { background-color: white !important; border-bottom: 1px solid ${COLORS.border} !important; }
  .react-datepicker__time-list-item { height: auto !important; padding: 10px !important; font-weight: 500; }
  .react-datepicker__time-list-item:hover { background-color: ${COLORS.bg} !important; }
  .react-datepicker__time-list-item--selected { background-color: ${COLORS.primary} !important; color: white !important; font-weight: 700 !important; }
  .react-datepicker__navigation-icon::before { border-color: ${COLORS.textSub} !important; border-width: 2px 2px 0 0 !important; }
`;

// --- FONCTION UTILITAIRE POUR LES DATES ---
const toLocalIsoString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000; 
  const localTime = new Date(date.getTime() - tzOffset); 
  return localTime.toISOString().slice(0, -1); 
};

// --- DECLENCHEURS PERSONNALISÉS ---
const CustomDateTrigger = React.forwardRef(({ value, onClick, dateDisplay }: any, ref: any) => (
    <TouchableOpacity style={styles.inputTrigger} onPress={onClick} ref={ref} activeOpacity={0.7}>
        <CalendarIcon size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={styles.triggerText}>{dateDisplay}</Text>
    </TouchableOpacity>
));

const CustomTimeTrigger = React.forwardRef(({ value, onClick, timeDisplay }: any, ref: any) => (
    <TouchableOpacity style={styles.inputTrigger} onPress={onClick} ref={ref} activeOpacity={0.7}>
        <ClockIcon size={18} color={COLORS.warning} style={{ marginRight: 8 }} />
        <Text style={styles.triggerText}>{timeDisplay}</Text>
    </TouchableOpacity>
));

export default function KPI() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- ETATS FILTRES DISSOCIÉS ---
    const [useDateFilter, setUseDateFilter] = useState(false);
    const [useTimeFilter, setUseTimeFilter] = useState(false);
    
    // --- NOUVEAU : ETATS TYPES & MODALE ---
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['paid']); // Par défaut: Payée
    const [showTypeModal, setShowTypeModal] = useState(false);

    // Dates & Heures
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [startTime, setStartTime] = useState(() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; });
    const [endTime, setEndTime] = useState(() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; });

    // Mobile Picker States
    const [showPicker, setShowPicker] = useState<{show: boolean, mode: 'date'|'time', type: 'start'|'end'}>({ show: false, mode: 'date', type: 'start' });
    const [tempDate, setTempDate] = useState(new Date());

    // --- FORMATAGE ---
    const formatDateDisplay = (date: any) => {
        if (!date) return "";
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTimeDisplay = (date: any) => {
        if (!date) return "";
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    };

    // --- HELPER LABEL TYPES (Version Courte pour le bouton) ---
    const getTypeLabel = () => {
        if (selectedTypes.length === 0) return "Aucun";
        if (selectedTypes.length === 4) return "Tous";
        if (selectedTypes.length === 1) {
            const found = TYPE_FILTERS.find(t => t.id === selectedTypes[0]);
            return found?.label; // Ex: "Payée" tout court
        }
        return `Types (${selectedTypes.length})`;
    };

    // --- HELPER : Est-ce que le filtre type est personnalisé (différent du défaut) ?
    const isTypeCustom = selectedTypes.length !== 1 || selectedTypes[0] !== 'paid';

    // --- FETCH DATA ---
    const fetchKpis = async () => {
        try {
            const token = await AsyncStorage.getItem("token");
            let url = `${getPosUrl()}/order/api/kpi/${getRestaurantId()}?`;
            
            if (useDateFilter) {
                const dStart = new Date(startDate); dStart.setHours(0, 0, 0, 0);
                const dEnd = new Date(endDate); dEnd.setHours(23, 59, 59, 999);
                url += `start_date=${encodeURIComponent(toLocalIsoString(dStart))}&end_date=${encodeURIComponent(toLocalIsoString(dEnd))}&`;
            }

            if (useTimeFilter) {
                const hStart = startTime.getHours().toString().padStart(2, '0');
                const mStart = startTime.getMinutes().toString().padStart(2, '0');
                const hEnd = endTime.getHours().toString().padStart(2, '0');
                const mEnd = endTime.getMinutes().toString().padStart(2, '0');
                url += `start_time=${hStart}:${mStart}&end_time=${hEnd}:${mEnd}&`;
            }

            if (selectedTypes.length > 0) {
            url += `types=${selectedTypes.join(',')}`;
            } else {
                // Si aucun type sélectionné, on décide d'un défaut ou on envoie 'paid'
                url += `types=paid`; 
            }

            console.log("Fetching KPI URL:", url);

            const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            setData(response.data);
        } catch (error) {
            console.error("Erreur KPI:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { 
        setLoading(true);
        fetchKpis(); 
    }, [startDate, endDate, startTime, endTime, useDateFilter, useTimeFilter, selectedTypes]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchKpis();
    };

    const handleDateUpdate = (date: Date, type: 'start' | 'end') => {
        if (type === 'start') {
            setStartDate(date);
            if (date > endDate) setEndDate(date);
        } else {
            setEndDate(date);
        }
    };

    const handleTimeUpdate = (time: Date, type: 'start' | 'end') => {
        if (type === 'start') setStartTime(time);
        else setEndTime(time);
    };

    const toggleType = (id: string) => {
        setSelectedTypes(prev => {
            if (prev.includes(id)) {
                return prev.filter(t => t !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    // --- UI HELPERS (DateInput/TimeInput) ---
    const DateInput = ({ date, type, minDate }: any) => {
        if (Platform.OS === 'web') {
            return (
                <View style={{ flex: 1, zIndex: 2000 }}>
                     <style>{MODERN_DATEPICKER_CSS}</style>
                     <style>{`.react-datepicker-popper { z-index: 9999 !important; } .react-datepicker-wrapper { width: 100%; }`}</style>
                    <DatePicker
                        selected={date}
                        onChange={(d: Date) => handleDateUpdate(d, type)}
                        minDate={minDate}
                        locale="fr"
                        dateFormat="dd/MM/yyyy"
                        customInput={<CustomDateTrigger dateDisplay={formatDateDisplay(date)} />}
                        popperPlacement="bottom-start"
                        portalId="root-portal"
                    />
                </View>
            );
        }
        return (
            <TouchableOpacity style={styles.inputTrigger} onPress={() => openMobilePicker('date', type)}>
                <CalendarIcon size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.triggerText}>{formatDateDisplay(date)}</Text>
            </TouchableOpacity>
        );
    };

    const TimeInput = ({ time, type }: any) => {
        const injectedTimes = type === 'end' ? [setHours(setMinutes(new Date(), 59), 23)] : [];
        if (Platform.OS === 'web') {
            return (
                <View style={{ flex: 1, zIndex: 2000 }}>
                     <style>{MODERN_DATEPICKER_CSS}</style>
                     <style>{`.react-datepicker-popper { z-index: 9999 !important; } .react-datepicker-wrapper { width: 100%; }`}</style>
                    <DatePicker
                        selected={time}
                        onChange={(d: Date) => handleTimeUpdate(d, type)}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption={type === 'start' ? "Début" : "Fin"}
                        dateFormat="HH:mm"
                        locale="fr"
                        injectTimes={injectedTimes} 
                        customInput={<CustomTimeTrigger timeDisplay={formatTimeDisplay(time)} />}
                        popperPlacement="bottom-start"
                        portalId="root-portal"
                    />
                </View>
            );
        }
        return (
            <TouchableOpacity style={styles.inputTrigger} onPress={() => openMobilePicker('time', type)}>
                <ClockIcon size={18} color={COLORS.warning} style={{ marginRight: 8 }} />
                <Text style={styles.triggerText}>{formatTimeDisplay(time)}</Text>
            </TouchableOpacity>
        );
    };

    const openMobilePicker = (mode: 'date'|'time', type: 'start'|'end') => {
        const base = mode === 'date' ? (type === 'start' ? startDate : endDate) : (type === 'start' ? startTime : endTime);
        setTempDate(base);
        setShowPicker({ show: true, mode, type });
    };

    const onMobileChange = (event: any, selected?: Date) => {
        if (Platform.OS === 'android') setShowPicker({ ...showPicker, show: false });
        if (selected) {
            if (Platform.OS === 'android') {
                 if (showPicker.mode === 'date') handleDateUpdate(selected, showPicker.type);
                 else handleTimeUpdate(selected, showPicker.type);
            } else {
                setTempDate(selected);
            }
        }
    };
    
    const closeIosPicker = () => {
        if (showPicker.mode === 'date') handleDateUpdate(tempDate, showPicker.type);
        else handleTimeUpdate(tempDate, showPicker.type);
        setShowPicker({ ...showPicker, show: false });
    };

    if (loading && !data) {
        return (<View style={styles.loaderContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>);
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                
                {/* HEADER & TOGGLES */}
                <View style={styles.headerSection}>
                    
                    {/* NOUVEAU : Ligne du haut avec Titre + Bouton Refresh */}
                    <View style={styles.headerTopRow}>
                        <View>
                            <Text style={styles.headerSubtitle}>Statistiques</Text>
                            <Text style={styles.headerTitle}>Tableau de Bord</Text>
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.refreshBtn} 
                            onPress={onRefresh}
                            activeOpacity={0.7}
                            disabled={refreshing || loading}
                        >
                            <RefreshCw 
                                size={20} 
                                color={COLORS.textHeader} 
                                style={{ opacity: (refreshing || loading) ? 0.3 : 1 }} 
                            />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.togglesContainer}>
                        {/* 1. Dates Button */}
                        <TouchableOpacity style={[styles.toggleBtn, useDateFilter && styles.toggleBtnActive]} onPress={() => setUseDateFilter(!useDateFilter)}>
                            <CalendarIcon size={16} color={useDateFilter ? "white" : COLORS.textSub} />
                            <Text style={[styles.toggleText, useDateFilter && styles.toggleTextActive]}>Dates</Text>
                        </TouchableOpacity>

                        {/* 2. Heures Button */}
                        <TouchableOpacity style={[styles.toggleBtn, useTimeFilter && styles.toggleBtnActive]} onPress={() => setUseTimeFilter(!useTimeFilter)}>
                            <ClockIcon size={16} color={useTimeFilter ? "white" : COLORS.textSub} />
                            <Text style={[styles.toggleText, useTimeFilter && styles.toggleTextActive]}>Heures</Text>
                        </TouchableOpacity>

                        {/* 3. Type Button */}
                        <TouchableOpacity 
                            style={[styles.toggleBtn, isTypeCustom && styles.toggleBtnActive]} 
                            onPress={() => setShowTypeModal(true)}
                        >
                            <Filter size={16} color={isTypeCustom ? "white" : COLORS.textSub} />
                            <Text style={[styles.toggleText, isTypeCustom && styles.toggleTextActive]}>
                                {getTypeLabel()}
                            </Text>
                        </TouchableOpacity>

                        {/* 4. Clear Button */}
                        {(useDateFilter || useTimeFilter || isTypeCustom) && (
                            <TouchableOpacity onPress={() => { setUseDateFilter(false); setUseTimeFilter(false); setSelectedTypes(['paid']); }} style={styles.clearBtn}>
                                <XIcon size={16} color={COLORS.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* --- ZONE DE FILTRES DATE/HEURE (CONDITIONNELLE) --- */}
                {(useDateFilter || useTimeFilter) && (
                    <View style={styles.filterCard}>
                        {useDateFilter && (
                            <View style={styles.filterRow}>
                                <Text style={styles.filterLabel}>Période :</Text>
                                <View style={styles.inputsRow}>
                                    <DateInput date={startDate} type="start" />
                                    <Text style={styles.arrow}>→</Text>
                                    <DateInput date={endDate} type="end" minDate={startDate} />
                                </View>
                            </View>
                        )}
                        {useDateFilter && useTimeFilter && <View style={styles.divider} />}
                        {useTimeFilter && (
                            <View style={styles.filterRow}>
                                <Text style={styles.filterLabel}>Créneau :</Text>
                                <View style={styles.inputsRow}>
                                    <TimeInput time={startTime} type="start" />
                                    <Text style={styles.arrow}>→</Text>
                                    <TimeInput time={endTime} type="end" />
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* INFO TEXT */}
                <Text style={styles.rangeInfo}>
                    {!useDateFilter && !useTimeFilter ? "Données globales" : 
                     (() => {
                         const defaultStart = new Date(); defaultStart.setHours(0,0,0,0);
                         const defaultEnd = new Date(); defaultEnd.setHours(23,59,59,999);
                         return (
                            `Du ${formatDateDisplay(useDateFilter ? startDate : new Date())} à ${formatTimeDisplay(useTimeFilter ? startTime : defaultStart)}` + 
                            ` au ${formatDateDisplay(useDateFilter ? endDate : new Date())} à ${formatTimeDisplay(useTimeFilter ? endTime : defaultEnd)}`
                         );
                     })()
                    }
                </Text>

                {/* MAIN KPI */}
                <View style={styles.mainCard}>
                    <View style={styles.mainCardContent}>
                        <View>
                            <Text style={styles.mainCardLabel}>
                                {selectedTypes.includes('cancelled') && selectedTypes.length === 1 
                                ? "Montant Annulé (Perte)" 
                                : selectedTypes.includes('refunded') && selectedTypes.length === 1
                                ? "Montant Remboursé"
                                : selectedTypes.includes('unpaid') && selectedTypes.length === 1
                                ? "Montant Non payée"
                                : !selectedTypes.includes('paid') && selectedTypes.length > 1
                                ? "Montant perdu"
                                : "Chiffre d'Affaires"}
                            </Text>
                            <Text style={styles.mainCardValue}>{(data?.total_revenue || 0).toLocaleString('fr-FR')} <Text style={styles.currency}>DA</Text></Text>
                        </View>
                        <View style={styles.iconCircle}><TrendingUp color="white" size={28} /></View>
                    </View>
                </View>

                {/* GRID KPI */}
                <View style={styles.grid}>
                    <KpiCard label="Commandes" value={data?.total_orders || 0} icon={<ShoppingBag size={20} color={COLORS.info} />} color={COLORS.info} />
                    <KpiCard label="Panier Moyen" value={`${(data?.average_cart || 0).toFixed(0)} DA`} icon={<CreditCard size={20} color={COLORS.warning} />} color={COLORS.warning} />
                    <KpiCard label="À Emporter" value={data?.take_away_count || 0} icon={<Package size={20} color={COLORS.primary} />} color={COLORS.primary} />
                    <KpiCard label="Taux Succès" value={(data?.total_orders || 0) > 0 ? `${(((data?.completed_orders || 0) / (data?.total_orders || 1)) * 100).toFixed(0)}%` : "0%"} icon={<CheckCircle2 size={20} color={COLORS.success} />} color={COLORS.success} />
                </View>

            </ScrollView>

            {/* --- MODALE DE SÉLECTION DE TYPES --- */}
            <Modal
                transparent={true}
                visible={showTypeModal}
                animationType="fade"
                onRequestClose={() => setShowTypeModal(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowTypeModal(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filtrer par type</Text>
                            <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                                <XIcon size={24} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.modalBody}>
                            {TYPE_FILTERS.map((type) => {
                                const isSelected = selectedTypes.includes(type.id);
                                const Icon = type.icon;
                                return (
                                    <TouchableOpacity 
                                        key={type.id} 
                                        style={[styles.typeRow, isSelected && styles.typeRowSelected]}
                                        onPress={() => toggleType(type.id)}
                                    >
                                        <View style={styles.typeRowLeft}>
                                            <View style={[styles.iconBox, {backgroundColor: type.color + '20'}]}>
                                                <Icon size={18} color={type.color} />
                                            </View>
                                            <Text style={styles.typeRowText}>{type.label}</Text>
                                        </View>
                                        <View style={[styles.checkbox, isSelected && {backgroundColor: COLORS.primary, borderColor: COLORS.primary}]}>
                                            {isSelected && <Check size={14} color="white" />}
                                        </View>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>

                        <TouchableOpacity style={styles.modalBtn} onPress={() => setShowTypeModal(false)}>
                            <Text style={styles.modalBtnText}>Valider</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* MODAL PICKER MOBILE */}
            {Platform.OS !== 'web' && showPicker.show && (
                Platform.OS === 'android' ? (
                    <DateTimePicker 
                        value={tempDate} 
                        mode={showPicker.mode} 
                        display="default" 
                        onChange={onMobileChange} 
                        minimumDate={showPicker.mode === 'date' && showPicker.type === 'end' ? startDate : undefined}
                    /> 
                ) : (
                    <Modal transparent animationType="slide" visible={showPicker.show}>
                        <View style={styles.iosPickerOverlay}>
                            <View style={styles.iosPickerContent}>
                                <DateTimePicker 
                                    value={tempDate} 
                                    mode={showPicker.mode} 
                                    display="spinner" 
                                    onChange={onMobileChange} 
                                    locale="fr-FR"
                                />
                                <Button title="Valider" onPress={closeIosPicker} />
                            </View>
                        </View>
                    </Modal>
                )
            )}
        </SafeAreaView>
    );
}

const KpiCard = ({ label, value, icon, color }: any) => (
    <View style={styles.smallCard}>
        <View style={[styles.smallIconBg, { backgroundColor: color + '15' }]}>{icon}</View>
        <Text style={styles.smallLabel}>{label}</Text>
        <Text style={styles.smallValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },
    container: { flex: 1, padding: 20 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
    
    headerSection: { marginBottom: 15 },
    
    // --- STYLES MODIFIÉS POUR LE HEADER ---
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    refreshBtn: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5,
    },
    headerSubtitle: { color: COLORS.textSub, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    headerTitle: { color: COLORS.textHeader, fontSize: 28, fontWeight: '800', marginBottom: 5 }, // Marge réduite

    // --- TOGGLES CONTAINER (Boutons alignés) ---
    togglesContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    toggleBtn: { 
        flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, 
        borderRadius: 25, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'white' 
    },
    toggleBtnActive: { backgroundColor: COLORS.textHeader, borderColor: COLORS.textHeader },
    toggleText: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: COLORS.textSub },
    toggleTextActive: { color: 'white' },
    clearBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 20 },

    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: 'white', borderRadius: 20, width: '100%', maxWidth: 350, padding: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textHeader },
    modalBody: { gap: 10, marginBottom: 20 },
    
    typeRow: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
        padding: 12, borderRadius: 12, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: 'transparent'
    },
    typeRowSelected: { backgroundColor: COLORS.primary + '10', borderColor: COLORS.primary },
    typeRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { padding: 6, borderRadius: 8 },
    typeRowText: { fontSize: 15, fontWeight: '600', color: COLORS.textHeader },
    
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
    
    modalBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

    // --- FILTER CARD ---
    filterCard: { 
        backgroundColor: 'white', borderRadius: 16, padding: 15, marginBottom: 15, marginTop: 10,
        borderWidth: 1, borderColor: COLORS.border 
    },
    filterRow: { flexDirection: 'column', marginBottom: 0 },
    filterLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '600', marginBottom: 8 },
    inputsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    arrow: { marginHorizontal: 10, color: COLORS.textSub },
    divider: { height: 1, backgroundColor: COLORS.bg, marginVertical: 12 },

    inputTrigger: { 
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.bg, paddingVertical: 10, borderRadius: 10,
        borderWidth: 1, borderColor: COLORS.border
    },
    triggerText: { marginLeft: 8, color: COLORS.textHeader, fontWeight: '600', fontSize: 13 },

    rangeInfo: { fontSize: 12, color: COLORS.textSub, textAlign: 'center', marginBottom: 15, fontStyle: 'italic' },

    mainCard: { 
        backgroundColor: COLORS.primary, borderRadius: 20, padding: 20, marginBottom: 20,
        elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12
    },
    mainCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mainCardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
    mainCardValue: { color: 'white', fontSize: 30, fontWeight: '800', marginTop: 5 },
    currency: { fontSize: 16, fontWeight: '500', opacity: 0.8 },
    iconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 14 },
    
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    smallCard: { 
        backgroundColor: 'white', width: (width - 50) / 2, padding: 16, borderRadius: 18, marginBottom: 15,
        borderWidth: 1, borderColor: COLORS.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5
    },
    smallIconBg: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    smallLabel: { color: COLORS.textSub, fontSize: 12, fontWeight: '600' },
    smallValue: { color: COLORS.textHeader, fontSize: 17, fontWeight: '700', marginTop: 4 },

    iosPickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    iosPickerContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }
});