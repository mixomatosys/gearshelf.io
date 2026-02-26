import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Plugin scanning
  scanPlugins: () => ipcRenderer.invoke('scan-plugins'),
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  getPluginStatistics: () => ipcRenderer.invoke('get-plugin-statistics'),
  
  // Database operations (to be implemented)
  exportPlugins: (format: string) => ipcRenderer.invoke('export-plugins', format),
  
  // Settings (to be implemented)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: any) => ipcRenderer.invoke('set-settings', settings),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      scanPlugins: () => Promise<any>;
      getPlugins: () => Promise<any[]>;
      getPluginStatistics: () => Promise<any>;
      exportPlugins: (format: string) => Promise<any>;
      getSettings: () => Promise<any>;
      setSettings: (settings: any) => Promise<void>;
    };
  }
}