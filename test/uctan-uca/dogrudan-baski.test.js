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
let uygulama, sayfa, hatalar, kapat, durum, yazicilar

test.before(async () => {
  ;({ uygulama, sayfa, hatalar, kapat } = await ortam.hazirla(
    calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'cikti')
  durum = await sayfa.evaluate(() => window.hiperVesika.dogrudanBaskiDurumu())
  // Liste ana surecten okunur: arayuzdeki secim kutusunun dolmasini beklemek
  // gerekmez ve sart, arayuzun kendi durumuna degil sisteme bakar.
  const liste = await sayfa.evaluate(() => window.hiperVesika.yaziciListesi())
  yazicilar = liste.yazicilar ?? []
})

// Anahtarin acilabilmesi iki ayri sarta bagli: baski yolunun bulunmasi
// (macOS/Linux'ta lp, Windows'ta Chromium) ve tanimli en az bir yazici.
// Ikisini ayirmak gerekiyor -- macOS kosucusunda lp var ama hic yazici tanimli
// degil; uygulama o durumda anahtari hakli olarak kapali tutuyor, dolayisiyla
// yalnizca durum.var'a bakan bir sart yetmiyor.
function anahtarKullanilabilir (t) {
  if (!durum.var) {
    t.skip(`Doğrudan baskı kullanılamıyor: ${JSON.stringify(durum)}`)
    return false
  }
  if (!yazicilar.length) {
    t.skip('Tanımlı yazıcı yok; doğrudan baskı anahtarı açılamaz')
    return false
  }
  return true
}

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

// Baski yolu var ama hic yazici tanimli degil: anahtar yine kapali kalmali ve
// sebep yazmali. macOS kosucusunun durumu tam olarak bu (lp var, yazici yok),
// bu yuzden ortam elverdiginde sinanan bir sey oluyor.
test('yazici tanimli degilse anahtar kapali kalir ve sebebi yazar', async (t) => {
  if (!durum.var || yazicilar.length) {
    t.skip('Tanımlı yazıcı var ya da baskı yolu yok; bu durum sınanamaz')
    return
  }

  assert.equal(await sayfa.isDisabled('#dogrudan-baski'), true)
  assert.equal(await gorunur('#dogrudan-ayarlari'), false)
  assert.match(await sayfa.textContent('#baski-durumu'), /Tanımlı yazıcı yok/i)
})

test('anahtar acilinca yazici secimi ve dugme yazisi degisiyor', async (t) => {
  if (!anahtarKullanilabilir(t)) return

  // Yazici listesi ve baski yolu ayri ayri okunuyor; anahtar ikisi de gelince
  // aciliyor.
  await sayfa.waitForSelector('#dogrudan-baski:not([disabled])', { timeout: 15000 })
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
  if (!anahtarKullanilabilir(t)) return

  await sayfa.check('#dogrudan-baski')
  await sayfa.fill('#kagit-genislik', '100')
  await sayfa.fill('#kagit-yukseklik', '150')
  await sayfa.waitForTimeout(500)

  // Duzeltme secili yaziciya yazilir; listedeki ilk yazici degil, secili olan
  // (varsayilan yazici listenin basinda olmak zorunda degil).
  const secili = await sayfa.inputValue('#yazici-secimi')
  assert.ok(secili, 'yazıcı seçilmedi')

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
  const kayit = ayarlar.kalibrasyonlar.find((k) => k.yazici === secili)
  assert.ok(kayit, `kalibrasyon kaydedilmedi: ${JSON.stringify(ayarlar.kalibrasyonlar)}`)
  assert.ok(kayit.olcekX > 1, `yatay düzeltme ${kayit.olcekX}`)
  assert.ok(kayit.olcekY < 1, `dikey düzeltme ${kayit.olcekY}`)

  // Sifirlama kaydi kaldirir.
  await sayfa.click('#btn-kalibrasyon-sil')
  await sayfa.waitForTimeout(800)
  const sonra = JSON.parse(
    fs.readFileSync(path.join(calisma.profil, 'ayarlar.json'), 'utf8'))
  assert.equal(sonra.kalibrasyonlar.some((k) => k.yazici === secili), false)

  await sayfa.uncheck('#dogrudan-baski')
  await sayfa.waitForTimeout(300)
})

test('sacma olcum kaydedilmez', async (t) => {
  if (!anahtarKullanilabilir(t)) return

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

test('ana eylem dugmesi ile ikili dipdibe durmuyor', async () => {
  // Dipdibe duran dugmeler tek bir blok gibi gorunuyor ve yanlis dugmeye
  // basmak kolaylasiyor; pay her iki yonde de ayni.
  const aralik = await sayfa.evaluate(() => {
    const kutu = (secici) => document.querySelector(secici).getBoundingClientRect()
    return {
      dikey: Math.round(kutu('#btn-sayfayi-pdf').top - kutu('#btn-sayfayi-bas').bottom),
      yatay: Math.round(kutu('#btn-sayfayi-kaydet').left - kutu('#btn-sayfayi-pdf').right)
    }
  })

  assert.ok(aralik.dikey >= 8, `dikey aralık ${aralik.dikey} px`)
  assert.equal(aralik.dikey, aralik.yatay, JSON.stringify(aralik))
})

test('basit modda da dugmeler dipdibe durmuyor', async (t) => {
  if (!anahtarKullanilabilir(t)) return

  // Basit modda kenarliksiz anahtari gizli kaliyor; "Yazici tercihleri..." o
  // zaman ana eylem dugmesine yapisiyordu.
  const modSec = (etiket) => uygulama.evaluate(({ Menu }, ad) => {
    const gorunum = Menu.getApplicationMenu().items.find((ust) => ust.label === 'Görünüm')
    gorunum.submenu.items.find((oge) => oge.label === ad).click()
  }, etiket)

  await modSec('Basit mod')
  await sayfa.waitForTimeout(600)
  await ortam.adima(sayfa, 'cikti')
  await sayfa.check('#dogrudan-baski')
  await sayfa.waitForTimeout(400)

  const aralik = await sayfa.evaluate(() => {
    const kutu = (secici) => document.querySelector(secici).getBoundingClientRect()
    return Math.round(kutu('#btn-sayfayi-bas').top - kutu('#btn-yazici-tercihleri').bottom)
  })

  await modSec('Gelişmiş mod')
  await sayfa.waitForTimeout(600)
  await ortam.adima(sayfa, 'cikti')

  assert.ok(aralik >= 8, `basit modda aralık ${aralik} px`)
})

test('kalibrasyonun ne ise yaradigi soru isaretiyle aciliyor', async (t) => {
  if (!anahtarKullanilabilir(t)) return

  await sayfa.check('#dogrudan-baski')
  await sayfa.waitForTimeout(300)

  const acikMi = () => sayfa.evaluate(
    () => !document.getElementById('kalibrasyon-yardimi').classList.contains('d-none'))

  // Aciklama once kapalidir: isi bilen kullanici her gun okumak zorunda kalmaz.
  assert.equal(await acikMi(), false)
  assert.equal(await sayfa.getAttribute('#btn-kalibrasyon-yardim', 'aria-expanded'), 'false')

  await sayfa.click('#btn-kalibrasyon-yardim')
  await sayfa.waitForTimeout(200)

  assert.equal(await acikMi(), true)
  assert.equal(await sayfa.getAttribute('#btn-kalibrasyon-yardim', 'aria-expanded'), 'true')

  const metin = await sayfa.textContent('#kalibrasyon-yardimi')
  assert.match(metin, /cetvel/i)
  assert.match(metin, /Kaydet/)

  await sayfa.click('#btn-kalibrasyon-yardim')
  await sayfa.waitForTimeout(200)
  assert.equal(await acikMi(), false)

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
