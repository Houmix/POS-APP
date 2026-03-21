// contexts/KioskThemeContext.tsx
// Fournit la personnalisation de l'app caissier (couleurs, logo)

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getPosUrl, getRestaurantId, loadRestaurantId } from '@/utils/serverConfig';

export interface KioskTheme {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    cardBgColor: string;
    textColor: string;
    sidebarColor: string;
    categoryBgColor: string;
    selectedCategoryBgColor: string;
    categoryTextColor: string;
    logoUrl: string | null;
    screensaverVideoUrl: string | null;
    cardStyle: 'gradient' | 'macdo' | 'magazine';
    compositionMode: 'modal' | 'page';
}

const DEFAULT_THEME: KioskTheme = {
    primaryColor: '#0056b3',
    secondaryColor: '#ff69b4',
    backgroundColor: '#F8F9FA',
    cardBgColor: '#ffffff',
    textColor: '#1e293b',
    sidebarColor: '#1e293b',
    categoryBgColor: '#1e293b',
    selectedCategoryBgColor: '#334155',
    categoryTextColor: '#94a3b8',
    logoUrl: null,
    screensaverVideoUrl: null,
    cardStyle: 'gradient',
    compositionMode: 'page',
};

const THEME_CACHE_KEY = 'kiosk_theme_cache';

interface KioskThemeContextValue extends KioskTheme {
    refreshTheme: () => Promise<void>;
}

const KioskThemeContext = createContext<KioskThemeContextValue>({
    ...DEFAULT_THEME,
    refreshTheme: async () => {},
});

export function KioskThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<KioskTheme>(DEFAULT_THEME);

    const fetchTheme = useCallback(async () => {
        let restaurantId = getRestaurantId();
        if (!restaurantId) restaurantId = await loadRestaurantId();
        const cacheKey = restaurantId ? `${THEME_CACHE_KEY}_${restaurantId}` : THEME_CACHE_KEY;

        if (!restaurantId) {
            console.warn('[KioskTheme] restaurant_id non disponible, thème par défaut utilisé');
            return;
        }

        try {
            const response = await axios.get(
                `${getPosUrl()}/api/kiosk/config/?restaurant_id=${restaurantId}`,
                { timeout: 5000 }
            );
            const data = response.data;

            const newTheme: KioskTheme = {
                primaryColor:       data.primary_color       || DEFAULT_THEME.primaryColor,
                secondaryColor:     data.secondary_color     || DEFAULT_THEME.secondaryColor,
                backgroundColor:    data.background_color    || DEFAULT_THEME.backgroundColor,
                cardBgColor:        data.card_bg_color       || DEFAULT_THEME.cardBgColor,
                textColor:          data.text_color          || DEFAULT_THEME.textColor,
                sidebarColor:              data.sidebar_color               || DEFAULT_THEME.sidebarColor,
                categoryBgColor:           data.category_bg_color           || DEFAULT_THEME.categoryBgColor,
                selectedCategoryBgColor:   data.selected_category_bg_color  || DEFAULT_THEME.selectedCategoryBgColor,
                categoryTextColor:         data.category_text_color         || DEFAULT_THEME.categoryTextColor,
                logoUrl:            data.logo_url            || null,
                screensaverVideoUrl:data.screensaver_video_url || null,
                cardStyle:          (data.card_style as 'gradient' | 'macdo' | 'magazine') || 'gradient',
                compositionMode:    (data.composition_mode as 'modal' | 'page') || 'page',
            };
            setTheme(newTheme);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(newTheme));
            console.log('[KioskTheme] ✅ Thème rechargé :', newTheme.primaryColor, newTheme.secondaryColor);
        } catch (err: any) {
            console.warn('[KioskTheme] Erreur fetch :', err?.message || err);
        }
    }, []);

    useEffect(() => {
        async function init() {
            const restaurantId = getRestaurantId();
            const cacheKey = restaurantId ? `${THEME_CACHE_KEY}_${restaurantId}` : THEME_CACHE_KEY;

            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setTheme({ ...DEFAULT_THEME, ...JSON.parse(cached) });
                }
            } catch {}

            await fetchTheme();
        }

        init();

        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') fetchTheme();
        });

        return () => sub.remove();
    }, [fetchTheme]);

    return (
        <KioskThemeContext.Provider value={{ ...theme, refreshTheme: fetchTheme }}>
            {children}
        </KioskThemeContext.Provider>
    );
}

export function useKioskTheme(): KioskThemeContextValue {
    return useContext(KioskThemeContext);
}
