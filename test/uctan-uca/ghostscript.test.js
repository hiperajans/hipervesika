'use strict'

// Ghostscript ile dogrudan baski — arayuz tarafi.
//
// GERCEK YAZICIYA IS GONDERILMEZ: sinanan sey ozelligin dogru acilip
// kapandigi, secimlerin arayuze baglandigi ve ana surecin gecersiz istegi
// reddettigidir. Komut satirinin kendisi test/ghostscript.test.js icinde.
//
// Ghostscript kurulu degilse (CI) anahtarin kapali kaldigi sinanir; kurulu
// makinede tam akis calisir.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')
const kalibrasyonMotoru = require(path.join(ortam.DEPO, 'src/renderer/js/kalibrasyon.js'))

const calisma = new ortam.Calisma('ghostscript')
let sayfa, hatalar, kapat, durum

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'cikti')
  durum = await sayfa.evaluate(() => window.hiperVesika.ghostscriptDurumu())
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const gorunur = (secici) => sayfa.evaluate(
  (s) => !document.querySelector(s).classList.contains('d-none'), secici)

test('Ghostscript durumu okunabiliyor', () => {
  assert.equal(typeof durum.var, 'boolean')
  assert.ok(Array.isArray(durum.aygitlar) && durum.aygitlar.length >= 1)
  assert.ok(Array.isArray(durum.cozunurlukler) && durum.cozunurlukler.length >= 1)

  if (durum.var) {
    assert.match(durum.surum, /^\d+\.\d+/)
    assert.ok(['paket', 'sistem'].includes(durum.kaynak))
  }
})

test('Ghostscript yoksa dogrudan baski acilamaz', async (t) => {
  if (durum.var) {
    t.skip('Ghostscript kurulu; kapali durum sinanamaz')
    return
  }

  assert.equal(await sayfa.isDisabled('#dogrudan-baski'), true)
  assert.equal(await gorunur('#dogrudan-ayarlari'), false)
  assert.match(await sayfa.textContent('#baski-dugme-yazisi'), /yazdır/i)
})

test('anahtar acilinca yazici secimi ve dugme yazisi degisiyor', async (t) => {
  if (!durum.var) {
    t.skip(`Ghostscript bulunamadı: ${JSON.stringify(durum)}`)
    return
  }

  assert.equal(await sayfa.isDisabled('#dogrudan-baski'), false)
  assert.equal(await gorunur('#dogrudan-ayarlari'), false)

  await sayfa.check('#dogrudan-baski')
  await sayfa.waitForTimeout(300)

  assert.equal(await gorunur('#dogrudan-ayarlari'), true)
  assert.equal(await sayfa.textContent('#baski-dugme-yazisi'), 'Yazıcıya gönder')

  // Yazici listesi sistemden gelir; en az bir yazici tanimliysa secili olmali.
  const yazicilar = await sayfa.$$eval('#yazici-secimi option', (o) => o.map((s) => s.value))
  if (yazicilar.length) assert.ok(await sayfa.inputValue('#yazici-secimi'))

  // Cozunurluk listesi ana surecten geldi; varsayilan secili.
  assert.equal(
    await sayfa.inputValue('#baski-cozunurlugu'), String(durum.varsayilanCozunurluk)
  )

  await sayfa.uncheck('#dogrudan-baski')
  await sayfa.waitForTimeout(300)
  assert.equal(await gorunur('#dogrudan-ayarlari'), false)
})

test('aygit secimi platformun sundugu kadar', () => {
  const kodlar = durum.aygitlar.map((a) => a.kod)
  assert.ok(kodlar.includes('otomatik'))

  // Windows'ta is her zaman surucuye gider; baska bir aygit sunulmaz.
  if (process.platform === 'win32') assert.deepEqual(kodlar, ['otomatik'])
  else assert.deepEqual(kodlar, ['otomatik', 'postscript', 'pcl'])
})

// GERCEK BASKI YOK: kalibrasyon sayfasini basan dugmeye dokunulmaz, yalnizca
// olcum -> duzeltme yolu sinanir.
test('olcum girilince duzeltme yaziciya kaydediliyor', async (t) => {
  if (!durum.var) {
    t.skip('Ghostscript kurulu değil; doğrudan baskı açılamıyor')
    return
  }

  const yazicilar = await sayfa.$$eval('#yazici-secimi option', (o) => o.map((s) => s.value))
  if (!yazicilar.length) {
    t.skip('Tanımlı yazıcı yok')
    return
  }

  await sayfa.check('#dogrudan-baski')
  await sayfa.fill('#kagit-genislik', '100')
  await sayfa.fill('#kagit-yukseklik', '150')
  await sayfa.waitForTimeout(500)

  assert.equal(
    await sayfa.evaluate(
      () => !document.getElementById('kalibrasyon-alani').classList.contains('d-none')),
    true, 'kalibrasyon alanı görünmüyor'
  )

  const referans = kalibrasyonMotoru.referanslar({ genislik: 100, yukseklik: 150 })
  // Yazici kucuk basmis gibi: duzeltme 1'in uzerine cikmali.
  await sayfa.fill('#olculen-yatay', String(referans.yatayMm - 0.4))
  await sayfa.fill('#olculen-dikey', String(referans.dikeyMm + 0.5))
  await sayfa.click('#btn-kalibrasyon-kaydet')
  await sayfa.waitForTimeout(800)

  assert.match(await sayfa.textContent('#kalibrasyon-durumu'), /kaydedildi/i)

  // Ayar dosyasina da yazilmali; uygulama kapanip acilinca duzeltme durmali.
  const ayarlar = JSON.parse(
    fs.readFileSync(path.join(calisma.profil, 'ayarlar.json'), 'utf8'))
  const kayit = ayarlar.kalibrasyonlar.find((k) => k.yazici === yazicilar[0])
  assert.ok(kayit, `kalibrasyon kaydedilmedi: ${JSON.stringify(ayarlar.kalibrasyonlar)}`)
  assert.ok(kayit.olcekX > 1, `yatay düzeltme ${kayit.olcekX}`)
  assert.ok(kayit.olcekY < 1, `dikey düzeltme ${kayit.olcekY}`)

  // Sifirlama kaydi kaldirir.
  await sayfa.click('#btn-kalibrasyon-sil')
  await sayfa.waitForTimeout(800)
  const sonra = JSON.parse(
    fs.readFileSync(path.join(calisma.profil, 'ayarlar.json'), 'utf8'))
  assert.equal(sonra.kalibrasyonlar.some((k) => k.yazici === yazicilar[0]), false)

  await sayfa.uncheck('#dogrudan-baski')
  await sayfa.waitForTimeout(300)
})

test('sacma olcum kaydedilmez', async (t) => {
  if (!durum.var) {
    t.skip('Ghostscript kurulu değil')
    return
  }

  await sayfa.check('#dogrudan-baski')
  await sayfa.waitForTimeout(300)
  // 70 mm'lik cizgi 40 mm olculemez; olcum hatasi sessizce duzeltmeye
  // cevrilmemeli.
  await sayfa.fill('#olculen-yatay', '40')
  await sayfa.fill('#olculen-dikey', '120')
  await sayfa.click('#btn-kalibrasyon-kaydet')
  await sayfa.waitForTimeout(500)

  assert.match(await sayfa.textContent('#kalibrasyon-durumu'), /ölçüm hatası|yakın/i)
  await sayfa.uncheck('#dogrudan-baski')
  await sayfa.waitForTimeout(300)
})

test('ICC profili yalnizca CMYK secilince sunulur', async (t) => {
  if (!durum.var) {
    t.skip('Ghostscript kurulu değil; ICC ayrımı yapılamıyor')
    return
  }

  const gorunurMu = () => sayfa.evaluate(
    () => !document.getElementById('icc-alani').classList.contains('d-none'))

  await sayfa.selectOption('#renk-duzeni', 'srgb')
  await sayfa.waitForTimeout(300)
  assert.equal(await gorunurMu(), false)

  await sayfa.selectOption('#renk-duzeni', 'cmyk')
  await sayfa.waitForTimeout(300)
  assert.equal(await gorunurMu(), true)
  // Profil secilmeden once profilsiz cevrim yapilacagi yaziyor.
  assert.match(await sayfa.textContent('#icc-durumu'), /profilsiz/i)

  await sayfa.selectOption('#renk-duzeni', 'srgb')
  await sayfa.waitForTimeout(300)
})

test('ana surec yazicisiz ve gecersiz olculu istegi reddediyor', async () => {
  const yazicisiz = await sayfa.evaluate(() => window.hiperVesika.sayfayiDogrudanBas({
    baytlar: new Uint8Array([1, 2, 3]),
    kagitMm: { genislik: 100, yukseklik: 150 }
  }))
  assert.equal(yazicisiz.basildi, false)
  assert.match(yazicisiz.hata, /Yazıcı|Ghostscript/)

  const bozukOlcu = await sayfa.evaluate(() => window.hiperVesika.sayfayiDogrudanBas({
    baytlar: new Uint8Array([1, 2, 3]),
    kagitMm: { genislik: 0, yukseklik: 0 },
    yazici: 'Olmayan Yazıcı'
  }))
  assert.equal(bozukOlcu.basildi, false)
  assert.match(bozukOlcu.hata, /geçersiz|Ghostscript/)

  assert.deepEqual(hatalar, [], 'arayuzde hata olusmamali')
})
