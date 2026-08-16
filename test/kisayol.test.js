'use strict'

// Arayuz olcegi kisayolunun tus eslemesi.
//
// Asil zorluk klavye dizeni: '+' Turkce Q klavyede Shift+4 ile yazilir, bu
// yuzden esleme fiziksel tusa degil uretilen karaktere bakar.

const test = require('node:test')
const assert = require('node:assert/strict')

const kisayol = require('../src/renderer/js/kisayol.js')
const yakinlik = require('../src/main/yakinlik.js')

const olay = (key, ek = {}) => ({
  key, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...ek
})

test('Ctrl ile yazilan karakter komuta cevrilir', () => {
  assert.equal(kisayol.yakinlikKomutu(olay('+')), 'buyut')
  assert.equal(kisayol.yakinlikKomutu(olay('=')), 'buyut')
  assert.equal(kisayol.yakinlikKomutu(olay('-')), 'kucult')
  assert.equal(kisayol.yakinlikKomutu(olay('_')), 'kucult')
  assert.equal(kisayol.yakinlikKomutu(olay('0')), 'sifirla')
})

test('Turkce Q klavyede Shift ile yazilan + de calisir', () => {
  // Shift+4 -> '+'. Fiziksel tusa bakan menu hizlandiricisi burada
  // tetiklenmiyordu; kisayolun bu dosyada olmasinin sebebi bu.
  assert.equal(kisayol.yakinlikKomutu(olay('+', { shiftKey: true })), 'buyut')
})

test('uretilen komutlar ana surecin tanidiklari', () => {
  for (const komut of kisayol.YAKINLIK_TUSLARI.values()) {
    assert.ok(yakinlik.komutGecerliMi(komut), `ana surec ${komut} komutunu tanimiyor`)
  }
})

test('denetim tusu olmadan kisayol yok', () => {
  assert.equal(kisayol.yakinlikKomutu(olay('+', { ctrlKey: false })), null)
  assert.equal(kisayol.yakinlikKomutu(olay('-', { ctrlKey: false })), null)
})

test('AltGr ile yazilan karakter kisayol sayilmaz', () => {
  // Windows'ta AltGr, Ctrl+Alt olarak bildirilir.
  assert.equal(kisayol.yakinlikKomutu(olay('-', { altKey: true })), null)
})

test('macOS Cmd bekler, Ctrl kabul etmez', () => {
  const mac = { mac: true }
  assert.equal(kisayol.yakinlikKomutu(olay('+', { ctrlKey: false, metaKey: true }), mac), 'buyut')
  assert.equal(kisayol.yakinlikKomutu(olay('+'), mac), null)
  // Diger platformlarda tersi.
  assert.equal(kisayol.yakinlikKomutu(olay('+', { ctrlKey: false, metaKey: true })), null)
})

test('tanimsiz tuslar ve bos olay gecilir', () => {
  assert.equal(kisayol.yakinlikKomutu(olay('a')), null)
  assert.equal(kisayol.yakinlikKomutu(olay('1')), null)
  assert.equal(kisayol.yakinlikKomutu(olay('Control')), null)
  assert.equal(kisayol.yakinlikKomutu(null), null)
})
