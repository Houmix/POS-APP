// types/electron.d.ts
// ==========================================
// Déclarations TypeScript pour les APIs Electron (preload)
// ==========================================
// Placez ce fichier dans votre projet React Native :
//   pos/types/electron.d.ts
//
// Puis vérifiez que votre tsconfig.json inclut ce dossier :
//   "include": ["src", "types", "**/*.ts", "**/*.tsx"]

interface SyncStatus {
    online: boolean;
    syncing: boolean;
    lastSync: string | null;
    pendingCount: number;
    hasBootstrapped: boolean;
    message?: string;
}

interface SyncResult {
    pushed?: number;
    pulled?: number;
    errors?: string[];
    skipped?: boolean;
    offline?: boolean;
    bootstrapped?: boolean;
}

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

interface LicenseActivateResult {
    success: boolean;
    message?: string;
    license?: LicenseStatus;
}

interface PrintResult {
    success: boolean;
    details?: Array<{ printer: string; status: string; method?: string; error?: string }>;
    error?: string;
}

interface SyncAPI {
    syncNow: () => Promise<SyncResult>;
    bootstrap: () => Promise<boolean>;
    getStatus: () => Promise<SyncStatus>;
    queueChange: (table: string, action: 'create' | 'update' | 'delete', data: Record<string, any>) => Promise<string>;
    onStatusChange: (callback: (status: SyncStatus) => void) => void;
}

interface LicenseAPI {
    activate: (licenseKey: string) => Promise<LicenseActivateResult>;
    deactivate: () => Promise<{ success: boolean; message?: string }>;
    getStatus: () => Promise<LicenseStatus>;
    verify: () => Promise<{ valid: boolean; reason?: string; offline?: boolean; graceDaysLeft?: number }>;
    onStatusChange: (callback: (status: LicenseStatus) => void) => void;
}

interface PrinterAPI {
    printTicket: (ticketText: string) => Promise<PrintResult>;
}

// Étendre l'objet Window global
declare global {
    interface Window {
        syncAPI: SyncAPI;
        licenseAPI: LicenseAPI;
        printerAPI: PrinterAPI;
    }
}

export {};