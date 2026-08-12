'use strict'

// Ana surec ile arayuz arasindaki tek koprü. Arayuze Node veya Electron API'si
// dogrudan acilmaz; buraya yalnizca adi belli, dar kapsamli islevler eklenir.

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('hiperVesika', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
})
