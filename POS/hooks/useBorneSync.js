import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; 

// L'URL du serveur est maintenant dynamique (configurée par l'utilisateur au premier démarrage).
import { getPosUrl, getRestaurantId, loadRestaurantId } from '@/utils/serverConfig';
// Constantes pour la connexion et la cache
// WEBSOCKET_URL est calculé dynamiquement pour utiliser l'IP courante du serveur
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

            // Récupère l'ID restaurant en mémoire, sinon depuis AsyncStorage
            let currentRestaurantId = getRestaurantId();
            if (!currentRestaurantId) currentRestaurantId = await loadRestaurantId();

            if (!accessToken || !currentRestaurantId) {
                console.error("[SYNC ERROR] Token ou ID Restaurant manquant.", { accessToken: !!accessToken, currentRestaurantId });
                return;
            }

            setRestaurantId(currentRestaurantId);
            const headers = { Authorization: `Bearer ${accessToken}` };

            // A. Récupération et Cache des Catégories (GroupMenu)
            const categoriesResponse = await axios.get(
                `${getPosUrl()}/menu/api/getGroupMenuList/${currentRestaurantId}/`, 
                { headers }
            );
            const availableCategories = categoriesResponse.data.filter((category) => category.avalaible);
            console.log(availableCategories);
            setCategories(availableCategories);
            await AsyncStorage.setItem(GROUP_MENU_KEY, JSON.stringify(availableCategories));

            // B. Récupération et Cache des Menus
            const menusResponse = await axios.get(
                `${getPosUrl()}/menu/api/getAllMenu/${currentRestaurantId}/`, 
                { headers }
            );
            setMenus(menusResponse.data);
            await AsyncStorage.setItem(MENU_KEY, JSON.stringify(menusResponse.data));

            console.log('[SYNC] Menus et Catégories rechargés et mis en cache.');

        } catch (error) {
            console.error('[SYNC ERROR] Échec du rechargement des données de menu:', error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- 2. FONCTION DE CHARGEMENT INITIAL (Lecture de la Cache) ---
    const loadDataFromCache = useCallback(async () => {
        setIsLoading(true);
        
        const currentRestaurantId = getRestaurantId();
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
        const socket = new WebSocket(`${getPosUrl().replace(/^http/, 'ws')}/ws/borne/sync/`);
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
    const getStepsForMenu = useCallback(async (menuId, mode = null) => {
        const STEPS_KEY = `@steps_menu_${menuId}_${mode || 'all'}`;
        const accessToken = await AsyncStorage.getItem("token");

        if (!accessToken) return [];

        const headers = { Authorization: `Bearer ${accessToken}` };

        // 1. Vérifie si le drapeau global d'invalidation est levé (mis par le WS)
        const isCacheInvalid = await AsyncStorage.getItem(STEPS_INVALIDATION_FLAG);

        let cachedSteps = null;
        if (isCacheInvalid !== 'true') {
            cachedSteps = await AsyncStorage.getItem(STEPS_KEY);
            if (cachedSteps) {
                console.log(`[STEPS] Étapes pour menu ${menuId} (mode: ${mode}) chargées depuis la cache.`);
                return JSON.parse(cachedSteps);
            }
        }

        // 2. Si la cache est invalide ou manquante, appelle l'API
        try {
            const url = `${getPosUrl()}/menu/api/stepListByMenu/${menuId}/${mode ? `?mode=${mode}` : ''}`;
            console.log(`[STEPS] Récupération via API: ${url}`);
            const response = await axios.get(url, { headers });

            // 3. Met en cache et supprime le drapeau d'invalidation après un succès
            await AsyncStorage.setItem(STEPS_KEY, JSON.stringify(response.data));
            if (isCacheInvalid === 'true') {
                 await AsyncStorage.removeItem(STEPS_INVALIDATION_FLAG);
                 console.log("[STEPS] Drapeau d'invalidation supprimé.");
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