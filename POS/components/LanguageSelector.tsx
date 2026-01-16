// components/LanguageSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

const LANGUAGES = [
  { code: 'fr' as const, name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'en' as const, name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'ar' as const, name: 'Arabic', flag: '🇩🇿', nativeName: 'العربية' },
];

interface LanguageSelectorProps {
  variant?: 'full' | 'compact' | 'flags-only' | 'modal';
  onSelect?: () => void;
  visible?: boolean;
  onClose?: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  variant = 'full',
  onSelect,
  visible = true,
  onClose
}) => {
  const { language, setLanguage } = useLanguage();

  const handleSelect = async (code: 'fr' | 'en' | 'ar') => {
    await setLanguage(code);
    onSelect?.();
  };

  // Variant Modal (pour la borne)
  if (variant === 'modal') {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Choisir la langue / Choose language / اختر اللغة
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.languageList}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.modalLanguageButton,
                    language === lang.code && styles.modalLanguageButtonActive
                  ]}
                  onPress={() => handleSelect(lang.code)}
                >
                  <Text style={styles.modalFlag}>{lang.flag}</Text>
                  <View style={styles.modalLanguageInfo}>
                    <Text style={[
                      styles.modalLanguageName,
                      language === lang.code && styles.modalLanguageNameActive
                    ]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={styles.modalLanguageSubname}>
                      {lang.name}
                    </Text>
                  </View>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={32} color="#ff9900" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // Variant Flags only (pour le header)
  if (variant === 'flags-only') {
    return (
      <View style={styles.flagsContainer}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.flagButton,
              language === lang.code && styles.flagButtonActive
            ]}
            onPress={() => handleSelect(lang.code)}
          >
            <Text style={styles.flagEmoji}>{lang.flag}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Variant Compact
  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.compactButton,
              language === lang.code && styles.compactButtonActive
            ]}
            onPress={() => handleSelect(lang.code)}
          >
            <Text style={styles.compactFlag}>{lang.flag}</Text>
            <Text style={[
              styles.compactText,
              language === lang.code && styles.compactTextActive
            ]}>
              {lang.code.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Variant Full (par défaut)
  return (
    <View style={styles.fullContainer}>
      <Text style={styles.fullTitle}>Langue / Language / اللغة</Text>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[
            styles.fullButton,
            language === lang.code && styles.fullButtonActive
          ]}
          onPress={() => handleSelect(lang.code)}
        >
          <Text style={styles.fullFlag}>{lang.flag}</Text>
          <Text style={[
            styles.fullText,
            language === lang.code && styles.fullTextActive
          ]}>
            {lang.nativeName}
          </Text>
          {language === lang.code && (
            <Ionicons name="checkmark-circle" size={24} color="#ff9900" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // Modal variant (pour la borne)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 30,
    width: '70%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  languageList: {
    gap: 15,
  },
  modalLanguageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  modalLanguageButtonActive: {
    backgroundColor: '#fff9f5',
    borderColor: '#ff9900',
  },
  modalFlag: {
    fontSize: 48,
    marginRight: 20,
  },
  modalLanguageInfo: {
    flex: 1,
  },
  modalLanguageName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  modalLanguageNameActive: {
    color: '#ff9900',
  },
  modalLanguageSubname: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },

  // Flags only variant
  flagsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  flagButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  flagButtonActive: {
    borderColor: '#ff9900',
    backgroundColor: '#fff9f5',
  },
  flagEmoji: {
    fontSize: 32,
  },

  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  compactButtonActive: {
    borderColor: '#ff9900',
    backgroundColor: '#fff9f5',
  },
  compactFlag: {
    fontSize: 20,
  },
  compactText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  compactTextActive: {
    color: '#ff9900',
    fontWeight: '700',
  },

  // Full variant
  fullContainer: {
    padding: 20,
  },
  fullTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fullButtonActive: {
    borderColor: '#ff9900',
    backgroundColor: '#fff9f5',
  },
  fullFlag: {
    fontSize: 32,
    marginRight: 15,
  },
  fullText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  fullTextActive: {
    color: '#ff9900',
    fontWeight: '700',
  },
});