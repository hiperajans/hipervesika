'use strict'

// Rotus hesaplarinin ve gecmis yigininin birim testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const rotus = require('../src/renderer/js/rotus.js')
const Gecmis = require('../src/renderer/js/gecmis.js')

test('varsayilan ayarlarda filtre uretilmez', () => {
  const ayarlar = rotus.varsayilanAyarlar()
  assert.equal(rotus.varsayilanMi(ayarlar), true)
  assert.equal(rotus.cssFiltresi(ayarlar), 'none')
})

test('css filtresi yalnizca degisen ayarlari icerir', () => {
  const filtre = rotus.cssFiltresi({ parlaklik: 1.2, kontrast: 1, doygunluk: 0.8 })
  assert.match(filtre, /brightness\(1\.2\)/)
  assert.match(filtre, /saturate\(0\.8\)/)
  assert.doesNotMatch(filtre, /contrast/)
})

test('sicaklik matrisi kirmizi ve maviyi ters yonde kaydirir', () => {
  const sicak = rotus.sicaklikMatrisi(1)
  // Satir 1 kirmizi, satir 3 mavi carpani
  assert.ok(sicak[0] > 1, 'kirmizi artmamis')
  assert.ok(sicak[12] < 1, 'mavi azalmamis')
  // Yesil kanal degismemeli
  assert.equal(sicak[6], 1)

  const soguk = rotus.sicaklikMatrisi(-1)
  assert.ok(soguk[0] < 1, 'soguklarda kirmizi azalmamis')
  assert.ok(soguk[12] > 1, 'soguklarda mavi artmamis')

  const notr = rotus.sicaklikMatrisi(0)
  assert.equal(notr[0], 1)
  assert.equal(notr[12], 1)
})

test('keskinlik cekirdeginin toplami her zaman 1', () => {
  // Toplam 1 olmazsa keskinlestirme goruntuyu genel olarak koyultur ya da acardi.
  for (const miktar of [0, 0.2, 0.5, 1]) {
    const cekirdek = rotus.keskinlikCekirdegi(miktar)
    const toplam = cekirdek.reduce((t, d) => t + d, 0)
    assert.ok(Math.abs(toplam - 1) < 1e-9, `${miktar} icin toplam ${toplam}`)
  }
})

test('keskinlik cekirdegi miktar arttikca merkezi guclendirir', () => {
  assert.deepEqual(rotus.keskinlikCekirdegi(0), [0, 0, 0, 0, 1, 0, 0, 0, 0])
  const orta = rotus.keskinlikCekirdegi(0.5)
  assert.equal(orta[4], 3)
  assert.equal(orta[1], -0.5)
})

test('ortalama renk orneklerin ortalamasini verir', () => {
  assert.deepEqual(rotus.ortalamaRenk([[100, 100, 100], [200, 200, 200]]), [150, 150, 150])
  assert.deepEqual(rotus.ortalamaRenk([[10, 20, 30]]), [10, 20, 30])
  assert.equal(rotus.ortalamaRenk([]), null)
})

test('gecmis kaydeder, geri alir ve yineler', () => {
  const gecmis = new Gecmis()
  assert.equal(gecmis.geriAlinabilir, false)

  gecmis.kaydet('a')
  gecmis.kaydet('b')
  gecmis.kaydet('c')

  assert.equal(gecmis.simdiki, 'c')
  assert.equal(gecmis.geriAl(), 'b')
  assert.equal(gecmis.geriAl(), 'a')
  assert.equal(gecmis.geriAlinabilir, false)
  assert.equal(gecmis.geriAl(), null)

  assert.equal(gecmis.yinele(), 'b')
  assert.equal(gecmis.yinele(), 'c')
  assert.equal(gecmis.yinelenebilir, false)
})

test('geri alindiktan sonra kaydetmek ileri adimlari atar', () => {
  const gecmis = new Gecmis()
  gecmis.kaydet('a')
  gecmis.kaydet('b')
  gecmis.kaydet('c')
  gecmis.geriAl()
  gecmis.kaydet('d')

  assert.equal(gecmis.simdiki, 'd')
  assert.equal(gecmis.yinelenebilir, false)
  assert.deepEqual(gecmis.yigin, ['a', 'b', 'd'])
})

test('gecmis sinira ulasinca en eski adimi atar', () => {
  const gecmis = new Gecmis(3)
  for (const deger of ['a', 'b', 'c', 'd']) gecmis.kaydet(deger)

  assert.deepEqual(gecmis.yigin, ['b', 'c', 'd'])
  assert.equal(gecmis.simdiki, 'd')
  assert.equal(gecmis.konum, 2)
})

test('basa donmek ilk duruma gider', () => {
  const gecmis = new Gecmis()
  gecmis.kaydet('a')
  gecmis.kaydet('b')

  assert.equal(gecmis.basaDon(), 'a')
  assert.equal(gecmis.yinelenebilir, true)
})
