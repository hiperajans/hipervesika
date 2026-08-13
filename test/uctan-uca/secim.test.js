'use strict'

// Birden fazla fotograf birakildiginda acilan secim penceresi.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('secim')
let sayfa, kapat

test.before(async () => {
  ;({ sayfa, kapat } = await ortam.hazirla(calisma))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const modalAcikMi = () => sayfa.evaluate(
  () => document.getElementById('secim-modali').classList.contains('show'))

async function modaliBekle (acik) {
  await sayfa.waitForFunction(
    (beklenen) => document.getElementById('secim-modali').classList.contains('show') === beklenen,
    acik, { timeout: 30000 })
  await sayfa.waitForTimeout(400)
}

async function kucukResimleriBekle (adet) {
  await sayfa.waitForFunction(
    (n) => document.querySelectorAll('.hv-secim-resim canvas').length === n,
    adet, { timeout: 90000 })
}

// Dosyalari sayfada File nesnesine cevirip gercek bir drop olayi gonderir.
async function surukleBirak (yollar) {
  const veriler = yollar.map((yol) => ({
    ad: path.basename(yol),
    tur: 'image/png',
    b64: fs.readFileSync(yol).toString('base64')
  }))

  await sayfa.evaluate((dosyalar) => {
    const veri = new DataTransfer()
    for (const d of dosyalar) {
      const ikili = Uint8Array.from(atob(d.b64), (c) => c.charCodeAt(0))
      veri.items.add(new File([ikili], d.ad, { type: d.tur }))
    }
    document.getElementById('tuval-sarmal').dispatchEvent(
      new DragEvent('drop', { dataTransfer: veri, bubbles: true, cancelable: true }))
  }, veriler)
}

test('tek fotografta secim penceresi acilmaz', async () => {
  await ortam.fotografYukle(sayfa, calisma.fotograf(0))

  assert.equal(await modalAcikMi(), false)
  assert.match(await sayfa.textContent('#gorsel-bilgisi'), /deneme-0\.png/)
})

test('birden fazla fotografta pencere acilir ve her dosya icin bir kutu olur', async () => {
  await sayfa.setInputFiles('#dosya-girisi',
    [calisma.fotograf(0), calisma.fotograf(1), calisma.fotograf(2)])
  await modaliBekle(true)

  assert.match(await sayfa.textContent('#secim-bilgisi'), /3 fotoğraf bırakıldı/)
  assert.equal(await sayfa.locator('.hv-secim-kutusu').count(), 3)
})

test('kucuk resimler cizilir ve olcu yazilir', async () => {
  await kucukResimleriBekle(3)

  const kucukler = await sayfa.evaluate(() =>
    Array.from(document.querySelectorAll('.hv-secim-resim canvas')).map((tuval) => {
      const veri = tuval.getContext('2d').getImageData(0, 0, tuval.width, tuval.height).data
      let toplam = 0
      for (let i = 0; i < veri.length; i += 4) toplam += veri[i]
      return { genislik: tuval.width, yukseklik: tuval.height, ortalama: toplam / (veri.length / 4) }
    }))

  for (const kucuk of kucukler) {
    // Bos ya da tek renk bir tuval bu araligin disinda kalir.
    assert.ok(kucuk.ortalama > 5 && kucuk.ortalama < 250, `ortalama ${kucuk.ortalama}`)
    // 1200x1800 kaynak, uzun kenar 1440'a oturur.
    assert.equal(kucuk.yukseklik, 1440)
  }

  const altYazilar = await sayfa.locator('.hv-secim-alt').allTextContents()
  for (const yazi of altYazilar) assert.match(yazi, /1200×1800 · /)
})

test('ok tusu kutular arasinda gezer', async () => {
  assert.equal(await sayfa.evaluate(() => document.activeElement?.dataset?.sira), '0')
  await sayfa.keyboard.press('ArrowRight')
  assert.equal(await sayfa.evaluate(() => document.activeElement?.dataset?.sira), '1')
})

test('secilen fotograf yuklenir ve tek fotografla calisilir', async () => {
  await sayfa.locator('.hv-secim-kutusu').nth(1).click()
  await modaliBekle(false)
  await sayfa.waitForFunction(
    () => /deneme-1/.test(document.getElementById('gorsel-bilgisi').textContent),
    null, { timeout: 60000 })

  const durum = await sayfa.evaluate(() => ({
    dosyaAdi: yuklenenGorsel?.dosyaAdi,
    dizi: Array.isArray(yuklenenGorsel)
  }))
  assert.equal(durum.dosyaAdi, 'deneme-1.png')
  assert.equal(durum.dizi, false, 'aynı anda birden fazla fotoğraf tutulmamalı')
})

test('vazgecince acik fotograf degismez', async () => {
  await sayfa.setInputFiles('#dosya-girisi', [calisma.fotograf(0), calisma.fotograf(2)])
  await modaliBekle(true)
  await sayfa.keyboard.press('Escape')
  await modaliBekle(false)

  assert.match(await sayfa.textContent('#gorsel-bilgisi'), /deneme-1\.png/)
})

test('surukle birak da ayni yolu kullanir', async () => {
  await surukleBirak([calisma.fotograf(0), calisma.fotograf(2)])
  await modaliBekle(true)
  assert.match(await sayfa.textContent('#secim-bilgisi'), /2 fotoğraf bırakıldı/)

  await kucukResimleriBekle(2)
  await sayfa.locator('.hv-secim-kutusu').first().click()
  await modaliBekle(false)
  await sayfa.waitForFunction(
    () => /deneme-0/.test(document.getElementById('gorsel-bilgisi').textContent),
    null, { timeout: 60000 })
})

test('tek fotograf suruklenince pencere acilmaz', async () => {
  await surukleBirak([calisma.fotograf(2)])
  await sayfa.waitForFunction(
    () => /deneme-2/.test(document.getElementById('gorsel-bilgisi').textContent),
    null, { timeout: 60000 })

  assert.equal(await modalAcikMi(), false)
})

test('okunamayan dosya secilemez ve sebebi yazar', async () => {
  const bozuk = calisma.cikti('bozuk.jpg')
  fs.writeFileSync(bozuk, Buffer.from('bu bir jpeg degil'))

  await sayfa.setInputFiles('#dosya-girisi', [calisma.fotograf(0), bozuk])
  await modaliBekle(true)
  await sayfa.waitForFunction(
    () => document.querySelectorAll('.hv-secim-kutusu[disabled]').length === 1,
    null, { timeout: 60000 })

  const yazi = await sayfa.locator('.hv-secim-kutusu[disabled] .hv-secim-alt').textContent()
  assert.match(yazi, /okunamadı/)

  await sayfa.keyboard.press('Escape')
  await modaliBekle(false)
})

test('secimden sonra duzenleme calisir', async () => {
  await ortam.adima(sayfa, 'rotus')
  await ortam.kaydiracAyarla(sayfa, '#rotus-sicaklik', 30)

  assert.equal(await sayfa.evaluate(() => yuklenenGorsel.gosterim !== null), true)
  await ortam.kaydiracAyarla(sayfa, '#rotus-sicaklik', 0)
})
