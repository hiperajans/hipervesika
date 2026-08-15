'use strict'

// Uygulama internet olmadan calisiyor mu? (AGENTS.md, kural 6)
//
// Ag emulasyonla kapatilir ve app:// disina cikan her istek hem kaydedilir hem
// de iptal edilir; boylece "sessizce basarisiz olup devam etti" durumu da
// yakalanir.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('cevrimdisi')
let uygulama, sayfa

const YEREL_ONEKLER = ['app://', 'file://', 'devtools://', 'data:', 'blob:', 'chrome-extension://']

test.before(async () => {
  ;({ uygulama, sayfa } = await ortam.uygulamayiAc(calisma))

  await uygulama.evaluate(async ({ session }, onekler) => {
    globalThis.__uzakIstekler = []
    session.defaultSession.webRequest.onBeforeRequest((ayrintilar, geriCagri) => {
      const yerel = onekler.some((onek) => ayrintilar.url.startsWith(onek))
      if (!yerel) globalThis.__uzakIstekler.push(ayrintilar.url)
      geriCagri({ cancel: !yerel })
    })
    session.defaultSession.enableNetworkEmulation({ offline: true })
  }, YEREL_ONEKLER)

  await ortam.moduSec(sayfa)
  await ortam.turuKapat(sayfa)
})

test.after(async () => {
  await uygulama.close()
  calisma.temizle()
})

test('uygulama ag kapaliyken aciliyor', async () => {
  assert.match(await sayfa.textContent('#sistem-bilgisi'), /macOS|Windows|Linux/)
})

test('Bootstrap ve simge yazi tipi yerelden yukleniyor', async () => {
  // Modal ve sekmeler Bootstrap'in JS'ine bagli; CDN'den gelseydi burada patlardi.
  assert.equal(await sayfa.evaluate(
    () => typeof window.bootstrap?.Modal === 'function'), true)

  assert.equal(await sayfa.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('16px bootstrap-icons')
  }), true)
})

test('fotograf aciliyor ve kaydedilebiliyor', async () => {
  await ortam.fotografYukle(sayfa, calisma.fotograf(0))
  await ortam.adima(sayfa, 'cikti')

  const yol = calisma.cikti('cevrimdisi.jpg')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-indir')
  await sayfa.waitForFunction(
    () => /kaydedildi|kaydedilemedi/i.test(
      document.getElementById('indirme-durumu').textContent), null, { timeout: 120000 })

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#indirme-durumu'))
})

test('sayfa PDF olarak kaydedilebiliyor', async () => {
  await sayfa.click('label[for="gorunum-sayfa"]')
  await sayfa.waitForTimeout(800)

  const yol = calisma.cikti('cevrimdisi.pdf')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-sayfayi-pdf')
  await sayfa.waitForFunction(
    () => /kaydedildi|kaydedilemedi|hazırlanamadı/i.test(
      document.getElementById('baski-durumu').textContent), null, { timeout: 180000 })

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))
  await sayfa.click('label[for="gorunum-foto"]')
  await sayfa.waitForTimeout(400)
})

test('yuz ve arka plan modelleri diskten yukleniyor', async (t) => {
  const sebep = ortam.yuzGerekli()
  if (sebep) return t.skip(sebep)

  await ortam.fotografYukle(sayfa, calisma.fotograf(0, { gercek: true }))
  await ortam.adima(sayfa, 'kadraj')
  await sayfa.click('#btn-otomatik-hizala')
  await sayfa.waitForFunction(
    () => /Eğiklik|bulunamadı|yapılamadı/.test(
      document.getElementById('hizalama-durumu').textContent), null, { timeout: 300000 })

  assert.match(await sayfa.textContent('#hizalama-durumu'), /Eğiklik/)

  await ortam.adima(sayfa, 'rotus')
  await sayfa.click('#arkaplan-beyazlat')
  await sayfa.waitForFunction(
    () => /beyazlatıldı|ayrılamadı/.test(
      document.getElementById('arkaplan-durumu').textContent), null, { timeout: 300000 })

  assert.match(await sayfa.textContent('#arkaplan-durumu'), /beyazlatıldı/)
})

test('hicbir uzak istek yapilmadi', async () => {
  const uzak = await uygulama.evaluate(() => globalThis.__uzakIstekler)
  assert.deepEqual(uzak, [])
})
