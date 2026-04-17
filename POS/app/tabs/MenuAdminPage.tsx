import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Image, ActivityIndicator, Dimensions, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import {
    LayoutGrid, Utensils, Settings2, Store,
    Plus, Trash2, Save, Edit, Eye, EyeOff, X, Camera, Upload, AlertTriangle, CheckCircle,
    ZoomIn, ZoomOut, Info, RefreshCw
} from 'lucide-react-native';
import axios from 'axios';
import { getPosUrl } from '@/utils/serverConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKioskTheme } from '@/contexts/KioskThemeContext';

const CLOUD_URL = 'https://borndz-production.up.railway.app';

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
    const { refreshTheme, logoUrl } = useKioskTheme();
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

    // 🔄 SYNC DEPUIS LE CLOUD
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    // 🖼️ CROP / ZOOM MODAL STATES
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);
    const [cropSourceSize, setCropSourceSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const [cropTargetSetter, setCropTargetSetter] = useState<Function | null>(null);
    const [cropZoom, setCropZoom] = useState(1);
    const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [cropBgColor, setCropBgColor] = useState<string>('#FFFFFF');
    const [cropIsApplying, setCropIsApplying] = useState(false);
    const cropDragRef = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
        dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0
    });

    // Dimensions cibles de l'image exportée (ratio 4:3, optimisé pour les bornes)
    const CROP_OUTPUT_WIDTH = 800;
    const CROP_OUTPUT_HEIGHT = 600;
    // Taille du cadre affiché dans la modale de recadrage
    const CROP_FRAME_WIDTH = 360;
    const CROP_FRAME_HEIGHT = 270;

    const BG_COLOR_PRESETS = [
        { label: 'Blanc', value: '#FFFFFF' },
        { label: 'Gris clair', value: '#F1F5F9' },
        { label: 'Beige', value: '#FAF3E0' },
        { label: 'Noir', value: '#111827' },
    ];

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
                axios.get(`${getPosUrl()}/restaurant/api/my-restaurant/${resId}/`, { headers }),
                axios.get(`${getPosUrl()}/menu/api/getGroupMenuList/${resId}/`, { headers }),
                axios.get(`${getPosUrl()}/menu/api/getAllMenu/${resId}/`, { headers }),
                axios.get(`${getPosUrl()}/menu/api/getOption/`, { headers })
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

    const handleForceSync = async () => {
        if (!restaurantId) {
            showError('Sync impossible', 'Restaurant non identifié. Reconnectez-vous.');
            return;
        }
        setIsSyncing(true);
        try {
            // 1. Télécharger le snapshot complet depuis le cloud
            setSyncMessage('Téléchargement depuis le cloud...');
            let snapshotRes: any;
            try {
                snapshotRes = await axios.get(
                    `${CLOUD_URL}/api/sync/snapshot/?restaurant_id=${restaurantId}`,
                    { timeout: 30000 }
                );
            } catch (cloudErr: any) {
                const status = cloudErr.response?.status;
                const serverMsg = cloudErr.response?.data?.error;
                if (status === 404) {
                    throw new Error(`Restaurant #${restaurantId} introuvable sur le cloud. Vérifiez que ce restaurant existe.`);
                } else if (status === 400) {
                    throw new Error(serverMsg || `Paramètre invalide (restaurant_id=${restaurantId}).`);
                } else {
                    throw new Error(serverMsg || cloudErr.message || 'Impossible de joindre le cloud.');
                }
            }

            if (!snapshotRes.data.success) {
                throw new Error(snapshotRes.data.error || 'Le cloud n\'a retourné aucune donnée.');
            }

            // Vérification anticipée : snapshot vide ?
            const snap = snapshotRes.data;
            const hasData = (snap.group_menus?.length > 0) || (snap.menus?.length > 0) || (snap.users?.length > 0);
            if (!hasData) {
                throw new Error(`Le cloud n'a pas de données pour le restaurant #${restaurantId}.\nVérifiez que ce restaurant est bien configuré sur le cloud (menus, utilisateurs).`);
            }

            // 2. Appliquer le snapshot en local (clear + import en une transaction atomique)
            setSyncMessage('Application des données en local...');
            let applyRes: any;
            try {
                applyRes = await axios.post(
                    `${getPosUrl()}/api/sync/apply-snapshot/`,
                    snap,
                    { timeout: 30000 }
                );
            } catch (localErr: any) {
                const serverMsg = localErr.response?.data?.error;
                throw new Error(serverMsg || localErr.message || 'Erreur lors de l\'application locale.');
            }

            if (!applyRes.data.success) {
                throw new Error(applyRes.data.error || 'Échec de l\'application des données.');
            }

            // 3. Recharger l'affichage + thème kiosque
            setSyncMessage('Rechargement des données...');
            await Promise.all([fetchInitialData(), refreshTheme()]);
            setSyncMessage('');
            const applied = applyRes.data.applied || {};
            showSuccess(
                'Synchronisation terminée',
                `${applied.group_menu ?? 0} catégories, ${applied.menu ?? 0} menus, ${applied.users ?? 0} utilisateur(s).`
            );
        } catch (e: any) {
            setSyncMessage('');
            showError('Erreur de sync', e.message || 'Impossible de synchroniser avec le cloud.');
        } finally {
            setIsSyncing(false);
        }
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

            // Pas de crop natif : on récupère l'image brute pour notre recadrage custom
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 1,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const MIN_WIDTH = 300;
                const MIN_HEIGHT = 300;

                if ((asset.width || 0) < MIN_WIDTH || (asset.height || 0) < MIN_HEIGHT) {
                    showError(
                        'Qualité insuffisante',
                        `L'image doit faire au moins ${MIN_WIDTH}×${MIN_HEIGHT}px.\nFormat conseillé : ${CROP_OUTPUT_WIDTH}×${CROP_OUTPUT_HEIGHT}px, fond uni.`
                    );
                    return;
                }

                // Ouvre la modale de recadrage / zoom / fond
                setCropSourceUri(asset.uri);
                setCropSourceSize({ w: asset.width || 0, h: asset.height || 0 });
                setCropTargetSetter(() => setter);
                // Centre l'image, zoom qui couvre le cadre (fit cover)
                const initialZoom = computeCoverZoom(asset.width || 1, asset.height || 1);
                setCropZoom(initialZoom);
                setCropOffset({ x: 0, y: 0 });
                setCropBgColor('#FFFFFF');
                setCropModalVisible(true);
            }
        } catch (error) {
            showError('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // Calcule le zoom minimum qui rempli le cadre (cover)
    const computeCoverZoom = (srcW: number, srcH: number) => {
        const frameRatio = CROP_FRAME_WIDTH / CROP_FRAME_HEIGHT;
        const imgRatio = srcW / srcH;
        // Base affichée = image mise en "contain" dans le cadre
        let baseW: number, baseH: number;
        if (imgRatio > frameRatio) {
            // image + large → contain donne baseH = frame height
            baseH = CROP_FRAME_HEIGHT;
            baseW = baseH * imgRatio;
        } else {
            baseW = CROP_FRAME_WIDTH;
            baseH = baseW / imgRatio;
        }
        // Zoom nécessaire pour couvrir
        return Math.max(CROP_FRAME_WIDTH / baseW, CROP_FRAME_HEIGHT / baseH, 1);
    };

    // Dimensions de base (avant zoom) de l'image dans le cadre (contain)
    const getDisplayedBaseSize = (): { w: number; h: number } => {
        const { w, h } = cropSourceSize;
        if (!w || !h) return { w: CROP_FRAME_WIDTH, h: CROP_FRAME_HEIGHT };
        const frameRatio = CROP_FRAME_WIDTH / CROP_FRAME_HEIGHT;
        const imgRatio = w / h;
        if (imgRatio > frameRatio) {
            const baseH = CROP_FRAME_HEIGHT;
            return { w: baseH * imgRatio, h: baseH };
        }
        const baseW = CROP_FRAME_WIDTH;
        return { w: baseW, h: baseW / imgRatio };
    };

    const clampOffset = (x: number, y: number, zoom: number): { x: number; y: number } => {
        const base = getDisplayedBaseSize();
        const displayedW = base.w * zoom;
        const displayedH = base.h * zoom;
        // L'image doit toujours recouvrir le cadre → offset borné
        const maxX = Math.max(0, (displayedW - CROP_FRAME_WIDTH) / 2);
        const maxY = Math.max(0, (displayedH - CROP_FRAME_HEIGHT) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    };

    const adjustZoom = (delta: number) => {
        setCropZoom((prev) => {
            const minZoom = computeCoverZoom(cropSourceSize.w || 1, cropSourceSize.h || 1);
            const newZoom = Math.max(minZoom, Math.min(4, prev + delta));
            // Recadrer l'offset pour éviter les bandes
            setCropOffset((off) => clampOffset(off.x, off.y, newZoom));
            return newZoom;
        });
    };

    const resetCrop = () => {
        const z = computeCoverZoom(cropSourceSize.w || 1, cropSourceSize.h || 1);
        setCropZoom(z);
        setCropOffset({ x: 0, y: 0 });
    };

    // Gestion du drag (web + mobile via onStartShouldSetResponder)
    const handleDragStart = (pageX: number, pageY: number) => {
        cropDragRef.current = {
            dragging: true,
            startX: pageX,
            startY: pageY,
            baseX: cropOffset.x,
            baseY: cropOffset.y,
        };
    };
    const handleDragMove = (pageX: number, pageY: number) => {
        if (!cropDragRef.current.dragging) return;
        const dx = pageX - cropDragRef.current.startX;
        const dy = pageY - cropDragRef.current.startY;
        const next = clampOffset(
            cropDragRef.current.baseX + dx,
            cropDragRef.current.baseY + dy,
            cropZoom
        );
        setCropOffset(next);
    };
    const handleDragEnd = () => {
        cropDragRef.current.dragging = false;
    };

    // Applique le recadrage : génère une image finale avec fond uni
    const applyCrop = async () => {
        if (!cropSourceUri || !cropTargetSetter) {
            setCropModalVisible(false);
            return;
        }
        setCropIsApplying(true);
        try {
            const outUri = await renderCroppedImage();
            cropTargetSetter({ uri: outUri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` });
            setCropModalVisible(false);
            setCropSourceUri(null);
            setCropTargetSetter(null);
        } catch (e: any) {
            showError('Recadrage impossible', e.message || 'Erreur pendant le recadrage.');
        } finally {
            setCropIsApplying(false);
        }
    };

    // Rendu via canvas HTML (web / Electron). Sur natif pur, on retourne l'URI source.
    const renderCroppedImage = async (): Promise<string> => {
        if (Platform.OS !== 'web' && Platform.OS !== 'windows' && Platform.OS !== 'macos') {
            // Fallback natif : on retourne l'image d'origine (zoom/fond non appliqués)
            return cropSourceUri!;
        }

        return new Promise((resolve, reject) => {
            try {
                // @ts-ignore - document dispo en web/Electron
                const canvas: HTMLCanvasElement = document.createElement('canvas');
                canvas.width = CROP_OUTPUT_WIDTH;
                canvas.height = CROP_OUTPUT_HEIGHT;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas 2D indisponible'));

                // Fond uni
                ctx.fillStyle = cropBgColor;
                ctx.fillRect(0, 0, CROP_OUTPUT_WIDTH, CROP_OUTPUT_HEIGHT);

                const img: HTMLImageElement = new (window as any).Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // Dimensions de base telles qu'affichées dans la modale
                    const base = getDisplayedBaseSize();
                    const displayedW = base.w * cropZoom;
                    const displayedH = base.h * cropZoom;

                    // Ratio image affichée → canvas final
                    const scale = CROP_OUTPUT_WIDTH / CROP_FRAME_WIDTH;
                    const destW = displayedW * scale;
                    const destH = displayedH * scale;
                    // Offset dans le cadre affiché : l'image est centrée, puis translatée de cropOffset
                    const centerX = CROP_OUTPUT_WIDTH / 2 + cropOffset.x * scale;
                    const centerY = CROP_OUTPUT_HEIGHT / 2 + cropOffset.y * scale;
                    const destX = centerX - destW / 2;
                    const destY = centerY - destH / 2;

                    ctx.drawImage(img, destX, destY, destW, destH);

                    // Convertir en JPEG (plus léger que PNG pour des photos)
                    canvas.toBlob((blob) => {
                        if (!blob) return reject(new Error('Export blob échoué'));
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    }, 'image/jpeg', 0.92);
                };
                img.onerror = () => reject(new Error('Impossible de charger l\'image source'));
                img.src = cropSourceUri!;
            } catch (err: any) {
                reject(err);
            }
        });
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
            
            const response = await fetch(`${getPosUrl()}/menu/api/createGroupMenu/`, {
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
            
            const response = await fetch(`${getPosUrl()}/menu/api/updateGroupMenu/`, {
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
                await axios.delete(`${getPosUrl()}/menu/api/deleteGroupMenu/${groupId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Groupe supprimé"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer le groupe"); }
        });
    };

    const toggleGroupAvailability = async (group: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${getPosUrl()}/menu/api/updateGroupMenu/`, { id: group.id, avalaible: !group.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
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
            formData.append('skip_kds', menuForm.skip_kds ? 'true' : 'false');

            if (menuFormPhoto) {
                await appendImageToFormData(formData, 'photo', menuFormPhoto);
            }

            const response = await fetch(`${getPosUrl()}/menu/api/createMenu/`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
    
            if (response.ok) {
                showSuccess("Succès", "Article ajouté au menu");
                setMenuForm({ name: '', price: '', solo_price: '', group_menu: '', type: 'burger', description: '', avalaible: true, skip_kds: false });
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
            formData.append('skip_kds', editingMenu.skip_kds ? 'true' : 'false');
            if (editingMenu.group_menu) formData.append('group_menu', editingMenu.group_menu);
            if (selectedMenuPhoto) await appendImageToFormData(formData, 'photo', selectedMenuPhoto);
            
            const response = await fetch(`${getPosUrl()}/menu/api/updateMenu/`, {
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
                await axios.delete(`${getPosUrl()}/menu/api/deleteMenu/${menuId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Article supprimé"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer l'article"); }
        });
    };

    const toggleMenuAvailability = async (menu: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${getPosUrl()}/menu/api/updateMenu/`, { id: menu.id, avalaible: !menu.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
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
            
            const response = await fetch(`${getPosUrl()}/menu/api/createOption/`, {
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
            
            const response = await fetch(`${getPosUrl()}/menu/api/updateOption/`, {
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
                await axios.delete(`${getPosUrl()}/menu/api/deleteOption/${optionId}/`, { headers: { Authorization: `Bearer ${token}` } });
                showSuccess("Succès", "Option supprimée"); fetchInitialData();
            } catch (e: any) { showError("Erreur", "Impossible de supprimer l'option"); }
        });
    };

    const toggleOptionAvailability = async (option: any) => {
        const token = await AsyncStorage.getItem("token");
        try {
            await axios.put(`${getPosUrl()}/menu/api/updateOption/`, { id: option.id, avalaible: !option.avalaible }, { headers: { Authorization: `Bearer ${token}` } });
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
                        <Image
                            source={{ uri: photo ? photo.uri : currentPhotoUrl }}
                            style={styles.photoPreview}
                            resizeMode="contain"
                        />
                        {photo && <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(setPhoto)}><X size={16} color="white" /></TouchableOpacity>}
                    </View>
                ) : (
                    <View style={styles.photoPlaceholder}><Camera size={40} color={COLORS.muted} /><Text style={styles.photoPlaceholderText}>Aucune photo</Text></View>
                )}
            </View>
            <View style={styles.photoHintBox}>
                <Info size={14} color={COLORS.primary} />
                <Text style={styles.photoHintText}>
                    Format recommandé : {CROP_OUTPUT_WIDTH}×{CROP_OUTPUT_HEIGHT}px, ratio 4:3, fond uni.
                </Text>
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
                    {g.photo_url && <Image source={{ uri: g.photo_url }} style={styles.listItemPhoto} resizeMode="contain" />}
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

                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}
                    onPress={() => setMenuForm({...menuForm, skip_kds: !menuForm.skip_kds})}
                    activeOpacity={0.7}
                >
                    <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: menuForm.skip_kds ? '#ef4444' : '#cbd5e1', backgroundColor: menuForm.skip_kds ? '#ef4444' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {menuForm.skip_kds && <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>✓</Text>}
                    </View>
                    <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600', flex: 1 }}>Ne pas envoyer en cuisine (KDS)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitBtn} onPress={handlePreCreateMenu}>
                    <Eye size={20} color="white" />
                    <Text style={styles.btnText}>Prévisualiser & Enregistrer</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.listHeader}>Articles existants ({menus.length})</Text>
            {menus.map((m: any) => (
                <View key={m.id} style={styles.menuListItem}>
                    {m.photo_url && <Image source={{ uri: m.photo_url }} style={styles.menuPhoto} resizeMode="contain" />}
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
                    {o.photo_url && <Image source={{ uri: o.photo_url }} style={styles.listItemPhoto} resizeMode="contain" />}
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
                <View style={styles.logoContainer}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" /> : <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />}<Text style={styles.adminTitle}>Admin POS</Text></View>
                <SidebarItem id="restaurant" label="Restaurant" icon={Store} />
                <SidebarItem id="groups" label="Groupes" icon={LayoutGrid} />
                <SidebarItem id="menus" label="Articles" icon={Utensils} />
                <SidebarItem id="options" label="Options" icon={Settings2} />
                <View style={styles.sidebarFooter}><Text style={styles.footerText}>Version 2.0.0</Text><Text style={styles.footerSubText}>Mode Desktop & Mobile</Text></View>
            </View>

            <View style={styles.content}>
                <View style={styles.contentHeader}>
                    <Text style={styles.sectionTitle}>{activeTab === 'restaurant' ? 'Restaurant' : activeTab === 'groups' ? 'Groupes de Menu' : activeTab === 'menus' ? 'Articles' : 'Options'}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <TouchableOpacity
                            style={[styles.syncBtn, isSyncing && { opacity: 0.6 }]}
                            onPress={handleForceSync}
                            disabled={isSyncing}
                        >
                            {isSyncing
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.syncBtnIcon}>☁</Text>
                            }
                            <Text style={styles.syncBtnText}>
                                {isSyncing ? syncMessage || 'Sync...' : 'Sync Cloud'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={fetchInitialData} style={styles.refreshBtn}>
                            <Text style={styles.refreshBtnText}>Actualiser</Text>
                        </TouchableOpacity>
                    </View>
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
                        {renderPhotoPicker(selectedGroupPhoto, setSelectedGroupPhoto, editingGroup?.photo_url)}
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
                            {renderPhotoPicker(selectedMenuPhoto, setSelectedMenuPhoto, editingMenu?.photo_url)}
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}
                                onPress={() => setEditingMenu({...editingMenu, skip_kds: !editingMenu?.skip_kds})}
                                activeOpacity={0.7}
                            >
                                <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: editingMenu?.skip_kds ? '#ef4444' : '#cbd5e1', backgroundColor: editingMenu?.skip_kds ? '#ef4444' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                    {editingMenu?.skip_kds && <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>✓</Text>}
                                </View>
                                <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600', flex: 1 }}>Ne pas envoyer en cuisine (KDS)</Text>
                            </TouchableOpacity>
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
                        {renderPhotoPicker(selectedOptionPhoto, setSelectedOptionPhoto, editingOption?.photo_url)}
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
                                        <Image source={{ uri: menuFormPhoto.uri }} style={styles.terminalImage} resizeMode="contain" />
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

            {/* 🖼️🖼️ MODALE DE RECADRAGE / ZOOM / FOND UNI */}
            <Modal visible={cropModalVisible} transparent animationType="fade" onRequestClose={() => setCropModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.cropModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Recadrer la photo</Text>
                            <TouchableOpacity onPress={() => setCropModalVisible(false)}>
                                <X size={24} color={COLORS.secondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.cropHint}>
                            Glissez l'image pour la déplacer, utilisez les boutons zoom. Le fond sera appliqué aux bords.
                        </Text>

                        {/* Cadre de recadrage */}
                        <View
                            style={[styles.cropFrame, { backgroundColor: cropBgColor, width: CROP_FRAME_WIDTH, height: CROP_FRAME_HEIGHT }]}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={(e: any) => handleDragStart(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                            onResponderMove={(e: any) => handleDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                            onResponderRelease={handleDragEnd}
                            onResponderTerminate={handleDragEnd}
                            // Web drag fallback
                            // @ts-ignore
                            onMouseDown={(e: any) => handleDragStart(e.pageX, e.pageY)}
                            // @ts-ignore
                            onMouseMove={(e: any) => handleDragMove(e.pageX, e.pageY)}
                            // @ts-ignore
                            onMouseUp={handleDragEnd}
                            // @ts-ignore
                            onMouseLeave={handleDragEnd}
                        >
                            {cropSourceUri && (() => {
                                const base = getDisplayedBaseSize();
                                const displayedW = base.w * cropZoom;
                                const displayedH = base.h * cropZoom;
                                return (
                                    <Image
                                        source={{ uri: cropSourceUri }}
                                        style={{
                                            position: 'absolute',
                                            width: displayedW,
                                            height: displayedH,
                                            left: (CROP_FRAME_WIDTH - displayedW) / 2 + cropOffset.x,
                                            top: (CROP_FRAME_HEIGHT - displayedH) / 2 + cropOffset.y,
                                        }}
                                        resizeMode="stretch"
                                    />
                                );
                            })()}
                        </View>

                        {/* Contrôles zoom */}
                        <View style={styles.cropControls}>
                            <TouchableOpacity style={styles.cropZoomBtn} onPress={() => adjustZoom(-0.15)}>
                                <ZoomOut size={18} color={COLORS.secondary} />
                            </TouchableOpacity>
                            <Text style={styles.cropZoomLabel}>{Math.round(cropZoom * 100)}%</Text>
                            <TouchableOpacity style={styles.cropZoomBtn} onPress={() => adjustZoom(0.15)}>
                                <ZoomIn size={18} color={COLORS.secondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cropResetBtn} onPress={resetCrop}>
                                <RefreshCw size={14} color={COLORS.secondary} />
                                <Text style={styles.cropResetText}>Réinitialiser</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Fond uni */}
                        <Text style={styles.cropSectionLabel}>Couleur de fond</Text>
                        <View style={styles.cropBgRow}>
                            {BG_COLOR_PRESETS.map((bg) => (
                                <TouchableOpacity
                                    key={bg.value}
                                    onPress={() => setCropBgColor(bg.value)}
                                    style={[
                                        styles.cropBgSwatch,
                                        { backgroundColor: bg.value },
                                        cropBgColor === bg.value && styles.cropBgSwatchActive,
                                    ]}
                                >
                                    <Text style={[
                                        styles.cropBgSwatchLabel,
                                        { color: bg.value === '#111827' ? '#FFF' : '#111827' }
                                    ]}>
                                        {bg.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Actions */}
                        <View style={styles.cropActions}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { flex: 1, marginRight: 10 }]}
                                onPress={() => setCropModalVisible(false)}
                                disabled={cropIsApplying}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, { marginTop: 0, flex: 1, height: 46 }]}
                                onPress={applyCrop}
                                disabled={cropIsApplying}
                            >
                                {cropIsApplying ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <CheckCircle size={18} color="#FFF" />
                                        <Text style={styles.btnText}>Appliquer</Text>
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
    syncBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10,
        paddingHorizontal: 12, marginTop: 12, gap: 8,
    },
    syncBtnIcon: { color: '#fff', fontSize: 16 },
    syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    syncStatusText: {
        color: COLORS.warning, fontSize: 11, textAlign: 'center',
        marginTop: 6, paddingHorizontal: 4,
    },
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
    listItemPhoto: { width: 60, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
    listItemInfo: { flex: 1 },
    itemTitle: { fontWeight: '700', fontSize: 17, color: COLORS.secondary },
    itemSubTitle: { color: COLORS.muted, fontSize: 14, marginTop: 4 },
    actionButtons: { flexDirection: 'row', alignItems: 'center' },
    
    menuListItem: { backgroundColor: COLORS.card, padding: 18, borderRadius: 16, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: COLORS.primary },
    menuPhoto: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
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
    photoPreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
    photoHintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginTop: 10, marginBottom: 10 },
    photoHintText: { fontSize: 12, color: COLORS.secondary, flex: 1, lineHeight: 16 },
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

    // ======== STYLES MODALE CROP ========
    cropModalContent: {
        backgroundColor: COLORS.card,
        width: '100%',
        maxWidth: 460,
        borderRadius: 20,
        padding: 20,
        elevation: 10,
    },
    cropHint: {
        fontSize: 13,
        color: COLORS.muted,
        marginBottom: 15,
        lineHeight: 18,
    },
    cropFrame: {
        alignSelf: 'center',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: COLORS.primary,
        marginBottom: 15,
        position: 'relative',
        ...(Platform.OS === 'web' ? { cursor: 'grab' as any } : {}),
    },
    cropControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 15,
    },
    cropZoomBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cropZoomLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.secondary,
        minWidth: 50,
        textAlign: 'center',
    },
    cropResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cropResetText: {
        fontSize: 12,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    cropSectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
        marginBottom: 8,
    },
    cropBgRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },
    cropBgSwatch: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cropBgSwatchActive: {
        borderColor: COLORS.primary,
    },
    cropBgSwatchLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    cropActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});