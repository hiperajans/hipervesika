'use strict'

// Dogrudan baski: yazdirma paneli acilmadan, secilen yaziciya gonderme.
//
// Uygulamanin varsayilan yolu sistemin yazdirma panelinden gecer; iyi bir
// varsayilan ama panelde "kagida sigdir" secili kalirsa vesikaligin olcusu
// bozulur. Dogrudan baskida yazici, kopya ve cozunurluk uygulamada secilir ve
// olcek %100'de sabit kalir.
//
// Is iki yoldan biriyle gider:
//
//   Windows  Chromium'un kendi baski yolu (webContents.print, silent: true).
//            Surucusu kurulu her yazici calisir; olcu pageSize'a mikron
//            cinsinden verilir. Ek bir ikiliye ihtiyac yok.
//
//   macOS    CUPS'a (lp). Chromium sessiz baskida kagit turu ve kaliteyi
//   Linux    kabul etmiyor, CUPS ise IPP niteligi olarak aliyor. lp isletim
//            sisteminin parcasi; paketlenen bir sey degil.
//
// Kagit turu ve kalite Windows'ta surucunun DEVMODE'unda duruyor ve disaridan
// degistirilemiyor; orada ayar surucunun kendi penceresinde yapilir
// (bkz. tercihKomutu).

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFile } = require('node:child_process')

// CUPS'un IPP karsiliklari. Windows'ta bos liste doner: calismayan bir secim
// kutusu gostermektense hic gostermemek dogru.
const KAGIT_TURLERI = [
  { kod: 'otomatik', ad: 'Sürücünün ayarı', ipp: null },
  { kod: 'parlak', ad: 'Parlak fotoğraf kağıdı', ipp: 'photographic-glossy' },
  { kod: 'mat', ad: 'Mat fotoğraf kağıdı', ipp: 'photographic-matte' },
  { kod: 'duz', ad: 'Düz kağıt', ipp: 'stationery' }
]

// IPP print-quality: 3 taslak, 4 normal, 5 yuksek. Taslak vesikalikta ise
// yaramaz, listeye alinmadi.
const KALITELER = [
  { kod: 'otomatik', ad: 'Sürücünün ayarı', ipp: null },
  { kod: 'normal', ad: 'Normal', ipp: 4 },
  { kod: 'yuksek', ad: 'Yüksek', ipp: 5 }
]

function windowsMu (platform) {
  return platform === 'win32'
}

function kagitTuruSecenekleri (platform = process.platform) {
  return windowsMu(platform) ? [] : KAGIT_TURLERI
}

function kaliteSecenekleri (platform = process.platform) {
  return windowsMu(platform) ? [] : KALITELER
}

function ippDegeri (liste, kod) {
  return liste.find((oge) => oge.kod === kod)?.ipp ?? null
}

// --- lp (CUPS) ---------------------------------------------------------------

function yolKlasorleri (env = process.env) {
  return (env.PATH ?? '').split(path.delimiter).filter(Boolean)
}

function dosyaVarMi (yol) {
  try {
    return fs.statSync(yol).isFile()
  } catch {
    return false
  }
}

// lp CUPS ile birlikte gelir; masaustu bir macOS ya da Linux kurulumunda
// bulunur. Yoksa dogrudan baski kapanir ve sistem paneli calismaya devam eder.
function lpYolu (env = process.env) {
  for (const klasor of [...yolKlasorleri(env), '/usr/bin', '/bin', '/usr/local/bin']) {
    const yol = path.join(klasor, 'lp')
    if (dosyaVarMi(yol)) return yol
  }
  return null
}

// Olcu CUPS'a milimetre olarak bildirilir ve "sayfaya sigdir" acikca kapatilir;
// urunun temel vaadi olcunun bozulmamasi.
function lpAdimi ({
  lp = 'lp', pdfYolu, yazici, kopya = 1, kagitMm,
  kagitTuru = 'otomatik', kalite = 'otomatik', kenarliksiz = false
}) {
  if (!yazici) throw new Error('Yazıcı seçilmedi.')

  const secenekler = [
    '-o', `media=Custom.${kagitMm.genislik}x${kagitMm.yukseklik}mm`,
    '-o', 'fit-to-page=false',
    '-o', 'scaling=100'
  ]

  if (kenarliksiz) secenekler.push('-o', 'page-border=none')

  // Kagit turu ve kalite yalnizca acikca secildiyse gonderilir; "otomatik"
  // surucunun kendi ayarini bozmamak demek.
  const turDegeri = ippDegeri(KAGIT_TURLERI, kagitTuru)
  if (turDegeri) secenekler.push('-o', `media-type=${turDegeri}`)

  const kaliteDegeri = ippDegeri(KALITELER, kalite)
  if (kaliteDegeri) secenekler.push('-o', `print-quality=${kaliteDegeri}`)

  return {
    komut: lp,
    argumanlar: ['-d', yazici, '-n', String(kopya), ...secenekler, pdfYolu]
  }
}

// --- Yazicinin kendi tercih penceresi ----------------------------------------

// Kagit turu ve kalite Windows'ta yalnizca burada ayarlanabiliyor; secim
// surucude kalici oldugu icin bir kez yapilmasi yeterli. Uc platform da ele
// alinir (bkz. AGENTS.md, kural 4).
function tercihKomutu (yazici, platform = process.platform) {
  if (platform === 'win32') {
    // printui.dll isletim sisteminin yazici arayuzu; /e o yazicinin tercih
    // penceresini acar.
    return {
      komut: 'rundll32.exe',
      argumanlar: ['printui.dll,PrintUIEntry', '/e', '/n', yazici]
    }
  }

  if (platform === 'darwin') {
    return { adres: 'x-apple.systempreferences:com.apple.Print-Scan-Settings.extension' }
  }

  // CUPS'un web arayuzu her masaustu ortaminda var; system-config-printer
  // her dagitimda kurulu degil.
  return { adres: `http://localhost:631/printers/${encodeURIComponent(yazici)}` }
}

// --- Durum ve calistirma -----------------------------------------------------

// Ozelligin kullanilabilir olup olmadigi. Windows'ta her zaman acik (is
// Chromium'dan gidiyor), POSIX'te lp bulunmasina bagli.
function durum ({ platform = process.platform, env = process.env } = {}) {
  const cups = windowsMu(platform) ? null : lpYolu(env)

  return {
    var: windowsMu(platform) || Boolean(cups),
    sistem: windowsMu(platform) ? 'chromium' : 'cups',
    lp: cups,
    kagitTurleri: kagitTuruSecenekleri(platform),
    kaliteler: kaliteSecenekleri(platform)
  }
}

function geciciYol (uzanti, klasor = os.tmpdir()) {
  const ad = `hiper-vesika-${process.pid}-${Date.now()}.${uzanti}`
  return path.join(klasor, ad)
}

function calistir (komut, argumanlar, { zamanAsimi = 120000 } = {}) {
  return new Promise((cozumle, reddet) => {
    execFile(
      komut, argumanlar, { timeout: zamanAsimi, windowsHide: true },
      (hata, cikti, hataCiktisi) => {
        if (hata) {
          const sebep = (hataCiktisi || cikti || hata.message).toString().trim()
          reddet(new Error(sebep.split('\n').slice(0, 3).join(' ') || hata.message))
          return
        }
        cozumle((cikti || '').toString())
      }
    )
  })
}

// PDF'i gecici bir dosyaya yazip CUPS'a gonderir. Gecici dosya her durumda
// silinir: vesikalik kisisel veridir, diskte kalmamali.
async function cupsaGonder ({ lp, pdf, geciciKlasor = os.tmpdir(), ...secenekler }) {
  const pdfYolu = geciciYol('pdf', geciciKlasor)
  await fs.promises.writeFile(pdfYolu, pdf)

  try {
    const adim = lpAdimi({ lp, pdfYolu, ...secenekler })
    await calistir(adim.komut, adim.argumanlar)
  } finally {
    await fs.promises.rm(pdfYolu, { force: true }).catch(() => {})
  }
}

module.exports = {
  KAGIT_TURLERI,
  KALITELER,
  kagitTuruSecenekleri,
  kaliteSecenekleri,
  ippDegeri,
  yolKlasorleri,
  lpYolu,
  lpAdimi,
  tercihKomutu,
  durum,
  geciciYol,
  cupsaGonder
}
