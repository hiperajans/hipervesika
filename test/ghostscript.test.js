'use strict'

// Ghostscript ile dogrudan baski: ikilinin bulunmasi ve komut satirinin
// kurulmasi. Komutlar uc platform icin de burada sinanir — makinede yalnizca
// biri calissa da yanlis bir arguman ucundeki kullaniciya yanlis olcude baski
// olarak doner.
//
// Gercek yaziciya is gonderilmez; sinanan sey komutun kendisidir.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const gs = require('../src/main/ghostscript.js')

const KAGIT = { genislik: 100, yukseklik: 150 }

// 100 mm = 283,4646 punto, 150 mm = 425,1969 punto.
const PUNTO = { genislik: gs.punto(100), yukseklik: gs.punto(150) }

function argumanDegeri (argumanlar, onek) {
  const bulunan = argumanlar.find((arguman) => arguman.startsWith(onek))
  return bulunan ? bulunan.slice(onek.length) : null
}

test('punto cevrimi PDF olcusuyle ortusur', () => {
  assert.equal(gs.punto(25.4), 72)
  assert.ok(Math.abs(gs.punto(100) - 283.4645) < 0.001)
})

test('ikili adlari platforma gore', () => {
  assert.deepEqual(gs.ikiliAdlari('win32'), ['gswin64c.exe', 'gswin32c.exe'])
  assert.deepEqual(gs.ikiliAdlari('darwin'), ['gs'])
  assert.deepEqual(gs.ikiliAdlari('linux'), ['gs'])
  // Taninmayan platformda POSIX adi denenir; hicbir sey dondurmemek yerine.
  assert.deepEqual(gs.ikiliAdlari('freebsd'), ['gs'])
})

test('paket klasoru platform basina ayrilir', () => {
  const yol = gs.paketKlasoru(path.join('kok', 'vendor'), 'win32')
  assert.equal(yol, path.join('kok', 'vendor', 'ghostscript', 'win32'))
})

test('bilinen klasorler POSIX kurulumlarini kapsar', () => {
  assert.ok(gs.bilinenKlasorler('darwin').includes('/opt/homebrew/bin'))
  assert.ok(gs.bilinenKlasorler('linux').includes('/usr/bin'))
})

test('ikili once pakette, sonra sistemde aranir', () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-gs-'))
  try {
    const paketBin = path.join(gs.paketKlasoru(path.join(kok, 'vendor'), 'linux'), 'bin')
    const sistemBin = path.join(kok, 'sistem')
    fs.mkdirSync(paketBin, { recursive: true })
    fs.mkdirSync(sistemBin, { recursive: true })
    fs.writeFileSync(path.join(sistemBin, 'gs'), '')

    const env = { PATH: sistemBin }

    // Yalnizca sistemde varken sistem bulunur.
    let bulunan = gs.bul({ paketKoku: path.join(kok, 'vendor'), platform: 'linux', env })
    assert.equal(bulunan.kaynak, 'sistem')
    assert.equal(bulunan.yol, path.join(sistemBin, 'gs'))

    // Pakete kopya girince o one gecer: surum farki sorun cikarmasin.
    fs.writeFileSync(path.join(paketBin, 'gs'), '')
    bulunan = gs.bul({ paketKoku: path.join(kok, 'vendor'), platform: 'linux', env })
    assert.equal(bulunan.kaynak, 'paket')
    assert.equal(bulunan.yol, path.join(paketBin, 'gs'))
  } finally {
    fs.rmSync(kok, { recursive: true, force: true })
  }
})

test('hicbir yerde yoksa null doner', () => {
  const bos = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-gs-bos-'))
  try {
    assert.equal(gs.bul({ platform: 'linux', env: { PATH: bos } }), null)
  } finally {
    fs.rmSync(bos, { recursive: true, force: true })
  }
})

// --- Windows -----------------------------------------------------------------

test('Windows komutu isi surucuye verir ve olcuyu sabitler', () => {
  const adimlar = gs.baskiAdimlari({
    platform: 'win32',
    gsYolu: 'C:\\gs\\gswin64c.exe',
    pdfYolu: 'C:\\temp\\sayfa.pdf',
    yazici: 'Canon PIXMA iX6800',
    kopya: 3,
    dpi: 600,
    kagitMm: KAGIT
  })

  assert.equal(adimlar.length, 1)
  const { komut, argumanlar } = adimlar[0]

  assert.equal(komut, 'C:\\gs\\gswin64c.exe')
  assert.ok(argumanlar.includes('-sDEVICE=mswinpr2'))
  // Yazici adi bosluklu; kabuk kullanilmadigi icin tirnak gerekmez.
  assert.ok(argumanlar.includes('-sOutputFile=%printer%Canon PIXMA iX6800'))
  assert.ok(argumanlar.includes('-dNumCopies=3'))
  assert.ok(argumanlar.includes('-r600'))
  assert.equal(argumanlar.at(-1), 'C:\\temp\\sayfa.pdf')

  // Olcu: verilen kagit birebir dayatilir, "sayfaya sigdir" devrede degil.
  assert.ok(argumanlar.includes('-dFIXEDMEDIA'))
  assert.equal(argumanDegeri(argumanlar, '-dDEVICEWIDTHPOINTS='), String(PUNTO.genislik))
  assert.equal(argumanDegeri(argumanlar, '-dDEVICEHEIGHTPOINTS='), String(PUNTO.yukseklik))
  assert.equal(argumanlar.some((a) => a.startsWith('-dPDFFitPage')), false)

  // Panel ve iptal kutusu acilmamali; is sessizce gitmeli.
  assert.ok(argumanlar.includes('-dNoCancel'))
  assert.ok(argumanlar.includes('-dBATCH'))
  assert.ok(argumanlar.includes('-dNOPAUSE'))
  // SAFER varsayilan kalir: kendi urettigimiz PDF icin gevsetmeye gerek yok.
  assert.equal(argumanlar.includes('-dNOSAFER'), false)
})

test('Windows tek aygit sunar', () => {
  assert.deepEqual(gs.aygitSecenekleri('win32').map((a) => a.kod), ['otomatik'])
  assert.equal(gs.aygitGecerliMi('postscript', 'win32'), false)
  assert.equal(gs.aygitGecerliMi('otomatik', 'win32'), true)
})

// --- POSIX -------------------------------------------------------------------

test('POSIX otomatik yolda PDF dogrudan CUPS a gider', () => {
  const adimlar = gs.baskiAdimlari({
    platform: 'linux',
    gsYolu: '/usr/bin/gs',
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Canon_iX6800',
    kopya: 2,
    dpi: 600,
    kagitMm: KAGIT
  })

  // CUPS zaten Ghostscript kullaniyor; araya ikinci bir cevrim koymak
  // goruntuyu bir kez daha rasterlestirmek olurdu.
  assert.equal(adimlar.length, 1)
  assert.equal(adimlar[0].komut, 'lp')

  const argumanlar = adimlar[0].argumanlar
  assert.deepEqual(argumanlar.slice(0, 4), ['-d', 'Canon_iX6800', '-n', '2'])
  assert.ok(argumanlar.includes('media=Custom.100x150mm'))
  assert.ok(argumanlar.includes('fit-to-page=false'))
  assert.ok(argumanlar.includes('scaling=100'))
  assert.equal(argumanlar.includes('page-border=none'), false)
  assert.equal(argumanlar.at(-1), '/tmp/sayfa.pdf')
})

test('POSIX PostScript ve PCL once uretir sonra gonderir', () => {
  for (const [aygit, surucu] of [['postscript', 'ps2write'], ['pcl', 'pxlcolor']]) {
    const adimlar = gs.baskiAdimlari({
      platform: 'darwin',
      gsYolu: '/opt/homebrew/bin/gs',
      pdfYolu: '/tmp/sayfa.pdf',
      araDosya: `/tmp/sayfa.${aygit}`,
      yazici: 'Ofis',
      kopya: 1,
      dpi: 600,
      kagitMm: KAGIT,
      aygit
    })

    assert.equal(adimlar.length, 2, aygit)
    assert.equal(adimlar[0].komut, '/opt/homebrew/bin/gs')
    assert.ok(adimlar[0].argumanlar.includes(`-sDEVICE=${surucu}`))
    assert.ok(adimlar[0].argumanlar.includes('-dFIXEDMEDIA'))
    assert.equal(
      argumanDegeri(adimlar[0].argumanlar, '-dDEVICEWIDTHPOINTS='), String(PUNTO.genislik)
    )

    // Yaziciya giden, uretilen dosya olmali; PDF degil.
    assert.equal(adimlar[1].komut, 'lp')
    assert.equal(adimlar[1].argumanlar.at(-1), `/tmp/sayfa.${aygit}`)
  }
})

test('kenarliksiz secildiginde CUPS kenar boslugu istenmez', () => {
  const adimlar = gs.baskiAdimlari({
    platform: 'linux',
    gsYolu: '/usr/bin/gs',
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Foto',
    kopya: 1,
    dpi: 1200,
    kagitMm: KAGIT,
    kenarliksiz: true
  })

  assert.ok(adimlar.at(-1).argumanlar.includes('page-border=none'))
})

test('kagit turu ve kalite POSIX te IPP niteligi olarak gider', () => {
  const adimlar = gs.baskiAdimlari({
    platform: 'linux',
    gsYolu: '/usr/bin/gs',
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Foto',
    kopya: 1,
    dpi: 1200,
    kagitMm: KAGIT,
    kagitTuru: 'parlak',
    kalite: 'yuksek'
  })

  const argumanlar = adimlar.at(-1).argumanlar
  assert.ok(argumanlar.includes('media-type=photographic-glossy'))
  assert.ok(argumanlar.includes('print-quality=5'))
})

test('otomatik secildiginde surucunun ayari bozulmaz', () => {
  const argumanlar = gs.baskiAdimlari({
    platform: 'darwin',
    gsYolu: '/usr/bin/gs',
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Foto',
    kopya: 1,
    dpi: 600,
    kagitMm: KAGIT
  }).at(-1).argumanlar

  assert.equal(argumanlar.some((a) => a.startsWith('media-type=')), false)
  assert.equal(argumanlar.some((a) => a.startsWith('print-quality=')), false)
})

test('kagit turu ve kalite Windows ta sunulmaz', () => {
  // Surucunun DEVMODE ayarina disaridan mudahale edilemiyor; calismayan bir
  // secim kutusu gostermektense hic gostermemek dogru.
  assert.deepEqual(gs.kagitTuruSecenekleri('win32'), [])
  assert.deepEqual(gs.kaliteSecenekleri('win32'), [])

  assert.ok(gs.kagitTuruSecenekleri('linux').length >= 3)
  assert.ok(gs.kaliteSecenekleri('darwin').length >= 2)
  for (const tur of gs.KAGIT_TURLERI) assert.ok(tur.ad.length > 0, tur.kod)
})

test('tercih penceresi uc platformda da bir yol sunar', () => {
  const windows = gs.tercihKomutu('Canon PIXMA', 'win32')
  assert.equal(windows.komut, 'rundll32.exe')
  assert.deepEqual(windows.argumanlar.slice(0, 3), ['printui.dll,PrintUIEntry', '/e', '/n'])
  assert.equal(windows.argumanlar.at(-1), 'Canon PIXMA')

  assert.match(gs.tercihKomutu('Foto', 'darwin').adres, /^x-apple\.systempreferences:/)
  // Bosluklu yazici adi adreste kacisli olmali.
  assert.equal(
    gs.tercihKomutu('Ofis Yazicisi', 'linux').adres,
    'http://localhost:631/printers/Ofis%20Yazicisi'
  )
})

test('POSIX uc aygiti da sunar', () => {
  assert.deepEqual(
    gs.aygitSecenekleri('linux').map((a) => a.kod), ['otomatik', 'postscript', 'pcl']
  )
  for (const aygit of gs.AYGITLAR) {
    assert.ok(aygit.ad.length > 0 && aygit.aciklama.length > 0, aygit.kod)
  }
})

// --- ICC profilli CMYK ayrimi -------------------------------------------------

test('ICC ayrimi olcuyu koruyup kayipsiz CMYK uretir', () => {
  const adim = gs.cmykPdfAdimi({
    gsYolu: '/usr/bin/gs',
    girdiPdf: '/tmp/rgb.pdf',
    ciktiPdf: '/tmp/cmyk.pdf',
    profilYolu: '/tmp/matbaa.icc',
    kagitMm: KAGIT
  })

  assert.ok(adim.argumanlar.includes('-sDEVICE=pdfwrite'))
  assert.ok(adim.argumanlar.includes('-dProcessColorModel=/DeviceCMYK'))
  assert.ok(adim.argumanlar.includes('-dColorConversionStrategy=/CMYK'))
  assert.ok(adim.argumanlar.includes('-sOutputICCProfile=/tmp/matbaa.icc'))

  // Olcu acikca verilmezse pdfwrite sayfayi A4'e dusuruyor; olculdu:
  // 100x150 mm girdi 595x842 punto cikmisti.
  assert.ok(adim.argumanlar.includes('-dFIXEDMEDIA'))
  assert.equal(argumanDegeri(adim.argumanlar, '-dDEVICEWIDTHPOINTS='), String(PUNTO.genislik))
  assert.equal(argumanDegeri(adim.argumanlar, '-dDEVICEHEIGHTPOINTS='), String(PUNTO.yukseklik))

  // Vesikaligin cozunurlugu bizim verdigimiz DPI'da kalmali: yeniden
  // ornekleme ve kayipli sikistirma kapali.
  for (const arguman of [
    '-dDownsampleColorImages=false',
    '-dAutoFilterColorImages=false',
    '-dColorImageFilter=/FlateEncode'
  ]) {
    assert.ok(adim.argumanlar.includes(arguman), arguman)
  }

  assert.equal(adim.argumanlar.at(-1), '/tmp/rgb.pdf')
})

test('yazici secilmeden komut kurulmaz', () => {
  assert.throws(() => gs.baskiAdimlari({
    platform: 'linux', gsYolu: '/usr/bin/gs', pdfYolu: '/tmp/a.pdf', kagitMm: KAGIT
  }), /Yazıcı/)
})

test('gecici dosya adi cakismaz ve istenen klasorde durur', () => {
  const klasor = os.tmpdir()
  const yol = gs.geciciYol('pdf', klasor)
  assert.equal(path.dirname(yol), klasor)
  assert.match(path.basename(yol), /^hiper-vesika-\d+-\d+\.pdf$/)
})
