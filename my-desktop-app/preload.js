const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printTicket: (text) => ipcRenderer.invoke('print-ticket', text)
});