'use strict'

// Olcu kalibrasyonu: duzeltme carpani ve referans cizgi olculeri.

const test = require('node:test')
const assert = require('node:assert/strict')

const kalibrasyon = require('../src/renderer/js/kalibrasyon.js')
const ayarlar = require('../src/main/ayarlar.js')

const yakin = (a, b, tolerans = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tolerans, `${a} ile ${b} arasindaki fark ${tolerans} asiyor`)

test('kucuk basan yazicida carpan buyur', () => {
  // 100 mm istendi, 99,4 mm cikti: sonraki baski %0,6 buyuk cizilmeli.
  // Deger bes basamaga yuvarlanir (1 metrede 0,01 mm).
  yakin(kalibrasyon.olcekHesapla(100, 99.4), 100 / 99.4, 1e-5)
  assert.ok(kalibrasyon.olcekHesapla(100, 99.4) > 1)

  // Buyuk basan yazicida tersi.
  assert.ok(kalibrasyon.olcekHesapla(100, 100.5) < 1)
  // Tam olcude basan yazicide duzeltme yok.
  assert.equal(kalibrasyon.olcekHesapla(150, 150), 1)
})

test('sapma makul araligin disindaysa reddedilir', () => {
  // Olcum hatasi ya da yanlis kagit; sessizce duzeltmek daha kotu olurdu.
  assert.equal(kalibrasyon.olcekHesapla(100, 80), null)
  assert.equal(kalibrasyon.olcekHesapla(100, 120), null)
  assert.equal(kalibrasyon.olcekHesapla(100, 0), null)
  assert.equal(kalibrasyon.olcekHesapla(100, Number.NaN), null)
  assert.equal(kalibrasyon.olcekHesapla(0, 100), null)
})

test('referans cizgiler kagida siger ve 10 mm adimlarina oturur', () => {
  for (const kagit of [
    { genislik: 100, yukseklik: 150 },
    { genislik: 148, yukseklik: 210 },
    { genislik: 210, yukseklik: 297 }
  ]) {
    const { yatayMm, dikeyMm } = kalibrasyon.referanslar(kagit)

    assert.equal(yatayMm % 10, 0, `${kagit.genislik} yatay`)
    assert.equal(dikeyMm % 10, 0, `${kagit.yukseklik} dikey`)
    assert.ok(yatayMm <= kagit.genislik - 2 * kalibrasyon.KENAR_PAYI_MM)
    assert.ok(dikeyMm <= kagit.yukseklik - 2 * kalibrasyon.KENAR_PAYI_MM)
    // Cizgi ne kadar uzunsa olcum o kadar hassas; bosa pay birakilmamali.
    assert.ok(yatayMm >= kagit.genislik - 2 * kalibrasyon.KENAR_PAYI_MM - 10)
  }
})

test('cok kucuk kagitta bile olculebilir bir cizgi kalir', () => {
  const { yatayMm } = kalibrasyon.referanslar({ genislik: 50, yukseklik: 50 })
  assert.ok(yatayMm >= 20)
})

test('yazici basina kayit okunur, yoksa duzeltmesiz doner', () => {
  const liste = [
    { yazici: 'Canon PIXMA', olcekX: 1.006, olcekY: 0.998 },
    { yazici: 'Kyocera', olcekX: 1, olcekY: 1 }
  ]

  assert.deepEqual(
    kalibrasyon.yaziciIcin(liste, 'Canon PIXMA'), { olcekX: 1.006, olcekY: 0.998 }
  )
  assert.deepEqual(kalibrasyon.yaziciIcin(liste, 'Baska'), kalibrasyon.VARSAYILAN)
  assert.deepEqual(kalibrasyon.yaziciIcin(null, 'Canon PIXMA'), kalibrasyon.VARSAYILAN)

  // Bozuk kayit da varsayilana duser; uygulama yanlis olcude basmaz.
  assert.deepEqual(
    kalibrasyon.yaziciIcin([{ yazici: 'X', olcekX: 5, olcekY: 1 }], 'X'),
    kalibrasyon.VARSAYILAN
  )
})

test('etkin olmayan duzeltme ayirt edilir', () => {
  assert.equal(kalibrasyon.etkinMi({ olcekX: 1, olcekY: 1 }), false)
  assert.equal(kalibrasyon.etkinMi({ olcekX: 1.006, olcekY: 1 }), true)
})

test('ozet yuzde olarak okunur', () => {
  assert.equal(kalibrasyon.ozet({ olcekX: 1.006, olcekY: 0.998 }), '%100,6 yatay · %99,8 dikey')
  assert.equal(kalibrasyon.ozet({ olcekX: 1, olcekY: 1 }), '%100 yatay · %100 dikey')
})

test('ayarlar dosyasi kalibrasyonu dogruluyor', () => {
  const temiz = ayarlar.ayarlariDogrula({
    kalibrasyonlar: [
      { yazici: 'Canon PIXMA', olcekX: 1.006, olcekY: 0.998 },
      // Aralik disi ve eksik kayitlar atilir.
      { yazici: 'Bozuk', olcekX: 3, olcekY: 1 },
      { yazici: '', olcekX: 1, olcekY: 1 },
      { olcekX: 1, olcekY: 1 },
      // Ayni yazici iki kez: ilki kalir.
      { yazici: 'Canon PIXMA', olcekX: 1.05, olcekY: 1.05 }
    ]
  })

  assert.deepEqual(temiz.kalibrasyonlar, [
    { yazici: 'Canon PIXMA', olcekX: 1.006, olcekY: 0.998 }
  ])
})

test('kalibrasyon sinirlari iki tarafta da ayni', () => {
  // Arayuz ile ana surec ayni araligi kullanmali; biri digerinin kaydettigini
  // atarsa kullanici duzeltmenin kayboldugunu gorur.
  assert.equal(ayarlar.EN_KUCUK_OLCEK, kalibrasyon.EN_KUCUK_OLCEK)
  assert.equal(ayarlar.EN_BUYUK_OLCEK, kalibrasyon.EN_BUYUK_OLCEK)
})

test('varsayilan ayarlarda kalibrasyon listesi bos', () => {
  assert.deepEqual(ayarlar.varsayilanAyarlar().kalibrasyonlar, [])
})
