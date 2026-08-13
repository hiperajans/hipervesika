'use strict'

// Baski, PDF ve sayfa kaydetme (Faz 8).
// Gercek yaziciya is gonderilmez; olcu dogrulugu PDF ve piksel uzerinden olculur.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')
const olcum = require('./olcum.js')
const baski = require(path.join(ortam.DEPO, 'src/main/baski.js'))
const metaveri = require(path.join(ortam.DEPO, 'src/renderer/js/metaveri.js'))

const calisma = new ortam.Calisma('baski')
let uygulama, sayfa, kapat
let yaziciSayisi = 0

test.before(async () => {
  ;({ uygulama, sayfa, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'cikti')
  await sayfa.click('label[for="gorunum-sayfa"]')
  await sayfa.waitForTimeout(800)

  const liste = await sayfa.evaluate(() => window.hiperVesika.yaziciListesi())
  yaziciSayisi = liste.yazicilar.length
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

async function iptaliYonlendir () {
  await uygulama.evaluate(async ({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined })
  })
}

async function baskiDurumunuBekle (desen, sure = 180000) {
  await sayfa.waitForFunction(
    (kaynak) => new RegExp(kaynak, 'i').test(
      document.getElementById('baski-durumu').textContent),
    desen.source, { timeout: sure })
}

test('menu kisayollari beklenen tuslarda', async () => {
  const menu = await uygulama.evaluate(({ Menu }) => {
    const topla = (ogeler) => ogeler.map((o) => ({
      etiket: o.label,
      kisayol: o.accelerator || null,
      alt: o.submenu ? topla(o.submenu.items) : null
    }))
    return topla(Menu.getApplicationMenu().items)
  })

  const dosya = menu.find((m) => m.etiket === 'Dosya')
  const kisayolu = (etiket) => dosya.alt.find((o) => o.etiket === etiket)?.kisayol

  assert.equal(kisayolu('Sayfayı yazdır…'), 'CmdOrCtrl+P')
  assert.equal(kisayolu('Kaydet…'), 'CmdOrCtrl+S')
  assert.equal(kisayolu('Sayfayı PDF olarak kaydet…'), 'CmdOrCtrl+Shift+S')
})

test('yazici listesi alinabiliyor', async () => {
  const liste = await sayfa.evaluate(() => window.hiperVesika.yaziciListesi())
  assert.ok(Array.isArray(liste.yazicilar), JSON.stringify(liste))
})

// Asil olcut: 50 mm'lik vesikaligin kagida hangi olcude cizildigi.
for (const kagit of [
  { ad: '10×15', genislik: 100, yukseklik: 150 },
  { ad: 'A4', genislik: 210, yukseklik: 297 },
  { ad: 'özel 130×180', genislik: 130, yukseklik: 180 }
]) {
  test(`PDF olcusu dogru: ${kagit.ad}`, async () => {
    await sayfa.fill('#kagit-genislik', String(kagit.genislik))
    await sayfa.fill('#kagit-yukseklik', String(kagit.yukseklik))
    await sayfa.waitForTimeout(400)

    const yol = calisma.cikti(`sayfa-${kagit.genislik}x${kagit.yukseklik}.pdf`)
    await ortam.kaydetmeyiYonlendir(uygulama, yol)

    await sayfa.click('#btn-sayfayi-pdf')
    await baskiDurumunuBekle(/kaydedildi|kaydedilemedi|hazırlanamadı|iptal/)
    assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))

    const baytlar = fs.readFileSync(yol)
    const cizim = olcum.pdfGoruntuOlcusuMm(baytlar)
    assert.ok(cizim, 'PDF içindeki çizim bulunamadı')

    // Sayfa kagidin tamamini kaplar; vesikaligin olcusu buna oranlidir.
    const vesikalik = 50 * (cizim.genislik / kagit.genislik)
    assert.ok(Math.abs(vesikalik - 50) <= 0.05,
      `50 mm vesikalık ${vesikalik.toFixed(3)} mm çizilmiş`)
    assert.ok(Math.abs(cizim.genislik - kagit.genislik) <= 0.2,
      `çizim ${cizim.genislik.toFixed(3)} mm, kağıt ${kagit.genislik} mm`)
    assert.ok(Math.abs(cizim.yukseklik - kagit.yukseklik) <= 0.2,
      `çizim ${cizim.yukseklik.toFixed(3)} mm, kağıt ${kagit.yukseklik} mm`)

    // Kagit kutusu Chromium tarafindan 1/300 ince yuvarlanir; sapma en fazla
    // 0,22 mm ve yalnizca kagit sinirina yansir.
    const kutu = baski.pdfMediaBox(baytlar)
    assert.ok(Math.abs(kutu.genislik - baski.punto(kagit.genislik)) <= 1)
    assert.ok(Math.abs(kutu.yukseklik - baski.punto(kagit.yukseklik)) <= 1)
  })
}

test('sayfa PNG piksel olcusu ve DPI bilgisi dogru', async () => {
  await sayfa.fill('#kagit-genislik', '100')
  await sayfa.fill('#kagit-yukseklik', '150')
  await sayfa.waitForTimeout(400)
  await sayfa.click('label[for="tur-png"]')

  const yol = calisma.cikti('sayfa.png')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-sayfayi-kaydet')
  await baskiDurumunuBekle(/kaydedildi|kaydedilemedi|hazırlanamadı/)
  assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))

  const baytlar = fs.readFileSync(yol)
  // 100 mm @ 300 DPI = 1181 px, 150 mm = 1772 px
  assert.deepEqual(olcum.pngOlcusu(baytlar), { genislik: 1181, yukseklik: 1772 })
  assert.equal(metaveri.dpiOku(new Uint8Array(baytlar)), 300)
})

test('600 DPI sayfa iki kati piksel uretir', async () => {
  await ortam.adima(sayfa, 'kadraj')
  await sayfa.selectOption('#dpi-secimi', '600')
  await ortam.adima(sayfa, 'cikti')

  const yol = calisma.cikti('sayfa-600.png')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-sayfayi-kaydet')
  await baskiDurumunuBekle(/kaydedildi|kaydedilemedi|hazırlanamadı/)
  assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))

  assert.deepEqual(olcum.pngOlcusu(fs.readFileSync(yol)),
    { genislik: 2362, yukseklik: 3543 })

  await ortam.adima(sayfa, 'kadraj')
  await sayfa.selectOption('#dpi-secimi', '300')
  await ortam.adima(sayfa, 'cikti')
})

test('kaydetmeden vazgecmek hata sayilmaz', async () => {
  await iptaliYonlendir()
  await sayfa.click('#btn-sayfayi-pdf')
  await baskiDurumunuBekle(/iptal/, 60000)

  assert.match(await sayfa.textContent('#baski-durumu'), /iptal edildi/i)
})

test('olmayan yazici anlasilir hata veriyor', async () => {
  const sonuc = await sayfa.evaluate(async () => {
    const tuval = document.createElement('canvas')
    tuval.width = 100
    tuval.height = 150
    tuval.getContext('2d').fillRect(0, 0, 100, 150)
    const blob = await new Promise((c) => tuval.toBlob(c, 'image/png'))
    return window.hiperVesika.sayfayiBas({
      baytlar: new Uint8Array(await blob.arrayBuffer()),
      kagitMm: { genislik: 100, yukseklik: 150 },
      yaziciAdi: 'HV-Olmayan-Yazici',
      kopya: 1,
      pencereGoster: false
    })
  })

  assert.equal(sonuc.basildi, false)
  assert.equal(typeof sonuc.hata, 'string')
})

test('ana surec gecersiz kagit olcusunu reddediyor', async () => {
  const sonuc = await sayfa.evaluate(() => window.hiperVesika.sayfayiPdfKaydet({
    baytlar: new Uint8Array([1, 2, 3]),
    kagitMm: { genislik: 0, yukseklik: 0 }
  }))

  assert.equal(sonuc.kaydedildi, false)
  assert.match(sonuc.hata, /geçersiz/)
})

test('yazici yokken anlasilir uyari verilir', async (t) => {
  // Denetim test govdesinde yapilmali: secenekler dizisi test tanimlanirken
  // degerlendirilir ve o an yaziciSayisi henuz okunmamis olur. Yazici tanimli
  // bir makinede bu test gercekten kagit basardi.
  if (yaziciSayisi > 0) return t.skip('makinede yazıcı tanımlı; baskı denenmiyor')

  await sayfa.click('#btn-sayfayi-bas')
  await sayfa.waitForTimeout(2000)

  assert.match(await sayfa.textContent('#baski-durumu'), /Yazıcı bulunamadı/)
  assert.notEqual(await sayfa.getAttribute('#yazici-secimi', 'disabled'), null)
})

test('menudeki Kaydet sayfa gorunumunde sayfayi kaydediyor', async () => {
  const yol = calisma.cikti('menuden-sayfa.png')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)

  await uygulama.evaluate(({ Menu }) => {
    const dosya = Menu.getApplicationMenu().items.find((m) => m.label === 'Dosya')
    dosya.submenu.items.find((o) => o.label === 'Kaydet…').click()
  })
  await sayfa.waitForTimeout(5000)

  assert.ok(fs.existsSync(yol), 'menüden kaydetme dosya üretmedi')
  assert.equal(olcum.pngOlcusu(fs.readFileSync(yol)).genislik, 1181)
})

test('menudeki Geri al ve Yinele calisiyor', async () => {
  // fill() zaten input ve change gonderir; ayrica change gondermek gecmise
  // ayni degerden ikinci bir adim yazar ve tek geri alma yetmezdi.
  await ortam.adima(sayfa, 'rotus')
  await ortam.kaydiracAyarla(sayfa, '#rotus-parlaklik', 20)

  const menuTikla = (etiket) => uygulama.evaluate(({ Menu }, ad) => {
    const duzen = Menu.getApplicationMenu().items.find((m) => m.label === 'Düzen')
    duzen.submenu.items.find((o) => o.label === ad).click()
  }, etiket)

  assert.equal(await sayfa.inputValue('#rotus-parlaklik'), '20')

  await menuTikla('Geri al')
  await sayfa.waitForTimeout(1200)
  assert.equal(await sayfa.inputValue('#rotus-parlaklik'), '0')

  await menuTikla('Yinele')
  await sayfa.waitForTimeout(1200)
  assert.equal(await sayfa.inputValue('#rotus-parlaklik'), '20')
})
