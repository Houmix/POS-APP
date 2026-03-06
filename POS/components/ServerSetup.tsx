// components/ServerSetup.tsx
// ==========================================
// Écran de configuration de l'adresse du serveur caisse
// ==========================================
// Affiché au premier démarrage ou si le serveur est injoignable.
// Permet de :
//  - Entrer manuellement l'IP de la caisse
//  - Lancer un scan automatique du réseau local

import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { scanNetwork, saveServerUrl, testServerUrl, ScanResult } from '../utils/serverConfig';

interface Props {
    onConfigured: (url: string) => void;
}

export default function ServerSetup({ onConfigured }: Props) {
    const [manualIp, setManualIp] = useState('');
    const [scanning, setScanning] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [found, setFound] = useState<ScanResult | null>(null);

    const handleScan = async () => {
        setScanning(true);
        setError('');
        setFound(null);
        setProgress(0);

        const result = await scanNetwork((scanned, tot) => {
            setProgress(scanned);
            setTotal(tot);
        });

        setScanning(false);

        if (result) {
            setFound(result);
            setManualIp(result.ip);
        } else {
            setError('Aucun serveur trouvé. Entrez l\'IP manuellement.');
        }
    };

    const handleConnect = async () => {
        const ip = manualIp.trim();
        if (!ip) {
            setError('Entrez une adresse IP');
            return;
        }

        const url = ip.startsWith('http') ? ip : `http://${ip}:8000`;
        setConnecting(true);
        setError('');

        const ok = await testServerUrl(url);
        setConnecting(false);

        if (ok) {
            await saveServerUrl(url);
            onConfigured(url);
        } else {
            setError(`Impossible de joindre ${url}\nVérifiez que la caisse est allumée et connectée au même réseau.`);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.logo}>📡</Text>
                <Text style={styles.title}>Configuration serveur</Text>
                <Text style={styles.subtitle}>
                    La borne doit se connecter au serveur de la caisse.
                </Text>

                {/* Scan automatique */}
                <TouchableOpacity
                    style={[styles.scanButton, scanning && styles.buttonDisabled]}
                    onPress={handleScan}
                    disabled={scanning || connecting}
                >
                    {scanning ? (
                        <View style={styles.row}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.scanButtonText}>
                                {total > 0
                                    ? `  Scan... ${Math.round((progress / total) * 100)}%`
                                    : '  Scan en cours...'}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.scanButtonText}>Détecter automatiquement</Text>
                    )}
                </TouchableOpacity>

                {found && (
                    <View style={styles.foundBox}>
                        <Text style={styles.foundText}>
                            Serveur trouvé : {found.ip}
                            {found.serverInfo?.host ? ` (${found.serverInfo.host})` : ''}
                        </Text>
                    </View>
                )}

                <Text style={styles.orLabel}>— ou entrer manuellement —</Text>

                <Text style={styles.label}>Adresse IP de la caisse</Text>
                <TextInput
                    style={[styles.input, error ? styles.inputError : null]}
                    value={manualIp}
                    onChangeText={text => {
                        setManualIp(text);
                        setError('');
                    }}
                    placeholder="ex: 192.168.1.100"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    autoCorrect={false}
                    editable={!scanning && !connecting}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.connectButton, (connecting || scanning) && styles.buttonDisabled]}
                    onPress={handleConnect}
                    disabled={connecting || scanning}
                >
                    {connecting ? (
                        <View style={styles.row}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.connectButtonText}>  Connexion...</Text>
                        </View>
                    ) : (
                        <Text style={styles.connectButtonText}>Se connecter</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.hint}>
                    L'adresse IP s'affiche sur l'écran de la caisse au démarrage.
                </Text>
            </View>
        </View>
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
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    logo: { fontSize: 48, marginBottom: 8 },
    title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center' },
    scanButton: {
        width: '100%',
        backgroundColor: '#756fbf',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    scanButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    foundBox: {
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        width: '100%',
    },
    foundText: { color: '#2e7d32', fontSize: 13, textAlign: 'center', fontWeight: '600' },
    orLabel: { color: '#aaa', fontSize: 12, marginVertical: 12 },
    label: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
    input: {
        width: '100%',
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: '#333',
        backgroundColor: '#f9f9f9',
    },
    inputError: { borderColor: '#F44336', backgroundColor: '#FFF5F5' },
    error: { color: '#F44336', fontSize: 12, marginTop: 8, textAlign: 'center' },
    connectButton: {
        width: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    buttonDisabled: { opacity: 0.6 },
    hint: { fontSize: 11, color: '#bbb', marginTop: 20, textAlign: 'center' },
});
