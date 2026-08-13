'use strict'

// Ana surec ile arayuz arasindaki tek koprü. Arayuze Node veya Electron API'si
// dogrudan acilmaz; buraya yalnizca adi belli, dar kapsamli islevler eklenir.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hiperVesika', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },

  // Kullaniciya kaydetme penceresi acar ve secilen yola yazar.
  // { kaydedildi: boolean, yol?: string, hata?: string } dondurur.
  gorseliKaydet: (istek) => ipcRenderer.invoke('gorsel:kaydet', istek)
})
