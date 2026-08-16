'use strict'

// Acilis asamalari ve ilerleme hesabi.
//
// Asama kodlari iki pencere arasinda paylasilir (ana pencere bildirir, acilis
// penceresi raya cevirir); bu yuzden liste ile dogrulama ayni yerde tutulur.

const test = require('node:test')
const assert = require('node:assert/strict')

const acilis = require('../src/renderer/js/acilis.js')

test('asamalar tanimli ve yuz modeli once yukleniyor', () => {
  assert.ok(acilis.ASAMALAR.length >= 2)
  for (const kod of acilis.ASAMALAR) assert.match(kod, /^[a-z]+$/)
  // Ikisi ayni ekran kartini kullaniyor; sira bozulursa yarisirlar.
  assert.equal(acilis.ASAMALAR[0], 'yuz')
})

test('bildirim dogrulamasi bilinmeyen kod ve durumu eler', () => {
  assert.equal(acilis.bildirimGecerliMi({ kod: 'yuz', durum: 'yukleniyor' }), true)
  assert.equal(acilis.bildirimGecerliMi({ kod: 'yuz', durum: 'hazir' }), true)
  assert.equal(acilis.bildirimGecerliMi({ kod: 'yok', durum: 'hazir' }), false)
  assert.equal(acilis.bildirimGecerliMi({ kod: 'yuz', durum: 'baska' }), false)
  assert.equal(acilis.bildirimGecerliMi({ kod: 'yuz' }), false)
  assert.equal(acilis.bildirimGecerliMi(null), false)
})

test('ilerleme biten asamayi tam, sureni yarim sayar', () => {
  const adet = acilis.ASAMALAR.length
  const [ilk, ikinci] = acilis.ASAMALAR

  assert.equal(acilis.ilerleme({}), 0)
  assert.equal(acilis.ilerleme({ [ilk]: 'bekliyor' }), 0)
  assert.equal(acilis.ilerleme({ [ilk]: 'yukleniyor' }), Math.round((0.5 / adet) * 100))
  assert.equal(acilis.ilerleme({ [ilk]: 'hazir' }), Math.round((1 / adet) * 100))
  assert.equal(
    acilis.ilerleme({ [ilk]: 'hazir', [ikinci]: 'yukleniyor' }),
    Math.round((1.5 / adet) * 100)
  )
})

test('ilerleme her asama bitince dolar, yuklenemeyen asama da bitmis sayilir', () => {
  const hepsiHazir = {}
  const biriHatali = {}
  for (const kod of acilis.ASAMALAR) {
    hepsiHazir[kod] = 'hazir'
    biriHatali[kod] = 'hata'
  }

  assert.equal(acilis.ilerleme(hepsiHazir), 100)
  // Hata da bir sonuctur: ray yarida kalirsa uygulama takilmis gorunur.
  assert.equal(acilis.ilerleme(biriHatali), 100)
})
