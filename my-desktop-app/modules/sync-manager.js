// ==========================================
// 🔄 SYNC MANAGER - Adapté à vos modèles Do-Eat
// modules/sync-manager.js
// ==========================================

const { ipcMain, BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

class SyncManager {
    constructor(options = {}) {
        // ⚙️ Configuration
        this.serverUrl = options.serverUrl || 'http://127.0.0.1:8000';// METTRE CLICKGO
        this.localApiUrl = options.localApiUrl || 'http://127.0.0.1:8000';
        this.syncInterval = options.syncInterval || 30000;
        this.connectivityCheckInterval = options.connectivityCheckInterval || 10000;

        // Identité de la borne (défini après activation licence)
        this.restaurantId = options.restaurantId || null;
        this.terminalUuid = options.terminalUuid || null;
        this.authToken = options.authToken || null;

        // 📊 État
        this.isOnline = false;
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.hasBootstrapped = false;     // true après le 1er snapshot
        this.pendingChanges = [];
        this._localDbChecked = false;     // check BDD locale vide (une seule fois au démarrage)

        // Chemins de persistance
        const userDataPath = require('electron').app.getPath('userData');
        this.pendingChangesPath = path.join(userDataPath, 'pending-sync.json');
        this.syncMetaPath = path.join(userDataPath, 'sync-meta.json');

        // Timers
        this._connectivityTimer = null;
        this._syncTimer = null;

        // Charger l'état persisté
        this._loadPendingChanges();
        this._loadSyncMeta();
    }

    // ==========================================
    //  1. CONNECTIVITÉ
    // ==========================================

    async checkConnectivity() {
        try {
            const hostname = new URL(this.serverUrl).hostname;
            await new Promise((resolve, reject) => {
                dns.resolve(hostname, (err) => err ? reject(err) : resolve());
            });

            const response = await this._httpRequest('GET', '/api/sync/health/');
            const wasOffline = !this.isOnline;
            this.isOnline = response.statusCode === 200;

            if (wasOffline && this.isOnline) {
                this._log('Connexion rétablie !', 'success');
                this._notifyRenderer('sync-status', { online: true, message: 'Connexion rétablie' });
                this.syncNow();
            } else if (this.isOnline && this.hasBootstrapped && !this._localDbChecked) {
                // Vérifier UNE SEULE FOIS au démarrage si la BDD locale est vide
                this._localDbChecked = true;
                const isEmpty = await this._isLocalDbEmpty();
                if (isEmpty) {
                    this._log('BDD locale vide détectée → re-bootstrap automatique', 'warning');
                    this.hasBootstrapped = false;
                    this._saveSyncMeta();
                    this.syncNow();
                }
            }
            return this.isOnline;
        } catch (err) {
            if (this.isOnline) {
                this._log('Connexion perdue.', 'warning');
                this._notifyRenderer('sync-status', { online: false, message: 'Hors ligne' });
            }
            this.isOnline = false;
            return false;
        }
    }

    // ==========================================
    //  2. BOOTSTRAP (1ère sync = snapshot complet)
    // ==========================================

    async bootstrap() {
        if (!this.isOnline || !this.restaurantId) return false;

        this._log('Bootstrap : téléchargement du catalogue complet...', 'info');
        this._notifyRenderer('sync-status', { syncing: true, message: 'Téléchargement initial...' });

        try {
            // 1. Récupérer le snapshot du serveur distant
            const response = await this._httpRequest('GET',
                `/api/sync/snapshot/?restaurant_id=${this.restaurantId}`
            );

            if (response.statusCode !== 200) {
                throw new Error(`Snapshot échoué: HTTP ${response.statusCode}`);
            }

            const snapshot = JSON.parse(response.body);

            if (!snapshot.success) {
                throw new Error(snapshot.error || 'Snapshot invalide');
            }

            // 2. Envoyer au Django LOCAL pour qu'il peuple sa BDD
            const localResponse = await this._httpRequestRaw(
                `${this.localApiUrl}/api/sync/apply-snapshot/`, 'POST', snapshot
            );

            if (localResponse.statusCode !== 200) {
                throw new Error(`Application locale échouée: HTTP ${localResponse.statusCode}`);
            }

            const localResult = JSON.parse(localResponse.body);
            this._log(`Bootstrap terminé : ${JSON.stringify(localResult.applied)}`, 'success');

            this.hasBootstrapped = true;
            this.lastSyncTime = snapshot.server_timestamp;
            this._saveSyncMeta();

            this._notifyRenderer('sync-status', {
                syncing: false, online: true,
                message: 'Catalogue synchronisé'
            });

            return true;

        } catch (err) {
            this._log(`Erreur bootstrap: ${err.message}`, 'error');
            this._notifyRenderer('sync-status', {
                syncing: false, online: this.isOnline,
                message: `Erreur sync initiale: ${err.message}`
            });
            return false;
        }
    }

    // ==========================================
    //  3. SYNC INCRÉMENTALE (après bootstrap)
    // ==========================================

    async syncNow() {
        if (this.isSyncing) return { skipped: true };
        if (!this.isOnline) return { offline: true };
        if (!this.restaurantId) return { error: 'no_restaurant' };

        // Si jamais bootstrappé, faire le snapshot d'abord
        if (!this.hasBootstrapped) {
            return { bootstrapped: await this.bootstrap() };
        }

        this.isSyncing = true;
        this._notifyRenderer('sync-status', { syncing: true, message: 'Synchronisation...' });

        const results = { pushed: 0, pulled: 0, errors: [] };

        try {
            // ── PUSH : envoyer les commandes locales au serveur ──
            if (this.pendingChanges.length > 0) {
                this._log(`Push de ${this.pendingChanges.length} changement(s)...`, 'info');
                const changesToPush = [...this.pendingChanges];

                try {
                    const pushRes = await this._httpRequest('POST', '/api/sync/push/', {
                        restaurant_id: this.restaurantId,
                        terminal_uuid: this.terminalUuid,
                        changes: changesToPush,
                    });

                    if (pushRes.statusCode === 200) {
                        const pushData = JSON.parse(pushRes.body);
                        results.pushed = pushData.accepted || 0;

                        // Retirer les changements acceptés
                        this.pendingChanges = this.pendingChanges.filter(
                            c => !changesToPush.includes(c)
                        );
                        this._savePendingChanges();

                        if (pushData.errors && pushData.errors.length > 0) {
                            this._log(`Push partiel: ${pushData.errors.length} erreur(s)`, 'warning');
                        }
                    }
                } catch (pushErr) {
                    results.errors.push(`Push: ${pushErr.message}`);
                    this._log(`Erreur push: ${pushErr.message}`, 'error');
                }
            }

            // ── PULL : récupérer les changements serveur (menus, dispos, etc.) ──
            try {
                const lastSync = this.lastSyncTime || '1970-01-01T00:00:00Z';
                let pullUrl = `/api/sync/pull/?restaurant_id=${this.restaurantId}`;
                pullUrl += `&since=${encodeURIComponent(lastSync)}`;
                if (this.terminalUuid) {
                    pullUrl += `&terminal_uuid=${encodeURIComponent(this.terminalUuid)}`;
                }

                const pullRes = await this._httpRequest('GET', pullUrl);

                if (pullRes.statusCode === 200) {
                    const pullData = JSON.parse(pullRes.body);

                    if (pullData.changes && pullData.changes.length > 0) {
                        results.pulled = pullData.changes.length;

                        // Appliquer chaque changement via le Django local
                        for (const change of pullData.changes) {
                            try {
                                await this._httpRequestRaw(
                                    `${this.localApiUrl}/api/sync/apply/`, 'POST', {
                                        table: change.table,
                                        action: change.action,
                                        data: change.data,
                                    }
                                );
                            } catch (applyErr) {
                                this._log(`Erreur apply local (${change.table}): ${applyErr.message}`, 'error');
                            }
                        }
                    }

                    this.lastSyncTime = pullData.server_timestamp;
                    this._saveSyncMeta();
                }
            } catch (pullErr) {
                results.errors.push(`Pull: ${pullErr.message}`);
                this._log(`Erreur pull: ${pullErr.message}`, 'error');
            }

            if (results.pushed > 0 || results.pulled > 0) {
                this._log(`Sync OK : ${results.pushed}↑ ${results.pulled}↓`, 'success');
            }

        } finally {
            this.isSyncing = false;
            this._notifyRenderer('sync-status', {
                syncing: false,
                online: this.isOnline,
                lastSync: this.lastSyncTime,
                pendingCount: this.pendingChanges.length,
                message: results.errors.length > 0 ? 'Sync partielle' : 'Synchronisé'
            });
        }

        return results;
    }

    // ==========================================
    //  4. FORCE RESET (vide la BDD locale et re-bootstrap depuis le cloud)
    // ==========================================

    async forceReset() {
        this._log('Force reset : effacement BDD locale et re-bootstrap...', 'warning');
        this._notifyRenderer('sync-status', { syncing: true, message: 'Réinitialisation en cours...' });

        // Effacer les données locales via l'API Django
        try {
            await this._httpRequestRaw(
                `${this.localApiUrl}/api/sync/clear-local/`, 'POST',
                { restaurant_id: this.restaurantId }
            );
        } catch (e) {
            this._log(`Avertissement clear-local: ${e.message}`, 'warning');
        }

        // Réinitialiser l'état de sync
        this.hasBootstrapped = false;
        this.lastSyncTime = null;
        this._localDbChecked = true;  // Pas besoin de re-check après reset
        this._saveSyncMeta();

        // Relancer le bootstrap complet
        return await this.bootstrap();
    }

    // ==========================================
    //  5. FILE D'ATTENTE (commandes créées hors ligne)
    // ==========================================

    /**
     * Enregistre un changement local à pousser au prochain sync.
     *
     * Exemples depuis le renderer :
     *   syncAPI.queueChange('order', 'create', { id: 999, status: 'pending', ... })
     *   syncAPI.queueChange('order_item', 'create', { id: 123, order_id: 999, menu_id: 5, ... })
     */
    queueChange(table, action, data) {
        const change = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            table,
            action,
            data,
            timestamp: new Date().toISOString(),
        };

        this.pendingChanges.push(change);
        this._savePendingChanges();

        this._log(`+1 en file: ${action} ${table} (${this.pendingChanges.length} total)`, 'info');

        // Si en ligne, tenter une sync rapide
        if (this.isOnline && !this.isSyncing) {
            setTimeout(() => this.syncNow(), 500);
        }

        return change.id;
    }

    // ==========================================
    //  5. DÉMARRAGE / ARRÊT
    // ==========================================

    async _isLocalDbEmpty() {
        if (!this.restaurantId) return false;
        try {
            const res = await this._httpRequestRaw(
                `${this.localApiUrl}/api/sync/snapshot/?restaurant_id=${this.restaurantId}`, 'GET'
            );
            if (res.statusCode === 200) {
                const data = JSON.parse(res.body);
                const menus = data.menus || [];
                return menus.length === 0;
            }
        } catch (e) { /* local not ready yet */ }
        return false;
    }

    start() {
        this._log('Démarrage...', 'info');

        this._connectivityTimer = setInterval(
            () => this.checkConnectivity(),
            this.connectivityCheckInterval
        );

        this._syncTimer = setInterval(
            () => { if (this.isOnline) this.syncNow(); },
            this.syncInterval
        );

        // Check initial
        this.checkConnectivity();

        // ── IPC ──
        ipcMain.handle('sync-now', async () => this.syncNow());
        ipcMain.handle('sync-bootstrap', async () => this.bootstrap());
        ipcMain.handle('sync-force-reset', async () => this.forceReset());
        ipcMain.handle('sync-status', () => ({
            online: this.isOnline,
            syncing: this.isSyncing,
            lastSync: this.lastSyncTime,
            pendingCount: this.pendingChanges.length,
            hasBootstrapped: this.hasBootstrapped,
        }));
        ipcMain.handle('sync-queue-change', async (event, { table, action, data }) => {
            return this.queueChange(table, action, data);
        });

        this._log('Démarré.', 'success');
    }

    stop() {
        if (this._connectivityTimer) clearInterval(this._connectivityTimer);
        if (this._syncTimer) clearInterval(this._syncTimer);
        this._savePendingChanges();
        this._saveSyncMeta();
        this._log('Arrêté.', 'info');
    }

    // ==========================================
    //  UTILITAIRES
    // ==========================================

    _httpRequest(method, endpoint, body = null) {
        return this._httpRequestRaw(`${this.serverUrl}${endpoint}`, method, body);
    }

    _httpRequestRaw(url, method, body = null) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const transport = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken ? { 'Authorization': `Token ${this.authToken}` } : {})
                },
                timeout: 15000
            };

            const req = transport.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    _loadPendingChanges() {
        try {
            if (fs.existsSync(this.pendingChangesPath)) {
                this.pendingChanges = JSON.parse(fs.readFileSync(this.pendingChangesPath, 'utf-8'));
                if (this.pendingChanges.length > 0) {
                    this._log(`${this.pendingChanges.length} changement(s) en attente.`, 'info');
                }
            }
        } catch { this.pendingChanges = []; }
    }

    _savePendingChanges() {
        try {
            fs.writeFileSync(this.pendingChangesPath, JSON.stringify(this.pendingChanges), 'utf-8');
        } catch (err) { this._log(`Erreur save pending: ${err.message}`, 'error'); }
    }

    _loadSyncMeta() {
        try {
            if (fs.existsSync(this.syncMetaPath)) {
                const meta = JSON.parse(fs.readFileSync(this.syncMetaPath, 'utf-8'));
                this.lastSyncTime = meta.lastSyncTime || null;
                this.hasBootstrapped = meta.hasBootstrapped || false;
            }
        } catch { /* ignore */ }
    }

    _saveSyncMeta() {
        try {
            fs.writeFileSync(this.syncMetaPath, JSON.stringify({
                lastSyncTime: this.lastSyncTime,
                hasBootstrapped: this.hasBootstrapped,
            }), 'utf-8');
        } catch { /* ignore */ }
    }

    _notifyRenderer(channel, data) {
        try {
            BrowserWindow.getAllWindows().forEach(win => {
                if (win && !win.isDestroyed()) win.webContents.send(channel, data);
            });
        } catch { /* ignore */ }
    }

    _log(msg, type = 'info') {
        const e = { info: '🔄', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
        console.log(`${e} [Sync] ${msg}`);
    }
}

module.exports = SyncManager;