// utils/serverConfig.ts
// ==========================================
// Gestion dynamique de l'URL du serveur caisse
// ==========================================
// L'URL est sauvegardée dans AsyncStorage et chargée au démarrage.
// La borne peut scanner le réseau local pour trouver automatiquement la caisse.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SERVER_URL_KEY = 'pos_server_url';
export const RESTAURANT_ID_KEY = 'pos_restaurant_id';
export const DEFAULT_PORT = 8000;
const DISCOVER_PATH = '/api/sync/discover/';
const SCAN_TIMEOUT_MS = 1500;

// URL et restaurant_id courants (mutables, chargés depuis AsyncStorage au démarrage)
let _currentUrl = 'http://127.0.0.1:8000';
let _currentRestaurantId: string | null = null;

export function getPosUrl(): string {
    return _currentUrl;
}

export function setPosUrlInMemory(url: string) {
    _currentUrl = url;
}

export async function loadServerUrl(): Promise<string> {
    try {
        const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
        if (saved) {
            _currentUrl = saved;
        }
    } catch {}
    return _currentUrl;
}

export async function saveServerUrl(url: string): Promise<void> {
    const normalized = url.replace(/\/$/, ''); // enlever slash final
    _currentUrl = normalized;
    await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
}

export async function clearServerUrl(): Promise<void> {
    _currentUrl = 'http://127.0.0.1:8000';
    await AsyncStorage.removeItem(SERVER_URL_KEY);
}

export async function hasSavedServerUrl(): Promise<boolean> {
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    return !!saved;
}

export function getRestaurantId(): string | null {
    return _currentRestaurantId;
}

export async function saveRestaurantId(id: string): Promise<void> {
    _currentRestaurantId = id;
    await AsyncStorage.setItem(RESTAURANT_ID_KEY, id);
}

export async function loadRestaurantId(): Promise<string | null> {
    try {
        const saved = await AsyncStorage.getItem(RESTAURANT_ID_KEY);
        if (saved) _currentRestaurantId = saved;
    } catch {}
    return _currentRestaurantId;
}

// ──────────────────────────────────────────────
//  VÉRIFICATION DE CONNECTIVITÉ
// ──────────────────────────────────────────────
export async function testServerUrl(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
        const response = await fetch(`${url}${DISCOVER_PATH}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.ok;
    } catch {
        return false;
    }
}

// ──────────────────────────────────────────────
//  SCAN RÉSEAU LOCAL
// ──────────────────────────────────────────────
// Teste des plages d'IP communes pour trouver la caisse.
// Retourne l'URL du premier serveur trouvé, ou null.

export interface ScanResult {
    url: string;
    ip: string;
    serverInfo?: { host?: string; version?: string };
}

async function testIp(ip: string): Promise<ScanResult | null> {
    const url = `http://${ip}:${DEFAULT_PORT}`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
        const response = await fetch(`${url}${DISCOVER_PATH}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
            const data = await response.json();
            if (data.server === 'caisse') {
                return { url, ip, serverInfo: data };
            }
        }
    } catch {}
    return null;
}

export async function scanNetwork(
    onProgress?: (scanned: number, total: number) => void
): Promise<ScanResult | null> {
    // Plages à scanner en priorité (subnets les plus courants)
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '10.0.1', '192.168.100'];
    // IPs prioritaires (routeurs/serveurs fréquents)
    const priorityLastOctets = [1, 2, 100, 101, 50, 200, 254, 10, 20, 30, 40];

    const allIps: string[] = [];

    for (const subnet of subnets) {
        // IPs prioritaires d'abord
        for (const last of priorityLastOctets) {
            allIps.push(`${subnet}.${last}`);
        }
        // Puis toute la plage
        for (let i = 1; i <= 254; i++) {
            if (!priorityLastOctets.includes(i)) {
                allIps.push(`${subnet}.${i}`);
            }
        }
    }

    const total = allIps.length;
    let scanned = 0;
    const BATCH_SIZE = 30;

    for (let i = 0; i < allIps.length; i += BATCH_SIZE) {
        const batch = allIps.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(ip => testIp(ip)));
        scanned += batch.length;
        onProgress?.(scanned, total);

        const found = results.find(r => r !== null);
        if (found) return found;
    }

    return null;
}
