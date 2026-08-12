'use strict'

// Arayuz kodu. Node API'lerine erisim yok; ana surece ihtiyac duyulan her sey
// preload'daki window.hiperVesika koprusunden gelir.

const { versions } = window.hiperVesika

document.getElementById('surum-bilgisi').textContent =
  `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`
