'use strict'

const path = require('node:path')
const fs = require('node:fs/promises')
const fsSenkron = require('node:fs')
const { pathToFileURL } = require('node:url')
const { execFile } = require('node:child_process')
const {
  app, BrowserWindow, Menu, shell, protocol, net, ipcMain, dialog, nativeImage
} = require('electron')

const baski = require('./baski.js')
const ayarlar = require('./ayarlar.js')
const pdf = require('./pdf.js')
const yakinlik = require('./yakinlik.js')
const dogrudanBaski = require('./dogrudan-baski.js')

app.setName('Hiper Vesika')

const ARAYUZ_KOKU = path.join(__dirname, '..', 'renderer')
const SIMGE_KOKU = path.join(__dirname, '..', '..', 'build', 'icons')

// Gelistirici araclari kapali: kullaniciya sunulan uygulamada isi yok, magaza
// incelemelerinde de hos karsilanmiyor. devTools: false kesin kapatmadir —
// menuden, kisayoldan ya da koddan acilamaz.
//
// Gerektiginde ortam degiskeniyle acilir:  HV_GELISTIRICI=1 npm start
// Kaynaktan calistirmada da varsayilan kapali; boylece gelistirirken gorulen
// uygulama kullanicinin gordugunun aynisi olur.
const GELISTIRICI = process.env.HV_GELISTIRICI === '1'

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

// Arayuz ile baski penceresi ayri kaynaklarda (origin) acilir. Sebebi
// Chromium'un yakinlik degerini kaynak basina tutmasi: ikisi de 'hv' olsaydi
// kullanicinin arayuzde sectigi olcek basilan sayfaya da gecerdi (ve baski
// penceresi olcegi sifirlasa bu kez arayuzunki bozulurdu). Baski her zaman
// %100'den cikar. Yol cozumu icin ana bilgisayar adinin bir onemi yok.
const ARAYUZ_KAYNAGI = 'app://hv'
const BASKI_KAYNAGI = 'app://baski'

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
    Buffer.from(baski.baskiSayfasiHtml(kagitMm, `${BASKI_KAYNAGI}/${gorselAnahtari}`), 'utf8'),
    'text/html; charset=utf-8'
  )

  const pencere = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: GELISTIRICI
    }
  })

  try {
    // did-finish-load, sayfanin load olayidir: goruntu de yuklenmis olur.
    await pencere.loadURL(`${BASKI_KAYNAGI}/${sayfaAnahtari}`)
    // Ayri kaynak zaten %100 ile acilir; yine de acikca yaziliyor, cunku
    // olcegin 1 olmamasi dogrudan yanlis olcude baski demek.
    pencere.webContents.setZoomFactor(1)
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
      return await kaydetmeyiSor(pencere, {
        baytlar: await sayfaPdfiUret(istek),
        varsayilanAd: istek?.varsayilanAd,
        tur: 'pdf',
        baslik: 'Sayfayı PDF olarak kaydet'
      })
    } catch (hata) {
      return { kaydedildi: false, hata: hata.message }
    }
  })
}

// Basilacak/kaydedilecek sayfanin PDF'i. Kaydetme ile dogrudan baski ayni
// belgeyi kullanir; olcu dogrulugu tek bir yerde saglanir.
async function sayfaPdfiUret (istek) {
  // CMYK istendiginde sayfa Chromium'dan gecmez: printToPDF her zaman RGB
  // uretir, bu yuzden PDF'i dogrudan CMYK orneklerinden yaziyoruz.
  if (istek?.cmyk) {
    return pdf.cmykSayfaPdf({
      baytlar: istek.cmyk.baytlar,
      genislik: istek.cmyk.genislik,
      yukseklik: istek.cmyk.yukseklik,
      kagitMm: baski.sayfaOlcusu(istek.kagitMm)
    })
  }

  return baskiSayfasindaCalis(istek, (baskiPenceresi, kagitMm) =>
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
}

// --- Dogrudan baski ----------------------------------------------------------

let dogrudanBaskiDurumu = null

function dogrudanBaskiDurumunuAl () {
  dogrudanBaskiDurumu ??= {
    ...dogrudanBaski.durum(),
    // Rasterlestirme cozunurlugu de baski isinin bir parcasi; arayuz listeyi
    // ikinci kez yazmasin diye buradan gider.
    cozunurlukler: baski.BASKI_COZUNURLUKLERI,
    varsayilanCozunurluk: baski.VARSAYILAN_BASKI_DPI
  }
  return dogrudanBaskiDurumu
}

// Arayuzden gelen istegin dogrulanmis hali. Ana surec arayuze guvenmez:
// olcu, kopya ve cozunurluk baski.js'teki sinirlardan gecer.
function dogrudanBaskiIstegi (istek) {
  const yazici = typeof istek?.yazici === 'string' ? istek.yazici.trim() : ''
  if (!yazici || yazici.length > 200) throw new Error('Yazıcı seçilmedi.')

  const secili = (liste, kod) =>
    liste.some((oge) => oge.kod === kod) ? kod : 'otomatik'

  return {
    yazici,
    kagitMm: baski.sayfaOlcusu(istek?.kagitMm),
    kopya: baski.kopyaSayisi(istek?.kopya),
    dpi: baski.baskiCozunurlugu(istek?.baskiDpi),
    kenarliksiz: istek?.kenarliksiz === true,
    kagitTuru: secili(dogrudanBaski.KAGIT_TURLERI, istek?.kagitTuru),
    kalite: secili(dogrudanBaski.KALITELER, istek?.kalite)
  }
}

// Windows: sayfa, olcusu tanimlanmis gizli pencerede acilir ve Chromium'un
// kendi baski yolundan sessizce gonderilir. Panel acilmaz; yazici, kopya ve
// cozunurluk buradan verilir, olcek %100'de sabit kalir.
function sessizBas (istek, dogrulanmis) {
  return baskiSayfasindaCalis(istek, (pencere, kagitMm) => new Promise((cozumle) => {
    pencere.webContents.print(
      {
        silent: true,
        deviceName: dogrulanmis.yazici,
        printBackground: true,
        margins: { marginType: 'none' },
        scaleFactor: 100,
        copies: dogrulanmis.kopya,
        dpi: { horizontal: dogrulanmis.dpi, vertical: dogrulanmis.dpi },
        pageSize: {
          width: baski.mikron(kagitMm.genislik),
          height: baski.mikron(kagitMm.yukseklik)
        }
      },
      (basarili, sebep) => {
        if (basarili) return cozumle({ basildi: true })
        cozumle({ basildi: false, hata: sebep || 'Baskı başlatılamadı.' })
      }
    )
  }))
}

function dogrudanBaskiyiKur () {
  ipcMain.handle('dogrudan-baski:durum', () => dogrudanBaskiDurumunuAl())

  // Kagit turu ve kalite Windows'ta yalnizca surucunun kendi penceresinden
  // ayarlanabiliyor; arayuz o pencereyi buradan actiriyor.
  ipcMain.handle('yazici:tercihler', async (olay, yazici) => {
    if (typeof yazici !== 'string' || !yazici || yazici.length > 200) {
      return { acildi: false, hata: 'Yazıcı seçilmedi.' }
    }

    try {
      const komut = dogrudanBaski.tercihKomutu(yazici)

      if (komut.adres) {
        await shell.openExternal(komut.adres)
        return { acildi: true }
      }

      // Pencere kullanicinin onunde acilir ve kapanmasini beklemeyiz.
      execFile(komut.komut, komut.argumanlar, { windowsHide: true })
      return { acildi: true }
    } catch (hata) {
      return { acildi: false, hata: hata.message }
    }
  })

  ipcMain.handle('sayfa:dogrudan-bas', async (olay, istek) => {
    try {
      const durum = dogrudanBaskiDurumunuAl()
      if (!durum.var) {
        return { basildi: false, hata: 'Doğrudan baskı bu sistemde kullanılamıyor.' }
      }

      const dogrulanmis = dogrudanBaskiIstegi(istek)

      if (durum.sistem === 'chromium') return await sessizBas(istek, dogrulanmis)

      // POSIX: is CUPS'a verilir; kagit turu ve kalite oradan gecer.
      await dogrudanBaski.cupsaGonder({
        lp: durum.lp,
        pdf: await sayfaPdfiUret(istek),
        geciciKlasor: app.getPath('temp'),
        ...dogrulanmis
      })

      return { basildi: true }
    } catch (hata) {
      return { basildi: false, hata: hata.message }
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

// --- Arayuz olcegi -----------------------------------------------------------

// Olcegi bir basamak degistirir ya da gercek boyuta dondurur.
function yakinligiUygula (webContents, komut) {
  if (!webContents || webContents.isDestroyed()) return null

  const yeni = yakinlik.yeniOlcek(webContents.getZoomFactor(), komut)
  webContents.setZoomFactor(yeni)
  return yeni
}

function yakinlikKomutu (komut) {
  return () => {
    const pencere = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    yakinligiUygula(pencere?.webContents, komut)
  }
}

// Kisayol menu hizlandiricisina birakilmadi: 'CmdOrCtrl+Plus' fiziksel tusa
// gore eslesiyor ve Turkce Q klavyede '+' Shift+4 ile yazildigi icin hic
// tetiklenmiyordu. Tus, uretilen karaktere gore arayuzde okunur
// (src/renderer/js/kisayol.js) ve komut olarak buraya gelir.
//
// Ayni tusa iki islem baglanmaz: menu ogelerine registerAccelerator: false
// verildigi icin Windows ve Linux'ta hizlandirici sisteme kaydedilmez, is
// arayuze kalir. macOS bu secenegi yok sayar; orada tusu menu yakalarsa olay
// arayuze hic ulasmaz ve isi menu ogesinin kendisi yapar.
function olcegiKur () {
  ipcMain.on('olcek:degistir', (olay, komut) => {
    // Arayuzden gelen degere guvenilmez.
    if (!yakinlik.komutGecerliMi(komut)) return
    yakinligiUygula(olay.sender, komut)
  })
}

// --- Acilis penceresi --------------------------------------------------------

// Yuz bulma ve arka plan ayirma modelleri 11 MB ve ilk calistirmada shader
// derliyorlar; bu is bitmeden acilan arayuzde "Otomatik hizala" saniyelerce
// bekletiyordu. Bu yuzden once cercevesiz bir acilis penceresi gosterilir,
// modeller ana pencerede (gizliyken) yuklenir ve uygulama hazir olunca ekrana
// gelir.
//
// Modelleri arayuz yukler cunku TensorFlow WebGL istiyor; ana surecin isi
// yalnizca iki pencereyi sirayla gostermek.
const ACILIS = process.env.HV_ACILIS !== '0'

// Yukleme beklenmedik bicimde uzarsa (ya da hic bitmezse) kullanici acilis
// penceresine bakakalmamali: uygulama bu surenin sonunda kendiliginden acilir.
// Olculdu: ilk acilis ~23 sn (ekran kartinin golgelendirici onbellegi bos),
// sonraki acilislar ~8 sn. Sinir, ilk acilisi kesmeyecek kadar uzak.
const ACILIS_EN_FAZLA_BEKLEME = 45000

let acilisPenceresi = null
let acilisZamanlayicisi = null

function acilisPenceresiOlustur () {
  const pencere = new BrowserWindow({
    width: 560,
    height: 262,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#eef0f4',
    title: 'Hiper Vesika',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: GELISTIRICI
    }
  })

  pencere.once('ready-to-show', () => pencere.show())
  pencere.loadURL(
    `${ARAYUZ_KAYNAGI}/acilis.html?surum=${encodeURIComponent(app.getVersion())}`
  )

  return pencere
}

// Uygulamayi ekrana getirir ve acilis penceresini kapatir. Birden fazla kez
// cagrilabilir (hem arayuzun haberi hem de sure asimi buraya duser).
function uygulamayiGoster (pencere) {
  clearTimeout(acilisZamanlayicisi)
  acilisZamanlayicisi = null

  if (!pencere || pencere.isDestroyed()) return

  if (!pencere.isVisible()) pencere.show()
  pencere.focus()

  if (acilisPenceresi && !acilisPenceresi.isDestroyed()) acilisPenceresi.close()
  acilisPenceresi = null
}

function acilisiKur (pencere) {
  // Asama bildirimi arayuzden geliyor; ana surec onu yalnizca acilis
  // penceresine tasir. Icerik metne cevrilmeden anahtar olarak kullanildigi
  // icin dogrulama orada (js/acilis.js -> bildirimGecerliMi), burada yalnizca
  // sekli denetlenir.
  ipcMain.on('acilis:asama', (olay, mesaj) => {
    if (typeof mesaj?.kod !== 'string' || typeof mesaj?.durum !== 'string') return
    if (acilisPenceresi && !acilisPenceresi.isDestroyed()) {
      acilisPenceresi.webContents.send('acilis:durum', mesaj)
    }
  })

  ipcMain.on('acilis:bitti', () => uygulamayiGoster(pencere))

  acilisZamanlayicisi = setTimeout(
    () => uygulamayiGoster(pencere), ACILIS_EN_FAZLA_BEKLEME
  )
}

// --- Menu --------------------------------------------------------------------

// Kisayollar menude tanimlanir; platform ayrimini CmdOrCtrl yapar.
// macOS'ta Apple menusunun altindaki "Hakkinda" penceresi, Windows ve Linux'ta
// ise Yardim menusunden acilan kutu. Doldurulmazsa yalnizca ad ve surum
// gorunur; kullanicinin en cok merak ettigi sey (fotograflarin nereye gittigi)
// tam olarak burada yaziyor.
function hakkindaKur () {
  const tanitim = [
    'Vesikalık fotoğraf hazırlama ve baskı kağıdına dizme uygulaması.',
    '',
    'Tüm görüntü işleme bu bilgisayarda yapılır: fotoğraflar hiçbir sunucuya ' +
      'gönderilmez, uygulama internet bağlantısı kurmaz.',
    '',
    'https://github.com/hiperajans/hipervesika'
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

// Arayuzun icinde bulundugu mod menude isaretli durur. Arayuz modu her
// degistirdiginde (ilk acilis sorusu ya da menunun kendisi) buraya bildirir;
// menu yeniden kurularak isaret guncellenir. Ana surec ayar dosyasini kendisi
// okumaz, tek kaynak arayuzdur.
let gecerliMod = null

function moduKur () {
  ipcMain.on('mod:bildir', (olay, mod) => {
    if (!ayarlar.MODLAR.includes(mod) || mod === gecerliMod) return
    gecerliMod = mod
    menuyuKur()
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
        // Mod secimi arayuzun kendisini degistirir, bu yuzden yakinlastirma
        // gibi pencere ayarlarindan once ve ayrilmis durur.
        {
          label: 'Basit mod',
          type: 'radio',
          checked: gecerliMod === 'basit',
          click: komut('mod-basit')
        },
        {
          label: 'Gelişmiş mod',
          type: 'radio',
          checked: gecerliMod === 'gelismis',
          click: komut('mod-gelismis')
        },
        { type: 'separator' },
        // Hazir zoom rolleri kullanilmiyor: hizlandiricilari klavye dizenine
        // takiliyor (bkz. olcegiKur). Kisayol yine de menude yaziyor ki
        // kullanici nereden bulacagini bilsin; registerAccelerator: false
        // gostermeye devam eder, sisteme kaydettirmez.
        {
          label: 'Gerçek boyut',
          accelerator: 'CmdOrCtrl+0',
          registerAccelerator: false,
          click: yakinlikKomutu('sifirla')
        },
        {
          label: 'Yakınlaştır',
          accelerator: 'CmdOrCtrl+Plus',
          registerAccelerator: false,
          click: yakinlikKomutu('buyut')
        },
        {
          label: 'Uzaklaştır',
          accelerator: 'CmdOrCtrl+-',
          registerAccelerator: false,
          click: yakinlikKomutu('kucult')
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam ekran' },
        ...(GELISTIRICI
          ? [{ role: 'toggleDevTools', label: 'Geliştirici araçları' }]
          : [])
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
      sandbox: true,
      devTools: GELISTIRICI,
      // Pencere acilis boyunca gizli duruyor ve modelleri o yukluyor; Chromium
      // gorunmeyen pencerede zamanlayicilari kistigi icin yukleme surunurdu.
      backgroundThrottling: false
    }
  })

  // Pencereyi boyanmadan gostermek beyaz bir parlamaya yol aciyor. Acilis
  // penceresi varsa gosterme kararini o verir (bkz. uygulamayiGoster).
  window.once('ready-to-show', () => {
    if (!acilisPenceresi) window.show()
  })

  // Arayuz uygulamanin icinden disari gezinemez; harici baglantilar
  // kullanicinin varsayilan tarayicisinda acilir.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  window.loadURL(`${ARAYUZ_KAYNAGI}/index.html`)

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
  dogrudanBaskiyiKur()
  olcegiKur()
  moduKur()
  hakkindaKur()
  menuyuKur()

  // Acilis penceresi once acilir: ana pencere modeller yuklenirken gizli
  // durur ve is bitince (ya da sure asiminda) ekrana gelir.
  if (ACILIS) acilisPenceresi = acilisPenceresiOlustur()
  const pencere = createWindow()
  if (ACILIS) acilisiKur(pencere)

  // macOS'ta Dock'tan tiklaninca pencere yeniden acilir. Acilis penceresi
  // yalnizca uygulamanin ilk acilisina aittir; burada tekrarlanmaz.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS disinda son pencere kapaninca uygulama da kapanir.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
