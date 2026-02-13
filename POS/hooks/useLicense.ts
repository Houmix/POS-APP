// hooks/useLicense.ts
// ==========================================
// Hook React pour la gestion de licence
// ==========================================
// Utilisation :
//   const { status, activate, isValid } = useLicense();

import { useState, useEffect, useCallback, useRef } from 'react';

interface LicenseStatus {
    activated: boolean;
    valid: boolean;
    key?: string;
    status?: string;
    restaurantId?: number;
    restaurantName?: string;
    plan?: string;
    features?: string[];
    expiresAt?: string | null;
    lastOnlineCheck?: string;
    machineId: string;
    offlineGraceDaysLeft?: number;
}

const DEFAULT_STATUS: LicenseStatus = {
    activated: false,
    valid: false,
    machineId: '',
};

function isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.licenseAPI;
}

export function useLicense() {
    const [status, setStatus] = useState<LicenseStatus>(DEFAULT_STATUS);
    const [loading, setLoading] = useState(true);
    const listenerSet = useRef(false);
    console.log('useLicense initialized, isElectron:', isElectron());
    console.log('Current license status:', status);
    useEffect(() => {
        if (!isElectron() || listenerSet.current) return;

        // Statut initial
        window.licenseAPI.getStatus()
            .then(setStatus)
            .catch(() => {})
            .finally(() => setLoading(false));

        // Écouter les changements
        window.licenseAPI.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });

        listenerSet.current = true;
    }, []);

    const activate = useCallback(async (licenseKey: string) => {
        if (!isElectron()) return { success: false, message: 'Pas dans Electron' };
        setLoading(true);
        try {
            const result = await window.licenseAPI.activate(licenseKey);
            if (result.success && result.license) {
                setStatus(result.license);
            }
            return result;
        } finally {
            setLoading(false);
        }
    }, []);

    const deactivate = useCallback(async () => {
        if (!isElectron()) return { success: false };
        const result = await window.licenseAPI.deactivate();
        if (result.success) {
            setStatus(DEFAULT_STATUS);
        }
        return result;
    }, []);

    const verify = useCallback(async () => {
        if (!isElectron()) return { valid: false };
        return window.licenseAPI.verify();
    }, []);

    return {
        status,
        loading,
        isValid: status.valid,
        isActivated: status.activated,
        restaurantName: status.restaurantName,
        plan: status.plan,
        activate,
        deactivate,
        verify,
        isElectron: isElectron(),
    };
}