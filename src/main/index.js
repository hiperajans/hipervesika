'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, shell, protocol, net } = require('electron')

app.setName('Hiper Vesika')

const ARAYUZ_KOKU = path.join(__dirname, '..', 'renderer')

// Arayuz file:// yerine kendi protokolumuz uzerinden sunulur. Sebebi: Human'in
// model dosyalari fetch() ile yukleniyor ve fetch file:// adreslerinde
// calismiyor. Standart ve guvenli olarak isaretlenen bu sema ayni zamanda
// sayfaya duzgun bir kaynak (origin) kazandirir, boylece CSP beklendigi gibi
// uygulanir.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function protokoluKur () {
  protocol.handle('app', async (istek) => {
    const adres = new URL(istek.url)
    const goreceYol = decodeURIComponent(adres.pathname).replace(/^\/+/, '')
    const hedef = path.join(ARAYUZ_KOKU, goreceYol)

    // Yol asimi denetimi: istek arayuz klasorunun disina cikamaz.
    if (hedef !== ARAYUZ_KOKU && !hedef.startsWith(ARAYUZ_KOKU + path.sep)) {
      return new Response('Erisim reddedildi', { status: 403 })
    }

    return net.fetch(pathToFileURL(hedef).toString())
  })
}

function createWindow () {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8f9fa',
    title: 'Hiper Vesika',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Pencereyi boyanmadan gostermek beyaz bir parlamaya yol aciyor.
  window.once('ready-to-show', () => window.show())

  // Arayuz uygulamanin icinden disari gezinemez; harici baglantilar
  // kullanicinin varsayilan tarayicisinda acilir.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  window.loadURL('app://hv/index.html')

  return window
}

app.whenReady().then(() => {
  protokoluKur()
  createWindow()

  // macOS'ta Dock'tan tiklaninca pencere yeniden acilir.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS disinda son pencere kapaninca uygulama da kapanir.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
