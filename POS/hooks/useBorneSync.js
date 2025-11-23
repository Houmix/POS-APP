import { useState, useEffect, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; 

// Ces deux variables doivent être définies dans votre fichier de configuration (`@/config`).
// Assurez-vous que POS_URL utilise l'IP locale de votre serveur Django (ex: http://192.168.1.5:8000).
import { POS_URL, idRestaurant} from '@/config';
// Constantes pour la connexion et la cache
const WEBSOCKET_URL = `${POS_URL}/ws/borne/sync/`; // S'assure que le chemin est cohérent avec le routing Django
const GROUP_MENU_KEY = 'GroupMenu';
const MENU_KEY = 'Menu';
const STEPS_INVALIDATION_FLAG = 'steps_cache_invalidated'; // Drapeaux pour la cache des étapes

export function useBorneSync() {
    const [categories, setCategories] = useState([]);
    const [menus, setMenus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ws, setWs] = useState(null);
    const [restaurantId, setRestaurantId] = useState(null); 

    // --- 1. FONCTION DE CHARGEMENT ET MISE EN CACHE COMPLÈTE (Menus & Catégories) ---
    const fetchAndCacheAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const accessToken = await AsyncStorage.getItem("token");
            const currentRestaurantId = idRestaurant;
            
            if (!accessToken || !currentRestaurantId) {
                console.log("Missing token or restaurant ID:");
                console.log(accessToken);
                console.log(currentRestaurantId);
                console.error("[SYNC ERROR] Token ou ID Restaurant manquant.");
                Alert.alert("Erreur d'authentification", "Veuillez vous reconnecter pour synchroniser les données.");
                return;
            }
            
            setRestaurantId(currentRestaurantId);
            const headers = { Authorization: `Bearer ${accessToken}` };

            // A. Récupération et Cache des Catégories (GroupMenu)
            const categoriesResponse = await axios.get(
                `${POS_URL}/menu/api/getGroupMenuList/${currentRestaurantId}/`, 
                { headers }
            );
            const availableCategories = categoriesResponse.data.filter((category) => category.avalaible);
            console.log(availableCategories);
            setCategories(availableCategories);
            await AsyncStorage.setItem(GROUP_MENU_KEY, JSON.stringify(availableCategories));

            // B. Récupération et Cache des Menus
            const menusResponse = await axios.get(
                `${POS_URL}/menu/api/getAllMenu/${currentRestaurantId}/`, 
                { headers }
            );
            setMenus(menusResponse.data);
            await AsyncStorage.setItem(MENU_KEY, JSON.stringify(menusResponse.data));

            console.log('[SYNC] Menus et Catégories rechargés et mis en cache.');

        } catch (error) {
            console.error('[SYNC ERROR] Échec du rechargement des données de menu:', error.message);
            Alert.alert("Erreur de Synchro", "Échec du rechargement des données de menu.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- 2. FONCTION DE CHARGEMENT INITIAL (Lecture de la Cache) ---
    const loadDataFromCache = useCallback(async () => {
        setIsLoading(true);
        
        const currentRestaurantId = await AsyncStorage.getItem(idRestaurantKey);
        if (currentRestaurantId) {
            setRestaurantId(currentRestaurantId);
        }

        const cachedCategories = await AsyncStorage.getItem(GROUP_MENU_KEY);
        const cachedMenus = await AsyncStorage.getItem(MENU_KEY);

        if (cachedCategories && cachedMenus) {
            setCategories(JSON.parse(cachedCategories));
            setMenus(JSON.parse(cachedMenus));
            console.log('[CACHE] Données chargées depuis la cache locale (Affichage immédiat).');
        }
        
        // Déclenche toujours une synchronisation API après l'affichage de la cache
        // pour s'assurer que les données sont les plus fraîches.
        await fetchAndCacheAllData(); 
    }, [fetchAndCacheAllData]);
    
    // --- 3. GESTION DE LA CONNEXION WEBSOCKET ET DES ALERTES ---
    const connectWebSocket = useCallback(() => {
        const socket = new WebSocket(WEBSOCKET_URL);
        setWs(socket);

        socket.onopen = () => console.log('[WS] Connecté à Django Channels.');

        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'sync_message' && data.data.status === 'full_sync_required') {
                console.log(`[WS ALERT] Alerte de mise à jour reçue. Rechargement déclenché.`);
                
                // A. Déclenche la mise à jour des menus/catégories
                fetchAndCacheAllData(); 
                
                // B. Marque la cache des étapes comme invalide
                AsyncStorage.setItem(STEPS_INVALIDATION_FLAG, 'true'); 
                console.log('[WS ALERT] Cache des étapes marquée comme invalide, sera rechargée au prochain clic.');
            }
        };

        socket.onclose = () => {
            console.warn('[WS] Déconnecté. Tentative de reconnexion dans 5s...');
            setTimeout(connectWebSocket, 5000); 
        };

        socket.onerror = (e) => {
            console.error('[WS ERROR] Erreur WebSocket:', e.message);
            socket.close(); 
        };

        return socket;
    }, [fetchAndCacheAllData]);
    
    // --- 4. FONCTION POUR LA GESTION DES ÉTAPES (Cache-Aside avec Invalidation) ---
    const getStepsForMenu = useCallback(async (menuId) => {
        const STEPS_KEY = `@steps_menu_${menuId}`;
        const accessToken = await AsyncStorage.getItem("token");

        if (!accessToken) return [];

        const headers = { Authorization: `Bearer ${accessToken}` };
        
        // 1. Vérifie si le drapeau global d'invalidation est levé (mis par le WS)
        const isCacheInvalid = await AsyncStorage.getItem(STEPS_INVALIDATION_FLAG);
        
        let cachedSteps = null;
        if (isCacheInvalid !== 'true') {
            // Tente de lire la cache locale de ce menu s'il n'y a pas eu d'alerte globale
            cachedSteps = await AsyncStorage.getItem(STEPS_KEY);
            if (cachedSteps) {
                console.log(`[STEPS] Étapes pour menu ${menuId} chargées depuis la cache.`);
                return JSON.parse(cachedSteps);
            }
        }
        
        // 2. Si la cache est invalide ou manquante, appelle l'API
        try {
            console.log(`[STEPS] Récupération des étapes pour menu ${menuId} via API.`);
            const response = await axios.get(`${POS_URL}/menu/api/stepListByMenu/${menuId}/`, { headers });
            
            // 3. Met en cache et supprime le drapeau d'invalidation après un succès (si présent)
            await AsyncStorage.setItem(STEPS_KEY, JSON.stringify(response.data));
            if (isCacheInvalid === 'true') {
                 await AsyncStorage.removeItem(STEPS_INVALIDATION_FLAG);
                 console.log("[STEPS] Drapeau d'invalidation levé pour la prochaine étape.");
            }

            return response.data;
            
        } catch (error) {
            console.error(`Erreur lors de la récupération des étapes pour menu ${menuId}:`, error);
            // Si l'API échoue, on retourne un tableau vide pour ne pas bloquer l'UI
            return [];
        }
    }, []);


    // --- 5. EFFET PRINCIPAL (Démarrage) ---
    useEffect(() => {
        loadDataFromCache(); 

        let currentWs = connectWebSocket(); 

        // Gérer le retour en premier plan de l'application
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && (!currentWs || currentWs.readyState === WebSocket.CLOSED)) {
                console.log('[APP STATE] App active, reconnexion WS...');
                currentWs = connectWebSocket();
            }
        });

        // Cleanup
        return () => {
            subscription.remove();
            currentWs?.close();
        };
    }, [loadDataFromCache, connectWebSocket]);

    // Rendre les données et les fonctions disponibles pour les composants
    return { 
        categories, 
        menus, 
        isLoading, 
        fetchAndCacheAllData, 
        getStepsForMenu, 
        restaurantId,
        // Laissons le token à récupérer par AsyncStorage dans le composant au besoin
    };
}