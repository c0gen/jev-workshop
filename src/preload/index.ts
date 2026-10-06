import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'
const api: DesktopApi = {
  load: () => ipcRenderer.invoke('jev:load'),
  save: (value) => ipcRenderer.invoke('jev:save', value),
  deleteExperiment: (id) => ipcRenderer.invoke('jev:delete', id),
  preferences: (value) => ipcRenderer.invoke('jev:preferences', value),
  setKey: (key) => ipcRenderer.invoke('jev:set-key', key),
  removeKey: () => ipcRenderer.invoke('jev:remove-key'),
  models: () => ipcRenderer.invoke('jev:models'),
  run: (value) => ipcRenderer.invoke('jev:run', value),
  cancel: () => ipcRenderer.invoke('jev:cancel'),
  exportLibrary: (id) => ipcRenderer.invoke('jev:export', id),
  importLibrary: () => ipcRenderer.invoke('jev:import'),
  copyText: (text) => ipcRenderer.invoke('jev:copy', text),
  openConsole: () => ipcRenderer.invoke('jev:console'),
  onClose(callback) {
    const listener = async () => {
      try {
        await callback()
        ipcRenderer.send('jev:close-ready')
      } catch {
        /* The renderer displays the save failure and keeps the window open. */
      }
    }
    ipcRenderer.on('jev:closing', listener)
    return () => {
      ipcRenderer.removeListener('jev:closing', listener)
    }
  }
}
contextBridge.exposeInMainWorld('jev', api)
