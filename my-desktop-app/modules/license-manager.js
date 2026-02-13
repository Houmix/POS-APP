// ==========================================
// 🔑 LICENSE MANAGER - Adapté aux modèles Terminal/License existants
// modules/license-manager.js
// ==========================================

const { ipcMain, BrowserWindow, app } = require('electron');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

class LicenseManager {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl || 'http://127.0.0.1:8000'; // METTRE CLICKGO
        this.checkInterval = options.checkInterval || 3600000;     // 1h
        this.gracePeriodDays = options.gracePeriodDays || 7;

        const userDataPath = app.getPath('userData');
        this.licenseFilePath = path.join(userDataPath, 'license.enc');

        // État
        this.license = null;
        this.machineId = this._generateMachineId();
        this.isValid = false;

        this._checkTimer = null;
    }

    // ==========================================
    //  ID MACHINE (hash du hardware)
    // ==========================================

    _generateMachineId() {
        const parts = [
            os.hostname(),
            os.cpus()[0]?.model || '',
            os.arch(),
            os.platform(),
        ];
        // Première MAC non-interne
        const ifaces = os.networkInterfaces();
        for (const name in ifaces) {
            for (const iface of ifaces[name]) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    parts.push(iface.mac);
                    break;
                }
            }
        }
        return crypto.createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 32);
    }

    // ==========================================
    //  ACTIVATION
    // ==========================================

    async activate(licenseKey) {
        this._log(`Activation: ${licenseKey.substring(0, 14)}...`, 'info');

        try {
            const res = await this._http('POST', '/api/license/activate/', {
                license_key: licenseKey,
                machine_id: this.machineId,
                machine_name: os.hostname(),
                app_version: app.getVersion(),
                platform: `${os.platform()}-${os.arch()}`
            });

            const data = JSON.parse(res.body);

            if (res.statusCode === 200 && data.success) {
                this.license = {
                    key: licenseKey,
                    status: 'active',
                    activatedAt: data.activated_at,
                    expiresAt: data.expires_at,
                    restaurantId: data.restaurant_id,
                    restaurantName: data.restaurant_name,
                    plan: data.plan,
                    features: data.features || [],
                    maxTerminals: data.max_terminals,
                    lastOnlineCheck: new Date().toISOString()
                };
                this.isValid = true;
                this._saveLicense();
                this._log(`Activé ! Restaurant: ${data.restaurant_name} (${data.plan})`, 'success');
                this._notify('license-status', this.getStatus());
                return { success: true, license: this.getStatus() };
            }

            const msg = data.error || 'Refusé';
            this._log(`Refusé: ${msg}`, 'error');
            return { success: false, message: msg };

        } catch (err) {
            this._log(`Erreur: ${err.message}`, 'error');
            return { success: false, message: `Connexion impossible: ${err.message}` };
        }
    }

    // ==========================================
    //  DÉSACTIVATION
    // ==========================================

    async deactivate() {
        if (!this.license) return { success: false, message: 'Aucune licence' };

        try {
            await this._http('POST', '/api/license/deactivate/', {
                license_key: this.license.key,
                machine_id: this.machineId
            });
        } catch (err) {
            this._log(`Erreur serveur déactivation: ${err.message}`, 'warning');
        }

        this.license = null;
        this.isValid = false;
        this._deleteLicense();
        this._notify('license-status', this.getStatus());
        this._log('Licence désactivée.', 'success');
        return { success: true };
    }

    // ==========================================
    //  VÉRIFICATION
    // ==========================================

    async verify() {
        if (!this.license) {
            this.isValid = false;
            return { valid: false, reason: 'no_license' };
        }

        // Expiration locale
        if (this.license.expiresAt && new Date(this.license.expiresAt) < new Date()) {
            this.isValid = false;
            this._notify('license-status', this.getStatus());
            return { valid: false, reason: 'expired' };
        }

        try {
            const res = await this._http('POST', '/api/license/verify/', {
                license_key: this.license.key,
                machine_id: this.machineId
            });

            const data = JSON.parse(res.body);

            if (res.statusCode === 200 && data.valid) {
                this.isValid = true;
                this.license.lastOnlineCheck = new Date().toISOString();
                this.license.status = 'active';
                if (data.expires_at) this.license.expiresAt = data.expires_at;
                if (data.features) this.license.features = data.features;
                if (data.plan) this.license.plan = data.plan;
                this._saveLicense();
                this._notify('license-status', this.getStatus());
                return { valid: true };
            }

            this.isValid = false;
            this.license.status = data.status || 'revoked';
            this._saveLicense();
            this._notify('license-status', this.getStatus());
            return { valid: false, reason: data.reason || 'revoked' };

        } catch (err) {
            // Mode hors ligne → période de grâce
            return this._checkGrace();
        }
    }

    _checkGrace() {
        if (!this.license?.lastOnlineCheck) {
            this.isValid = false;
            return { valid: false, reason: 'never_verified' };
        }

        const daysSince = (Date.now() - new Date(this.license.lastOnlineCheck)) / 86400000;

        if (daysSince <= this.gracePeriodDays) {
            this.isValid = true;
            const daysLeft = Math.ceil(this.gracePeriodDays - daysSince);
            this._log(`Grâce hors ligne: ${daysLeft}j restant(s)`, 'warning');
            this._notify('license-status', { ...this.getStatus(), offlineGraceDaysLeft: daysLeft });
            return { valid: true, offline: true, graceDaysLeft: daysLeft };
        }

        this.isValid = false;
        this._log('Grâce expirée ! Connexion requise.', 'error');
        this._notify('license-status', this.getStatus());
        return { valid: false, reason: 'grace_period_expired' };
    }

    // ==========================================
    //  STATUT
    // ==========================================

    getStatus() {
        if (!this.license) {
            return { activated: false, valid: false, machineId: this.machineId };
        }
        return {
            activated: true,
            valid: this.isValid,
            key: `${this.license.key.substring(0, 14)}...`,
            status: this.license.status,
            restaurantId: this.license.restaurantId,
            restaurantName: this.license.restaurantName,
            plan: this.license.plan,
            features: this.license.features,
            expiresAt: this.license.expiresAt,
            lastOnlineCheck: this.license.lastOnlineCheck,
            machineId: this.machineId,
        };
    }

    // ==========================================
    //  DÉMARRAGE / ARRÊT
    // ==========================================

    async start() {
        this._log(`Machine ID: ${this.machineId}`, 'info');
        this._loadLicense();

        if (this.license) {
            this._log(`Licence: ${this.license.key?.substring(0, 14)}...`, 'info');
            await this.verify();
        } else {
            this._log('Aucune licence. Activation requise.', 'warning');
        }

        this._checkTimer = setInterval(() => this.verify(), this.checkInterval);

        // IPC
        ipcMain.handle('license-activate', async (e, { licenseKey }) => this.activate(licenseKey));
        ipcMain.handle('license-deactivate', async () => this.deactivate());
        ipcMain.handle('license-status', () => this.getStatus());
        ipcMain.handle('license-verify', async () => this.verify());

        this._log('Démarré.', 'success');
    }

    stop() {
        if (this._checkTimer) clearInterval(this._checkTimer);
    }

    // ==========================================
    //  PERSISTANCE CHIFFRÉE
    // ==========================================

    _encKey() {
        return crypto.createHash('sha256').update(`doeat-lic-${this.machineId}`).digest();
    }

    _saveLicense() {
        try {
            const key = this._encKey();
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            let enc = cipher.update(JSON.stringify(this.license), 'utf-8', 'hex');
            enc += cipher.final('hex');
            fs.writeFileSync(this.licenseFilePath, JSON.stringify({ iv: iv.toString('hex'), data: enc }), 'utf-8');
        } catch (err) { this._log(`Save err: ${err.message}`, 'error'); }
    }

    _loadLicense() {
        try {
            if (!fs.existsSync(this.licenseFilePath)) return;
            const { iv, data } = JSON.parse(fs.readFileSync(this.licenseFilePath, 'utf-8'));
            const decipher = crypto.createDecipheriv('aes-256-cbc', this._encKey(), Buffer.from(iv, 'hex'));
            let dec = decipher.update(data, 'hex', 'utf-8');
            dec += decipher.final('utf-8');
            this.license = JSON.parse(dec);
        } catch (err) {
            this._log(`Licence corrompue: ${err.message}`, 'warning');
            this.license = null;
        }
    }

    _deleteLicense() {
        try { if (fs.existsSync(this.licenseFilePath)) fs.unlinkSync(this.licenseFilePath); } catch {}
    }

    // ==========================================
    //  UTILITAIRES
    // ==========================================

    _http(method, endpoint, body = null) {
        const url = `${this.serverUrl}${endpoint}`;
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const t = u.protocol === 'https:' ? https : http;
            const opts = {
                hostname: u.hostname, port: u.port,
                path: u.pathname + u.search, method,
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            };
            const req = t.request(opts, res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: d }));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    _notify(channel, data) {
        try {
            BrowserWindow.getAllWindows().forEach(w => {
                if (w && !w.isDestroyed()) w.webContents.send(channel, data);
            });
        } catch {}
    }

    _log(msg, type = 'info') {
        const e = { info: '🔑', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
        console.log(`${e} [License] ${msg}`);
    }
}

module.exports = LicenseManager;