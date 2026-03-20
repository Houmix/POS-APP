const { contextBridge, ipcRenderer } = require('electron');

// ── Impression ──
contextBridge.exposeInMainWorld('electronAPI', {
    printTicket: (text) => ipcRenderer.invoke('print-ticket', text)
});

// ── Sync BDD ──
contextBridge.exposeInMainWorld('syncAPI', {
    syncNow:      () => ipcRenderer.invoke('sync-now'),
    bootstrap:    () => ipcRenderer.invoke('sync-bootstrap'),
    getStatus:    () => ipcRenderer.invoke('sync-status'),
    queueChange:  (table, action, data) => ipcRenderer.invoke('sync-queue-change', { table, action, data }),
    onStatusChange: (cb) => ipcRenderer.on('sync-status', (_, data) => cb(data)),
});

// ── Licence ──
contextBridge.exposeInMainWorld('licenseAPI', {
    activate:   (licenseKey) => ipcRenderer.invoke('license-activate', { licenseKey }),
    deactivate: () => ipcRenderer.invoke('license-deactivate'),
    getStatus:  () => ipcRenderer.invoke('license-status'),
    verify:     () => ipcRenderer.invoke('license-verify'),
    onStatusChange: (cb) => ipcRenderer.on('license-status', (_, data) => cb(data)),
});
