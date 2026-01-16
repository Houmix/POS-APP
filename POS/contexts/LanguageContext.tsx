// contexts/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '@/constants/translations';
import { I18nManager } from 'react-native';

type Language = 'fr' | 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('fr');
  const [isInitialized, setIsInitialized] = useState(false);

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedLanguage');
      if (saved && (saved === 'fr' || saved === 'en' || saved === 'ar')) {
        setLanguageState(saved as Language);
        // Configure RTL si nécessaire
        if (saved === 'ar' && !I18nManager.isRTL) {
          // Note: Le changement de RTL nécessite un redémarrage de l'app
          // I18nManager.forceRTL(true);
        }
      }
    } catch (error) {
      console.error('Erreur chargement langue:', error);
    } finally {
      setIsInitialized(true);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('selectedLanguage', lang);
      setLanguageState(lang);
      
      // Gestion du RTL pour l'arabe
      const shouldBeRTL = lang === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        // Note: Pour activer vraiment le RTL, il faut redémarrer l'app
        // I18nManager.forceRTL(shouldBeRTL);
        // Vous pouvez afficher un message demandant de redémarrer
        console.log(`RTL change needed. Current: ${I18nManager.isRTL}, Required: ${shouldBeRTL}`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde langue:', error);
    }
  };

  // Fonction de traduction avec navigation dans l'objet et fallback
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    // Navigation dans l'objet de traduction
    for (const k of keys) {
      value = value?.[k];
    }
    
    // Si la traduction n'existe pas, fallback vers français puis la clé
    if (value === undefined || value === null) {
      console.warn(`Traduction manquante: ${key} pour ${language}`);
      
      // Essayer avec le français
      let fallback: any = translations.fr;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      
      return fallback || key;
    }
    
    return String(value);
  };

  const isRTL = language === 'ar';

  // Attendre l'initialisation avant de rendre
  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};