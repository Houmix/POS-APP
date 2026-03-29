const { contextBridge, ipcRenderer } = require('electron');

// ── Impression ──
contextBridge.exposeInMainWorld('electronAPI', {
    printTicket:           (text, qrContent) => ipcRenderer.invoke('print-ticket', text, qrContent),
    printToNetworkPrinter: (ip, port, data)  => ipcRenderer.invoke('printToNetworkPrinter', ip, port, data),
    testNetworkPrinter:    (ip, port)        => ipcRenderer.invoke('testNetworkPrinter', ip, port),
});

// ── Sync BDD ──
contextBridge.exposeInMainWorld('syncAPI', {
    syncNow:      () => ipcRenderer.invoke('sync-now'),
    bootstrap:    () => ipcRenderer.invoke('sync-bootstrap'),
    forceReset:   () => ipcRenderer.invoke('sync-force-reset'),
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
