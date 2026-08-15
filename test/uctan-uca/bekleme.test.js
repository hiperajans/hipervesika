'use strict'

// Uzun islemlerin bekleme penceresi: otomatik hizalama ve arka plan ayirma.
//
// Islerin kendisi (yuz bulma, kisi maskesi) gercek fotograf ister; burada
// sinanan pencerenin acilip kapanmasi, o yuzden sentetik goruntu yeter:
// sonuc bulunamayan yol da ayni pencereden gecer.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('bekleme')

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

test('arka plan ayrilirken de ayni pencere cikar', async () => {
  await ortam.adima(sayfa, 'rotus')
  // Sentetik goruntude yuz bulunmadigi icin hizalama maske uretmeden dondu;
  // anahtar bu yuzden gercekten maske cikarmaya gidiyor.
  await sayfa.click('#arkaplan-beyazlat')

  await sayfa.waitForSelector('#islem-modali.show')
  assert.match(await sayfa.textContent('#islem-yazisi'), /arka plandan ayrılıyor/i)

  await sayfa.waitForSelector('#islem-modali.show', { state: 'hidden', timeout: 300000 })
  assert.match(await sayfa.textContent('#arkaplan-durumu'), /ayrılamadı|beyazlatıldı/)
  assert.equal(await sayfa.isDisabled('#arkaplan-beyazlat'), false)
})

test('pencere kapaninca arayuz yeniden kullanilabiliyor', async () => {
  // Perde kalirsa panel tiklanamaz hale gelirdi.
  await ortam.adima(sayfa, 'rotus')
  assert.equal(await sayfa.isVisible('#adim-rotus.active'), true)
  await ortam.adima(sayfa, 'kadraj')
})

test('bekleme penceresi arayuzde hata birakmadi', () => {
  assert.deepEqual(hatalar, [])
})
