// components/LanguageSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

const LANGUAGES = [
  { code: 'fr' as const, flag: '🇫🇷' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'ar' as const, flag: '🇸🇦' },
];

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[
            styles.button,
            language === lang.code && styles.buttonActive
          ]}
          onPress={() => setLanguage(lang.code)}
        >
          <Text style={styles.flag}>{lang.flag}</Text>
          {language === lang.code && <View style={styles.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)', // Fond translucide pour s'intégrer au header
    borderRadius: 15,
    padding: 5,
    gap: 10,
  },
  button: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonActive: {
    backgroundColor: 'white', // Met en avant la langue choisie
    elevation: 3,
  },
  flag: {
    fontSize: 28,
  },
  indicator: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B00',
  }
});