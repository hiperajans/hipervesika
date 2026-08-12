'use strict'

const path = require('node:path')
const { app, BrowserWindow, shell } = require('electron')

app.setName('Hiper Vesika')

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

  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))

  return window
}

app.whenReady().then(() => {
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
