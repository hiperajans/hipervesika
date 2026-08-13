'use strict'

// Kullanici ayarlarinin birim testleri. Ayar dosyasi elle duzenlenebildigi icin
// asil sinav bozuk veriyle acilabilmek.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ayarlar = require('../src/main/ayarlar.js')

function geciciKlasor () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hv-ayar-'))
}

test('varsayilan ayarlar bos listelerle gelir', () => {
  const varsayilan = ayarlar.varsayilanAyarlar()

  assert.deepEqual(varsayilan.fotografOnayarlari, [])
  assert.deepEqual(varsayilan.kagitOnayarlari, [])
  assert.deepEqual(varsayilan.sonKullanilan, {})
})

test('gecerli on ayarlar korunur', () => {
  const temiz = ayarlar.ayarlariDogrula({
    fotografOnayarlari: [{ kod: 'kullanici-1', ad: 'Ehliyet', genislikMm: 45, yukseklikMm: 55 }],
    kagitOnayarlari: [{ kod: 'kullanici-1', ad: 'Rulo', genislik: 100, yukseklik: 200 }]
  })

  assert.equal(temiz.fotografOnayarlari.length, 1)
  assert.deepEqual(temiz.fotografOnayarlari[0], {
    kod: 'kullanici-1', ad: 'Ehliyet', genislikMm: 45, yukseklikMm: 55
  })
  assert.equal(temiz.kagitOnayarlari[0].ad, 'Rulo')
})

test('sinir disi olculer atilir', () => {
  const temiz = ayarlar.ayarlariDogrula({
    fotografOnayarlari: [
      { kod: 'a', ad: 'Cok kucuk', genislikMm: 2, yukseklikMm: 55 },
      { kod: 'b', ad: 'Cok buyuk', genislikMm: 45, yukseklikMm: 9000 },
      { kod: 'c', ad: 'Olur', genislikMm: 45, yukseklikMm: 55 }
    ],
    kagitOnayarlari: [
      { kod: 'a', ad: 'Kucuk kagit', genislik: 20, yukseklik: 100 },
      { kod: 'b', ad: 'Olur', genislik: 100, yukseklik: 150 }
    ]
  })

  assert.deepEqual(temiz.fotografOnayarlari.map((o) => o.ad), ['Olur'])
  assert.deepEqual(temiz.kagitOnayarlari.map((o) => o.ad), ['Olur'])
})

test('adsiz, kodsuz ve tekrar eden kayitlar atilir', () => {
  const temiz = ayarlar.ayarlariDogrula({
    fotografOnayarlari: [
      { kod: 'k-1', ad: '   ', genislikMm: 45, yukseklikMm: 55 },
      { ad: 'Kodsuz', genislikMm: 45, yukseklikMm: 55 },
      { kod: 'k-2', ad: 'Ilk', genislikMm: 45, yukseklikMm: 55 },
      { kod: 'k-2', ad: 'Ayni kod', genislikMm: 40, yukseklikMm: 50 }
    ]
  })

  assert.deepEqual(temiz.fotografOnayarlari.map((o) => o.ad), ['Ilk'])
})

test('bozuk yapi varsayilana duser', () => {
  for (const bozuk of [null, undefined, 42, 'metin', [], { fotografOnayarlari: 'liste' }]) {
    const temiz = ayarlar.ayarlariDogrula(bozuk)
    assert.deepEqual(temiz.fotografOnayarlari, [])
    assert.deepEqual(temiz.kagitOnayarlari, [])
  }
})

test('ad kirpilir ve uzunlugu sinirlanir', () => {
  assert.equal(ayarlar.adTemizle('  Vesikalık  '), 'Vesikalık')
  assert.equal(ayarlar.adTemizle('iki\n\nsatir'), 'iki satir')
  assert.equal(ayarlar.adTemizle('x'.repeat(80)).length, ayarlar.AD_UZUNLUGU)
  assert.equal(ayarlar.adTemizle('   '), null)
  assert.equal(ayarlar.adTemizle(5), null)
})

test('on ayar sayisi sinirlanir', () => {
  const cok = Array.from({ length: ayarlar.EN_FAZLA_ONAYAR + 10 }, (_, sira) => ({
    kod: `k-${sira}`, ad: `Ad ${sira}`, genislikMm: 45, yukseklikMm: 55
  }))

  const temiz = ayarlar.ayarlariDogrula({ fotografOnayarlari: cok })
  assert.equal(temiz.fotografOnayarlari.length, ayarlar.EN_FAZLA_ONAYAR)
})

test('son kullanilan degerlerde yalnizca basit turler kalir', () => {
  const temiz = ayarlar.ayarlariDogrula({
    sonKullanilan: {
      dpi: 300,
      tur: 'png',
      kesimKilavuzu: true,
      bozuk: { ic: 1 },
      dizi: [1, 2],
      sonsuz: Number.POSITIVE_INFINITY
    }
  })

  assert.deepEqual(temiz.sonKullanilan, { dpi: 300, tur: 'png', kesimKilavuzu: true })
})

test('benzersiz kod uretilir', () => {
  assert.equal(ayarlar.benzersizKod([]), 'kullanici-1')
  assert.equal(ayarlar.benzersizKod([{ kod: 'kullanici-1' }]), 'kullanici-2')
  assert.equal(
    ayarlar.benzersizKod([{ kod: 'kullanici-1' }, { kod: 'kullanici-2' }]),
    'kullanici-3'
  )
})

test('yazilan ayarlar geri okunur', async () => {
  const klasor = geciciKlasor()

  await ayarlar.yaz(klasor, {
    fotografOnayarlari: [{ kod: 'kullanici-1', ad: 'Ehliyet', genislikMm: 45, yukseklikMm: 55 }],
    sonKullanilan: { dpi: 600, tur: 'png' }
  })

  const okunan = await ayarlar.oku(klasor)
  assert.equal(okunan.fotografOnayarlari[0].ad, 'Ehliyet')
  assert.equal(okunan.sonKullanilan.dpi, 600)

  fs.rmSync(klasor, { recursive: true, force: true })
})

test('olmayan klasor ve bozuk dosya varsayilan dondurur', async () => {
  const klasor = geciciKlasor()

  // Henuz dosya yok
  assert.deepEqual((await ayarlar.oku(klasor)).fotografOnayarlari, [])

  fs.writeFileSync(ayarlar.dosyaYolu(klasor), '{ yarim', 'utf8')
  const okunan = await ayarlar.oku(klasor)
  assert.deepEqual(okunan.fotografOnayarlari, [])
  assert.deepEqual(okunan.sonKullanilan, {})

  fs.rmSync(klasor, { recursive: true, force: true })
})

test('yazma gecici dosya birakmaz', async () => {
  const klasor = geciciKlasor()
  await ayarlar.yaz(klasor, ayarlar.varsayilanAyarlar())

  assert.deepEqual(fs.readdirSync(klasor), [ayarlar.DOSYA_ADI])

  fs.rmSync(klasor, { recursive: true, force: true })
})
