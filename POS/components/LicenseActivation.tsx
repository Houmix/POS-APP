// components/LicenseActivation.tsx
// ==========================================
// 🔑 Écran d'activation de licence
// ==========================================
// Affiche un formulaire de saisie de clé de licence.
// À utiliser comme écran principal si aucune licence n'est active.
//
// Utilisation :
//   import LicenseActivation from './components/LicenseActivation';
//
//   // Dans votre navigation / App.tsx :
//   const { isValid, loading } = useLicense();
//
//   if (loading) return <SplashScreen />;
//   if (!isValid) return <LicenseActivation onActivated={() => { /* recharger */ }} />;
//   return <MainApp />;
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLicense } from '../hooks/useLicense';

interface Props {
    onActivated?: () => void;
}

export default function LicenseActivation({ onActivated }: Props) {
    const { activate, status } = useLicense();

    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Formatage auto de la clé : CLICKGO-XXXX-XXXX-XXXX
    const formatKey = (input: string) => {
        // Retirer tout sauf lettres et chiffres
        const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Ajouter le préfixe CLICKGO si pas déjà là
        let formatted = '';
        if (clean.startsWith('CLICKGO')) {
            const rest = clean.substring(7); // CLICKGO = 7 caractères
            formatted = 'CLICKGO';
            for (let i = 0; i < rest.length && i < 12; i++) {
                if (i % 4 === 0) formatted += '-';
                formatted += rest[i];
            }
        } else {
            // Pas de préfixe — juste formater par blocs de 4
            for (let i = 0; i < clean.length && i < 17; i++) {
                if (i > 0 && i % 4 === 0) formatted += '-';
                formatted += clean[i];
            }
        }

        return formatted;
    };

    const handleActivate = async () => {
        if (!key.trim()) {
            setError('Veuillez entrer une clé de licence');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await activate(key.trim());

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onActivated?.();
                }, 1500);
            } else {
                setError(result.message || 'Activation échouée');
            }
        } catch (err: any) {
            setError(err.message || 'Erreur inattendue');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.successIcon}>✅</Text>
                    <Text style={styles.successTitle}>Licence activée !</Text>
                    <Text style={styles.successSub}>Démarrage de l'application...</Text>
                    <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.card}>
                {/* Logo / Titre */}
                <Text style={styles.logo}>🍔</Text>
                <Text style={styles.title}>Do-Eat</Text>
                <Text style={styles.subtitle}>Activez votre borne de commande</Text>

                {/* Champ clé */}
                <Text style={styles.label}>Clé de licence</Text>
                <TextInput
                    style={[styles.input, error ? styles.inputError : null]}
                    value={key}
                    onChangeText={(text) => {
                        setKey(formatKey(text));
                        setError('');
                    }}
                    placeholder="CLICKGO-XXXX-XXXX-XXXX"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={22}
                    editable={!loading}
                />

                {/* Erreur */}
                {error ? <Text style={styles.error}>{error}</Text> : null}

                {/* Bouton */}
                <TouchableOpacity
                    style={[styles.button, loading ? styles.buttonDisabled : null]}
                    onPress={handleActivate}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Activer la licence</Text>
                    )}
                </TouchableOpacity>

                {/* Machine ID (pour le support) */}
                <Text style={styles.machineId}>
                    ID Machine : {status.machineId || '...'}
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        width: 420,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    logo: {
        fontSize: 48,
        marginBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a2e',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        marginBottom: 32,
    },
    label: {
        alignSelf: 'flex-start',
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    input: {
        width: '100%',
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 18,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 1.5,
        textAlign: 'center',
        color: '#333',
        backgroundColor: '#f9f9f9',
    },
    inputError: {
        borderColor: '#F44336',
        backgroundColor: '#FFF5F5',
    },
    error: {
        color: '#F44336',
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
    },
    button: {
        width: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    buttonDisabled: {
        backgroundColor: '#A5D6A7',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    machineId: {
        fontSize: 10,
        color: '#bbb',
        marginTop: 24,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    successIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#4CAF50',
    },
    successSub: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
});