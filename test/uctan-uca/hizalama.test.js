'use strict'

// Otomatik hizalamanin bekleme penceresi.
//
// Isin kendisi (yuz bulma) gercek fotograf ister; burada sinanan pencerenin
// acilip kapanmasi, o yuzden sentetik goruntu yeter: yuz bulunamayan yol da
// ayni pencereden gecer.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('hizalama')

let sayfa, hatalar, kapat

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(
    calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'kadraj')
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

test('otomatik hizala calisirken bekleme penceresi durur', async () => {
  await sayfa.click('#btn-otomatik-hizala')

  await sayfa.waitForSelector('#islem-modali.show')
  assert.match(await sayfa.textContent('#islem-yazisi'), /Yüz aranıyor/)
  // Islem surerken dugmeye ikinci kez basilamamali.
  assert.equal(await sayfa.isDisabled('#btn-otomatik-hizala'), true)

  // Modeller ilk kullanimda yukleniyor olabilir; sure comert tutuldu.
  await sayfa.waitForSelector('#islem-modali.show', { state: 'hidden', timeout: 300000 })

  assert.match(
    await sayfa.textContent('#hizalama-durumu'), /Yüz bulunamadı|Eğiklik|yapılamadı/)
  assert.equal(await sayfa.isDisabled('#btn-otomatik-hizala'), false)
})

test('pencere kapaninca arayuz yeniden kullanilabiliyor', async () => {
  // Perde kalirsa panel tiklanamaz hale gelirdi.
  await ortam.adima(sayfa, 'rotus')
  assert.equal(await sayfa.isVisible('#adim-rotus.active'), true)
  await ortam.adima(sayfa, 'kadraj')
})

test('hizalama arayuzde hata birakmadi', () => {
  assert.deepEqual(hatalar, [])
})
