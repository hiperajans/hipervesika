'use strict'

// Dogrudan baski: hangi sistemin kullanildigi, CUPS komutu ve yazicinin tercih
// penceresi. Uc platform da burada sinanir — makinede yalnizca biri calissa da
// yanlis bir secenek ucundeki kullaniciya yanlis olcude baski olarak doner.
//
// Gercek yaziciya is gonderilmez; sinanan sey komutun kendisidir. Windows
// tarafi Chromium'un kendi baski yolundan gectigi icin burada komut yok,
// arayuz baglantisi uctan uca testte.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const dogrudan = require('../src/main/dogrudan-baski.js')

const KAGIT = { genislik: 100, yukseklik: 150 }

test('Windows Chromium yolunu kullanir, POSIX CUPS u arar', () => {
  const windows = dogrudan.durum({ platform: 'win32', env: {} })
  assert.equal(windows.var, true)
  assert.equal(windows.sistem, 'chromium')
  // Chromium sessiz baskida kagit turu ve kaliteyi kabul etmiyor.
  assert.deepEqual(windows.kagitTurleri, [])
  assert.deepEqual(windows.kaliteler, [])

  const bos = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-lp-bos-'))
  try {
    const lpsiz = dogrudan.durum({ platform: 'linux', env: { PATH: bos } })
    assert.equal(lpsiz.sistem, 'cups')
    // lp yoksa ozellik kapanir; uygulama sistem panelinden basmaya devam eder.
    assert.equal(lpsiz.var, false)
  } finally {
    fs.rmSync(bos, { recursive: true, force: true })
  }
})

test('lp bulunursa POSIX te dogrudan baski acilir', () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-lp-'))
  try {
    fs.writeFileSync(path.join(kok, 'lp'), '')
    const durum = dogrudan.durum({ platform: 'darwin', env: { PATH: kok } })

    assert.equal(durum.var, true)
    assert.equal(durum.lp, path.join(kok, 'lp'))
    assert.ok(durum.kagitTurleri.length >= 3)
    assert.ok(durum.kaliteler.length >= 2)
  } finally {
    fs.rmSync(kok, { recursive: true, force: true })
  }
})

test('CUPS komutu olcuyu dayatir ve sigdirmayi kapatir', () => {
  const { komut, argumanlar } = dogrudan.lpAdimi({
    lp: '/usr/bin/lp',
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Canon iX6800',
    kopya: 3,
    kagitMm: KAGIT
  })

  assert.equal(komut, '/usr/bin/lp')
  assert.deepEqual(argumanlar.slice(0, 4), ['-d', 'Canon iX6800', '-n', '3'])
  assert.ok(argumanlar.includes('media=Custom.100x150mm'))
  assert.ok(argumanlar.includes('fit-to-page=false'))
  assert.ok(argumanlar.includes('scaling=100'))
  assert.equal(argumanlar.at(-1), '/tmp/sayfa.pdf')

  // Secilmeyen ayarlar gonderilmez: "otomatik" surucunun ayarini bozmamak.
  assert.equal(argumanlar.some((a) => a.startsWith('media-type=')), false)
  assert.equal(argumanlar.some((a) => a.startsWith('print-quality=')), false)
  assert.equal(argumanlar.includes('page-border=none'), false)
})

test('kagit turu, kalite ve kenarliksiz IPP niteligi olarak gider', () => {
  const { argumanlar } = dogrudan.lpAdimi({
    pdfYolu: '/tmp/sayfa.pdf',
    yazici: 'Foto',
    kagitMm: KAGIT,
    kagitTuru: 'parlak',
    kalite: 'yuksek',
    kenarliksiz: true
  })

  assert.ok(argumanlar.includes('media-type=photographic-glossy'))
  assert.ok(argumanlar.includes('print-quality=5'))
  assert.ok(argumanlar.includes('page-border=none'))
})

test('mat kagit ve normal kalite karsiliklari dogru', () => {
  assert.equal(dogrudan.ippDegeri(dogrudan.KAGIT_TURLERI, 'mat'), 'photographic-matte')
  assert.equal(dogrudan.ippDegeri(dogrudan.KAGIT_TURLERI, 'duz'), 'stationery')
  assert.equal(dogrudan.ippDegeri(dogrudan.KAGIT_TURLERI, 'otomatik'), null)
  assert.equal(dogrudan.ippDegeri(dogrudan.KALITELER, 'normal'), 4)
  assert.equal(dogrudan.ippDegeri(dogrudan.KALITELER, 'yok'), null)

  for (const oge of [...dogrudan.KAGIT_TURLERI, ...dogrudan.KALITELER]) {
    assert.ok(oge.ad.length > 0, oge.kod)
  }
})

test('yazici secilmeden komut kurulmaz', () => {
  assert.throws(
    () => dogrudan.lpAdimi({ pdfYolu: '/tmp/a.pdf', kagitMm: KAGIT }), /Yazıcı/
  )
})

test('tercih penceresi uc platformda da bir yol sunar', () => {
  const windows = dogrudan.tercihKomutu('Canon PIXMA', 'win32')
  assert.equal(windows.komut, 'rundll32.exe')
  assert.deepEqual(windows.argumanlar.slice(0, 3), ['printui.dll,PrintUIEntry', '/e', '/n'])
  assert.equal(windows.argumanlar.at(-1), 'Canon PIXMA')

  assert.match(dogrudan.tercihKomutu('Foto', 'darwin').adres, /^x-apple\.systempreferences:/)
  // Bosluklu yazici adi adreste kacisli olmali.
  assert.equal(
    dogrudan.tercihKomutu('Ofis Yazicisi', 'linux').adres,
    'http://localhost:631/printers/Ofis%20Yazicisi'
  )
})

test('gecici dosya adi cakismaz ve istenen klasorde durur', () => {
  const klasor = os.tmpdir()
  const yol = dogrudan.geciciYol('pdf', klasor)
  assert.equal(path.dirname(yol), klasor)
  assert.match(path.basename(yol), /^hiper-vesika-\d+-\d+\.pdf$/)
})
