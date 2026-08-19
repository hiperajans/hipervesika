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

// Uygulama penceresi her makinede gorunur olmak zorunda: hazirlik biterse hemen,
// bitmezse ana surecin guvenlik suresi (45 sn) devreye girip yine gosteriyor.
// Sinir o surenin biraz uzerinde.
const PENCERE_BEKLEMESI = 60000

// Hazirligin kendisi icin ayri ve genis bir sinir. Ilk acilis bu makinede ~23 sn
// olculdu ama ekran karti olmayan bir kosucuda yazilim isleyicisiyle kat kat
// uzun suruyor; buradaki sinir "hazirlik hic bitiyor mu" sorusunu yanitlamak
// icin, hiz olcmek icin degil. Hizi bir kosucunun saatiyle olcmek zaten
// yanlis olurdu.
const HAZIRLIK_BEKLEMESI = 180000

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

// Kosul saglanana kadar bekler; playwright'in waitForFunction'i sayfada calisir,
// buradaki kosullar ise ana surecten okunuyor.
async function bekle (kosul, sure, mesaj) {
  const bitis = Date.now() + sure
  while (Date.now() < bitis) {
    if (await kosul()) return
    await new Promise((cozumle) => setTimeout(cozumle, 250))
  }
  assert.fail(`${mesaj} (${sure} ms beklendi)`)
}

test('acilis kapanir ve uygulama penceresi gorunur', async () => {
  await bekle(anaPencereGorunur, PENCERE_BEKLEMESI, 'uygulama penceresi görünmedi')

  // Kapanma ve gosterme ana surecte pespese yapiliyor; bir kare beklenir.
  await sayfa.waitForTimeout(500)

  const liste = await pencereler()
  assert.equal(liste.some((p) => p.adres.includes('acilis.html')), false,
    `açılış penceresi kapanmadı: ${JSON.stringify(liste)}`)
})

test('hazirlik sonunda tamamlaniyor', async () => {
  // Hazirlik bittiginde arayuz bunu body'ye yaziyor. Asamalardan biri
  // basarisiz olsa da yaziliyor; burada sinanan sey hazirligin bir yerde
  // takilip kalmadigi.
  await sayfa.waitForFunction(
    () => document.body.dataset.hvHazir === 'evet', null, { timeout: HAZIRLIK_BEKLEMESI })
})
