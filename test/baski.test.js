'use strict'

// Baski olcu cevrimlerinin ve basilan sayfanin birim testleri.
// Bu fazin asil isi olcu dogrulugu oldugu icin cevrimler ayrica sinaniyor.

const test = require('node:test')
const assert = require('node:assert/strict')

const baski = require('../src/main/baski.js')

test('mikron cevrimi webContents.print icin dogru', () => {
  assert.equal(baski.mikron(100), 100000)
  assert.equal(baski.mikron(150), 150000)
  // 1 inc = 25,4 mm
  assert.equal(baski.mikron(25.4), 25400)
})

test('inc cevrimi printToPDF icin dogru', () => {
  assert.equal(baski.inc(25.4), 1)
  assert.ok(Math.abs(baski.inc(100) - 3.937008) < 1e-6)
})

test('punto cevrimi PDF olcusuyle ortusur', () => {
  assert.equal(baski.punto(25.4), 72)
  // 100x150 mm sayfa 283,46 x 425,20 punto olmali
  assert.ok(Math.abs(baski.punto(100) - 283.4645) < 1e-3)
  assert.ok(Math.abs(baski.punto(150) - 425.1968) < 1e-3)
})

test('kopya sayisi sinirlara cekilir', () => {
  assert.equal(baski.kopyaSayisi(1), 1)
  assert.equal(baski.kopyaSayisi(3), 3)
  assert.equal(baski.kopyaSayisi(0), 1)
  assert.equal(baski.kopyaSayisi(-5), 1)
  assert.equal(baski.kopyaSayisi(500), 99)
  assert.equal(baski.kopyaSayisi('2'), 2)
  assert.equal(baski.kopyaSayisi('abc'), 1)
  assert.equal(baski.kopyaSayisi(undefined), 1)
  assert.equal(baski.kopyaSayisi(2.7), 2)
})

test('gecersiz kagit olcusu reddedilir', () => {
  assert.deepEqual(baski.sayfaOlcusu({ genislik: 100, yukseklik: 150 }), {
    genislik: 100, yukseklik: 150
  })
  assert.throws(() => baski.sayfaOlcusu(null), /geçersiz/)
  assert.throws(() => baski.sayfaOlcusu({ genislik: 0, yukseklik: 150 }), /geçersiz/)
  assert.throws(() => baski.sayfaOlcusu({ genislik: 100 }), /geçersiz/)
  assert.throws(() => baski.sayfaOlcusu({ genislik: 5000, yukseklik: 150 }), /geçersiz/)
})

test('basilan sayfa kagit olcusunu milimetre olarak yazar', () => {
  const html = baski.baskiSayfasiHtml({ genislik: 100, yukseklik: 150 }, 'app://hv/gecici/1')

  assert.match(html, /@page \{ size: 100mm 150mm; margin: 0; \}/)
  // Goruntu de kagidin tamamini kaplamali; aksi halde surucu olcekleme yapar.
  assert.match(html, /width: 100mm;/)
  assert.match(html, /height: 150mm;/)
  assert.match(html, /src="app:\/\/hv\/gecici\/1"/)
})

test('kesirli kagit olculeri gereksiz sifirla yazilmaz', () => {
  const html = baski.baskiSayfasiHtml({ genislik: 210, yukseklik: 297.5 }, 'app://hv/gecici/2')
  assert.match(html, /@page \{ size: 210mm 297.5mm; margin: 0; \}/)
})

test('baski sayfasi kendi CSP ile gelir ve betik icermez', () => {
  const html = baski.baskiSayfasiHtml({ genislik: 100, yukseklik: 150 }, 'app://hv/gecici/1')

  assert.match(html, /Content-Security-Policy/)
  assert.equal(/<script/i.test(html), false)
})

test('PDF MediaBox okunur', () => {
  const sahte = Buffer.from('... /MediaBox [ 0 0 283.46 425.2 ] ...', 'latin1')
  assert.deepEqual(baski.pdfMediaBox(sahte), { genislik: 283.46, yukseklik: 425.2 })
  assert.equal(baski.pdfMediaBox(Buffer.from('bos')), null)
})

test('baski cozunurlugu dogrulanir', () => {
  // Verilmezse fotograf kipine uygun varsayilan.
  assert.equal(baski.baskiCozunurlugu(undefined), 600)
  assert.equal(baski.baskiCozunurlugu(null), 600)
  assert.equal(baski.baskiCozunurlugu('abc'), 600)

  // Listedeki degerler oldugu gibi gecer.
  for (const nokta of baski.BASKI_COZUNURLUKLERI) {
    assert.equal(baski.baskiCozunurlugu(nokta), nokta)
  }

  // Liste disi ama makul degerler de kabul edilir (ozel surucu profilleri).
  assert.equal(baski.baskiCozunurlugu(720), 720)
  assert.equal(baski.baskiCozunurlugu('1440'), 1440)

  // Aralik disi degerler varsayilana duser. Kirpmak yanlis olurdu: 0 gelirse
  // 72 DPI'ya inip sessizce berbat bir baski cikardi.
  assert.equal(baski.baskiCozunurlugu(0), 600)
  assert.equal(baski.baskiCozunurlugu(-300), 600)
  assert.equal(baski.baskiCozunurlugu(50), 600)
  assert.equal(baski.baskiCozunurlugu(99999), 600)

  // Sinirlarin kendisi gecerlidir.
  assert.equal(baski.baskiCozunurlugu(72), 72)
  assert.equal(baski.baskiCozunurlugu(2400), 2400)
})
