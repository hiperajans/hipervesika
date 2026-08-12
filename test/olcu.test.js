'use strict'

// Olcu motorunun birim testleri. Arayuz gerektirmez: node --test ile calisir.

const test = require('node:test')
const assert = require('node:assert/strict')

const olcu = require('../src/renderer/js/olcu.js')

const yakin = (a, b, tolerans = 0.001) =>
  assert.ok(Math.abs(a - b) <= tolerans, `${a} ile ${b} arasindaki fark ${tolerans} degerini asiyor`)

const oraniOlc = (c) => c.genislik / c.yukseklik

test('mm ve piksel donusumu birbirinin tersi', () => {
  yakin(olcu.mmDenPiksel(25.4, 300), 300)
  yakin(olcu.pikselDenMm(300, 300), 25.4)
  yakin(olcu.pikselDenMm(olcu.mmDenPiksel(37.5, 600), 600), 37.5)
})

test('cikti boyutu secilen DPI ile hesaplanir', () => {
  assert.deepEqual(olcu.ciktiBoyutu({ genislikMm: 50, yukseklikMm: 60 }, 300), {
    genislik: 591,
    yukseklik: 709
  })
  assert.deepEqual(olcu.ciktiBoyutu({ genislikMm: 35, yukseklikMm: 45 }, 600), {
    genislik: 827,
    yukseklik: 1063
  })
})

test('efektif DPI kaynaktaki gercek cozunurlugu verir', () => {
  yakin(olcu.efektifDpi(591, 50), 300.228, 0.01)
  // Yarisi kadar piksel, yarisi kadar DPI.
  yakin(olcu.efektifDpi(295.5, 50), 150.114, 0.01)
  assert.equal(olcu.efektifDpi(500, 0), 0)
})

test('cozunurluk durumu esiklere gore siniflanir', () => {
  assert.equal(olcu.cozunurlukDurumu(320), 'iyi')
  assert.equal(olcu.cozunurlukDurumu(300), 'iyi')
  assert.equal(olcu.cozunurlukDurumu(250), 'sinirda')
  assert.equal(olcu.cozunurlukDurumu(199), 'dusuk')
})

test('olcu dogrulamasi sinirlari uygular', () => {
  assert.equal(olcu.olcuGecerliMi(50), true)
  assert.equal(olcu.olcuGecerliMi(9), false)
  assert.equal(olcu.olcuGecerliMi(301), false)
  assert.equal(olcu.olcuGecerliMi(Number.NaN), false)
  assert.equal(olcu.olcuGecerliMi(undefined), false)
})

test('baslangic cercevesi ortalanir, orani korur ve gorsele sigar', () => {
  // Genis gorsel, dikey oran: yukseklik sinirlayici olmali.
  const c = olcu.baslangicCercevesi(4000, 3000, 50 / 60)
  yakin(oraniOlc(c), 50 / 60)
  assert.equal(c.yukseklik, 3000)
  yakin(c.x + c.genislik / 2, 2000)
  yakin(c.y, 0)
  assert.ok(c.genislik <= 4000)

  // Dar gorsel, yatay oran: genislik sinirlayici olmali.
  const d = olcu.baslangicCercevesi(1000, 4000, 3 / 2)
  yakin(oraniOlc(d), 3 / 2)
  assert.equal(d.genislik, 1000)
  yakin(d.y + d.yukseklik / 2, 2000)
})

test('sinirlara tasima cerceveyi gorsel icine geri iter', () => {
  const c = olcu.sinirlaraTasi({ x: -50, y: -80, genislik: 200, yukseklik: 240 }, 1000, 1000)
  assert.deepEqual(c, { x: 0, y: 0, genislik: 200, yukseklik: 240 })

  const d = olcu.sinirlaraTasi({ x: 900, y: 900, genislik: 200, yukseklik: 240 }, 1000, 1000)
  assert.deepEqual(d, { x: 800, y: 760, genislik: 200, yukseklik: 240 })

  // Gorselden buyuk cerceve gorsele indirgenir.
  const e = olcu.sinirlaraTasi({ x: 0, y: 0, genislik: 2000, yukseklik: 2000 }, 800, 600)
  assert.equal(e.genislik, 800)
  assert.equal(e.yukseklik, 600)
})

test('koseden boyutlandirmada karsi kose sabit kalir ve oran korunur', () => {
  const cerceve = { x: 200, y: 200, genislik: 400, yukseklik: 480 }
  const kose = { sagda: true, altta: true } // sag alt kose suruklenir

  const yeni = olcu.koseIleBoyutlandir(cerceve, kose, { x: 700, y: 900 }, 50 / 60, 2000, 2000)

  yakin(oraniOlc(yeni), 50 / 60)
  assert.equal(yeni.x, 200) // sol ust kose yerinde
  assert.equal(yeni.y, 200)
  assert.ok(yeni.genislik > cerceve.genislik)
})

test('koseden boyutlandirma gorsel disina tasmaz', () => {
  const cerceve = { x: 100, y: 100, genislik: 200, yukseklik: 240 }
  const kose = { sagda: true, altta: true }

  // Imlec gorselin cok disinda.
  const yeni = olcu.koseIleBoyutlandir(cerceve, kose, { x: 99999, y: 99999 }, 50 / 60, 800, 600)

  yakin(oraniOlc(yeni), 50 / 60)
  assert.ok(yeni.x >= 0 && yeni.y >= 0)
  assert.ok(yeni.x + yeni.genislik <= 800.001)
  assert.ok(yeni.y + yeni.yukseklik <= 600.001)
  // Yukseklik sinirlayici: 600 - 100 = 500 -> genislik 500 * (50/60)
  yakin(yeni.yukseklik, 500)
})

test('sol ust koseden boyutlandirmada sag alt kose sabit kalir', () => {
  const cerceve = { x: 300, y: 300, genislik: 400, yukseklik: 480 }
  const kose = { sagda: false, altta: false }

  const yeni = olcu.koseIleBoyutlandir(cerceve, kose, { x: 100, y: 100 }, 50 / 60, 2000, 2000)

  yakin(oraniOlc(yeni), 50 / 60)
  yakin(yeni.x + yeni.genislik, 700) // sag kenar yerinde
  yakin(yeni.y + yeni.yukseklik, 780) // alt kenar yerinde
})

test('koseden boyutlandirma en kucuk olcunun altina inmez', () => {
  const cerceve = { x: 100, y: 100, genislik: 400, yukseklik: 480 }
  const kose = { sagda: true, altta: true }

  // Imlec sabit kosenin uzerine geliyor: cerceve sifira inmemeli.
  const yeni = olcu.koseIleBoyutlandir(cerceve, kose, { x: 100, y: 100 }, 50 / 60, 2000, 2000)

  assert.ok(yeni.genislik >= olcu.EN_KUCUK_KIRPMA)
  assert.ok(yeni.yukseklik >= olcu.EN_KUCUK_KIRPMA)
  yakin(oraniOlc(yeni), 50 / 60)
})

test('orana uydurma merkezi korur ve yeni orani uygular', () => {
  const cerceve = { x: 100, y: 100, genislik: 400, yukseklik: 480 } // 50x60 orani
  const yeni = olcu.oranaUydur(cerceve, 35 / 45, 2000, 2000)

  yakin(oraniOlc(yeni), 35 / 45)
  yakin(yeni.x + yeni.genislik / 2, 300, 0.5)
  yakin(yeni.y + yeni.yukseklik / 2, 340, 0.5)
})

test('orana uydurma gorselden buyuk cerceve uretmez', () => {
  const cerceve = { x: 0, y: 0, genislik: 800, yukseklik: 600 }
  const yeni = olcu.oranaUydur(cerceve, 50 / 60, 800, 600)

  yakin(oraniOlc(yeni), 50 / 60)
  assert.ok(yeni.genislik <= 800.001)
  assert.ok(yeni.yukseklik <= 600.001)
  assert.ok(yeni.x >= -0.001 && yeni.y >= -0.001)
})

test('on ayarlar tanimli ve tutarli', () => {
  assert.equal(olcu.FOTOGRAF_ONAYARLARI.length, 3)
  for (const onayar of olcu.FOTOGRAF_ONAYARLARI) {
    assert.ok(olcu.olcuGecerliMi(onayar.genislikMm), `${onayar.kod} genislik`)
    assert.ok(olcu.olcuGecerliMi(onayar.yukseklikMm), `${onayar.kod} yukseklik`)
  }
  const tr = olcu.FOTOGRAF_ONAYARLARI.find((o) => o.kod === 'tr-biyometrik')
  assert.deepEqual([tr.genislikMm, tr.yukseklikMm], [50, 60])
})
