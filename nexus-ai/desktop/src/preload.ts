import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('nexus', {
  onToggleMic: (cb: () => void) => {
    ipcRenderer.on('nexus:toggle-mic', cb);
  },
  notify: (title: string, body: string) => ipcRenderer.invoke('nexus:notify', title, body),
  setOpenAtLogin: (on: boolean) => ipcRenderer.invoke('nexus:set-open-at-login', on),
  getOpenAtLogin: () => ipcRenderer.invoke('nexus:get-open-at-login'),
  isDesktop: true
});
