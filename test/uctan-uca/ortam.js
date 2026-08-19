'use strict'

// Uctan uca testlerin ortak koşum takimi: gercek uygulamayi Electron ile acar,
// her test kendi userData klasorunde calisir (kullanicinin ayarlarina dokunmaz).
//
// Fotograf kaynagi iki turlu olabilir:
//   - Varsayilan: test/uctan-uca/gorsel-uret.js ile uretilen sentetik portre.
//     Depoya kisisel veri girmedigi icin (AGENTS.md, kural 5) CI'da da calisir.
//   - HV_FOTOGRAFLAR ortam degiskeni bir klasoru gosteriyorsa oradaki gercek
//     fotograflar kullanilir. Yuz bulma ve arka plan ayirma yalnizca boyle
//     sinanabilir; aksi halde ilgili testler atlanir.

const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { _electron: electron } = require('playwright-core')

const { pngUret } = require('./gorsel-uret.js')

const DEPO = path.resolve(__dirname, '..', '..')
const FOTOGRAF_UZANTILARI = ['.jpg', '.jpeg', '.png', '.webp']

// --- Fotograf kaynagi --------------------------------------------------------

// HV_FOTOGRAFLAR klasorundeki gercek fotograflar. Yoksa bos dizi doner.
function gercekFotograflar () {
  const klasor = process.env.HV_FOTOGRAFLAR
  if (!klasor || !fs.existsSync(klasor)) return []

  return fs.readdirSync(klasor)
    .filter((ad) => FOTOGRAF_UZANTILARI.includes(path.extname(ad).toLowerCase()))
    .map((ad) => path.join(klasor, ad))
    .sort()
}

// Yuz gerektiren testler icin: gercek fotograf yoksa atlama sebebi doner.
function yuzGerekli () {
  return gercekFotograflar().length
    ? null
    : 'gerçek fotoğraf yok (HV_FOTOGRAFLAR ayarlanmamış); yüz ve arka plan testleri atlandı'
}

// --- ICC profili -------------------------------------------------------------

// Sistemde kurulu bir CMYK profili. Depoya profil konmuyor (baskasinin telifli
// verisi olabilir); bulunamazsa ilgili testler atlanir.
const PROFIL_KLASORLERI = [
  path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'spool', 'drivers', 'color'),
  '/System/Library/ColorSync/Profiles',
  '/Library/ColorSync/Profiles',
  '/usr/share/color/icc',
  '/usr/share/color/icc/colord'
]

function cmykProfili () {
  for (const klasor of PROFIL_KLASORLERI) {
    let dosyalar = []
    try {
      dosyalar = fs.readdirSync(klasor).filter((ad) => /\.(icc|icm)$/i.test(ad))
    } catch {
      continue
    }

    for (const ad of dosyalar.slice(0, 40)) {
      const yol = path.join(klasor, ad)
      try {
        // Renk uzayi profil basliginda 16. bayttan itibaren yazar.
        const bas = Buffer.alloc(20)
        const dosya = fs.openSync(yol, 'r')
        fs.readSync(dosya, bas, 0, 20, 0)
        fs.closeSync(dosya)
        if (bas.toString('latin1', 16, 20) === 'CMYK') return yol
      } catch { /* okunamayan dosya */ }
    }
  }
  return null
}

// --- Gecici dosyalar ---------------------------------------------------------

class Calisma {
  constructor (ad) {
    this.klasor = fs.mkdtempSync(path.join(os.tmpdir(), `hv-${ad}-`))
    this.profil = path.join(this.klasor, 'profil')
    fs.mkdirSync(this.profil)
  }

  // Sentetik ya da gercek fotograf; sira, birden fazla istendiginde ayirt eder.
  fotograf (sira = 0, { gercek = false } = {}) {
    if (gercek) {
      const dosyalar = gercekFotograflar()
      if (!dosyalar.length) throw new Error('Gerçek fotoğraf istendi ama bulunamadı.')
      return dosyalar[sira % dosyalar.length]
    }

    const yol = path.join(this.klasor, `deneme-${sira}.png`)
    if (!fs.existsSync(yol)) fs.writeFileSync(yol, pngUret(1200, 1800, sira * 37))
    return yol
  }

  // Testin uretecegi cikti dosyasi icin yol; testten once silinir.
  cikti (ad) {
    const yol = path.join(this.klasor, ad)
    if (fs.existsSync(yol)) fs.unlinkSync(yol)
    return yol
  }

  temizle () {
    fs.rmSync(this.klasor, { recursive: true, force: true })
  }
}

// --- Uygulama ----------------------------------------------------------------

// Acilis penceresi acikken ilk pencere odur; ana arayuz index.html yukleyendir.
async function anaPencere (uygulama) {
  const uygun = (pencere) => pencere.url().includes('index.html')
  return uygulama.windows().find(uygun) ??
    await uygulama.waitForEvent('window', { predicate: uygun, timeout: 60000 })
}

function acilisPenceresi (uygulama) {
  return uygulama.windows().find((pencere) => pencere.url().includes('acilis.html')) ?? null
}

// Acilis penceresi testlerde varsayilan olarak kapalidir (HV_ACILIS=0): her
// test dosyasinda modellerin yuklenmesini beklemek suiti dakikalarca uzatirdi.
// Acilisi sinayan test onu acikca ister.
async function uygulamayiAc (calisma, { ekArgumanlar = [], acilis = false } = {}) {
  const uygulama = await electron.launch({
    args: ['.', `--user-data-dir=${calisma.profil}`, ...ekArgumanlar],
    cwd: DEPO,
    executablePath: require(path.join(DEPO, 'node_modules', 'electron')),
    env: { ...process.env, HV_ACILIS: acilis ? '1' : '0' }
  })

  const sayfa = acilis ? await anaPencere(uygulama) : await uygulama.firstWindow()
  const hatalar = []
  sayfa.on('pageerror', (hata) => hatalar.push(hata.message))

  await sayfa.waitForFunction(
    () => document.getElementById('sistem-bilgisi').textContent.length > 0,
    null, { timeout: 60000 })
  // Ayarlar okunup uygulanana kadar bekle.
  await sayfa.waitForTimeout(1200)

  return { uygulama, sayfa, hatalar }
}

// Ilk acilista once mod sorulur (Basit / Gelismis) ve pencere kapatilamaz.
// Testler arayuzun tamamiyla calistigi icin varsayilan olarak gelismis secilir;
// basit modu sinayan testler 'basit' gonderir. Modu zaten secilmis bir profilde
// pencere acilmaz, islev sessizce doner.
//
// Soru ayarlar okunduktan sonra soruluyor ve iki yoldan biri isliyor: kayitli
// mod varsa body'ye hvMod yaziliyor, yoksa pencere aciliyor. Bu yuzden ikisinden
// biri gerceklesene kadar beklenir. Tek bir anlik bakis yeterli degildi: yavas
// bir makinede pencere henuz acilmamis oluyor, islev sessizce donuyor ve pencere
// az sonra acilip butun tiklamalari yiyordu (macOS kosucusunda dogrudan baski
// testlerinin tamami boyle dusuyordu).
async function moduSec (sayfa, mod = 'gelismis') {
  await sayfa.waitForFunction(() =>
    document.body.dataset.hvMod !== undefined ||
    document.getElementById('mod-modali')?.classList.contains('show') === true,
  null, { timeout: 60000 })

  const acik = await sayfa.evaluate(
    () => document.getElementById('mod-modali')?.classList.contains('show') === true)
  if (!acik) return

  await sayfa.click(mod === 'basit' ? '#btn-mod-basit' : '#btn-mod-gelismis')
  await sayfa.waitForSelector('#mod-modali.show', { state: 'hidden' })
  await sayfa.waitForTimeout(300)
}

// Ilk acilista tanitim turu cikar ve tiklamalari tutar.
async function turuKapat (sayfa) {
  const acik = await sayfa.evaluate(() => {
    const katman = document.getElementById('tanitim-katmani')
    return katman !== null && !katman.classList.contains('d-none')
  })
  if (!acik) return

  await sayfa.keyboard.press('Escape')
  await sayfa.waitForFunction(
    () => document.getElementById('tanitim-katmani').classList.contains('d-none'))
  await sayfa.waitForTimeout(300)
}

async function fotografYukle (sayfa, yol) {
  await sayfa.setInputFiles('#dosya-girisi', yol)
  await sayfa.waitForFunction(
    () => document.getElementById('gorsel-bilgisi').textContent.length > 0,
    null, { timeout: 90000 })
  await sayfa.waitForTimeout(400)
}

// Panel uc adima bolundu; gizli sekmedeki denetime dokunulamaz.
async function adima (sayfa, ad) {
  await sayfa.click(`#adim-${ad}-dugmesi`)
  await sayfa.waitForSelector(`#adim-${ad}.active`)
  await sayfa.waitForTimeout(300)
}

// Kaydetme penceresini test dosyasina yonlendirir.
async function kaydetmeyiYonlendir (uygulama, hedef) {
  await uygulama.evaluate(async ({ dialog }, yol) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: yol })
  }, hedef)
}

// Kaydirac degerini degistirir ve onizlemenin tazelenmesini bekler.
async function kaydiracAyarla (sayfa, secici, deger, bekleme = 700) {
  await sayfa.fill(secici, String(deger))
  await sayfa.dispatchEvent(secici, 'input')
  await sayfa.waitForTimeout(bekleme)
}

// Hazir bir uygulama: acar, turu kapatir, istenirse fotograf yukler.
// Doner: { uygulama, sayfa, hatalar, kapat }
async function hazirla (calisma, { fotograf = null, mod = 'gelismis', acilis = false } = {}) {
  const { uygulama, sayfa, hatalar } = await uygulamayiAc(calisma, { acilis })
  await moduSec(sayfa, mod)
  await turuKapat(sayfa)
  if (fotograf) await fotografYukle(sayfa, fotograf)

  return {
    uygulama,
    sayfa,
    hatalar,
    kapat: async () => { await uygulama.close() }
  }
}

module.exports = {
  DEPO,
  Calisma,
  gercekFotograflar,
  yuzGerekli,
  cmykProfili,
  uygulamayiAc,
  anaPencere,
  acilisPenceresi,
  moduSec,
  turuKapat,
  fotografYukle,
  adima,
  kaydetmeyiYonlendir,
  kaydiracAyarla,
  hazirla
}
