'use strict'

// Tanitim turunun adim listesi ve kart yerlestirme hesabi.

const test = require('node:test')
const assert = require('node:assert/strict')

const tanitim = require('../src/renderer/js/tanitim.js')

const PENCERE = { genislik: 1280, yukseklik: 800 }
const KART = { genislik: 310, yukseklik: 180 }

test('adimlarin tumu hedef, baslik ve metin tasir', () => {
  assert.ok(tanitim.ADIMLAR.length >= 5)

  for (const adim of tanitim.ADIMLAR) {
    assert.ok(adim.kod, 'kod yok')
    assert.ok(adim.hedef.startsWith('#') || adim.hedef.startsWith('.'), adim.kod)
    assert.ok(adim.baslik.length > 0, adim.kod)
    assert.ok(adim.metin.length > 20, adim.kod)
  }

  // Kodlar tekrar etmemeli
  const kodlar = tanitim.ADIMLAR.map((a) => a.kod)
  assert.equal(new Set(kodlar).size, kodlar.length)
})

test('isik alani hedefin cevresini bosluklu sarar', () => {
  const isik = tanitim.isikAlani({ x: 100, y: 200, genislik: 40, yukseklik: 20 }, 6)

  assert.deepEqual(isik, { x: 94, y: 194, genislik: 52, yukseklik: 32 })
})

test('kart tercih edilen yone konur', () => {
  const isik = { x: 600, y: 300, genislik: 100, yukseklik: 40 }

  const sol = tanitim.kartKonumu({ isik, kart: KART, pencere: PENCERE, tercih: 'sol' })
  assert.equal(sol.yon, 'sol')
  assert.equal(sol.x, 600 - tanitim.ARA - KART.genislik)

  const alt = tanitim.kartKonumu({ isik, kart: KART, pencere: PENCERE, tercih: 'alt' })
  assert.equal(alt.yon, 'alt')
  assert.equal(alt.y, 300 + 40 + tanitim.ARA)
})

test('sigmayan yon yerine sigan bir yon secilir', () => {
  // Hedef sol kenarda: sol tarafta kart icin yer yok.
  const isik = { x: 10, y: 300, genislik: 60, yukseklik: 40 }
  const konum = tanitim.kartKonumu({ isik, kart: KART, pencere: PENCERE, tercih: 'sol' })

  assert.notEqual(konum.yon, 'sol')
  assert.ok(konum.x >= tanitim.KENAR_BOSLUGU)
})

test('kart her durumda pencerenin icinde kalir', () => {
  const kutular = [
    { x: 0, y: 0, genislik: 20, yukseklik: 20 },
    { x: 1260, y: 780, genislik: 20, yukseklik: 20 },
    { x: 640, y: 0, genislik: 300, yukseklik: 10 },
    { x: 1200, y: 400, genislik: 60, yukseklik: 300 },
    { x: 0, y: 760, genislik: 1280, yukseklik: 40 }
  ]

  for (const isik of kutular) {
    for (const tercih of ['sol', 'sag', 'ust', 'alt']) {
      const konum = tanitim.kartKonumu({ isik, kart: KART, pencere: PENCERE, tercih })

      assert.ok(konum.x >= tanitim.KENAR_BOSLUGU,
        `sol tasti: ${JSON.stringify(isik)} ${tercih} -> ${konum.x}`)
      assert.ok(konum.y >= tanitim.KENAR_BOSLUGU,
        `ust tasti: ${JSON.stringify(isik)} ${tercih} -> ${konum.y}`)
      assert.ok(konum.x + KART.genislik <= PENCERE.genislik - tanitim.KENAR_BOSLUGU,
        `sag tasti: ${JSON.stringify(isik)} ${tercih} -> ${konum.x}`)
      assert.ok(konum.y + KART.yukseklik <= PENCERE.yukseklik - tanitim.KENAR_BOSLUGU,
        `alt tasti: ${JSON.stringify(isik)} ${tercih} -> ${konum.y}`)
    }
  }
})

test('kart pencereden buyukse sol ust kosede kalir, disari tasmaz', () => {
  const dar = { genislik: 200, yukseklik: 150 }
  const konum = tanitim.kartKonumu({
    isik: { x: 50, y: 50, genislik: 40, yukseklik: 40 },
    kart: KART,
    pencere: dar,
    tercih: 'sag'
  })

  assert.equal(konum.x, tanitim.KENAR_BOSLUGU)
  assert.equal(konum.y, tanitim.KENAR_BOSLUGU)
})

test('hedefi bulunmayan adim listeden dusurulur', () => {
  const adimlar = [
    { kod: 'a', hedef: '#var' },
    { kod: 'b', hedef: '#yok' },
    { kod: 'c', hedef: '#var2' }
  ]

  const gecerli = tanitim.gecerliAdimlar(adimlar, (secici) => secici !== '#yok')
  assert.deepEqual(gecerli.map((a) => a.kod), ['a', 'c'])
})
