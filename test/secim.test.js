'use strict'

// Fotograf secim penceresinin saf hesaplari.

const test = require('node:test')
const assert = require('node:assert/strict')

const secim = require('../src/renderer/js/secim.js')

test('secim yalnizca birden fazla fotografta gerekir', () => {
  // Tek fotograf eskisi gibi dogrudan yuklenir; pencere acilmaz.
  assert.equal(secim.secimGerekli([{}]), false)
  assert.equal(secim.secimGerekli([]), false)
  assert.equal(secim.secimGerekli(null), false)
  assert.equal(secim.secimGerekli(undefined), false)

  assert.equal(secim.secimGerekli([{}, {}]), true)
  assert.equal(secim.secimGerekli([{}, {}, {}, {}, {}]), true)
})

test('sutun sayisi fotograf sayisiyla artar ama dorde kadar', () => {
  assert.equal(secim.sutunSayisi(2), 2)
  assert.equal(secim.sutunSayisi(3), 3)
  assert.equal(secim.sutunSayisi(6), 3)
  assert.equal(secim.sutunSayisi(7), 4)
  assert.equal(secim.sutunSayisi(40), 4)
})

test('uzun dosya adi uzantisi korunarak kisalir', () => {
  // Kisa ad oldugu gibi kalir
  assert.equal(secim.kisaAd('LC7A9822.JPG'), 'LC7A9822.JPG')

  const uzun = 'dugun-cekimi-2026-agustos-ali-veli-vesikalik.jpeg'
  const kisa = secim.kisaAd(uzun, 28)

  assert.ok(kisa.length <= 28, `${kisa.length} karakter: ${kisa}`)
  assert.ok(kisa.endsWith('.jpeg'), kisa)
  assert.ok(kisa.startsWith('dugun'), kisa)
  assert.ok(kisa.includes('…'), kisa)
})

test('uzantisiz ve asiri uzun uzantili adlar kirilmaz', () => {
  const uzantisiz = secim.kisaAd('a'.repeat(60), 20)
  assert.ok(uzantisiz.length <= 20)
  assert.ok(uzantisiz.endsWith('…'))

  // Uzanti sinirdan uzunsa bile govdeden 4 karakter kalir; ad taninir.
  const tuhaf = secim.kisaAd('fotograf.cok-uzun-bir-uzanti', 10)
  assert.ok(tuhaf.startsWith('foto'), tuhaf)

  assert.equal(secim.kisaAd(''), '')
  assert.equal(secim.kisaAd(null), '')
})

test('kucuk resim en boy oranini korur ve buyutmez', () => {
  // Yatay
  const yatay = secim.kucukResimOlcusu(4000, 3000, 320)
  assert.equal(yatay.genislik, 320)
  assert.equal(yatay.yukseklik, 240)

  // Dikey: uzun kenar yine kutuya oturur
  const dikey = secim.kucukResimOlcusu(1984, 2976, 320)
  assert.equal(dikey.yukseklik, 320)
  assert.ok(Math.abs(dikey.genislik / dikey.yukseklik - 1984 / 2976) < 0.01)

  // Kutudan kucuk gorsel buyutulmez
  assert.deepEqual(secim.kucukResimOlcusu(100, 80, 320), { genislik: 100, yukseklik: 80 })

  // Bozuk olcu uygulamayi dusurmez
  assert.deepEqual(secim.kucukResimOlcusu(0, 0, 320), { genislik: 1, yukseklik: 1 })
})

test('ok tuslariyla gezinme uclarda basa doner', () => {
  // Ileri geri
  assert.equal(secim.sonrakiSira(0, 5, 1), 1)
  assert.equal(secim.sonrakiSira(4, 5, 1), 0)
  assert.equal(secim.sonrakiSira(0, 5, -1), 4)

  // Satir atlama (3 sutunlu izgara)
  assert.equal(secim.sonrakiSira(0, 5, 3), 3)
  assert.equal(secim.sonrakiSira(3, 5, 3), 1)
  assert.equal(secim.sonrakiSira(0, 5, -3), 2)

  // Hicbir kutu odakta degilken ilk/son kutuya gider
  assert.equal(secim.sonrakiSira(-1, 5, 1), 0)
  assert.equal(secim.sonrakiSira(-1, 5, -1), 4)

  // Bos liste
  assert.equal(secim.sonrakiSira(0, 0, 1), -1)
})
