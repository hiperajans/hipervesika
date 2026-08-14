'use strict'

const path = require('node:path')
const fs = require('node:fs/promises')
const fsSenkron = require('node:fs')
const { pathToFileURL } = require('node:url')
const {
  app, BrowserWindow, Menu, shell, protocol, net, ipcMain, dialog, nativeImage
} = require('electron')

const baski = require('./baski.js')
const ayarlar = require('./ayarlar.js')
const pdf = require('./pdf.js')

app.setName('Hiper Vesika')

const ARAYUZ_KOKU = path.join(__dirname, '..', 'renderer')
const SIMGE_KOKU = path.join(__dirname, '..', '..', 'build', 'icons')

// Uygulama simgesi. Paketlenmis uygulamada simgeyi isletim sistemi paketin
// kendisinden okur (.app icindeki .icns, .exe'ye gomulu .ico); asagidakiler
// yalnizca kaynaktan calistirmada (npm start) pencerenin ve Dock'un dogru
// simgeyi gostermesi icindir. `npm run simge` hic calistirilmamissa dosyalar
// yoktur; o durumda Electron kendi simgesine duser.
function simgeDosyasi (ad) {
  const yol = path.join(SIMGE_KOKU, ad)
  return fsSenkron.existsSync(yol) ? yol : null
}

// Windows .ico, Linux PNG bekler. macOS pencere simgesi kullanmaz; orada
// simge Dock'a ayrica verilir.
function pencereSimgesi () {
  if (process.platform === 'darwin') return null
  return simgeDosyasi(process.platform === 'win32' ? 'icon.ico' : 'icon.png')
}

// nativeImage yalnizca PNG ve JPEG cozer, .icns cozmez. Dock'a bu yuzden
// macOS yerlesiminde ayri bir PNG veriliyor: duz PNG verilseydi simge
// Dock'ta komsularindan buyuk dururdu.
function dockSimgesi () {
  const yol = simgeDosyasi(path.join('macos', '512x512.png'))
  if (!yol) return null
  const gorsel = nativeImage.createFromPath(yol)
  return gorsel.isEmpty() ? null : gorsel
}

// Baski penceresine gecici olarak sunulan icerikler. Diske yazmamak icin
// bellekte tutulur ve is bitince silinir.
const GECICI_ONEK = 'gecici/'
const geciciIcerikler = new Map()
let geciciSayac = 0

function geciciEkle (veri, tur) {
  const anahtar = `${GECICI_ONEK}${++geciciSayac}`
  geciciIcerikler.set(anahtar, { veri, tur })
  return anahtar
}

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

    // Baski penceresinin icerigi diskte degil, bellekte durur.
    if (goreceYol.startsWith(GECICI_ONEK)) {
      const kayit = geciciIcerikler.get(goreceYol)
      if (!kayit) return new Response('Bulunamadı', { status: 404 })
      return new Response(kayit.veri, {
        headers: { 'content-type': kayit.tur, 'cache-control': 'no-store' }
      })
    }

    const hedef = path.join(ARAYUZ_KOKU, goreceYol)

    // Yol asimi denetimi: istek arayuz klasorunun disina cikamaz.
    if (hedef !== ARAYUZ_KOKU && !hedef.startsWith(ARAYUZ_KOKU + path.sep)) {
      return new Response('Erisim reddedildi', { status: 403 })
    }

    return net.fetch(pathToFileURL(hedef).toString())
  })
}

// --- Kaydetme ----------------------------------------------------------------

const DOSYA_SUZGECLERI = {
  jpg: { name: 'JPEG görüntü', extensions: ['jpg', 'jpeg'] },
  png: { name: 'PNG görüntü', extensions: ['png'] },
  pdf: { name: 'PDF belgesi', extensions: ['pdf'] }
}

// Kaydetme penceresini acar ve dosyayi yazar. Yol secimini kullanici yapar;
// arayuz dosya sistemine dogrudan erisemez.
async function kaydetmeyiSor (pencere, { baytlar, varsayilanAd, tur, baslik }) {
  const suzgec = DOSYA_SUZGECLERI[tur] ?? DOSYA_SUZGECLERI.jpg

  const { canceled, filePath } = await dialog.showSaveDialog(pencere, {
    title: baslik,
    // Sabit yol yazilmaz; kullanicinin resim klasoru platforma gore cozulur.
    defaultPath: path.join(
      app.getPath('pictures'), varsayilanAd || `vesikalik.${suzgec.extensions[0]}`
    ),
    filters: [suzgec]
  })

  if (canceled || !filePath) return { kaydedildi: false }

  try {
    await fs.writeFile(filePath, baytlar)
    return { kaydedildi: true, yol: filePath }
  } catch (hata) {
    return { kaydedildi: false, hata: hata.message }
  }
}

function baytlariDogrula (baytlar) {
  if (!(baytlar instanceof Uint8Array) || baytlar.length === 0) {
    throw new Error('Kaydedilecek görüntü verisi geçersiz.')
  }
  return baytlar
}

function kaydetmeyiKur () {
  ipcMain.handle('gorsel:kaydet', async (olay, istek) => {
    const { baytlar, varsayilanAd, tur } = istek ?? {}

    try {
      baytlariDogrula(baytlar)
    } catch (hata) {
      return { kaydedildi: false, hata: hata.message }
    }

    return kaydetmeyiSor(BrowserWindow.fromWebContents(olay.sender), {
      baytlar,
      varsayilanAd,
      tur: tur === 'png' ? 'png' : 'jpg',
      baslik: istek.baslik || 'Vesikalığı kaydet'
    })
  })
}

// --- Baski -------------------------------------------------------------------

// Sayfa goruntusunu tam olcusu tanimlanmis gizli bir pencerede acar ve isi
// bitince her seyi temizler. Baski da PDF de ayni sayfadan uretilir, boylece
// ekranda gorulen ile basilan arasinda ikinci bir hesap yolu olusmaz.
async function baskiSayfasindaCalis (istek, gorev) {
  const baytlar = baytlariDogrula(istek?.baytlar)
  const kagitMm = baski.sayfaOlcusu(istek?.kagitMm)

  const gorselAnahtari = geciciEkle(baytlar, 'image/png')
  const sayfaAnahtari = geciciEkle(
    Buffer.from(baski.baskiSayfasiHtml(kagitMm, `app://hv/${gorselAnahtari}`), 'utf8'),
    'text/html; charset=utf-8'
  )

  const pencere = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })

  try {
    // did-finish-load, sayfanin load olayidir: goruntu de yuklenmis olur.
    await pencere.loadURL(`app://hv/${sayfaAnahtari}`)
    return await gorev(pencere, kagitMm)
  } finally {
    geciciIcerikler.delete(gorselAnahtari)
    geciciIcerikler.delete(sayfaAnahtari)
    if (!pencere.isDestroyed()) pencere.destroy()
  }
}

function baskiyiKur () {
  ipcMain.handle('yazici:liste', async (olay) => {
    try {
      const yazicilar = await olay.sender.getPrintersAsync()
      return {
        yazicilar: yazicilar.map((yazici) => ({
          ad: yazici.name,
          gorunenAd: yazici.displayName || yazici.name,
          varsayilan: yazici.isDefault === true
        }))
      }
    } catch (hata) {
      return { yazicilar: [], hata: hata.message }
    }
  })

  ipcMain.handle('sayfa:bas', async (olay, istek) => {
    try {
      return await baskiSayfasindaCalis(istek, (pencere, kagitMm) => new Promise((cozumle) => {
        pencere.webContents.print(
          {
            // Baski her zaman sistemin yazdirma panelinden gecer: yazici,
            // kopya, kagit ve kalite oranin sahibi surucudur. Uygulama sessiz
            // baski yapmaz; boylece "bizim yazdirdigimiz" bir cikti olmaz.
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' },
            scaleFactor: 100,
            // Rasterlestirme cozunurlugu panelde secilemez (Chromium tarafidir),
            // bu yuzden burada verilir. Verilmezse aygitin varsayilanina duser
            // ve fotograf kagidinda gozle gorulur bicimde yumusak cikar.
            dpi: (() => {
              const nokta = baski.baskiCozunurlugu(istek?.baskiDpi)
              return { horizontal: nokta, vertical: nokta }
            })(),
            pageSize: {
              width: baski.mikron(kagitMm.genislik),
              height: baski.mikron(kagitMm.yukseklik)
            }
          },
          (basarili, sebep) => {
            if (basarili) return cozumle({ basildi: true })
            // Kullanicinin vazgecmesi hata degildir.
            if (sebep === 'cancelled') return cozumle({ basildi: false, iptal: true })
            cozumle({ basildi: false, hata: sebep || 'Baskı başlatılamadı.' })
          }
        )
      }))
    } catch (hata) {
      return { basildi: false, hata: hata.message }
    }
  })

  ipcMain.handle('sayfa:pdf', async (olay, istek) => {
    const pencere = BrowserWindow.fromWebContents(olay.sender)

    try {
      // CMYK istendiginde sayfa Chromium'dan gecmez: printToPDF her zaman RGB
      // uretir, bu yuzden PDF'i dogrudan CMYK orneklerinden yaziyoruz.
      if (istek?.cmyk) {
        const kagitMm = baski.sayfaOlcusu(istek.kagitMm)
        const belge = pdf.cmykSayfaPdf({
          baytlar: istek.cmyk.baytlar,
          genislik: istek.cmyk.genislik,
          yukseklik: istek.cmyk.yukseklik,
          kagitMm
        })

        return await kaydetmeyiSor(pencere, {
          baytlar: belge,
          varsayilanAd: istek?.varsayilanAd,
          tur: 'pdf',
          baslik: 'Sayfayı PDF olarak kaydet'
        })
      }

      const belge = await baskiSayfasindaCalis(istek, (baskiPenceresi, kagitMm) =>
        baskiPenceresi.webContents.printToPDF({
          printBackground: true,
          // Sayfa olcusu CSS'teki @page'ten alinir; ikisi ayni degeri yazar.
          preferCSSPageSize: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: {
            width: baski.inc(kagitMm.genislik),
            height: baski.inc(kagitMm.yukseklik)
          }
        })
      )

      return await kaydetmeyiSor(pencere, {
        baytlar: belge,
        varsayilanAd: istek?.varsayilanAd,
        tur: 'pdf',
        baslik: 'Sayfayı PDF olarak kaydet'
      })
    } catch (hata) {
      return { kaydedildi: false, hata: hata.message }
    }
  })
}

// --- Ayarlar -----------------------------------------------------------------

// Kullanici ayarlari uygulama verisi klasorunde durur; depoya ya da fotografin
// yanina hicbir sey yazilmaz.
function ayarlariKur () {
  const klasor = () => app.getPath('userData')

  ipcMain.handle('ayarlar:oku', () => ayarlar.oku(klasor()))

  ipcMain.handle('ayarlar:yaz', async (olay, gelen) => {
    try {
      return { yazildi: true, ayarlar: await ayarlar.yaz(klasor(), gelen) }
    } catch (hata) {
      return { yazildi: false, hata: hata.message }
    }
  })
}

// --- Menu --------------------------------------------------------------------

// Kisayollar menude tanimlanir; platform ayrimini CmdOrCtrl yapar.
// macOS'ta Apple menusunun altindaki "Hakkinda" penceresi, Windows ve Linux'ta
// ise Yardim menusunden acilan kutu. Doldurulmazsa yalnizca ad ve surum
// gorunur; kullanicinin en cok merak ettigi sey (fotograflarin nereye gittigi)
// tam olarak burada yaziyor.
function hakkindaKur () {
  const s = process.versions
  const tanitim = [
    'Vesikalık fotoğraf hazırlama ve baskı kağıdına dizme uygulaması.',
    '',
    'Tüm görüntü işleme bu bilgisayarda yapılır: fotoğraflar hiçbir sunucuya ' +
      'gönderilmez, uygulama internet bağlantısı kurmaz.',
    '',
    `Electron ${s.electron} · Chromium ${s.chrome} · Node ${s.node}`,
    'github.com/hiperajans/hipervesika'
  ].join('\n')

  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    // macOS "Surum <kisa> (<yapi>)" yazar. Yapi numarasi ayri tutulmadigi icin
    // parantez ya "0.1.0 (0.1.0)" diye tekrar ederdi (paket) ya da Electron'un
    // surumunu gosterirdi (kaynaktan calistirmada "0.1.0 (43.4.0)"). Bos
    // birakilinca parantez hic cizilmiyor.
    version: '',
    copyright: '© Hiper Ajans · Apache-2.0 lisansı',
    credits: tanitim,
    // Yalnizca Linux'ta kullanilir.
    authors: ['Hiper Ajans'],
    website: 'https://github.com/hiperajans/hipervesika',
    // Yalnizca Windows ve Linux'ta kullanilir; macOS simgeyi paketten okur.
    ...(simgeDosyasi('icon.png') ? { iconPath: simgeDosyasi('icon.png') } : {})
  })
}

function menuyuKur () {
  const komut = (ad) => () => {
    const pencere = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    pencere?.webContents.send('menu', ad)
  }

  const sablon = [
    // 'appMenu' rolu hazir bir alt menu verir ama etiketleri Ingilizce'dir;
    // arayuzun geri kalani Turkce oldugu icin ayni menu elle yaziliyor.
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about', label: `${app.name} Hakkında` },
            { type: 'separator' },
            { role: 'services', label: 'Hizmetler' },
            { type: 'separator' },
            { role: 'hide', label: `${app.name}'yı Gizle` },
            { role: 'hideOthers', label: 'Diğerlerini Gizle' },
            { role: 'unhide', label: 'Tümünü Göster' },
            { type: 'separator' },
            { role: 'quit', label: `${app.name}'dan Çık` }
          ]
        }]
      : []),
    {
      label: 'Dosya',
      submenu: [
        { label: 'Fotoğraf aç…', accelerator: 'CmdOrCtrl+O', click: komut('ac') },
        { type: 'separator' },
        { label: 'Kaydet…', accelerator: 'CmdOrCtrl+S', click: komut('kaydet') },
        {
          label: 'Sayfayı PDF olarak kaydet…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: komut('pdf')
        },
        { type: 'separator' },
        { label: 'Sayfayı yazdır…', accelerator: 'CmdOrCtrl+P', click: komut('yazdir') },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close', label: 'Kapat' }
          : { role: 'quit', label: 'Çıkış' }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { label: 'Geri al', accelerator: 'CmdOrCtrl+Z', click: komut('geri-al') },
        { label: 'Yinele', accelerator: 'CmdOrCtrl+Shift+Z', click: komut('yinele') },
        { type: 'separator' },
        { role: 'cut', label: 'Kes' },
        { role: 'copy', label: 'Kopyala' },
        { role: 'paste', label: 'Yapıştır' },
        { role: 'selectAll', label: 'Tümünü seç' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'resetZoom', label: 'Gerçek boyut' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam ekran' },
        { role: 'toggleDevTools', label: 'Geliştirici araçları' }
      ]
    },
    { role: 'windowMenu', label: 'Pencere' },
    {
      label: 'Yardım',
      role: 'help',
      submenu: [
        { label: 'Tanıtım turu', accelerator: 'F1', click: komut('tanitim') },
        // macOS'ta "Hakkında" Apple menusunun altindadir; Windows ve Linux'ta
        // buraya konur.
        ...(process.platform === 'darwin'
          ? []
          : [{ type: 'separator' }, { role: 'about', label: `${app.name} Hakkında` }])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(sablon))
}

function createWindow () {
  const simge = pencereSimgesi()
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8f9fa',
    title: 'Hiper Vesika',
    ...(simge ? { icon: simge } : {}),
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
  // macOS'ta Dock simgesi pencereden degil uygulamadan gelir; paketlenmemis
  // calistirmada Electron'un kendi simgesi gorunurdu.
  if (process.platform === 'darwin' && !app.isPackaged) {
    const simge = dockSimgesi()
    if (simge) app.dock?.setIcon(simge)
  }

  protokoluKur()
  kaydetmeyiKur()
  baskiyiKur()
  ayarlariKur()
  hakkindaKur()
  menuyuKur()
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
