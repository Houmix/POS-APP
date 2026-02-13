// hooks/useSync.ts
// ==========================================
// Hook React pour la synchronisation
// ==========================================
// Utilisation :
//   const { status, syncNow, queueChange } = useSync();
//   console.log(status.online, status.pendingCount);

import { useState, useEffect, useCallback, useRef } from 'react';

interface SyncStatus {
    online: boolean;
    syncing: boolean;
    lastSync: string | null;
    pendingCount: number;
    hasBootstrapped: boolean;
    message?: string;
}

const DEFAULT_STATUS: SyncStatus = {
    online: false,
    syncing: false,
    lastSync: null,
    pendingCount: 0,
    hasBootstrapped: false,
};

/**
 * Vérifie si on tourne dans Electron (avec les APIs preload)
 * En dev web pur (navigateur), les APIs n'existent pas
 */
function isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.syncAPI;
}

export function useSync() {
    const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS);
    const listenerSet = useRef(false);

    // Écouter les mises à jour de statut en temps réel
    useEffect(() => {
        if (!isElectron() || listenerSet.current) return;

        // Récupérer le statut initial
        window.syncAPI.getStatus().then(setStatus).catch(() => {});

        // Écouter les changements
        window.syncAPI.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });

        listenerSet.current = true;
    }, []);

    // Forcer une sync manuelle
    const syncNow = useCallback(async () => {
        if (!isElectron()) return null;
        return window.syncAPI.syncNow();
    }, []);

    // Enregistrer un changement local
    const queueChange = useCallback(
        async (table: string, action: 'create' | 'update' | 'delete', data: Record<string, any>) => {
            if (!isElectron()) return null;
            return window.syncAPI.queueChange(table, action, data);
        },
        []
    );

    // Forcer le bootstrap (1ère sync)
    const bootstrap = useCallback(async () => {
        if (!isElectron()) return false;
        return window.syncAPI.bootstrap();
    }, []);

    return {
        status,
        isOnline: status.online,
        isSyncing: status.syncing,
        pendingCount: status.pendingCount,
        syncNow,
        queueChange,
        bootstrap,
        isElectron: isElectron(),
    };
}