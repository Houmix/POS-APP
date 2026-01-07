// Installation requise :
// npm install expo-image-picker
// ou
// npm install react-native-image-picker

import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    TextInput, Image, Alert, ActivityIndicator, Dimensions, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker'; // Pour Expo
// OU pour React Native CLI :
// import { launchImageLibrary } from 'react-native-image-picker';

import { 
    LayoutGrid, Utensils, Settings2, Store, 
    Plus, Trash2, Save, Edit, Eye, EyeOff, X, Camera, Upload 
} from 'lucide-react-native';
import axios from 'axios';
import { POS_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

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
    overlay: "rgba(0,0,0,0.5)"
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

export default function MenuAdminPage() {
    const [activeTab, setActiveTab] = useState<Tab>('groups');
    const [loading, setLoading] = useState(false);
    const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
    const [restaurantId, setRestaurantId] = useState<string>('');
    const [groups, setGroups] = useState([]);
    const [menus, setMenus] = useState([]);
    const [options, setOptions] = useState([]);

    // Modal states
    const [editGroupModal, setEditGroupModal] = useState(false);
    const [editMenuModal, setEditMenuModal] = useState(false);
    const [editOptionModal, setEditOptionModal] = useState(false);

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

    useEffect(() => { fetchInitialData(); }, []);

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
            Alert.alert("Erreur", "Impossible de charger les données");
        } finally { setLoading(false); }
    };

    // ============= IMAGE PICKER FUNCTIONS =============
    
    const pickImage = async (setter: Function) => {
        try {
            // Demander la permission (pour Expo)
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission refusée', 'Nous avons besoin de la permission pour accéder à vos photos');
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
                setter({
                    uri: asset.uri,
                    type: 'image/jpeg',
                    name: `photo_${Date.now()}.jpg`
                });
                console.log('✅ Photo sélectionnée:', asset.uri);
            }
        } catch (error) {
            console.error('Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    /* Alternative pour React Native CLI (sans Expo) :
    
    import { launchImageLibrary } from 'react-native-image-picker';
    
    const pickImage = async (setter: Function) => {
        const options = {
            mediaType: 'photo',
            quality: 0.8,
            maxWidth: 1000,
            maxHeight: 1000,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('Sélection annulée');
            } else if (response.errorCode) {
                console.error('Erreur:', response.errorMessage);
                Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
            } else if (response.assets && response.assets[0]) {
                const asset = response.assets[0];
                setter({
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || `photo_${Date.now()}.jpg`
                });
                console.log('✅ Photo sélectionnée');
            }
        });
    };
    */

    const removeImage = (setter: Function) => {
        setter(null);
    };

    // ============= GROUP FUNCTIONS =============
    
const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
        return Alert.alert("Attention", "Le nom du groupe est obligatoire");
    }
    
    const token = await AsyncStorage.getItem("token");
    
    try {
        const formData = new FormData();
        
        // Ajouter les champs texte
        formData.append('name', newGroupName);
        formData.append('description', newGroupDescription || newGroupName);
        formData.append('restaurant', restaurantId);
        formData.append('avalaible', 'true');
        formData.append('extra', 'false');
        formData.append('position', '0');
        
        // ✅ CORRECTION - Format correct pour React Native
        if (newGroupPhoto) {
            // Méthode 1 : Objet avec propriétés spécifiques (RECOMMANDÉ)
            formData.append('photo', {
                uri: newGroupPhoto.uri,
                type: newGroupPhoto.type || 'image/jpeg',
                name: newGroupPhoto.name || `photo_${Date.now()}.jpg`,
            } as any);
            
            console.log('📸 Photo ajoutée au FormData:', {
                uri: newGroupPhoto.uri,
                type: newGroupPhoto.type,
                name: newGroupPhoto.name
            });
        }
        
        // Log pour déboguer
        console.log('📤 FormData créé, prêt à envoyer');
        
        const response = await axios.post(
            `${POS_URL}/menu/api/createGroupMenu/`, 
            formData, 
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            }
        );
        
        console.log('✅ Réponse serveur:', response.data);
        Alert.alert("Succès", "Le groupe a été créé");
        
        // Reset
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupPhoto(null);
        fetchInitialData();
        
    } catch (e: any) { 
        console.error('❌ Erreur complète:', e.response?.data);
        console.error('❌ Erreur status:', e.response?.status);
        Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la création"); 
    }
};


    const openEditGroup = (group: any) => {
        setEditingGroup({ ...group });
        setSelectedGroupPhoto(null); // Reset la nouvelle photo
        setEditGroupModal(true);
    };

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
            
            // Si une nouvelle photo a été sélectionnée
            if (selectedGroupPhoto) {
                formData.append('photo', {
                    uri: selectedGroupPhoto.uri,
                    type: selectedGroupPhoto.type,
                    name: selectedGroupPhoto.name
                } as any);
                console.log('📸 Nouvelle photo pour le groupe');
            }
            
            await axios.put(`${POS_URL}/menu/api/updateGroupMenu/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            Alert.alert("Succès", "Groupe mis à jour");
            setEditGroupModal(false);
            setEditingGroup(null);
            setSelectedGroupPhoto(null);
            fetchInitialData();
        } catch (e: any) { 
            console.error('❌ Erreur mise à jour:', e.response?.data);
            Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la mise à jour"); 
        }
    };

    const handleDeleteGroup = async (groupId: number) => {
        Alert.alert(
            "Confirmation",
            "Supprimer ce groupe et tous ses menus ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer", style: "destructive",
                    onPress: async () => {
                        const token = await AsyncStorage.getItem("token");
                        try {
                            await axios.delete(`${POS_URL}/menu/api/deleteGroupMenu/${groupId}/`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Alert.alert("Succès", "Groupe supprimé");
                            fetchInitialData();
                        } catch (e: any) { 
                            Alert.alert("Erreur", "Erreur lors de la suppression"); 
                        }
                    }
                }
            ]
        );
    };

    const toggleGroupAvailability = async (group: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateGroupMenu/`, {
                id: group.id,
                avalaible: !group.avalaible
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData();
        } catch (e: any) { 
            Alert.alert("Erreur", "Erreur lors du changement de disponibilité"); 
        }
    };

    // ============= MENU FUNCTIONS =============
    
    const handleCreateMenu = async () => {
        if (!menuForm.name || !menuForm.price || !menuForm.group_menu) {
            return Alert.alert("Attention", "Veuillez remplir les champs obligatoires");
        }
        
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
                formData.append('photo', {
                    uri: menuFormPhoto.uri,
                    type: menuFormPhoto.type,
                    name: menuFormPhoto.name
                } as any);
            }
            
            await axios.post(`${POS_URL}/menu/api/createMenu/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            Alert.alert("Succès", "L'article a été ajouté");
            setMenuForm({ name: '', price: '', solo_price: '', group_menu: '', 
                         type: 'burger', description: '', avalaible: true });
            setMenuFormPhoto(null);
            fetchInitialData();
        } catch (e: any) { 
            console.error('❌ Erreur création menu:', e.response?.data);
            Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la création"); 
        }
    };

    const openEditMenu = (menu: any) => {
        setEditingMenu({
            ...menu,
            price: menu.price.toString(),
            solo_price: menu.solo_price.toString()
        });
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
            formData.append('price', editingMenu.price);
            formData.append('solo_price', editingMenu.solo_price || '0');
            formData.append('type', editingMenu.type);
            formData.append('avalaible', editingMenu.avalaible.toString());
            
            if (selectedMenuPhoto) {
                formData.append('photo', {
                    uri: selectedMenuPhoto.uri,
                    type: selectedMenuPhoto.type,
                    name: selectedMenuPhoto.name
                } as any);
            }
            
            await axios.put(`${POS_URL}/menu/api/updateMenu/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            Alert.alert("Succès", "Menu mis à jour");
            setEditMenuModal(false);
            setEditingMenu(null);
            setSelectedMenuPhoto(null);
            fetchInitialData();
        } catch (e: any) { 
            console.error('❌ Erreur mise à jour menu:', e.response?.data);
            Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la mise à jour"); 
        }
    };

    const handleDeleteMenu = async (menuId: number) => {
        Alert.alert(
            "Confirmation",
            "Supprimer cet article ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer", style: "destructive",
                    onPress: async () => {
                        const token = await AsyncStorage.getItem("token");
                        try {
                            await axios.delete(`${POS_URL}/menu/api/deleteMenu/${menuId}/`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Alert.alert("Succès", "Article supprimé");
                            fetchInitialData();
                        } catch (e: any) { 
                            Alert.alert("Erreur", "Erreur lors de la suppression"); 
                        }
                    }
                }
            ]
        );
    };

    const toggleMenuAvailability = async (menu: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateMenu/`, {
                id: menu.id,
                avalaible: !menu.avalaible
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData();
        } catch (e: any) { 
            Alert.alert("Erreur", "Erreur lors du changement de disponibilité"); 
        }
    };

    // ============= OPTION FUNCTIONS =============
    
    const handleCreateOption = async () => {
        if (!optionForm.name || !optionForm.type) {
            return Alert.alert("Attention", "Veuillez remplir les champs obligatoires");
        }
        
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('name', optionForm.name);
            formData.append('type', optionForm.type);
            formData.append('extra_price', optionForm.extra_price || '0');
            formData.append('avalaible', 'true');
            
            if (optionFormPhoto) {
                formData.append('photo', {
                    uri: optionFormPhoto.uri,
                    type: optionFormPhoto.type,
                    name: optionFormPhoto.name
                } as any);
            }
            
            await axios.post(`${POS_URL}/menu/api/createOption/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            Alert.alert("Succès", "L'option a été créée");
            setOptionForm({ name: '', type: 'pain', extra_price: '0.00', avalaible: true });
            setOptionFormPhoto(null);
            fetchInitialData();
        } catch (e: any) { 
            console.error('❌ Erreur création option:', e.response?.data);
            Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la création"); 
        }
    };

    const openEditOption = (option: any) => {
        setEditingOption({
            ...option,
            extra_price: option.extra_price.toString()
        });
        setSelectedOptionPhoto(null);
        setEditOptionModal(true);
    };

    const handleUpdateOption = async () => {
        if (!editingOption) return;
        
        const token = await AsyncStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append('id', editingOption.id.toString());
            formData.append('name', editingOption.name);
            formData.append('type', editingOption.type);
            formData.append('extra_price', editingOption.extra_price || '0');
            formData.append('avalaible', editingOption.avalaible.toString());
            
            if (selectedOptionPhoto) {
                formData.append('photo', {
                    uri: selectedOptionPhoto.uri,
                    type: selectedOptionPhoto.type,
                    name: selectedOptionPhoto.name
                } as any);
            }
            
            await axios.put(`${POS_URL}/menu/api/updateOption/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            Alert.alert("Succès", "Option mise à jour");
            setEditOptionModal(false);
            setEditingOption(null);
            setSelectedOptionPhoto(null);
            fetchInitialData();
        } catch (e: any) { 
            console.error('❌ Erreur mise à jour option:', e.response?.data);
            Alert.alert("Erreur", e.response?.data?.message || "Erreur lors de la mise à jour"); 
        }
    };

    const handleDeleteOption = async (optionId: number) => {
        Alert.alert(
            "Confirmation",
            "Supprimer cette option ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer", style: "destructive",
                    onPress: async () => {
                        const token = await AsyncStorage.getItem("token");
                        try {
                            await axios.delete(`${POS_URL}/menu/api/deleteOption/${optionId}/`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Alert.alert("Succès", "Option supprimée");
                            fetchInitialData();
                        } catch (e: any) { 
                            Alert.alert("Erreur", "Erreur lors de la suppression"); 
                        }
                    }
                }
            ]
        );
    };

    const toggleOptionAvailability = async (option: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${POS_URL}/menu/api/updateOption/`, {
                id: option.id,
                avalaible: !option.avalaible
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInitialData();
        } catch (e: any) { 
            Alert.alert("Erreur", "Erreur lors du changement de disponibilité"); 
        }
    };

    // ============= RENDER PHOTO PICKER =============
    
    const renderPhotoPicker = (photo: any, setPhoto: Function, currentPhotoUrl?: string) => (
        <View style={styles.photoPickerContainer}>
            <Text style={styles.photoLabel}>Photo</Text>
            <View style={styles.photoPreviewContainer}>
                {photo || currentPhotoUrl ? (
                    <View style={styles.photoWrapper}>
                        <Image 
                            source={{ uri: photo ? photo.uri : `${POS_URL}${currentPhotoUrl}` }}
                            style={styles.photoPreview}
                        />
                        {photo && (
                            <TouchableOpacity 
                                style={styles.removePhotoBtn}
                                onPress={() => removeImage(setPhoto)}
                            >
                                <X size={16} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Camera size={40} color={COLORS.muted} />
                        <Text style={styles.photoPlaceholderText}>Aucune photo</Text>
                    </View>
                )}
            </View>
            <TouchableOpacity 
                style={styles.selectPhotoBtn}
                onPress={() => pickImage(setPhoto)}
            >
                <Upload size={18} color={COLORS.primary} />
                <Text style={styles.selectPhotoText}>
                    {photo ? 'Changer la photo' : 'Sélectionner une photo'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // ============= RENDER COMPONENTS =============
    
    const SidebarItem = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
        <TouchableOpacity 
            style={[styles.tabBtn, activeTab === id && styles.activeTab]} 
            onPress={() => setActiveTab(id)}
        >
            <Icon size={20} color={activeTab === id ? "#FFF" : COLORS.muted} />
            <Text style={[styles.tabText, activeTab === id && styles.activeTabText]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderGroupsTab = () => (
        <View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Créer un Nouveau Groupe</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Nom du groupe"
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Description"
                    value={newGroupDescription}
                    onChangeText={setNewGroupDescription}
                />
                {renderPhotoPicker(newGroupPhoto, setNewGroupPhoto)}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateGroup}>
                    <Plus size={20} color="white" />
                    <Text style={styles.btnText}>Créer le Groupe</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.listHeader}>Groupes existants ({groups.length})</Text>
            {groups.map((g: any) => (
                <View key={g.id} style={styles.listItem}>
                    {g.photo && (
                        <Image 
                            source={{ uri: `${POS_URL}${g.photo}` }}
                            style={styles.listItemPhoto}
                        />
                    )}
                    <View style={styles.listItemInfo}>
                        <Text style={styles.itemTitle}>{g.name}</Text>
                        <Text style={styles.itemSubTitle}>{g.description}</Text>
                        <View style={styles.statusBadge}>
                            <Text style={[styles.statusText, !g.avalaible && styles.unavailableText]}>
                                {g.avalaible ? '✓ Disponible' : '✗ Indisponible'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditGroup(g)}>
                            <Edit size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => toggleGroupAvailability(g)}>
                            {g.avalaible ? <Eye size={18} color={COLORS.success} /> : <EyeOff size={18} color={COLORS.muted} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteGroup(g.id)}>
                            <Trash2 size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderMenusTab = () => (
        <View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Ajouter un Article</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Nom"
                    value={menuForm.name}
                    onChangeText={(t) => setMenuForm({...menuForm, name: t})}
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Description"
                    value={menuForm.description}
                    onChangeText={(t) => setMenuForm({...menuForm, description: t})}
                    multiline
                />
                <View style={styles.row}>
                    <TextInput 
                        style={[styles.input, {flex: 1, marginRight: 10}]} 
                        placeholder="Prix (DA)"
                        keyboardType="numeric"
                        value={menuForm.price}
                        onChangeText={(t) => setMenuForm({...menuForm, price: t})}
                    />
                    <TextInput 
                        style={[styles.input, {flex: 1}]} 
                        placeholder="Prix solo"
                        keyboardType="numeric"
                        value={menuForm.solo_price}
                        onChangeText={(t) => setMenuForm({...menuForm, solo_price: t})}
                    />
                </View>
                <View style={styles.row}>
                    <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                        <Picker 
                            selectedValue={menuForm.group_menu}
                            onValueChange={(v) => setMenuForm({...menuForm, group_menu: v})}
                        >
                            <Picker.Item label="Choisir un groupe" value="" />
                            {groups.map((g: any) => (
                                <Picker.Item key={g.id} label={g.name} value={g.id.toString()} />
                            ))}
                        </Picker>
                    </View>
                    <View style={[styles.pickerContainer, {flex: 1}]}>
                        <Picker 
                            selectedValue={menuForm.type}
                            onValueChange={(v) => setMenuForm({...menuForm, type: v})}
                        >
                            {MENU_TYPES.map((type) => (
                                <Picker.Item key={type.value} label={type.label} value={type.value} />
                            ))}
                        </Picker>
                    </View>
                </View>
                {renderPhotoPicker(menuFormPhoto, setMenuFormPhoto)}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateMenu}>
                    <Save size={20} color="white" />
                    <Text style={styles.btnText}>Enregistrer</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.listHeader}>Articles existants ({menus.length})</Text>
            {menus.map((m: any) => (
                <View key={m.id} style={styles.menuListItem}>
                    {m.photo && (
                        <Image 
                            source={{ uri: `${POS_URL}${m.photo}` }}
                            style={styles.menuPhoto}
                        />
                    )}
                    <View style={styles.menuListHeader}>
                        <View style={{flex: 1}}>
                            <Text style={styles.itemTitle}>{m.name}</Text>
                            <Text style={styles.itemSubTitle}>{m.type}</Text>
                        </View>
                        <Text style={styles.priceTag}>{m.price} DA</Text>
                    </View>
                    <View style={styles.menuActions}>
                        <View style={styles.statusBadge}>
                            <Text style={[styles.statusText, !m.avalaible && styles.unavailableText]}>
                                {m.avalaible ? '✓' : '✗'}
                            </Text>
                        </View>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMenu(m)}>
                                <Edit size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => toggleMenuAvailability(m)}>
                                {m.avalaible ? <Eye size={16} color={COLORS.success} /> : <EyeOff size={16} color={COLORS.muted} />}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteMenu(m.id)}>
                                <Trash2 size={16} color={COLORS.danger} />
                            </TouchableOpacity>
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
                <TextInput 
                    style={styles.input} 
                    placeholder="Nom"
                    value={optionForm.name}
                    onChangeText={(t) => setOptionForm({...optionForm, name: t})}
                />
                <View style={styles.row}>
                    <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                        <Picker 
                            selectedValue={optionForm.type}
                            onValueChange={(v) => setOptionForm({...optionForm, type: v})}
                        >
                            {OPTION_TYPES.map((type) => (
                                <Picker.Item key={type.value} label={type.label} value={type.value} />
                            ))}
                        </Picker>
                    </View>
                    <TextInput 
                        style={[styles.input, {flex: 1}]} 
                        placeholder="Prix +"
                        keyboardType="numeric"
                        value={optionForm.extra_price}
                        onChangeText={(t) => setOptionForm({...optionForm, extra_price: t})}
                    />
                </View>
                {renderPhotoPicker(optionFormPhoto, setOptionFormPhoto)}
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateOption}>
                    <Plus size={20} color="white" />
                    <Text style={styles.btnText}>Créer</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.listHeader}>Options existantes ({options.length})</Text>
            {options.map((o: any) => (
                <View key={o.id} style={styles.listItem}>
                    {o.photo && (
                        <Image 
                            source={{ uri: `${POS_URL}${o.photo}` }}
                            style={styles.listItemPhoto}
                        />
                    )}
                    <View style={styles.listItemInfo}>
                        <Text style={styles.itemTitle}>{o.name}</Text>
                        <Text style={styles.itemSubTitle}>
                            {o.type} • {o.extra_price > 0 ? `+${o.extra_price} DA` : 'Inclus'}
                        </Text>
                        <View style={styles.statusBadge}>
                            <Text style={[styles.statusText, !o.avalaible && styles.unavailableText]}>
                                {o.avalaible ? '✓' : '✗'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditOption(o)}>
                            <Edit size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => toggleOptionAvailability(o)}>
                            {o.avalaible ? <Eye size={18} color={COLORS.success} /> : <EyeOff size={18} color={COLORS.muted} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteOption(o.id)}>
                            <Trash2 size={18} color={COLORS.danger} />
                        </TouchableOpacity>
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
                    <Text style={styles.infoLabel}>Nom:</Text>
                    <Text style={styles.infoValue}>{restaurantInfo.name}</Text>
                    <Text style={styles.infoLabel}>Adresse:</Text>
                    <Text style={styles.infoValue}>{restaurantInfo.address}</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{groups.length}</Text>
                            <Text style={styles.statLabel}>Groupes</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{menus.length}</Text>
                            <Text style={styles.statLabel}>Articles</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{options.length}</Text>
                            <Text style={styles.statLabel}>Options</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* SIDEBAR */}
            <View style={styles.sidebar}>
                <View style={styles.logoContainer}>
                    <Store size={24} color={COLORS.primary} />
                    <Text style={styles.adminTitle}>Admin POS</Text>
                </View>
                
                <SidebarItem id="restaurant" label="Restaurant" icon={Store} />
                <SidebarItem id="groups" label="Groupes" icon={LayoutGrid} />
                <SidebarItem id="menus" label="Articles" icon={Utensils} />
                <SidebarItem id="options" label="Options" icon={Settings2} />

                <View style={styles.sidebarFooter}>
                    <Text style={styles.footerText}>Version 2.0.0</Text>
                    <Text style={styles.footerSubText}>Avec Upload Photos</Text>
                </View>
            </View>

            {/* CONTENT */}
            <View style={styles.content}>
                <View style={styles.contentHeader}>
                    <Text style={styles.sectionTitle}>
                        {activeTab === 'restaurant' ? 'Restaurant' : 
                         activeTab === 'groups' ? 'Groupes de Menu' :
                         activeTab === 'menus' ? 'Articles' : 'Options'}
                    </Text>
                    <TouchableOpacity onPress={fetchInitialData} style={styles.refreshBtn}>
                        <Text style={styles.refreshBtnText}>Actualiser</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {activeTab === 'restaurant' && renderRestaurantTab()}
                        {activeTab === 'groups' && renderGroupsTab()}
                        {activeTab === 'menus' && renderMenusTab()}
                        {activeTab === 'options' && renderOptionsTab()}
                    </ScrollView>
                )}
            </View>

            {/* MODAL EDIT GROUP */}
            <Modal visible={editGroupModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={styles.modalScrollContent}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Modifier le Groupe</Text>
                                <TouchableOpacity onPress={() => setEditGroupModal(false)}>
                                    <X size={24} color={COLORS.secondary} />
                                </TouchableOpacity>
                            </View>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Nom"
                                value={editingGroup?.name || ''}
                                onChangeText={(t) => setEditingGroup({...editingGroup, name: t})}
                            />
                            <TextInput 
                                style={styles.input} 
                                placeholder="Description"
                                value={editingGroup?.description || ''}
                                onChangeText={(t) => setEditingGroup({...editingGroup, description: t})}
                            />
                            {renderPhotoPicker(selectedGroupPhoto, setSelectedGroupPhoto, editingGroup?.photo)}
                            <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateGroup}>
                                <Save size={20} color="white" />
                                <Text style={styles.btnText}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* MODAL EDIT MENU */}
            <Modal visible={editMenuModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={styles.modalScrollContent}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Modifier l'Article</Text>
                                <TouchableOpacity onPress={() => setEditMenuModal(false)}>
                                    <X size={24} color={COLORS.secondary} />
                                </TouchableOpacity>
                            </View>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Nom"
                                value={editingMenu?.name || ''}
                                onChangeText={(t) => setEditingMenu({...editingMenu, name: t})}
                            />
                            <TextInput 
                                style={styles.input} 
                                placeholder="Description"
                                value={editingMenu?.description || ''}
                                onChangeText={(t) => setEditingMenu({...editingMenu, description: t})}
                                multiline
                            />
                            <View style={styles.row}>
                                <TextInput 
                                    style={[styles.input, {flex: 1, marginRight: 10}]} 
                                    placeholder="Prix"
                                    keyboardType="numeric"
                                    value={editingMenu?.price || ''}
                                    onChangeText={(t) => setEditingMenu({...editingMenu, price: t})}
                                />
                                <TextInput 
                                    style={[styles.input, {flex: 1}]} 
                                    placeholder="Prix solo"
                                    keyboardType="numeric"
                                    value={editingMenu?.solo_price || ''}
                                    onChangeText={(t) => setEditingMenu({...editingMenu, solo_price: t})}
                                />
                            </View>
                            <View style={styles.pickerContainer}>
                                <Picker 
                                    selectedValue={editingMenu?.type}
                                    onValueChange={(v) => setEditingMenu({...editingMenu, type: v})}
                                >
                                    {MENU_TYPES.map((type) => (
                                        <Picker.Item key={type.value} label={type.label} value={type.value} />
                                    ))}
                                </Picker>
                            </View>
                            {renderPhotoPicker(selectedMenuPhoto, setSelectedMenuPhoto, editingMenu?.photo)}
                            <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateMenu}>
                                <Save size={20} color="white" />
                                <Text style={styles.btnText}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* MODAL EDIT OPTION */}
            <Modal visible={editOptionModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={styles.modalScrollContent}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Modifier l'Option</Text>
                                <TouchableOpacity onPress={() => setEditOptionModal(false)}>
                                    <X size={24} color={COLORS.secondary} />
                                </TouchableOpacity>
                            </View>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Nom"
                                value={editingOption?.name || ''}
                                onChangeText={(t) => setEditingOption({...editingOption, name: t})}
                            />
                            <View style={styles.row}>
                                <View style={[styles.pickerContainer, {flex: 1, marginRight: 10}]}>
                                    <Picker 
                                        selectedValue={editingOption?.type}
                                        onValueChange={(v) => setEditingOption({...editingOption, type: v})}
                                    >
                                        {OPTION_TYPES.map((type) => (
                                            <Picker.Item key={type.value} label={type.label} value={type.value} />
                                        ))}
                                    </Picker>
                                </View>
                                <TextInput 
                                    style={[styles.input, {flex: 1}]} 
                                    placeholder="Prix +"
                                    keyboardType="numeric"
                                    value={editingOption?.extra_price || ''}
                                    onChangeText={(t) => setEditingOption({...editingOption, extra_price: t})}
                                />
                            </View>
                            {renderPhotoPicker(selectedOptionPhoto, setSelectedOptionPhoto, editingOption?.photo)}
                            <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateOption}>
                                <Save size={20} color="white" />
                                <Text style={styles.btnText}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
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
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 15 },
    pickerContainer: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginBottom: 15 },
    
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
    
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center' },
    modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: COLORS.card, width: width * 0.9, maxWidth: 500, borderRadius: 20, padding: 25, elevation: 10, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary },
    
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
});