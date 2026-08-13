'use strict'

// Renk duzeni cevrimlerinin birim testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const renk = require('../src/renderer/js/renk.js')

test('duzen listesi sRGB, gri ve CMYK icerir', () => {
  const kodlar = renk.RENK_DUZENLERI.map((d) => d.kod)
  assert.deepEqual(kodlar, ['srgb', 'gri', 'cmyk'])

  for (const duzen of renk.RENK_DUZENLERI) {
    assert.ok(duzen.ad.length > 0, duzen.kod)
    assert.ok(duzen.aciklama.length > 20, duzen.kod)
  }
})

test('bilinmeyen duzen sRGB kabul edilir', () => {
  assert.equal(renk.duzenBul('yok').kod, 'srgb')
  assert.equal(renk.duzenGecerliMi('cmyk'), true)
  assert.equal(renk.duzenGecerliMi('yok'), false)
  assert.equal(renk.duzenGecerliMi(undefined), false)
})

test('gri tonu parlaklik agirliklarini kullanir', () => {
  assert.equal(renk.griTonu(0, 0, 0), 0)
  assert.equal(renk.griTonu(255, 255, 255), 255)
  // Yesil kirmizidan parlak gorunur
  assert.ok(renk.griTonu(0, 255, 0) > renk.griTonu(255, 0, 0))
  assert.ok(renk.griTonu(255, 0, 0) > renk.griTonu(0, 0, 255))
})

test('CMYK cevrimi bilinen renkleri dogru veriyor', () => {
  assert.deepEqual(renk.rgbdenCmyk(255, 255, 255), [0, 0, 0, 0])
  assert.deepEqual(renk.rgbdenCmyk(0, 0, 0), [0, 0, 0, 255])
  assert.deepEqual(renk.rgbdenCmyk(255, 0, 0), [0, 255, 255, 0])
  assert.deepEqual(renk.rgbdenCmyk(0, 255, 0), [255, 0, 255, 0])
  assert.deepEqual(renk.rgbdenCmyk(0, 0, 255), [255, 255, 0, 0])
  // Notr gri: yalnizca siyah murekkep
  assert.deepEqual(renk.rgbdenCmyk(128, 128, 128), [0, 0, 0, 127])
})

test('CMYK cevrimi geri donusturulebilir', () => {
  const renkler = [
    [255, 255, 255], [0, 0, 0], [128, 64, 32], [10, 200, 90], [200, 200, 60], [17, 17, 17]
  ]

  for (const [r, g, b] of renkler) {
    const [c, m, y, k] = renk.rgbdenCmyk(r, g, b)
    const [r2, g2, b2] = renk.cmyktenRgb(c, m, y, k)

    // Tam sayiya yuvarlamadan gelen 1 birimlik sapma kabul edilir.
    assert.ok(Math.abs(r2 - r) <= 1, `${r},${g},${b} -> ${r2},${g2},${b2}`)
    assert.ok(Math.abs(g2 - g) <= 1, `${r},${g},${b} -> ${r2},${g2},${b2}`)
    assert.ok(Math.abs(b2 - b) <= 1, `${r},${g},${b} -> ${r2},${g2},${b2}`)
  }
})

test('CMYK bilesenleri gecerli aralikta kalir', () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        for (const deger of renk.rgbdenCmyk(r, g, b)) {
          assert.ok(Number.isInteger(deger) && deger >= 0 && deger <= 255,
            `${r},${g},${b} -> ${deger}`)
        }
      }
    }
  }
})
