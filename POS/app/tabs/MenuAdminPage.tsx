import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    TextInput, Image, ActivityIndicator, Dimensions, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker'; 
import { 
    LayoutGrid, Utensils, Settings2, Store, 
    Plus, Trash2, Save, Edit, Eye, EyeOff, X, Camera, Upload, AlertTriangle, CheckCircle 
} from 'lucide-react-native'; 
import axios from 'axios';
import { POS_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. IMPORT MODIFIÉ POUR LE TOAST
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

type Tab = 'restaurant' | 'groups' | 'menus' | 'options';

const COLORS = {
    primary: "#6366F1",
    secondary: "#1E293B",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    bg: "#F1F5F9",
    card: "#FFFFFF",
    border: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
    overlay: "rgba(0,0,0,0.6)"
};

const MENU_TYPES = [
    { value: 'burger', label: 'Burger' },
    { value: 'sandwich', label: 'Sandwich' },
    { value: 'wrap', label: 'Wrap' },
    { value: 'salad', label: 'Salad' },
    { value: 'plate', label: 'Plate' },
    { value: 'dessert', label: 'Dessert' },
    { value: 'drink', label: 'Drink' }
];

const OPTION_TYPES = [
    { value: 'pain', label: 'Pain' },
    { value: 'crudité', label: 'Crudité' },
    { value: 'accompagnement', label: 'Accompagnement' },
    { value: 'sauce', label: 'Sauce' },
    { value: 'boisson', label: 'Boisson' },
    { value: 'dessert', label: 'Dessert' },
    { value: 'base', label: 'Base' },
    { value: 'protéine', label: 'Protéine' },
];

// 2. CONFIGURATION DU TOAST (POUR AFFICHER PLUSIEURS LIGNES)
const toastConfig = {
    success: (props: any) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: COLORS.success, height: 'auto', minHeight: 60, paddingVertical: 10 }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary }}
            text2Style={{ fontSize: 14, color: COLORS.muted }}
            text2NumberOfLines={4} // Autorise 4 lignes de texte
        />
    ),
    error: (props: any) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: COLORS.danger, height: 'auto', minHeight: 60, paddingVertical: 10 }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary }}
            text2Style={{ fontSize: 14, color: COLORS.muted }}
            text2NumberOfLines={4} // Autorise 4 lignes de texte
        />
    )
};

export default function MenuAdminPage() {
    const [activeTab, setActiveTab] = useState<Tab>('groups');
    const [loading, setLoading] = useState(false);
    const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
    const [restaurantId, setRestaurantId] = useState<string>('');
    const [groups, setGroups] = useState([]);
    const [menus, setMenus] = useState([]);
    const [options, setOptions] = useState([]);

    // Modal states (Edit)
    const [editGroupModal, setEditGroupModal] = useState(false);
    const [editMenuModal, setEditMenuModal] = useState(false);
    const [editOptionModal, setEditOptionModal] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        visible: false, title: '', message: '', onConfirm: async () => {}
    });

    // Photo states
    const [selectedGroupPhoto, setSelectedGroupPhoto] = useState<any>(null);
    const [selectedMenuPhoto, setSelectedMenuPhoto] = useState<any>(null);
    const [selectedOptionPhoto, setSelectedOptionPhoto] = useState<any>(null);

    // Form States
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupPhoto, setNewGroupPhoto] = useState<any>(null);
    
    const [menuForm, setMenuForm] = useState({
        name: '', price: '', solo_price: '', group_menu: '', 
        type: 'burger', description: '', avalaible: true
    });
    const [menuFormPhoto, setMenuFormPhoto] = useState<any>(null);

    const [optionForm, setOptionForm] = useState({
        name: '', type: 'pain', extra_price: '0.00', avalaible: true
    });
    const [optionFormPhoto, setOptionFormPhoto] = useState<any>(null);

    // Edit states
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [editingMenu, setEditingMenu] = useState<any>(null);
    const [editingOption, setEditingOption] = useState<any>(null);

    // 🔥 ETATS POUR LA PRÉVISUALISATION
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);

    useEffect(() => { fetchInitialData(); }, []);

    // ============= UTILS =============

    const showSuccess = (title: string, message: string) => {
        Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 4000 });
    };

    const showError = (title: string, message: string) => {
        Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 5000 });
    };

    const askConfirmation = (title: string, message: string, onConfirm: () => Promise<void>) => {
        setConfirmModal({
            visible: true, title, message,
            onConfirm: async () => { await onConfirm(); setConfirmModal(prev => ({ ...prev, visible: false })); }
        });
    };

    const fetchInitialData = async () => {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        const resId = await AsyncStorage.getItem("Employee_restaurant_id");
        setRestaurantId(resId || '');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [resResto, resGroups, resMenus, resOptions] = await Promise.all([
                axios.get(`${POS_URL}/restaurant/api/my-restaurant/${resId}/`, { headers }),
                axios.get(`${POS_URL}/menu/api/getGroupMenuList/${resId}/`, { headers }),
                axios.get(`${POS_URL}/menu/api/getAllMenu/${resId}/`, { headers }),
                axios.get(`${POS_URL}/menu/api/getOption/`, { headers })
            ]);
            
            setRestaurantInfo(resResto.data);
            setGroups(resGroups.data);
            setMenus(resMenus.data);
            setOptions(resOptions.data);
        } catch (e: any) { 
            console.error('Erreur:', e.response?.data || e.message);
            showError("Erreur chargement", "Impossible de charger les données");
        } finally { setLoading(false); }
    };

    const appendImageToFormData = async (formData: FormData, key: string, photo: any) => {
        if (!photo) return;
        if (Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos') {
            try {
                const response = await fetch(photo.uri);
                const blob = await response.blob();
                const filename = photo.fileName || photo.name || `photo_${Date.now()}.jpg`;
                formData.append(key, blob, filename);
            } catch (err) {
                console.error("Erreur conversion Blob:", err);
                throw new Error("Impossible de traiter l'image pour Windows");
            }
        } else {
            const filename = photo.uri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : 'image/jpeg';
            formData.append(key, { uri: photo.uri, name: filename || `photo_${Date.now()}.jpg`, type: type } as any);
        }
    };

    const pickImage = async (setter: Function) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showError('Permission refusée', 'Accès aux photos requis');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const MIN_WIDTH = 500;
                const MIN_HEIGHT = 500;

                if (asset.width < MIN_WIDTH || asset.height < MIN_HEIGHT) {
                    showError('Qualité insuffisante', `L'image est trop pixelisée. Min: ${MIN_WIDTH}x${MIN_HEIGHT}px.`);
                    return;
                }

                setter({ uri: asset.uri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` });
            }
        } catch (error) {
            showError('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    const removeImage = (setter: Function) => setter(null);

    // ============= GROUP FUNCTIONS =============
    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || !newGroupDescription.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Champs obligatoires',
                text2: 'Le nom et la description sont requis.'
            });
            return;
        }
        
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('name', newGroupName);
            formData.append('description', newGroupDescription || newGroupName);
            formData.append('restaurant', restaurantId);
            formData.append('avalaible', 'true');
            formData.append('extra', 'false');
            formData.append('position', '0');
            if (newGroupPhoto) await appendImageToFormData(formData, 'photo', newGroupPhoto);
            
            const response = await fetch(`${POS_URL}/menu/api/createGroupMenu/`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
    
            if (response.ok) {
                showSuccess("Succès", "Groupe créé avec succès");
                setNewGroupName(''); setNewGroupDescription(''); setNewGroupPhoto(null);
                fetchInitialData();
            } else { showError("Erreur", "Le serveur a refusé la création"); }
        } catch (e: any) { showError("Erreur Réseau", e.message); }
    };

    const openEditGroup = (group: any) => { setEditingGroup({ ...group }); setSelectedGroupPhoto(null); setEditGroupModal(true); };

    const handleUpdateGroup = async () => {
        if (!editingGroup) return;
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('id', editingGroup.id.toString());
            formData.append('name', editingGroup.name);
            formData.append('description', editingGroup.description || '');
            formData.append('restaurant', editingGroup.restaurant.toString());
            formData.append('avalaible', editingGroup.avalaible.toString());
            if (selectedGroupPhoto) await appendImageToFormData(formData, 'photo', selectedGroupPhoto);
            
            const response = await fetch(`${POS_URL}/menu/api/updateGroupMenu/`, {
                method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            if (response.ok) {
                showSuccess("Succès", "Groupe mis à jour");
                setEditGroupModal(false); setEditingGroup(null); setSelectedGroupPhoto(null);
                fetchInitialData();
            } else { showError("Erreur", "Mise à jour échouée"); }
        } catch (e: any) { showError("Erreur", e.message); }
    };

    const handleDeleteGroup = (groupId: number) => {
        askConfirmation("Supprimer le groupe ?", "Cette action supprimera le groupe et TOUS les menus associés.", async () => {
            const token = await AsyncStorage.getItem("token");
            try {
                await axios.delete(`${POS_URL}/menu/api/deleteGroupMenu/${groupId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Groupe supprimé"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer le groupe"); }
        });
    };

    const toggleGroupAvailability = async (group: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateGroupMenu/`, { id: group.id, avalaible: !group.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData(); showSuccess("Succès", `Groupe ${!group.avalaible ? 'activé' : 'désactivé'}`);
        } catch (e: any) { showError("Erreur", "Erreur lors du changement de disponibilité"); }
    };

    // ============= 🔥 MENU FUNCTIONS (MODIFIED) =============
    
    // ÉTAPE 1 : Vérification et Ouverture de la Prévisualisation
    const handlePreCreateMenu = () => {
        if (!menuForm.name || !menuForm.price || !menuForm.solo_price || !menuForm.group_menu || !menuForm.description) {
            // Grâce à toastConfig, ce message s'affichera entièrement maintenant
            return showError("Incomplet", "Veuillez remplir les champs obligatoires (Nom, Description, Prix et Groupe)");
        }
        setPreviewModalVisible(true);
    };

    // ÉTAPE 2 : Envoi final au serveur (Appelé depuis la Modal)
    const handleFinalizeCreateMenu = async () => {
        setIsSubmittingMenu(true);
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('name', menuForm.name);
            formData.append('description', menuForm.description || '');
            formData.append('price', menuForm.price);
            formData.append('solo_price', menuForm.solo_price || '0');
            formData.append('group_menu', menuForm.group_menu);
            formData.append('type', menuForm.type);
            formData.append('avalaible', 'true');
            formData.append('extra', 'false');
            formData.append('position', '0');
            
            if (menuFormPhoto) {
                await appendImageToFormData(formData, 'photo', menuFormPhoto);
            }
            
            const response = await fetch(`${POS_URL}/menu/api/createMenu/`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
    
            if (response.ok) {
                showSuccess("Succès", "Article ajouté au menu");
                setMenuForm({ name: '', price: '', solo_price: '', group_menu: '', type: 'burger', description: '', avalaible: true });
                setMenuFormPhoto(null);
                setPreviewModalVisible(false); // Fermer la modal
                fetchInitialData();
            } else {
                showError("Erreur", "Création échouée");
            }
        } catch (e: any) { 
            showError("Erreur", e.message);
        } finally {
            setIsSubmittingMenu(false);
        }
    };

    const openEditMenu = (menu: any) => {
        let groupId = '';
        if (menu.group_menu) {
            if (typeof menu.group_menu === 'object') groupId = menu.group_menu.id ? menu.group_menu.id.toString() : '';
            else groupId = menu.group_menu.toString();
        }
        setEditingMenu({ ...menu, price: menu.price.toString(), solo_price: menu.solo_price ? menu.solo_price.toString() : '0', group_menu: groupId, type: menu.type });
        setSelectedMenuPhoto(null);
        setEditMenuModal(true);
    };

    const handleUpdateMenu = async () => {
        if (!editingMenu) return;
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('id', editingMenu.id.toString());
            formData.append('name', editingMenu.name);
            formData.append('description', editingMenu.description || '');
            formData.append('price', editingMenu.price.toString());
            formData.append('solo_price', (editingMenu.solo_price || '0').toString());
            formData.append('type', editingMenu.type);
            formData.append('avalaible', editingMenu.avalaible.toString());
            if (editingMenu.group_menu) formData.append('group_menu', editingMenu.group_menu); 
            if (selectedMenuPhoto) await appendImageToFormData(formData, 'photo', selectedMenuPhoto);
            
            const response = await fetch(`${POS_URL}/menu/api/updateMenu/`, {
                method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            if (response.ok) {
                showSuccess("Succès", "Article mis à jour");
                setEditMenuModal(false); setEditingMenu(null); setSelectedMenuPhoto(null);
                fetchInitialData();
            } else { showError("Erreur", "Mise à jour échouée"); }
        } catch (e: any) { showError("Erreur", e.message); }
    };

    const handleDeleteMenu = (menuId: number) => {
        askConfirmation("Supprimer l'article ?", "Êtes-vous sûr de vouloir supprimer cet article définitivement ?", async () => {
            const token = await AsyncStorage.getItem("token");
            try {
                await axios.delete(`${POS_URL}/menu/api/deleteMenu/${menuId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Article supprimé"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer l'article"); }
        });
    };

    const toggleMenuAvailability = async (menu: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateMenu/`, { id: menu.id, avalaible: !menu.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData(); showSuccess("Succès", "Disponibilité mise à jour");
        } catch (e: any) { showError("Erreur", "Erreur lors du changement de disponibilité"); }
    };

    // ============= OPTION FUNCTIONS =============
    const handleCreateOption = async () => {
        if (!optionForm.name || !optionForm.type) return showError("Incomplet", "Nom et Type obligatoires");
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('name', optionForm.name);
            formData.append('type', optionForm.type);
            formData.append('extra_price', optionForm.extra_price || '0');
            formData.append('avalaible', 'true');
            if (optionFormPhoto) await appendImageToFormData(formData, 'photo', optionFormPhoto);
            
            const response = await fetch(`${POS_URL}/menu/api/createOption/`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            if (response.ok) {
                showSuccess("Succès", "Option créée");
                setOptionForm({ name: '', type: 'pain', extra_price: '0.00', avalaible: true }); setOptionFormPhoto(null);
                fetchInitialData();
            } else { showError("Erreur", "Création échouée"); }
        } catch (e: any) { showError("Erreur", e.message); }
    };

    const openEditOption = (option: any) => { setEditingOption({ ...option, extra_price: option.extra_price.toString() }); setSelectedOptionPhoto(null); setEditOptionModal(true); };

    const handleUpdateOption = async () => {
        if (!editingOption) return;
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('id', editingOption.id.toString());
            formData.append('name', editingOption.name);
            formData.append('type', editingOption.type);
            formData.append('extra_price', (editingOption.extra_price || '0').toString());
            formData.append('avalaible', editingOption.avalaible.toString());
            if (selectedOptionPhoto) await appendImageToFormData(formData, 'photo', selectedOptionPhoto);
            
            const response = await fetch(`${POS_URL}/menu/api/updateOption/`, {
                method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            if (response.ok) {
                showSuccess("Succès", "Option mise à jour");
                setEditOptionModal(false); setEditingOption(null); setSelectedOptionPhoto(null);
                fetchInitialData();
            } else { showError("Erreur", "Mise à jour échouée"); }
        } catch (e: any) { showError("Erreur", e.message); }
    };

    const handleDeleteOption = (optionId: number) => {
        askConfirmation("Supprimer l'option ?", "Voulez-vous vraiment supprimer cette option ?", async () => {
            const token = await AsyncStorage.getItem("token");
            try {
                await axios.delete(`${POS_URL}/menu/api/deleteOption/${optionId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Option supprimée"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer l'option"); }
        });
    };

    const toggleOptionAvailability = async (option: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateOption/`, { id: option.id, avalaible: !option.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData(); showSuccess("Succès", "Disponibilité mise à jour");
        } catch (e: any) { showError("Erreur", "Impossible de modifier la disponibilité"); }
    };

    // ============= RENDERERS =============
    
    const renderPhotoPicker = (photo: any, setPhoto: Function, currentPhotoUrl?: string) => (
        <View style={styles.photoPickerContainer}>
            <Text style={styles.photoLabel}>Photo</Text>
            <View style={styles.photoPreviewContainer}>
                {photo || currentPhotoUrl ? (
                    <View style={styles.photoWrapper}>
                        <Image source={{ uri: photo ? photo.uri : `${POS_URL}${currentPhotoUrl}` }} style={styles.photoPreview} />
                        {photo && <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(setPhoto)}><X size={16} color="white" /></TouchableOpacity>}
                    </View>
                ) : (
                    <View style={styles.photoPlaceholder}><Camera size={40} color={COLORS.muted} /><Text style={styles.photoPlaceholderText}>Aucune photo</Text></View>
                )}
            </View>
            <TouchableOpacity style={styles.selectPhotoBtn} onPress={() => pickImage(setPhoto)}>
                <Upload size={18} color={COLORS.primary} /><Text style={styles.selectPhotoText}>{photo ? 'Changer la photo' : 'Sélectionner une photo'}</Text>
            </TouchableOpacity>
        </View>
    );

    const SidebarItem = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
        <TouchableOpacity style={[styles.tabBtn, activeTab === id && styles.activeTab]} onPress={() => setActiveTab(id)}>
            <Icon size={20} color={activeTab === id ? "#FFF" : COLORS.muted} />
            <Text style={[styles.tabText, activeTab === id && styles.activeTabText]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderGroupsTab = () => (
        <View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Créer un Nouveau Groupe</Text>
                <TextInput style={styles.input} placeholder="Nom du groupe" value={newGroupName} onChangeText={setNewGroupName} />
                <TextInput style={styles.input} placeholder="Description" value={newGroupDescription} onChangeText={setNewGroupDescription} />
                {renderPhotoPicker(newGroupPhoto, setNewGroupPhoto)}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateGroup}><Plus size={20} color="white" /><Text style={styles.btnText}>Créer le Groupe</Text></TouchableOpacity>
            </View>
            <Text style={styles.listHeader}>Groupes existants ({groups.length})</Text>
            {groups.map((g: any) => (
                <View key={g.id} style={styles.listItem}>
                    {g.photo && <Image source={{ uri: `${POS_URL}${g.photo}` }} style={styles.listItemPhoto} />}
                    <View style={styles.listItemInfo}>
                        <Text style={styles.itemTitle}>{g.name}</Text>
                        <Text style={styles.itemSubTitle}>{g.description}</Text>
                        <View style={styles.statusBadge}><Text style={[styles.statusText, !g.avalaible && styles.unavailableText]}>{g.avalaible ? '✓ Disponible' : '✗ Indisponible'}</Text></View>
                    </View>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditGroup(g)}><Edit size={18} color={COLORS.primary} /></TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => toggleGroupAvailability(g)}>{g.avalaible ? <Eye size={18} color={COLORS.success} /> : <EyeOff size={18} color={COLORS.muted} />}</TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteGroup(g.id)}><Trash2 size={18} color={COLORS.danger} /></TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderMenusTab = () => (
        <View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Ajouter un Article</Text>
                <TextInput style={styles.input} placeholder="Nom" value={menuForm.name} onChangeText={(t) => setMenuForm({...menuForm, name: t})} />
                <TextInput style={styles.input} placeholder="Description" value={menuForm.description} onChangeText={(t) => setMenuForm({...menuForm, description: t})} multiline />
                <View style={styles.row}>
                    <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Prix Menu" keyboardType="numeric" value={menuForm.price} onChangeText={(t) => setMenuForm({...menuForm, price: t})} />
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="Prix solo" keyboardType="numeric" value={menuForm.solo_price} onChangeText={(t) => setMenuForm({...menuForm, solo_price: t})} />
                </View>
                <View style={styles.row}>
                    <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                        <Picker selectedValue={menuForm.group_menu} onValueChange={(v) => setMenuForm({...menuForm, group_menu: v})} style={{ width: '100%', height: '100%', color: COLORS.secondary, backgroundColor: 'transparent' }}>
                            <Picker.Item label="Choisir un groupe" value="" style={{color: COLORS.muted}} />
                            {groups.map((g: any) => (<Picker.Item key={g.id} label={g.name} value={g.id.toString()} />))}
                        </Picker>
                    </View>
                    <View style={[styles.pickerContainer, {flex: 1}]}>
                        <Picker selectedValue={menuForm.type} onValueChange={(v) => setMenuForm({...menuForm, type: v})} style={{ width: '100%', height: '100%', color: COLORS.secondary, backgroundColor: 'transparent' }}>
                            {MENU_TYPES.map((type) => (<Picker.Item key={type.value} label={type.label} value={type.value} />))}
                        </Picker>
                    </View>
                </View>
                {renderPhotoPicker(menuFormPhoto, setMenuFormPhoto)}
                
                <TouchableOpacity style={styles.submitBtn} onPress={handlePreCreateMenu}>
                    <Eye size={20} color="white" />
                    <Text style={styles.btnText}>Prévisualiser & Enregistrer</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.listHeader}>Articles existants ({menus.length})</Text>
            {menus.map((m: any) => (
                <View key={m.id} style={styles.menuListItem}>
                    {m.photo && <Image source={{ uri: `${POS_URL}${m.photo}` }} style={styles.menuPhoto} />}
                    <View style={styles.menuListHeader}>
                        <View style={{flex: 1}}>
                            <Text style={styles.itemTitle}>{m.name}</Text>
                            <Text style={styles.itemSubTitle}>{m.type}</Text>
                        </View>
                        <Text style={styles.priceTag}>{m.price} DA</Text>
                    </View>
                    <View style={styles.menuActions}>
                        <View style={styles.statusBadge}><Text style={[styles.statusText, !m.avalaible && styles.unavailableText]}>{m.avalaible ? '✓' : '✗'}</Text></View>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMenu(m)}><Edit size={16} color={COLORS.primary} /></TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => toggleMenuAvailability(m)}>{m.avalaible ? <Eye size={16} color={COLORS.success} /> : <EyeOff size={16} color={COLORS.muted} />}</TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteMenu(m.id)}><Trash2 size={16} color={COLORS.danger} /></TouchableOpacity>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderOptionsTab = () => (
        <View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Créer une Option</Text>
                <TextInput style={styles.input} placeholder="Nom" value={optionForm.name} onChangeText={(t) => setOptionForm({...optionForm, name: t})} />
                <View style={styles.row}>
                    <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                        <Picker selectedValue={optionForm.type} onValueChange={(v) => setOptionForm({...optionForm, type: v})}>
                            {OPTION_TYPES.map((type) => (<Picker.Item key={type.value} label={type.label} value={type.value} />))}
                        </Picker>
                    </View>
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="Prix +" keyboardType="numeric" value={optionForm.extra_price} onChangeText={(t) => setOptionForm({...optionForm, extra_price: t})} />
                </View>
                {renderPhotoPicker(optionFormPhoto, setOptionFormPhoto)}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateOption}><Plus size={20} color="white" /><Text style={styles.btnText}>Créer</Text></TouchableOpacity>
            </View>
            <Text style={styles.listHeader}>Options existantes ({options.length})</Text>
            {options.map((o: any) => (
                <View key={o.id} style={styles.listItem}>
                    {o.photo && <Image source={{ uri: `${POS_URL}${o.photo}` }} style={styles.listItemPhoto} />}
                    <View style={styles.listItemInfo}>
                        <Text style={styles.itemTitle}>{o.name}</Text>
                        <Text style={styles.itemSubTitle}>{o.type} • {o.extra_price > 0 ? `+${o.extra_price} DA` : 'Inclus'}</Text>
                        <View style={styles.statusBadge}><Text style={[styles.statusText, !o.avalaible && styles.unavailableText]}>{o.avalaible ? '✓' : '✗'}</Text></View>
                    </View>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditOption(o)}><Edit size={18} color={COLORS.primary} /></TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => toggleOptionAvailability(o)}>{o.avalaible ? <Eye size={18} color={COLORS.success} /> : <EyeOff size={18} color={COLORS.muted} />}</TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteOption(o.id)}><Trash2 size={18} color={COLORS.danger} /></TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderRestaurantTab = () => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations du Restaurant</Text>
            {restaurantInfo && (
                <View>
                    <Text style={styles.infoLabel}>Nom:</Text><Text style={styles.infoValue}>{restaurantInfo.name}</Text>
                    <Text style={styles.infoLabel}>Adresse:</Text><Text style={styles.infoValue}>{restaurantInfo.address}</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}><Text style={styles.statValue}>{groups.length}</Text><Text style={styles.statLabel}>Groupes</Text></View>
                        <View style={styles.statBox}><Text style={styles.statValue}>{menus.length}</Text><Text style={styles.statLabel}>Articles</Text></View>
                        <View style={styles.statBox}><Text style={styles.statValue}>{options.length}</Text><Text style={styles.statLabel}>Options</Text></View>
                    </View>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.sidebar}>
                <View style={styles.logoContainer}><Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" /><Text style={styles.adminTitle}>Admin POS</Text></View>
                <SidebarItem id="restaurant" label="Restaurant" icon={Store} />
                <SidebarItem id="groups" label="Groupes" icon={LayoutGrid} />
                <SidebarItem id="menus" label="Articles" icon={Utensils} />
                <SidebarItem id="options" label="Options" icon={Settings2} />
                <View style={styles.sidebarFooter}><Text style={styles.footerText}>Version 2.0.0</Text><Text style={styles.footerSubText}>Mode Desktop & Mobile</Text></View>
            </View>

            <View style={styles.content}>
                <View style={styles.contentHeader}>
                    <Text style={styles.sectionTitle}>{activeTab === 'restaurant' ? 'Restaurant' : activeTab === 'groups' ? 'Groupes de Menu' : activeTab === 'menus' ? 'Articles' : 'Options'}</Text>
                    <TouchableOpacity onPress={fetchInitialData} style={styles.refreshBtn}><Text style={styles.refreshBtnText}>Actualiser</Text></TouchableOpacity>
                </View>

                {loading ? ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View> ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {activeTab === 'restaurant' && renderRestaurantTab()}
                        {activeTab === 'groups' && renderGroupsTab()}
                        {activeTab === 'menus' && renderMenusTab()}
                        {activeTab === 'options' && renderOptionsTab()}
                    </ScrollView>
                )}
            </View>

            {/* MODALS EDIT... (Groups, Menus, Options) */}
            <Modal visible={editGroupModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Modifier le Groupe</Text><TouchableOpacity onPress={() => setEditGroupModal(false)}><X size={24} color={COLORS.secondary} /></TouchableOpacity></View>
                        <TextInput style={styles.input} placeholder="Nom" value={editingGroup?.name || ''} onChangeText={(t) => setEditingGroup({...editingGroup, name: t})} />
                        <TextInput style={styles.input} placeholder="Description" value={editingGroup?.description || ''} onChangeText={(t) => setEditingGroup({...editingGroup, description: t})} />
                        {renderPhotoPicker(selectedGroupPhoto, setSelectedGroupPhoto, editingGroup?.photo)}
                        <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateGroup}><Save size={20} color="white" /><Text style={styles.btnText}>Enregistrer</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
            
            <Modal visible={editMenuModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Modifier l'Article</Text><TouchableOpacity onPress={() => setEditMenuModal(false)}><X size={24} color={COLORS.secondary} /></TouchableOpacity></View>
                            <Text style={styles.photoLabel}>Nom de l'article</Text>
                            <TextInput style={styles.input} placeholder="Nom" value={editingMenu?.name || ''} onChangeText={(t) => setEditingMenu({...editingMenu, name: t})} />
                            <Text style={styles.photoLabel}>Description</Text>
                            <TextInput style={styles.input} placeholder="Description" value={editingMenu?.description || ''} onChangeText={(t) => setEditingMenu({...editingMenu, description: t})} multiline />
                            <Text style={{marginBottom: 8, marginTop: 10, color: COLORS.secondary, fontWeight:'700'}}>Catégorie (Groupe)</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={editingMenu?.group_menu ? editingMenu.group_menu.toString() : ""} onValueChange={(v) => setEditingMenu({...editingMenu, group_menu: v})} style={{ width: '100%', height: '100%', color: COLORS.secondary, backgroundColor: 'transparent' }}>
                                    <Picker.Item label="Sélectionner une catégorie..." value="" style={{color: COLORS.muted}} />
                                    {groups.map((g: any) => (<Picker.Item key={g.id} label={g.name} value={g.id.toString()} />))}
                                </Picker>
                            </View>
                            <View style={[styles.row, {marginTop: 10}]}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.photoLabel}>Prix Menu</Text><TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={editingMenu?.price ? editingMenu.price.toString() : ''} onChangeText={(t) => setEditingMenu({...editingMenu, price: t})} /></View>
                                <View style={{flex: 1}}><Text style={styles.photoLabel}>Prix Solo</Text><TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={editingMenu?.solo_price ? editingMenu.solo_price.toString() : ''} onChangeText={(t) => setEditingMenu({...editingMenu, solo_price: t})} /></View>
                            </View>
                            <Text style={{marginBottom: 8, marginTop: 15, color: COLORS.secondary, fontWeight:'700'}}>Type de produit</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={editingMenu?.type} onValueChange={(v) => setEditingMenu({...editingMenu, type: v})} style={{ width: '100%', height: '100%', color: COLORS.secondary, backgroundColor: 'transparent' }}>
                                    {MENU_TYPES.map((type) => (<Picker.Item key={type.value} label={type.label} value={type.value} />))}
                                </Picker>
                            </View>
                            {renderPhotoPicker(selectedMenuPhoto, setSelectedMenuPhoto, editingMenu?.photo)}
                            <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateMenu}><Save size={20} color="white" /><Text style={styles.btnText}>Enregistrer</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <Modal visible={editOptionModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Modifier l'Option</Text><TouchableOpacity onPress={() => setEditOptionModal(false)}><X size={24} color={COLORS.secondary} /></TouchableOpacity></View>
                        <TextInput style={styles.input} placeholder="Nom" value={editingOption?.name || ''} onChangeText={(t) => setEditingOption({...editingOption, name: t})} />
                        <View style={styles.row}>
                            <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                                <Picker selectedValue={editingOption?.type} onValueChange={(v) => setEditingOption({...editingOption, type: v})}>{OPTION_TYPES.map((type) => (<Picker.Item key={type.value} label={type.label} value={type.value} />))}</Picker>
                            </View>
                            <TextInput style={[styles.input, {flex: 1}]} placeholder="Prix +" keyboardType="numeric" value={editingOption?.extra_price || ''} onChangeText={(t) => setEditingOption({...editingOption, extra_price: t})} />
                        </View>
                        {renderPhotoPicker(selectedOptionPhoto, setSelectedOptionPhoto, editingOption?.photo)}
                        <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateOption}><Save size={20} color="white" /><Text style={styles.btnText}>Enregistrer</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* CONFIRM MODAL */}
            <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={() => setConfirmModal(prev => ({...prev, visible: false}))}>
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmBox}>
                        <View style={styles.confirmIconBg}><AlertTriangle size={32} color={COLORS.danger} /></View>
                        <Text style={styles.confirmTitle}>{confirmModal.title}</Text>
                        <Text style={styles.confirmMessage}>{confirmModal.message}</Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirmModal(prev => ({...prev, visible: false}))}><Text style={styles.cancelButtonText}>Annuler</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmButton} onPress={confirmModal.onConfirm}><Text style={styles.confirmButtonText}>Supprimer</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🔥🔥 MODAL DE PRÉVISUALISATION STYLE TERMINAL (POS) */}
            <Modal visible={previewModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.previewModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Aperçu Borne (Terminal)</Text>
                            <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                                <X size={24} color={COLORS.secondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.previewSubtitle}>Voici exactement comment l'article s'affichera sur la borne :</Text>

                        {/* 🔥 RENDU IDENTIQUE AU FICHIER terminal.tsx 🔥 */}
                        <View style={styles.previewContainer}>
                            <View style={styles.terminalCard}>
                                {/* Image du terminal */}
                                <View style={styles.terminalImageContainer}>
                                    {menuFormPhoto ? (
                                        <Image source={{ uri: menuFormPhoto.uri }} style={styles.terminalImage} resizeMode="cover" />
                                    ) : (
                                        <View style={[styles.terminalImage, {backgroundColor: '#EEE', justifyContent:'center', alignItems:'center'}]}>
                                            <Utensils size={40} color="#94a3b8" />
                                        </View>
                                    )}
                                </View>
                                
                                {/* Info du terminal */}
                                <View style={styles.terminalInfo}>
                                    <Text style={styles.terminalTitle} numberOfLines={2}>
                                        {menuForm.name || "Nom du produit"}
                                    </Text>
                                    <View style={styles.terminalPriceContainer}>
                                        <Text style={styles.terminalPrice}>
                                            {/* Logique d'affichage du prix identique au terminal */}
                                            {(menuForm.solo_price && parseFloat(menuForm.solo_price) > 0) 
                                                ? menuForm.solo_price 
                                                : menuForm.price} 
                                            {/* Le DA en plus petit comme sur la photo */}
                                            <Text style={{fontSize: 14}}> DA</Text>
                                        </Text>
                                        <View style={styles.terminalAddButton}>
                                            <Plus size={20} color="white" />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.previewWarning}>
                            Vérifiez que la photo est bien cadrée et que le nom ne dépasse pas.
                        </Text>

                        <View style={styles.previewActions}>
                            <TouchableOpacity style={[styles.cancelButton, {flex: 1, marginRight: 10}]} onPress={() => setPreviewModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>Modifier</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.submitBtn, {marginTop: 0, flex: 1}]} onPress={handleFinalizeCreateMenu} disabled={isSubmittingMenu}>
                                {isSubmittingMenu ? ( <ActivityIndicator color="white" /> ) : (
                                    <>
                                        <CheckCircle size={20} color="white" />
                                        <Text style={styles.btnText}>Valider et Mettre en Ligne</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 3. APPLICATION DE LA CONFIG AU TOAST */}
            <Toast position="bottom" bottomOffset={40} config={toastConfig} />
        </View>
    );
}

const styles = StyleSheet.create({
    logoImage: { width: 100, height: 25 },
    container: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.bg },
    sidebar: { width: 260, backgroundColor: COLORS.card, padding: 20, borderRightWidth: 1, borderColor: COLORS.border },
    logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, gap: 10 },
    adminTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary },
    tabBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, gap: 12 },
    activeTab: { backgroundColor: COLORS.primary },
    tabText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
    activeTabText: { color: '#FFF' },
    sidebarFooter: { marginTop: 'auto', paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
    footerText: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
    footerSubText: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 4 },
    
    content: { flex: 1, padding: 30 },
    contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    sectionTitle: { fontSize: 28, fontWeight: '800', color: COLORS.secondary },
    refreshBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#E2E8F0' },
    refreshBtnText: { fontWeight: '700', color: COLORS.secondary, fontSize: 13 },
    
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    card: { backgroundColor: COLORS.card, padding: 25, borderRadius: 16, marginBottom: 25, elevation: 4 },
    cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, color: COLORS.secondary },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 15, borderRadius: 12, fontSize: 16, marginBottom: 15, color: COLORS.secondary, height: 55, justifyContent: 'center' },
    pickerContainer: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginBottom: 15, height: 55, justifyContent: 'center', overflow: 'hidden' },
    
    submitBtn: { backgroundColor: COLORS.success, flexDirection: 'row', height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
    btnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    iconBtn: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8, marginLeft: 8 },
    deleteBtn: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10, marginLeft: 8 },
    
    listHeader: { fontSize: 18, fontWeight: '700', marginBottom: 15, color: COLORS.muted },
    listItem: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    listItemPhoto: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
    listItemInfo: { flex: 1 },
    itemTitle: { fontWeight: '700', fontSize: 17, color: COLORS.secondary },
    itemSubTitle: { color: COLORS.muted, fontSize: 14, marginTop: 4 },
    actionButtons: { flexDirection: 'row', alignItems: 'center' },
    
    menuListItem: { backgroundColor: COLORS.card, padding: 18, borderRadius: 16, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: COLORS.primary },
    menuPhoto: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12 },
    menuListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    priceTag: { fontWeight: '800', color: COLORS.primary, fontSize: 16 },
    menuActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0FDF4', alignSelf: 'flex-start', marginTop: 8 },
    statusText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
    unavailableText: { color: COLORS.danger },
    
    infoLabel: { fontSize: 14, fontWeight: '600', color: COLORS.muted, marginTop: 15, marginBottom: 5 },
    infoValue: { fontSize: 16, color: COLORS.secondary, fontWeight: '500' },
    statsContainer: { flexDirection: 'row', marginTop: 25, gap: 15 },
    statBox: { flex: 1, backgroundColor: COLORS.bg, padding: 20, borderRadius: 12, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
    statLabel: { fontSize: 14, color: COLORS.muted, marginTop: 5 },
    
    // Modal Edit styles
    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: COLORS.card, width: '100%', maxWidth: 500, borderRadius: 20, padding: 25, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary },
    
    // Confirmation Modal Styles
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    confirmBox: { backgroundColor: 'white', padding: 30, borderRadius: 24, width: 340, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
    confirmIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    confirmTitle: { fontSize: 20, fontWeight: '700', color: COLORS.secondary, marginBottom: 10, textAlign: 'center' },
    confirmMessage: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.bg, alignItems: 'center' },
    cancelButtonText: { color: COLORS.secondary, fontWeight: '600' },
    confirmButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: 'center' },
    confirmButtonText: { color: 'white', fontWeight: '700' },

    // Photo picker styles
    photoPickerContainer: { marginBottom: 20 },
    photoLabel: { fontSize: 14, fontWeight: '600', color: COLORS.secondary, marginBottom: 10 },
    photoPreviewContainer: { marginBottom: 10 },
    photoWrapper: { position: 'relative' },
    photoPreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: COLORS.bg },
    photoPlaceholder: { width: '100%', height: 200, borderRadius: 12, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed' },
    photoPlaceholderText: { color: COLORS.muted, marginTop: 10, fontSize: 14 },
    removePhotoBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: COLORS.danger, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    selectPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4FF', padding: 12, borderRadius: 10, gap: 8 },
    selectPhotoText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

    // =========================================================================
    // 🔥🔥 STYLES POUR LA PRÉVISUALISATION (Alignés sur terminal.tsx) 🔥🔥
    // =========================================================================
    previewModalContent: { 
        backgroundColor: '#F3F4F6', 
        width: '100%', 
        maxWidth: 450, 
        borderRadius: 20, 
        padding: 25, 
        elevation: 10,
        alignItems: 'center'
    },
    previewSubtitle: { fontSize: 16, color: COLORS.muted, marginBottom: 20, textAlign: 'center' },
    previewContainer: { marginBottom: 25 },
    previewWarning: { fontSize: 14, color: COLORS.warning, textAlign: 'center', marginBottom: 20, backgroundColor: '#FFFBEB', padding: 10, borderRadius: 8, width: '100%' },
    previewActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },

    // Style exact de la carte du terminal
    terminalCard: {
        width: 320, // Élargi (était 250)
        height: 240, // Réduit (était 280) pour un effet rectangle net
        backgroundColor: "#fff",
        borderRadius: 20,
        overflow: 'hidden',
        // Ombres
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    terminalImageContainer: {
        width: "100%",
        height: "60%", // Image un peu plus grande pour correspondre à votre photo
    },
    terminalImage: {
        width: "100%",
        height: "100%",
    },
    terminalInfo: {
        padding: 15,
        flex: 1,
        justifyContent: 'space-between', // Pousse le titre en haut et le prix en bas
    },
    terminalTitle: {
        fontSize: 17,
        fontWeight: "700",
        textAlign: "left",
        color: "#1e293b", 
        marginBottom: 5,
    },
    terminalPriceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    terminalPrice: {
        fontSize: 20,
        color: "#0056b3", 
        fontWeight: "800",
    },
    terminalAddButton: {
        backgroundColor: "#ff69b4", 
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
});