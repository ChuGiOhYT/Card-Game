const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameAPI', {
  saveGame: (data) => ipcRenderer.invoke('save:write', data),
  loadGame: () => ipcRenderer.invoke('save:read'),
  quit: () => ipcRenderer.invoke('app:quit'),
  // Sin parámetros a propósito: el destino lo decide el proceso principal.
  abrirArena: () => ipcRenderer.invoke('arena:abrir')
});
