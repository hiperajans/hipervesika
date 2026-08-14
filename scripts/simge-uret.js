'use strict'

// Uygulama simgelerini uretir: `npm run simge`
//
// Kaynak tek bir vektor tanimidir (scripts/simge/cizim.js). Bu betik onu
// Electron'un tuvalinde her boyutta yeniden rasterler ve platformlarin
// bekledigi kaplara yazar:
//
//   build/icons/icon.icns   macOS   (824/1024 sablonu, golgeli)
//   build/icons/icon.ico    Windows (tuvali dolduran yerlesim)
//   build/icons/icon.png    Linux   (512 px)
//   build/icons/<n>x<n>.png Linux   (hicolor boyutlari)
//   assets/simge.svg        vektor kaynak (macOS yerlesimi)
//   assets/simge-duz.svg    vektor kaynak (duz yerlesim)
//
// Rasterleme neden Electron'da: depoda gorsel isleyen bir bagimlilik yok ve
// eklemek istemiyoruz. Electron zaten kurulu ve icinde Chromium'un tuvali
// var; ayni motor uygulamanin kendisinde de cizim yapiyor. Donanim
// hizlandirma kapatilir, boylece cikti makineden makineye degismez.

const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const { sahne, svgUret } = require('./simge/cizim')
const { icoUret, icnsUret } = require('./simge/kap')

const kok = path.resolve(__dirname, '..')
const simgeKlasoru = path.join(kok, 'build', 'icons')
const varlikKlasoru = path.join(kok, 'assets')

// ICO 256 px'ten buyugunu tasiyamaz. Windows kabuk bu araligi kucuk simge,
// ayrintili gorunum ve buyuk kutucuk icin kullanir.
const ICO_BOYUTLARI = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

// freedesktop hicolor temasinin bekledigi olculer.
const LINUX_BOYUTLARI = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

// icns kap tablosunun ihtiyac duydugu piksel olculeri.
const MACOS_BOYUTLARI = [16, 32, 64, 128, 256, 512, 1024]

const ONEK = 'data:image/png;base64,'

function benzersiz (sayilar) {
  return [...new Set(sayilar)].sort((a, b) => a - b)
}

async function pencereAc () {
  const pencere = new BrowserWindow({
    show: false,
    width: 256,
    height: 256,
    webPreferences: { backgroundThrottling: false, sandbox: true }
  })
  await pencere.loadURL('about:blank')
  // Sondaki `true` sart: executeJavaScript son ifadenin degerini geri
  // gonderir ve islev nesnesi surecler arasi kopyalanamaz.
  await pencere.webContents.executeJavaScript(
    `${fs.readFileSync(path.join(__dirname, 'simge', 'tuval.js'), 'utf8')}\n;true`
  )
  return pencere
}

async function pngUret (pencere, boyut, yerlesim) {
  const tanim = JSON.stringify(sahne(boyut, { yerlesim }))
  const veri = await pencere.webContents.executeJavaScript(`globalThis.hvSimgeCiz(${tanim})`)
  if (!veri.startsWith(ONEK)) throw new Error(`${boyut} px cizilemedi`)
  return Buffer.from(veri.slice(ONEK.length), 'base64')
}

async function tumunuUret (pencere, boyutlar, yerlesim) {
  const cikti = new Map()
  // Sirayla: es zamanli calistirmanin kazandiracagi sey yok, hata mesajinda
  // hangi boyutta takildigi belli olsun.
  for (const boyut of boyutlar) cikti.set(boyut, await pngUret(pencere, boyut, yerlesim))
  return cikti
}

function yaz (dosya, icerik) {
  fs.mkdirSync(path.dirname(dosya), { recursive: true })
  fs.writeFileSync(dosya, icerik)
  const kb = (icerik.length / 1024).toFixed(1)
  console.log(`  ${path.relative(kok, dosya).padEnd(30)} ${kb.padStart(8)} KB`)
}

async function uret () {
  const pencere = await pencereAc()

  console.log('Vektor kaynak')
  yaz(path.join(varlikKlasoru, 'simge.svg'), svgUret(1024, { yerlesim: 'macos' }))
  yaz(path.join(varlikKlasoru, 'simge-duz.svg'), svgUret(1024, { yerlesim: 'duz' }))

  console.log('macOS')
  const macos = await tumunuUret(pencere, MACOS_BOYUTLARI, 'macos')
  yaz(path.join(simgeKlasoru, 'icon.icns'), icnsUret(macos))

  // Kaynaktan calistirmada Dock'a verilecek kopya. Electron'un nativeImage'i
  // .icns cozemedigi icin ayri bir PNG gerekiyor. Alt klasorde duruyor:
  // electron-builder'in Linux simge setini `build/icons/*.png` ile taradigi,
  // oraya `<n>x<n>.png` disinda bir ad koymanin karisiklik cikardigi icin.
  yaz(path.join(simgeKlasoru, 'macos', '512x512.png'), macos.get(512))

  console.log('Windows ve Linux')
  const duz = await tumunuUret(pencere, benzersiz([...ICO_BOYUTLARI, ...LINUX_BOYUTLARI]), 'duz')

  yaz(
    path.join(simgeKlasoru, 'icon.ico'),
    icoUret(ICO_BOYUTLARI.map((boyut) => ({ boyut, png: duz.get(boyut) })))
  )

  for (const boyut of LINUX_BOYUTLARI) {
    yaz(path.join(simgeKlasoru, `${boyut}x${boyut}.png`), duz.get(boyut))
  }
  // electron-builder ve cogu masaustu ortami tek dosya isterse bunu okur.
  yaz(path.join(simgeKlasoru, 'icon.png'), duz.get(512))

  pencere.destroy()
}

// Yazilim rasterleme: ayni kaynaktan her makinede ayni bayt cikar, yoksa
// simgeler surucuye gore degisir ve depoda anlamsiz farklar birikir.
app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  try {
    await uret()
    app.exit(0)
  } catch (hata) {
    console.error('Simge uretilemedi:', hata)
    app.exit(1)
  }
})
