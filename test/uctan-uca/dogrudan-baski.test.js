'use strict'

// Dogrudan baski — arayuz tarafi.
//
// GERCEK YAZICIYA IS GONDERILMEZ: sinanan sey ozelligin dogru acilip
// kapandigi, secimlerin arayuze baglandigi ve ana surecin gecersiz istegi
// reddettigidir. Komutun kendisi test/dogrudan-baski.test.js icinde.
//
// Windows'ta ozellik her zaman acik (is Chromium'un kendi baski yolundan
// gider); macOS ve Linux'ta CUPS'un lp komutuna bagli.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')
const kalibrasyonMotoru = require(path.join(ortam.DEPO, 'src/renderer/js/kalibrasyon.js'))

const calisma = new ortam.Calisma('dogrudan-baski')
let sayfa, hatalar, kapat, durum

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'cikti')
  durum = await sayfa.evaluate(() => window.hiperVesika.dogrudanBaskiDurumu())
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const gorunur = (secici) => sayfa.evaluate(
  (s) => !document.querySelector(s).classList.contains('d-none'), secici)

test('dogrudan baski durumu okunabiliyor', () => {
  assert.equal(typeof durum.var, 'boolean')
  assert.ok(['chromium', 'cups'].includes(durum.sistem))
  assert.ok(Array.isArray(durum.cozunurlukler) && durum.cozunurlukler.length >= 1)

  // Windows'ta ek bir ikiliye ihtiyac yok: Chromium'un kendi baski yolu.
  if (process.platform === 'win32') {
    assert.equal(durum.sistem, 'chromium')
    assert.equal(durum.var, true)
  }
})

test('kullanilamadigi sistemde anahtar kapali kalir', async (t) => {
  if (durum.var) {
    t.skip('Doğrudan baskı kullanılabiliyor; kapalı durum sınanamaz')
    return
  }

  assert.equal(await sayfa.isDisabled('#dogrudan-baski'), true)
  assert.equal(await gorunur('#dogrudan-ayarlari'), false)
  assert.match(await sayfa.textContent('#baski-dugme-yazisi'), /yazdır/i)
})

test('anahtar acilinca yazici secimi ve dugme yazisi degisiyor', async (t) => {
  if (!durum.var) {
    t.skip(`Doğrudan baskı kullanılamıyor: ${JSON.stringify(durum)}`)
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

test('kagit turu ve kalite yalnizca CUPS ta sunulur', async () => {
  const kodlar = (liste) => liste.map((oge) => oge.kod)

  if (process.platform === 'win32') {
    // Surucunun DEVMODE ayarina disaridan mudahale edilemiyor; calismayan bir
    // secim kutusu yerine surucunun kendi penceresini acan dugme var.
    assert.deepEqual(durum.kagitTurleri, [])
    assert.deepEqual(durum.kaliteler, [])
    assert.equal(await gorunur('#kagit-turu-alani'), false)
    assert.equal(await gorunur('#baski-kalitesi-alani'), false)
    assert.equal(await gorunur('#btn-yazici-tercihleri'), true)
    return
  }

  assert.deepEqual(kodlar(durum.kagitTurleri), ['otomatik', 'parlak', 'mat', 'duz'])
  assert.deepEqual(kodlar(durum.kaliteler), ['otomatik', 'normal', 'yuksek'])
  assert.equal(await gorunur('#kagit-turu-alani'), true)
  assert.equal(await gorunur('#btn-yazici-tercihleri'), false)
})

// GERCEK BASKI YOK: kalibrasyon sayfasini basan dugmeye dokunulmaz, yalnizca
// olcum -> duzeltme yolu sinanir.
test('olcum girilince duzeltme yaziciya kaydediliyor', async (t) => {
  if (!durum.var) {
    t.skip('Doğrudan baskı kullanılamıyor')
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
    t.skip('Doğrudan baskı kullanılamıyor')
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

test('ana surec yazicisiz ve gecersiz olculu istegi reddediyor', async () => {
  const yazicisiz = await sayfa.evaluate(() => window.hiperVesika.sayfayiDogrudanBas({
    baytlar: new Uint8Array([1, 2, 3]),
    kagitMm: { genislik: 100, yukseklik: 150 }
  }))
  assert.equal(yazicisiz.basildi, false)
  assert.match(yazicisiz.hata, /Yazıcı|kullanılamıyor/)

  const bozukOlcu = await sayfa.evaluate(() => window.hiperVesika.sayfayiDogrudanBas({
    baytlar: new Uint8Array([1, 2, 3]),
    kagitMm: { genislik: 0, yukseklik: 0 },
    yazici: 'Olmayan Yazıcı'
  }))
  assert.equal(bozukOlcu.basildi, false)
  assert.match(bozukOlcu.hata, /geçersiz|kullanılamıyor/)

  assert.deepEqual(hatalar, [], 'arayuzde hata olusmamali')
})
