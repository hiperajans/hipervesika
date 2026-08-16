'use strict'

// Arayuz olceginin basamak hesabi (ana surec tarafi). Kisayolun tus eslemesi
// arayuzde durur ve kisayol.test.js icinde sinanir.

const test = require('node:test')
const assert = require('node:assert/strict')

const yakinlik = require('../src/main/yakinlik.js')

test('basamaklar artan sirada ve gercek boyutu iceriyor', () => {
  const sirali = [...yakinlik.BASAMAKLAR].sort((a, b) => a - b)
  assert.deepEqual(yakinlik.BASAMAKLAR, sirali)
  assert.ok(yakinlik.BASAMAKLAR.includes(yakinlik.VARSAYILAN))
})

test('basamak basamak buyur ve kuculur', () => {
  assert.equal(yakinlik.sonrakiBasamak(1, 1), 1.1)
  assert.equal(yakinlik.sonrakiBasamak(1.1, 1), 1.25)
  assert.equal(yakinlik.sonrakiBasamak(1, -1), 0.9)
  assert.equal(yakinlik.sonrakiBasamak(0.9, -1), 0.8)
})

test('uclarda deger degismez', () => {
  assert.equal(yakinlik.sonrakiBasamak(yakinlik.EN_BUYUK, 1), yakinlik.EN_BUYUK)
  assert.equal(yakinlik.sonrakiBasamak(yakinlik.EN_KUCUK, -1), yakinlik.EN_KUCUK)
})

test('merdiven disi olcek o yondeki ilk basamaga oturur', () => {
  assert.equal(yakinlik.sonrakiBasamak(1.05, 1), 1.1)
  assert.equal(yakinlik.sonrakiBasamak(1.05, -1), 1)
  // Sinir disi degerler once sinira cekilir.
  assert.equal(yakinlik.sonrakiBasamak(5, -1), 1.75)
  assert.equal(yakinlik.sonrakiBasamak(0.1, 1), 0.75)
})

test('gecersiz olcek gercek boyut sayilir', () => {
  assert.equal(yakinlik.sinirla(Number.NaN), yakinlik.VARSAYILAN)
  assert.equal(yakinlik.sinirla(0), yakinlik.VARSAYILAN)
  assert.equal(yakinlik.sinirla(-2), yakinlik.VARSAYILAN)
  assert.equal(yakinlik.sinirla(undefined), yakinlik.VARSAYILAN)
})

test('komutlar dogru olcegi uretir', () => {
  assert.equal(yakinlik.yeniOlcek(1, 'buyut'), 1.1)
  assert.equal(yakinlik.yeniOlcek(1, 'kucult'), 0.9)
  assert.equal(yakinlik.yeniOlcek(1.75, 'sifirla'), yakinlik.VARSAYILAN)
  // Olcek okunamazsa (getZoomFactor beklenmedik bir sey dondururse) gercek
  // boyuttan devam edilir; kullanici en azindan bildigi yere doner.
  assert.equal(yakinlik.yeniOlcek(Number.NaN, 'buyut'), 1.1)
})

test('arayuzden gelen komut dogrulanir', () => {
  for (const komut of yakinlik.KOMUTLAR) assert.ok(yakinlik.komutGecerliMi(komut))
  assert.equal(yakinlik.komutGecerliMi('baska'), false)
  assert.equal(yakinlik.komutGecerliMi(''), false)
  assert.equal(yakinlik.komutGecerliMi(undefined), false)
})
