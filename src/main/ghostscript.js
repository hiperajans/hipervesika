'use strict'

// Ghostscript ile dogrudan baski.
//
// Uygulamanin kendi baski yolu sistemin yazdirma panelinden gecer: yazici,
// kopya ve olcekleme kararini surucu verir. Bu iyi bir varsayilan ama iki
// eksigi var — kullanici her baskida panelden geciyor ve "kagida sigdir"
// secili kalirsa vesikaligin olcusu bozuluyor.
//
// Ghostscript kuruluysa (ya da paketle geldiyse) sayfa dogrudan yaziciya
// gonderilir: panel acilmaz, olcek sabittir ve rasterlestirme cozunurlugunu
// biz veririz. Bulunamazsa ozellik kapanir, mevcut yol aynen calisir.
//
// Ikili dosya aranma sirasi: paketle gelen kopya -> PATH -> bilinen kurulum
// klasorleri. Yol hesaplari saf tutuldu ki birim testlerinde uc platform da
// sinanabilsin.

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFile } = require('node:child_process')

// Windows'ta konsol surumu kullanilir (gswin64c); pencereli surum (gswin64)
// is bitince acik kaliyor.
const IKILI_ADLARI = {
  win32: ['gswin64c.exe', 'gswin32c.exe'],
  darwin: ['gs'],
  linux: ['gs']
}

// Paketle gelen kopyanin klasoru. scripts/ghostscript.js buraya yazar,
// electron-builder extraResources ile pakete tasir.
const PAKET_KLASORU = 'ghostscript'

// Baski yolu secenekleri.
//
// Windows'ta her sey surucu uzerinden (mswinpr2) gider: PostScript de PCL de
// olsa isi surucu cevirir, ayrica bir aygit secmeye gerek yoktur. POSIX'te is
// CUPS'a verilir; CUPS kendi icinde zaten Ghostscript kullanir, ama surucusu
// olmayan ag yazicilari icin dogrudan PostScript ya da PCL uretmek gerekir.
const AYGITLAR = [
  {
    kod: 'otomatik',
    ad: 'Sürücünün kendi yolu',
    aciklama: 'İş yazıcının sürücüsüne verilir. Sürücüsü kurulu her yazıcıda çalışır.'
  },
  {
    kod: 'postscript',
    ad: 'PostScript',
    aciklama: 'Sayfa PostScript olarak üretilip gönderilir; PostScript bekleyen ' +
      'ofis ve ağ yazıcıları için.'
  },
  {
    kod: 'pcl',
    ad: 'PCL',
    aciklama: 'Sayfa PCL-XL olarak üretilip gönderilir; PCL bekleyen yazıcılar için.'
  }
]

// POSIX aygit karsiliklari. Renkli/siyah-beyaz ayrimi yapilmaz: renkli aygit
// siyah-beyaz yazicida da dogru sonuc verir, tersi rengi atardi.
const AYGIT_SURUCULERI = {
  postscript: { aygit: 'ps2write', uzanti: 'ps' },
  pcl: { aygit: 'pxlcolor', uzanti: 'pcl' }
}

// Kagit turu ve baski kalitesi.
//
// Bunlar Ghostscript'in degil surucunun ayarlaridir. CUPS onlari IPP
// nitelikleriyle kabul eder (media-type, print-quality), bu yuzden macOS ve
// Linux'ta uygulamadan secilebilirler. Windows'ta is GDI uzerinden surucuye
// gidiyor ve DEVMODE'a disaridan mudahale etmenin tasinabilir bir yolu yok;
// orada ayar surucunun kendi penceresinde yapilir (bkz. yaziciTercihleri).
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

const INC_MM = 25.4

function ikiliAdlari (platform) {
  return IKILI_ADLARI[platform] ?? IKILI_ADLARI.linux
}

// Windows'ta her platform icin ayri bir alt klasor tutulur; ayni pakette iki
// platformun ikilisi bulunmaz ama yol tahmini platformdan bagimsiz olsun.
function paketKlasoru (kaynakKok, platform) {
  return path.join(kaynakKok, PAKET_KLASORU, platform)
}

// Kurulumun bilinen yerleri. Windows'ta surum numarasi klasor adinda gectigi
// icin klasor taranir ve en yenisi once denenir.
function bilinenKlasorler (platform, env = process.env) {
  if (platform === 'win32') {
    const kokler = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432]
      .filter(Boolean)
      .map((kok) => path.join(kok, 'gs'))

    const klasorler = []
    for (const kok of kokler) {
      let icerik = []
      try {
        icerik = fs.readdirSync(kok, { withFileTypes: true })
          .filter((oge) => oge.isDirectory())
          .map((oge) => oge.name)
          .sort()
          .reverse()
      } catch {
        continue
      }
      for (const ad of icerik) klasorler.push(path.join(kok, ad, 'bin'))
    }
    return klasorler
  }

  if (platform === 'darwin') {
    return ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin', '/usr/bin']
  }
  return ['/usr/bin', '/usr/local/bin', '/bin']
}

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

// Ikiliyi bulur. Donen kaynak kullaniciya yazilir: paketle gelen kopya ile
// sistemdeki kurulum ayni sey degil, surum farki sorun cikarabilir.
function bul ({ paketKoku = null, platform = process.platform, env = process.env } = {}) {
  const adlar = ikiliAdlari(platform)

  const aramalar = [
    ...(paketKoku ? [{ kaynak: 'paket', klasorler: [path.join(paketKlasoru(paketKoku, platform), 'bin')] }] : []),
    { kaynak: 'sistem', klasorler: yolKlasorleri(env) },
    { kaynak: 'sistem', klasorler: bilinenKlasorler(platform, env) }
  ]

  for (const arama of aramalar) {
    for (const klasor of arama.klasorler) {
      for (const ad of adlar) {
        const yol = path.join(klasor, ad)
        if (dosyaVarMi(yol)) return { yol, kaynak: arama.kaynak }
      }
    }
  }

  return null
}

// --- Komut kurma -------------------------------------------------------------

function punto (mm) {
  return Number(((mm / INC_MM) * 72).toFixed(4))
}

function aygitSecenekleri (platform = process.platform) {
  // Windows'ta surucu disinda bir yol yok: uretilen PostScript ya da PCL'i
  // yazici kuyruguna ham olarak vermenin tasinabilir bir yolu bulunmuyor.
  if (platform === 'win32') return [AYGITLAR[0]]
  return AYGITLAR
}

function aygitGecerliMi (kod, platform = process.platform) {
  return aygitSecenekleri(platform).some((aygit) => aygit.kod === kod)
}

// Windows'ta bos liste doner: orada bu ayarlar surucunun penceresinden yapilir
// ve arayuz calismayan bir secim kutusu gostermemeli.
function kagitTuruSecenekleri (platform = process.platform) {
  return platform === 'win32' ? [] : KAGIT_TURLERI
}

function kaliteSecenekleri (platform = process.platform) {
  return platform === 'win32' ? [] : KALITELER
}

function ippDegeri (liste, kod) {
  return liste.find((oge) => oge.kod === kod)?.ipp ?? null
}

// Windows: is tek adimda surucuye gider (mswinpr2 = GDI). Olcu sabitlenir,
// PDF'in kendi sayfa olcusu ya da "sayfaya sigdir" devreye girmez.
function windowsAdimi ({ gsYolu, pdfYolu, yazici, kopya, dpi, kagitMm }) {
  return {
    komut: gsYolu,
    argumanlar: [
      '-dPrinted',
      '-dBATCH',
      '-dNOPAUSE',
      '-dNoCancel',
      '-q',
      '-sDEVICE=mswinpr2',
      // Olcegin sabit kalmasi urunun temel vaadi: FIXEDMEDIA verilen olcuyu
      // dayatir, PDFFitPage verilmedigi icin sayfa kucultulmez.
      '-dFIXEDMEDIA',
      `-dDEVICEWIDTHPOINTS=${punto(kagitMm.genislik)}`,
      `-dDEVICEHEIGHTPOINTS=${punto(kagitMm.yukseklik)}`,
      `-r${dpi}`,
      `-dNumCopies=${kopya}`,
      `-sOutputFile=%printer%${yazici}`,
      pdfYolu
    ]
  }
}

// POSIX: is CUPS'a verilir. 'otomatik' PDF'i oldugu gibi gonderir (CUPS zaten
// Ghostscript kullanir); PostScript ve PCL once uretilip sonra gonderilir.
function posixAdimlari ({
  gsYolu, pdfYolu, araDosya, yazici, kopya, dpi, kagitMm, aygit, kenarliksiz,
  kagitTuru = 'otomatik', kalite = 'otomatik'
}) {
  const adimlar = []
  const surucu = AYGIT_SURUCULERI[aygit]
  const gonderilecek = surucu ? araDosya : pdfYolu

  if (surucu) {
    adimlar.push({
      komut: gsYolu,
      argumanlar: [
        '-dBATCH',
        '-dNOPAUSE',
        '-q',
        `-sDEVICE=${surucu.aygit}`,
        '-dFIXEDMEDIA',
        `-dDEVICEWIDTHPOINTS=${punto(kagitMm.genislik)}`,
        `-dDEVICEHEIGHTPOINTS=${punto(kagitMm.yukseklik)}`,
        `-r${dpi}`,
        `-sOutputFile=${araDosya}`,
        pdfYolu
      ]
    })
  }

  // Olcu CUPS'a milimetre olarak bildirilir; "fit-to-page" acikca kapatilir.
  const lpSecenekleri = [
    '-o', `media=Custom.${kagitMm.genislik}x${kagitMm.yukseklik}mm`,
    '-o', 'fit-to-page=false',
    '-o', 'scaling=100'
  ]
  if (kenarliksiz) lpSecenekleri.push('-o', 'page-border=none')

  // Kagit turu ve kalite yalnizca acikca secildiyse gonderilir; "otomatik"
  // surucunun kendi ayarini bozmamak demek.
  const turDegeri = ippDegeri(KAGIT_TURLERI, kagitTuru)
  if (turDegeri) lpSecenekleri.push('-o', `media-type=${turDegeri}`)

  const kaliteDegeri = ippDegeri(KALITELER, kalite)
  if (kaliteDegeri) lpSecenekleri.push('-o', `print-quality=${kaliteDegeri}`)

  adimlar.push({
    komut: 'lp',
    argumanlar: ['-d', yazici, '-n', String(kopya), ...lpSecenekleri, gonderilecek]
  })

  return adimlar
}

// ICC profiliyle CMYK ayrimi.
//
// Uygulamanin kendi cevrimi profilsizdir (aygit cevrimi, bkz. js/renk.js) —
// matbaaya ya da foto laboratuvarina giden iste bu yeterli olmayabilir.
// Ghostscript varsa ayrim gercek bir profille yapilir.
//
// Goruntu yeniden ornekleme yapilmadan gecer: Flate (kayipsiz) sikistirma ve
// yeniden ornekleme kapali; vesikaligin cozunurlugu bizim verdigimiz DPI'da
// kalmali.
function cmykPdfAdimi ({ gsYolu, girdiPdf, ciktiPdf, profilYolu, kagitMm }) {
  return {
    komut: gsYolu,
    argumanlar: [
      '-dBATCH',
      '-dNOPAUSE',
      '-q',
      '-sDEVICE=pdfwrite',
      '-dProcessColorModel=/DeviceCMYK',
      '-dColorConversionStrategy=/CMYK',
      `-sOutputICCProfile=${profilYolu}`,
      // Olcu acikca verilmeli: pdfwrite girdinin MediaBox'ini korumuyor,
      // verilmezse sayfa A4'e duser (olculdu: 100x150 mm -> 595x842 punto).
      '-dFIXEDMEDIA',
      `-dDEVICEWIDTHPOINTS=${punto(kagitMm.genislik)}`,
      `-dDEVICEHEIGHTPOINTS=${punto(kagitMm.yukseklik)}`,
      '-dAutoRotatePages=/None',
      // Yeniden ornekleme ve kayipli sikistirma kapali.
      '-dDownsampleColorImages=false',
      '-dDownsampleGrayImages=false',
      '-dDownsampleMonoImages=false',
      '-dAutoFilterColorImages=false',
      '-dAutoFilterGrayImages=false',
      '-dColorImageFilter=/FlateEncode',
      '-dGrayImageFilter=/FlateEncode',
      `-sOutputFile=${ciktiPdf}`,
      girdiPdf
    ]
  }
}

// RGB PDF'i profilli CMYK PDF'e cevirir ve baytlarini dondurur.
async function cmykPdfUret ({
  gsYolu, pdf, profilYolu, kagitMm, geciciKlasor = os.tmpdir()
}) {
  const girdiPdf = geciciYol('pdf', geciciKlasor)
  const ciktiPdf = geciciYol('cmyk.pdf', geciciKlasor)

  await fs.promises.writeFile(girdiPdf, pdf)

  try {
    const adim = cmykPdfAdimi({ gsYolu, girdiPdf, ciktiPdf, profilYolu, kagitMm })
    await calistir(adim.komut, adim.argumanlar)
    return await fs.promises.readFile(ciktiPdf)
  } finally {
    for (const yol of [girdiPdf, ciktiPdf]) {
      await fs.promises.rm(yol, { force: true }).catch(() => {})
    }
  }
}

// Calistirilacak komutlar. Saf: dosya sistemine dokunmaz, platformu disaridan
// alir; boylece uc platformun komut satiri da testte dogrulanabilir.
function baskiAdimlari ({
  platform = process.platform, gsYolu, pdfYolu, araDosya = null, yazici,
  kopya = 1, dpi = 600, kagitMm, aygit = 'otomatik', kenarliksiz = false,
  kagitTuru = 'otomatik', kalite = 'otomatik'
}) {
  if (!yazici) throw new Error('Yazıcı seçilmedi.')

  return platform === 'win32'
    ? [windowsAdimi({ gsYolu, pdfYolu, yazici, kopya, dpi, kagitMm })]
    : posixAdimlari({
      gsYolu,
      pdfYolu,
      araDosya,
      yazici,
      kopya,
      dpi,
      kagitMm,
      aygit,
      kenarliksiz,
      kagitTuru,
      kalite
    })
}

// --- Calistirma --------------------------------------------------------------

function calistir (komut, argumanlar, { zamanAsimi = 120000 } = {}) {
  return new Promise((cozumle, reddet) => {
    execFile(komut, argumanlar, { timeout: zamanAsimi, windowsHide: true }, (hata, cikti, hataCiktisi) => {
      if (hata) {
        const sebep = (hataCiktisi || cikti || hata.message).toString().trim()
        reddet(new Error(sebep.split('\n').slice(0, 3).join(' ') || hata.message))
        return
      }
      cozumle((cikti || '').toString())
    })
  })
}

async function surumOku (gsYolu) {
  try {
    const cikti = await calistir(gsYolu, ['--version'], { zamanAsimi: 10000 })
    return cikti.trim().split('\n')[0] || null
  } catch {
    return null
  }
}

// Ozelligin kullanilabilir olup olmadigi. Arayuz bunu acilista sorar.
async function durum ({ paketKoku = null, platform = process.platform } = {}) {
  const yok = {
    var: false,
    aygitlar: aygitSecenekleri(platform),
    kagitTurleri: kagitTuruSecenekleri(platform),
    kaliteler: kaliteSecenekleri(platform)
  }

  const bulunan = bul({ paketKoku, platform })
  if (!bulunan) return yok

  const surum = await surumOku(bulunan.yol)
  if (!surum) return yok

  return {
    var: true,
    yol: bulunan.yol,
    kaynak: bulunan.kaynak,
    surum,
    aygitlar: aygitSecenekleri(platform),
    kagitTurleri: kagitTuruSecenekleri(platform),
    kaliteler: kaliteSecenekleri(platform)
  }
}

// Yazicinin kendi tercih penceresi.
//
// Kagit turu ve kalite Windows'ta yalnizca burada ayarlanabiliyor; secim
// surucude kalici oldugu icin bir kez yapilmasi yeterli. Uc platform da ele
// alinir (bkz. AGENTS.md, kural 4): Windows'ta surucunun tercih penceresi,
// macOS'ta yazicilar bolumu, Linux'ta CUPS'un kendi arayuzu acilir.
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

function geciciYol (uzanti, klasor = os.tmpdir()) {
  const ad = `hiper-vesika-${process.pid}-${Date.now()}.${uzanti}`
  return path.join(klasor, ad)
}

// PDF'i gecici bir dosyaya yazip yaziciya gonderir. Gecici dosyalar her
// durumda silinir: vesikalik kisisel veridir, diskte kalmamali.
async function bas ({
  gsYolu, platform = process.platform, pdf, yazici, kopya, dpi, kagitMm,
  aygit = 'otomatik', kenarliksiz = false, kagitTuru = 'otomatik',
  kalite = 'otomatik', geciciKlasor = os.tmpdir()
}) {
  const pdfYolu = geciciYol('pdf', geciciKlasor)
  const surucu = AYGIT_SURUCULERI[aygit]
  const araDosya = surucu ? geciciYol(surucu.uzanti, geciciKlasor) : null

  await fs.promises.writeFile(pdfYolu, pdf)

  try {
    const adimlar = baskiAdimlari({
      platform,
      gsYolu,
      pdfYolu,
      araDosya,
      yazici,
      kopya,
      dpi,
      kagitMm,
      aygit,
      kenarliksiz,
      kagitTuru,
      kalite
    })
    for (const adim of adimlar) await calistir(adim.komut, adim.argumanlar)
  } finally {
    for (const yol of [pdfYolu, araDosya]) {
      if (yol) await fs.promises.rm(yol, { force: true }).catch(() => {})
    }
  }
}

module.exports = {
  IKILI_ADLARI,
  PAKET_KLASORU,
  AYGITLAR,
  AYGIT_SURUCULERI,
  KAGIT_TURLERI,
  KALITELER,
  kagitTuruSecenekleri,
  kaliteSecenekleri,
  ikiliAdlari,
  paketKlasoru,
  bilinenKlasorler,
  yolKlasorleri,
  bul,
  punto,
  aygitSecenekleri,
  aygitGecerliMi,
  ippDegeri,
  tercihKomutu,
  cmykPdfAdimi,
  cmykPdfUret,
  baskiAdimlari,
  surumOku,
  durum,
  geciciYol,
  bas
}
