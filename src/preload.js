const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('klondikeAPI', {
  getStats: () => ipcRenderer.invoke('stats:get'),
  updateStats: (result) => ipcRenderer.invoke('stats:update', result),
  resetStats: () => ipcRenderer.invoke('stats:reset'),
  showAbout: () => ipcRenderer.invoke('dialog:about'),
  on: (channel, listener) => {
    const allowed = [
      'menu:new-game',
      'menu:undo',
      'menu:hint',
      'menu:auto-complete',
      'menu:toggle-draw',
      'menu:stats',
      'menu:options'
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    }
  }
});
