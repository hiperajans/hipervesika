'use strict'

// Sayfa yerlesimi hesaplarinin birim testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const sayfa = require('../src/renderer/js/sayfa.js')

const VESIKALIK = { genislik: 50, yukseklik: 60 }
const kagit = (kod) => {
  const onayar = sayfa.KAGIT_ONAYARLARI.find((k) => k.kod === kod)
  return { genislik: onayar.genislik, yukseklik: onayar.yukseklik }
}

test('10x15 kagida 50x60 vesikaliktan 4 adet sigar', () => {
  const yerlesim = sayfa.yerlesimHesapla({ kagitMm: kagit('10x15'), fotoMm: VESIKALIK })

  assert.equal(yerlesim.sutun, 2)
  assert.equal(yerlesim.satir, 2)
  assert.equal(yerlesim.adet, 4)
  assert.equal(yerlesim.sigmiyor, false)
})

test('15x21 kagida 50x60 vesikaliktan 9 adet sigar', () => {
  const yerlesim = sayfa.yerlesimHesapla({ kagitMm: kagit('15x21'), fotoMm: VESIKALIK })

  assert.equal(yerlesim.sutun, 3)
  assert.equal(yerlesim.satir, 3)
  assert.equal(yerlesim.adet, 9)
})

test('A4 kagida 50x60 vesikaliktan 16 adet sigar', () => {
  const yerlesim = sayfa.yerlesimHesapla({ kagitMm: kagit('a4'), fotoMm: VESIKALIK })
  assert.equal(yerlesim.adet, 16)
})

test('izgara kagida ortalanir', () => {
  const yerlesim = sayfa.yerlesimHesapla({ kagitMm: kagit('15x21'), fotoMm: VESIKALIK })

  // 3 sutun x 50 = 150 -> yatayda bosluk yok
  assert.equal(yerlesim.kenarBoslugu.x, 0)
  // 3 satir x 60 = 180, kagit 210 -> ustte ve altta 15'er mm
  assert.equal(yerlesim.kenarBoslugu.y, 15)

  const ilk = yerlesim.konumlar[0]
  assert.equal(ilk.x, 0)
  assert.equal(ilk.y, 15)
})

test('konumlar birbirine girmez ve kagidin disina tasmaz', () => {
  const kagitMm = kagit('a4')
  const yerlesim = sayfa.yerlesimHesapla({ kagitMm, fotoMm: VESIKALIK, kenarMm: 5, aralikMm: 3 })

  for (const konum of yerlesim.konumlar) {
    assert.ok(konum.x >= 5 - 1e-9, 'sol kenar bosluguna girdi')
    assert.ok(konum.y >= 5 - 1e-9, 'ust kenar bosluguna girdi')
    assert.ok(konum.x + VESIKALIK.genislik <= kagitMm.genislik - 5 + 1e-9, 'sag kenari asti')
    assert.ok(konum.y + VESIKALIK.yukseklik <= kagitMm.yukseklik - 5 + 1e-9, 'alt kenari asti')
  }

  // Ayni satirdaki iki komsu arasinda tam olarak aralik kadar bosluk olmali.
  const ayniSatir = yerlesim.konumlar.filter((k) => k.y === yerlesim.konumlar[0].y)
  if (ayniSatir.length > 1) {
    assert.equal(ayniSatir[1].x - (ayniSatir[0].x + VESIKALIK.genislik), 3)
  }
})

test('kenar boslugu ve aralik adedi azaltir', () => {
  const kagitMm = kagit('10x15')
  const boslusuz = sayfa.yerlesimHesapla({ kagitMm, fotoMm: VESIKALIK })
  const bosluklu = sayfa.yerlesimHesapla({ kagitMm, fotoMm: VESIKALIK, kenarMm: 5 })

  assert.equal(boslusuz.adet, 4)
  // 90x140 kullanilabilir alana 50x60 yalnizca 1 sutun 2 satir sigar
  assert.equal(bosluklu.adet, 2)
})

test('sigmayan olcu bildirilir', () => {
  const yerlesim = sayfa.yerlesimHesapla({
    kagitMm: kagit('10x15'),
    fotoMm: { genislik: 120, yukseklik: 200 }
  })

  assert.equal(yerlesim.sigmiyor, true)
  assert.equal(yerlesim.adet, 0)
  assert.deepEqual(yerlesim.konumlar, [])
})

test('adet siniri yerlesimi kirpar ama izgarayi bozmaz', () => {
  const kagitMm = kagit('15x21')
  const tam = sayfa.yerlesimHesapla({ kagitMm, fotoMm: VESIKALIK })
  const sinirli = sayfa.yerlesimHesapla({ kagitMm, fotoMm: VESIKALIK, enFazlaAdet: 4 })

  assert.equal(sinirli.adet, 4)
  assert.equal(sinirli.sigacakAdet, 9)
  // Ilk dort konum tam yerlesimdekiyle ayni olmali
  assert.deepEqual(sinirli.konumlar, tam.konumlar.slice(0, 4))
})

test('en iyi yerlesim fotografi cevirmenin daha cok adet verdigi durumu bulur', () => {
  // 100x150 kagida 60x50 (yatik vesikalik): dik haliyle 1x3 = 3,
  // cevrilince 50x60 olur ve 2x2 = 4 adet cikar.
  const yerlesim = sayfa.enIyiYerlesim({
    kagitMm: kagit('10x15'),
    fotoMm: { genislik: 60, yukseklik: 50 }
  })

  assert.equal(yerlesim.adet, 4)
  assert.equal(yerlesim.dondurulmus, true)
  assert.equal(yerlesim.fotoMm.genislik, 50)
  assert.equal(yerlesim.fotoMm.yukseklik, 60)
})

test('cevirmek fayda etmiyorsa dik yerlesim korunur', () => {
  const yerlesim = sayfa.enIyiYerlesim({ kagitMm: kagit('10x15'), fotoMm: VESIKALIK })

  assert.equal(yerlesim.adet, 4)
  assert.equal(yerlesim.dondurulmus, false)
})

test('kagit olcusu dogrulamasi sinirlari uygular', () => {
  assert.equal(sayfa.kagitGecerliMi(100), true)
  assert.equal(sayfa.kagitGecerliMi(49), false)
  assert.equal(sayfa.kagitGecerliMi(1001), false)
  assert.equal(sayfa.kagitGecerliMi(Number.NaN), false)
})

test('on ayarlarin olculeri gecerli', () => {
  assert.equal(sayfa.KAGIT_ONAYARLARI.length, 4)
  for (const onayar of sayfa.KAGIT_ONAYARLARI) {
    assert.ok(sayfa.kagitGecerliMi(onayar.genislik), `${onayar.kod} genislik`)
    assert.ok(sayfa.kagitGecerliMi(onayar.yukseklik), `${onayar.kod} yukseklik`)
  }
})
