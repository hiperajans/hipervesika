'use strict'

// Acilis penceresi: uygulama, hazirlik bitene kadar ekranda gorunmemeli.
//
// Bu dosya acilisi acikca ister (HV_ACILIS=1); diger uctan uca testlerde kapali
// cunku her dosyada modellerin yuklenmesini beklemek suiti dakikalarca uzatir.

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ortam = require('./ortam.js')
const acilisMotoru = require(path.join(ortam.DEPO, 'src/renderer/js/acilis.js'))
const paket = require(path.join(ortam.DEPO, 'package.json'))

// Ilk acilis olculdu: ~23 sn (ekran kartinin onbellegi bos). Sinir onun
// uzerinde, ana surecin kendi guvenlik suresinin (45 sn) altinda kalmali ki
// test "acilis kendiliginden kapandi" ile "sure asimi" arasini ayirt edebilsin.
const BEKLEME = 40000

const calisma = new ortam.Calisma('acilis')
let uygulama, sayfa

test.before(async () => {
  ;({ uygulama, sayfa } = await ortam.uygulamayiAc(calisma, { acilis: true }))
})

test.after(async () => {
  await uygulama.close()
  calisma.temizle()
})

// Ana surecten okunur: sayfanin kendisi gizli pencerede de calisir, gorunurluk
// yalnizca pencerenin ozelligidir.
const pencereler = () => uygulama.evaluate(({ BrowserWindow }) =>
  BrowserWindow.getAllWindows().map((pencere) => ({
    adres: pencere.webContents.getURL(),
    gorunur: pencere.isVisible()
  })))

const anaPencereGorunur = async () =>
  (await pencereler()).some((p) => p.adres.includes('index.html') && p.gorunur)

test('acilis penceresi acik, uygulama penceresi henuz gizli', async () => {
  const acilis = ortam.acilisPenceresi(uygulama)
  assert.ok(acilis, 'açılış penceresi açılmadı')

  const liste = await pencereler()
  const acilisKaydi = liste.find((p) => p.adres.includes('acilis.html'))
  assert.ok(acilisKaydi?.gorunur, `açılış penceresi görünmüyor: ${JSON.stringify(liste)}`)
  assert.equal(await anaPencereGorunur(), false,
    `uygulama penceresi erken göründü: ${JSON.stringify(liste)}`)
})

test('acilis penceresinde marka, durum ve telif yazar', async () => {
  const acilis = ortam.acilisPenceresi(uygulama)
  assert.ok(acilis, 'açılış penceresi kapanmış')

  assert.equal(await acilis.textContent('.hv-ad'), 'Hiper Vesika')
  assert.equal(await acilis.textContent('#surum'), `Sürüm ${paket.version}`)
  assert.match(await acilis.textContent('.hv-alt'), /© Hiper Ajans · Bütün hakları saklıdır/)

  // Kullaniciya tek satir yazilir; hangi modelin yuklendigi ekranda yer almaz.
  const durum = await acilis.textContent('#durum')
  assert.ok(
    [acilisMotoru.YAZILAR.normal, acilisMotoru.YAZILAR.uzun].includes(durum),
    `beklenmeyen durum yazısı: ${durum}`
  )

  // Hazirlik ilerledikce ray doluyor: bos bir ray takilma izlenimi verirdi.
  const ray = await acilis.evaluate(
    () => Number.parseInt(document.getElementById('ilerleme').style.width, 10))
  assert.ok(ray > 0 && ray <= 100, `ray ${ray}`)
})

test('hazirlik bitince acilis kapanir ve uygulama gorunur', async () => {
  await sayfa.waitForFunction(
    () => document.body.dataset.hvHazir === 'evet', null, { timeout: BEKLEME })

  // Kapanma ve gosterme ana surecte pespese yapiliyor; bir kare beklenir.
  await sayfa.waitForTimeout(500)

  const liste = await pencereler()
  assert.equal(liste.some((p) => p.adres.includes('acilis.html')), false,
    `açılış penceresi kapanmadı: ${JSON.stringify(liste)}`)
  assert.ok(await anaPencereGorunur(), `uygulama penceresi açılmadı: ${JSON.stringify(liste)}`)
})
