'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bootAPI', {
  /* 动画窗口 */
  done: () => ipcRenderer.send('boot:done'),
  log: (m) => ipcRenderer.send('boot:log', String(m)),
  openSettings: () => ipcRenderer.send('boot:open-settings'),
  getConfig: () => ipcRenderer.invoke('config:get'),

  /* 设置窗口 */
  load: () => ipcRenderer.invoke('config:get'),
  save: (cfg) => ipcRenderer.invoke('config:save', cfg),
  reset: () => ipcRenderer.invoke('config:reset'),
  preview: (cfg) => ipcRenderer.invoke('config:preview', cfg),
  pick: (kind) => ipcRenderer.invoke('file:pick', kind),
  setAutostart: (on) => ipcRenderer.invoke('config:autostart', on),
  autostartState: () => ipcRenderer.invoke('config:autostart-state'),
  openFolder: () => ipcRenderer.invoke('config:open-folder'),
  quit: () => ipcRenderer.invoke('config:quit')
});
