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

const ortam = require('./ortam.js')

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
