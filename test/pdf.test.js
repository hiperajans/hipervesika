'use strict'

// Elle yazilan DeviceCMYK PDF'in yapisi.

const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')

const pdf = require('../src/main/pdf.js')
const baski = require('../src/main/baski.js')

const KAGIT = { genislik: 100, yukseklik: 150 }

function ornekPdf (genislik = 4, yukseklik = 3) {
  const baytlar = new Uint8Array(genislik * yukseklik * 4)
  for (let i = 0; i < baytlar.length; i += 4) {
    baytlar[i] = 10        // C
    baytlar[i + 1] = 20    // M
    baytlar[i + 2] = 30    // Y
    baytlar[i + 3] = 40    // K
  }
  return { baytlar, belge: pdf.cmykSayfaPdf({ baytlar, genislik, yukseklik, kagitMm: KAGIT }) }
}

test('PDF basligi ve sonu dogru', () => {
  const { belge } = ornekPdf()
  const metin = belge.toString('latin1')

  assert.ok(metin.startsWith('%PDF-1.7'))
  assert.ok(metin.trimEnd().endsWith('%%EOF'))
})

test('sayfa olcusu milimetreden puntoya cevrilir', () => {
  const { belge } = ornekPdf()
  const kutu = baski.pdfMediaBox(belge)

  assert.ok(Math.abs(kutu.genislik - baski.punto(100)) < 0.01, `${kutu.genislik}`)
  assert.ok(Math.abs(kutu.yukseklik - baski.punto(150)) < 0.01, `${kutu.yukseklik}`)
})

test('goruntu DeviceCMYK olarak gomulur', () => {
  const { belge } = ornekPdf(4, 3)
  const metin = belge.toString('latin1')

  assert.match(metin, /\/ColorSpace \/DeviceCMYK/)
  assert.match(metin, /\/BitsPerComponent 8/)
  assert.match(metin, /\/Width 4 \/Height 3/)
  assert.match(metin, /\/Filter \/FlateDecode/)
})

test('gomulu akis acildiginda ozgun baytlari verir', () => {
  const { baytlar, belge } = ornekPdf(4, 3)
  const metin = belge.toString('latin1')

  // Goruntu nesnesinin akisini bul
  const bas = metin.indexOf('stream\n', metin.indexOf('/DeviceCMYK')) + 'stream\n'.length
  const son = metin.indexOf('\nendstream', bas)
  const acilan = zlib.inflateSync(belge.subarray(bas, son))

  assert.equal(acilan.length, baytlar.length)
  assert.deepEqual(new Uint8Array(acilan), baytlar)
})

test('xref konumlari nesnelerin gercek yerini gosterir', () => {
  const { belge } = ornekPdf()
  const metin = belge.toString('latin1')

  // "startxref" de "xref" iceriyor; tablonun kendisi satir basindadir.
  const xrefBasi = metin.lastIndexOf('\nxref\n') + 1
  const satirlar = metin.slice(xrefBasi).split('\n').slice(3, 8)

  satirlar.forEach((satir, sira) => {
    const konum = Number(satir.slice(0, 10))
    assert.equal(metin.slice(konum, konum + 7), `${sira + 1} 0 obj`,
      `${sira + 1}. nesne ${konum} konumunda degil`)
  })

  // startxref, xref bolumunun basini gostermeli
  const startxref = Number(metin.slice(metin.lastIndexOf('startxref') + 10).trim().split('\n')[0])
  assert.equal(startxref, xrefBasi)
})

test('icerik akisi goruntuyu sayfanin tamamina oturtur', () => {
  const { belge } = ornekPdf()
  const metin = belge.toString('latin1')
  const eslesme = metin.match(/q ([\d.]+) 0 0 ([\d.]+) 0 0 cm \/Im0 Do Q/)

  assert.ok(eslesme, 'icerik akisi bulunamadi')
  assert.ok(Math.abs(Number(eslesme[1]) - baski.punto(100)) < 0.01)
  assert.ok(Math.abs(Number(eslesme[2]) - baski.punto(150)) < 0.01)
})

test('uyusmayan olcu reddedilir', () => {
  assert.throws(
    () => pdf.cmykSayfaPdf({
      baytlar: new Uint8Array(10), genislik: 4, yukseklik: 3, kagitMm: KAGIT
    }),
    /uyuşmuyor/
  )
  assert.throws(
    () => pdf.cmykSayfaPdf({
      baytlar: new Uint8Array(48), genislik: 0, yukseklik: 3, kagitMm: KAGIT
    }),
    /Görüntü ölçüsü geçersiz/
  )
  assert.throws(
    () => pdf.cmykSayfaPdf({ baytlar: 'metin', genislik: 4, yukseklik: 3, kagitMm: KAGIT }),
    /CMYK verisi geçersiz/
  )
})
