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
  gsYolu, pdfYolu, araDosya, yazici, kopya, dpi, kagitMm, aygit, kenarliksiz
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

  adimlar.push({
    komut: 'lp',
    argumanlar: ['-d', yazici, '-n', String(kopya), ...lpSecenekleri, gonderilecek]
  })

  return adimlar
}

// Calistirilacak komutlar. Saf: dosya sistemine dokunmaz, platformu disaridan
// alir; boylece uc platformun komut satiri da testte dogrulanabilir.
function baskiAdimlari ({
  platform = process.platform, gsYolu, pdfYolu, araDosya = null, yazici,
  kopya = 1, dpi = 600, kagitMm, aygit = 'otomatik', kenarliksiz = false
}) {
  if (!yazici) throw new Error('Yazıcı seçilmedi.')

  return platform === 'win32'
    ? [windowsAdimi({ gsYolu, pdfYolu, yazici, kopya, dpi, kagitMm })]
    : posixAdimlari({
      gsYolu, pdfYolu, araDosya, yazici, kopya, dpi, kagitMm, aygit, kenarliksiz
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
  const bulunan = bul({ paketKoku, platform })
  if (!bulunan) {
    return { var: false, aygitlar: aygitSecenekleri(platform) }
  }

  const surum = await surumOku(bulunan.yol)
  if (!surum) {
    return { var: false, aygitlar: aygitSecenekleri(platform) }
  }

  return {
    var: true,
    yol: bulunan.yol,
    kaynak: bulunan.kaynak,
    surum,
    aygitlar: aygitSecenekleri(platform)
  }
}

function geciciYol (uzanti, klasor = os.tmpdir()) {
  const ad = `hiper-vesika-${process.pid}-${Date.now()}.${uzanti}`
  return path.join(klasor, ad)
}

// PDF'i gecici bir dosyaya yazip yaziciya gonderir. Gecici dosyalar her
// durumda silinir: vesikalik kisisel veridir, diskte kalmamali.
async function bas ({
  gsYolu, platform = process.platform, pdf, yazici, kopya, dpi, kagitMm,
  aygit = 'otomatik', kenarliksiz = false, geciciKlasor = os.tmpdir()
}) {
  const pdfYolu = geciciYol('pdf', geciciKlasor)
  const surucu = AYGIT_SURUCULERI[aygit]
  const araDosya = surucu ? geciciYol(surucu.uzanti, geciciKlasor) : null

  await fs.promises.writeFile(pdfYolu, pdf)

  try {
    const adimlar = baskiAdimlari({
      platform, gsYolu, pdfYolu, araDosya, yazici, kopya, dpi, kagitMm, aygit, kenarliksiz
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
  ikiliAdlari,
  paketKlasoru,
  bilinenKlasorler,
  yolKlasorleri,
  bul,
  punto,
  aygitSecenekleri,
  aygitGecerliMi,
  baskiAdimlari,
  surumOku,
  durum,
  geciciYol,
  bas
}
