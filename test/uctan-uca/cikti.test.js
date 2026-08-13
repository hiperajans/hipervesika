'use strict'

// Tek fotograf disa aktarma ve renk duzeni (sRGB / gri tonlama / CMYK).

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const ortam = require('./ortam.js')
const olcum = require('./olcum.js')
const baski = require(path.join(ortam.DEPO, 'src/main/baski.js'))
const metaveri = require(path.join(ortam.DEPO, 'src/renderer/js/metaveri.js'))

const calisma = new ortam.Calisma('cikti')
let uygulama, sayfa, kapat

test.before(async () => {
  ;({ uygulama, sayfa, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'cikti')
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

async function indirmeyiBekle (sure = 120000) {
  await sayfa.waitForFunction(
    () => /kaydedildi|kaydedilemedi/i.test(
      document.getElementById('indirme-durumu').textContent), null, { timeout: sure })
}

// Cikti tuvalini uretip ozetini cikarir; dosyaya yazmadan olcmek icin.
const ciktiOzeti = () => sayfa.evaluate(() => {
  const maskeler = ciktiMaskeleri()
  const { tuval } = window.HV.disaAktar.tuvalUret({
    gorsel: yuklenenGorsel,
    cerceve: kirpma.cerceve,
    maske: maskeler.maske,
    kisiMaskesi: maskeler.kisiMaskesi,
    rotusAyarlari,
    lekeler,
    olcuMm: olcuDurumu,
    dpi,
    renkDuzeni: document.getElementById('renk-duzeni').value
  })

  const veri = tuval.getContext('2d').getImageData(0, 0, tuval.width, tuval.height).data
  let griSayisi = 0
  const piksel = veri.length / 4
  for (let i = 0; i < veri.length; i += 4) {
    if (veri[i] === veri[i + 1] && veri[i + 1] === veri[i + 2]) griSayisi++
  }

  return { genislik: tuval.width, yukseklik: tuval.height, griOrani: griSayisi / piksel }
})

test('JPG kaydedilir ve DPI bilgisi yazilir', async () => {
  const yol = calisma.cikti('vesikalik.jpg')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-indir')
  await indirmeyiBekle()

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#indirme-durumu'))
  assert.equal(metaveri.dpiOku(new Uint8Array(fs.readFileSync(yol))), 300)
})

test('PNG kaydedilir ve olcu 50x60 mm @ 300 DPI ile uyusur', async () => {
  await sayfa.click('label[for="tur-png"]')
  await sayfa.waitForTimeout(300)

  const yol = calisma.cikti('vesikalik.png')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-indir')
  await indirmeyiBekle()

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#indirme-durumu'))
  // 50 mm @ 300 DPI = 591 px, 60 mm = 709 px
  assert.deepEqual(olcum.pngOlcusu(fs.readFileSync(yol)), { genislik: 591, yukseklik: 709 })

  await sayfa.click('label[for="tur-jpg"]')
  await sayfa.waitForTimeout(300)
})

test('sRGB secildiginde cikti renkli kalir', async () => {
  await sayfa.selectOption('#renk-duzeni', 'srgb')
  await sayfa.waitForTimeout(500)

  const ozet = await ciktiOzeti()
  assert.deepEqual({ genislik: ozet.genislik, yukseklik: ozet.yukseklik },
    { genislik: 591, yukseklik: 709 })
  assert.ok(ozet.griOrani < 0.5, `gri oranı %${(ozet.griOrani * 100).toFixed(1)}`)
})

test('gri tonlamada tum pikseller gri', async () => {
  await sayfa.selectOption('#renk-duzeni', 'gri')
  await sayfa.waitForTimeout(500)

  const ozet = await ciktiOzeti()
  assert.ok(ozet.griOrani > 0.999, `gri oranı %${(ozet.griOrani * 100).toFixed(1)}`)
})

test('renk duzeni aciklamasi secime gore degisiyor', async () => {
  await sayfa.selectOption('#renk-duzeni', 'cmyk')
  await sayfa.waitForTimeout(400)

  // CMYK'nin yalnizca PDF'te gercek oldugu arayuzde yaziyor.
  assert.match(await sayfa.textContent('#renk-duzeni-aciklamasi'), /PDF/)
})

test('CMYK PDF gercekten DeviceCMYK olarak yaziliyor', async () => {
  await sayfa.click('label[for="gorunum-sayfa"]')
  await sayfa.waitForTimeout(800)
  await sayfa.fill('#kagit-genislik', '100')
  await sayfa.fill('#kagit-yukseklik', '150')
  await sayfa.waitForTimeout(400)

  const yol = calisma.cikti('cmyk.pdf')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-sayfayi-pdf')
  await sayfa.waitForFunction(
    () => /kaydedildi|kaydedilemedi|hazırlanamadı/i.test(
      document.getElementById('baski-durumu').textContent), null, { timeout: 180000 })

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))
  const belge = fs.readFileSync(yol)
  const metin = belge.toString('latin1')

  assert.match(metin, /\/ColorSpace \/DeviceCMYK/)

  const kutu = baski.pdfMediaBox(belge)
  assert.ok(Math.abs(kutu.genislik - baski.punto(100)) < 0.5, `${kutu.genislik} pt`)
  assert.ok(Math.abs(kutu.yukseklik - baski.punto(150)) < 0.5, `${kutu.yukseklik} pt`)

  // Gomulu ornekler gercekten dort bilesenli mi?
  const bas = metin.indexOf('stream\n', metin.indexOf('/DeviceCMYK')) + 'stream\n'.length
  const son = metin.indexOf('\nendstream', bas)
  const acilan = zlib.inflateSync(belge.subarray(bas, son))
  const eslesme = metin.match(/\/Width (\d+) \/Height (\d+)/)

  assert.equal(acilan.length, Number(eslesme[1]) * Number(eslesme[2]) * 4)

  await sayfa.click('label[for="gorunum-foto"]')
  await sayfa.waitForTimeout(500)
  await ortam.adima(sayfa, 'cikti')
  await sayfa.selectOption('#renk-duzeni', 'srgb')
})
