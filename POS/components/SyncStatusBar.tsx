// components/SyncStatusBar.tsx
// ==========================================
// 🔄 Barre de statut Sync/Connexion
// ==========================================
// Affiche un indicateur en bas de l'écran :
//   🟢 Synchronisé        (en ligne, rien en attente)
//   🔄 Synchronisation...  (sync en cours)
//   🟡 3 en attente        (hors ligne, des commandes locales)
//   🔴 Hors ligne          (pas de connexion)
//
// Utilisation :
//   import SyncStatusBar from './components/SyncStatusBar';
//   // Dans votre layout principal :
//   <View style={{ flex: 1 }}>
//       <VotreContenu />
//       <SyncStatusBar />
//   </View>

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSync } from '../hooks/useSync';

export default function SyncStatusBar() {
    const { status, isOnline, isSyncing, pendingCount, syncNow, isElectron } = useSync();

    // Ne rien afficher si on n'est pas dans Electron
    if (!isElectron) return null;

    // Déterminer l'état visuel
    let bgColor = '#4CAF50';  // Vert par défaut
    let icon = '🟢';
    let message = 'Synchronisé';

    if (isSyncing) {
        bgColor = '#2196F3';
        icon = '🔄';
        message = 'Synchronisation...';
    } else if (!isOnline && pendingCount > 0) {
        bgColor = '#FF9800';
        icon = '🟡';
        message = `Hors ligne · ${pendingCount} en attente`;
    } else if (!isOnline) {
        bgColor = '#F44336';
        icon = '🔴';
        message = 'Hors ligne';
    } else if (pendingCount > 0) {
        bgColor = '#FF9800';
        icon = '🟡';
        message = `${pendingCount} en attente d'envoi`;
    }

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: bgColor }]}
            onPress={() => { if (isOnline && !isSyncing) syncNow(); }}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                {isSyncing ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
                ) : (
                    <Text style={styles.icon}>{icon}</Text>
                )}
                <Text style={styles.text}>{message}</Text>

                {status.lastSync && (
                    <Text style={styles.time}>
                        {new Date(status.lastSync).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 12,
        marginRight: 8,
    },
    spinner: {
        marginRight: 8,
    },
    text: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    time: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        marginLeft: 12,
    },
});