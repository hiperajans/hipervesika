'use strict'

// Kullanici on ayarlari ve son kullanilan degerler (Faz 9).
// Gercek kullanici ayarlarina dokunmamak icin gecici bir userData klasoru kullanilir.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('ayarlar')
const AYAR_DOSYASI = path.join(calisma.profil, 'ayarlar.json')

let uygulama, sayfa

test.after(() => calisma.temizle())

async function ac ({ turuKapat = true } = {}) {
  ;({ uygulama, sayfa } = await ortam.uygulamayiAc(calisma))
  if (turuKapat) await ortam.turuKapat(sayfa)
}

const ayarlariOku = () => JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8'))

// Ad soran pencereyi doldurup kaydeder.
async function onayarKaydet (dugme, ad) {
  await sayfa.click(dugme)
  await sayfa.waitForSelector('#onayar-modali.show')
  await sayfa.fill('#onayar-adi', ad)
  await sayfa.click('#btn-onayar-kaydet')
  await sayfa.waitForSelector('#onayar-modali.show', { state: 'hidden' })
  await sayfa.waitForTimeout(300)
}

const secenekler = (secici) => sayfa.$$eval(
  `${secici} option`, (ogeler) => ogeler.map((o) => `${o.value}:${o.textContent.trim()}`))

test('temiz profilde ayar dosyasi yok ve hazir olcu silinemez', async () => {
  // Tur ancak bu denetimden sonra kapatilir: kapatmak ayar dosyasini yazar.
  await ac({ turuKapat: false })

  assert.equal(fs.existsSync(AYAR_DOSYASI), false)
  assert.equal(await sayfa.isDisabled('#btn-olcu-sil'), true)
  assert.equal(await sayfa.isDisabled('#btn-kagit-sil'), true)

  await ortam.turuKapat(sayfa)
})

test('kendi olcusu kaydedilir', async () => {
  await sayfa.fill('#genislik-mm', '45')
  await sayfa.fill('#yukseklik-mm', '55')
  await sayfa.waitForTimeout(300)
  await onayarKaydet('#btn-olcu-kaydet', 'Ehliyet')

  const liste = await secenekler('#onayar-secimi')
  assert.ok(liste.some((s) => s.includes('Ehliyet — 45×55 mm')), liste.join(' | '))
  assert.ok((await sayfa.inputValue('#onayar-secimi')).startsWith('kullanici-'))
  assert.equal(await sayfa.isDisabled('#btn-olcu-sil'), false)
})

test('kendi kagidi kaydedilir', async () => {
  await ortam.adima(sayfa, 'cikti')
  await sayfa.fill('#kagit-genislik', '120')
  await sayfa.fill('#kagit-yukseklik', '160')
  await sayfa.waitForTimeout(300)
  await onayarKaydet('#btn-kagit-kaydet', 'Rulo kağıt')

  const liste = await secenekler('#kagit-onayari')
  assert.ok(liste.some((s) => s.includes('Rulo kağıt — 120×160 mm')), liste.join(' | '))
})

test('diger tercihler dosyaya yazilir', async () => {
  await ortam.adima(sayfa, 'kadraj')
  await sayfa.selectOption('#dpi-secimi', '600')
  await ortam.adima(sayfa, 'cikti')
  await sayfa.click('label[for="tur-png"]')
  await sayfa.fill('#dizme-kenar', '4')
  await sayfa.uncheck('#kesim-kilavuzu')
  await sayfa.waitForTimeout(1200)

  assert.equal(fs.existsSync(AYAR_DOSYASI), true)
  const yazilan = ayarlariOku()

  assert.equal(yazilan.fotografOnayarlari.length, 1)
  assert.equal(yazilan.kagitOnayarlari.length, 1)
  assert.deepEqual(
    {
      dpi: yazilan.sonKullanilan.dpi,
      tur: yazilan.sonKullanilan.tur,
      kenarMm: yazilan.sonKullanilan.kenarMm,
      kesimKilavuzu: yazilan.sonKullanilan.kesimKilavuzu
    },
    { dpi: 600, tur: 'png', kenarMm: 4, kesimKilavuzu: false }
  )

  await uygulama.close()
})

test('ikinci acilista her sey geri gelir', async () => {
  await ac()

  const durum = await sayfa.evaluate(() => ({
    genislik: document.getElementById('genislik-mm').value,
    yukseklik: document.getElementById('yukseklik-mm').value,
    olcuSecimi: document.getElementById('onayar-secimi').value,
    olcuMetni: document.getElementById('onayar-secimi').selectedOptions[0]?.textContent.trim(),
    dpi: document.getElementById('dpi-secimi').value,
    png: document.getElementById('tur-png').checked,
    kaliteGizli: document.getElementById('kalite-alani').classList.contains('d-none'),
    kagitGenislik: document.getElementById('kagit-genislik').value,
    kagitYukseklik: document.getElementById('kagit-yukseklik').value,
    kagitSecimi: document.getElementById('kagit-onayari').value,
    kenar: document.getElementById('dizme-kenar').value,
    kilavuz: document.getElementById('kesim-kilavuzu').checked,
    ciktiPiksel: document.getElementById('cikti-piksel').textContent.trim()
  }))

  assert.equal(durum.genislik, '45')
  assert.equal(durum.yukseklik, '55')
  assert.ok(durum.olcuSecimi.startsWith('kullanici-'))
  assert.match(durum.olcuMetni, /Ehliyet/)
  assert.equal(durum.dpi, '600')
  // Cikti olcusu geri gelen DPI ile yeniden hesaplanmali.
  assert.equal(durum.ciktiPiksel, '1063 × 1299 px')
  assert.equal(durum.png, true)
  assert.equal(durum.kaliteGizli, true, 'PNG secildiginde JPEG kalitesi gizlenir')
  assert.equal(durum.kagitGenislik, '120')
  assert.equal(durum.kagitYukseklik, '160')
  assert.ok(durum.kagitSecimi.startsWith('kullanici-'))
  assert.equal(durum.kenar, '4')
  assert.equal(durum.kilavuz, false)
})

test('ayni adla kaydetmek cogaltmaz, uzerine yazar', async () => {
  await ortam.adima(sayfa, 'kadraj')
  await sayfa.fill('#genislik-mm', '46')
  await sayfa.waitForTimeout(300)
  await onayarKaydet('#btn-olcu-kaydet', 'Ehliyet')

  const guncel = ayarlariOku()
  assert.equal(guncel.fotografOnayarlari.length, 1)
  assert.equal(guncel.fotografOnayarlari[0].genislikMm, 46)
})

test('silinen on ayar dosyadan da kalkar', async () => {
  await sayfa.click('#btn-olcu-sil')
  await sayfa.waitForTimeout(400)

  assert.equal(ayarlariOku().fotografOnayarlari.length, 0)
  assert.ok(!(await secenekler('#onayar-secimi')).some((s) => s.includes('Ehliyet')))

  // Secim "Ozel olcu"ye duser ama girilen olcu korunur.
  assert.equal(await sayfa.inputValue('#onayar-secimi'), 'ozel')
  assert.equal(await sayfa.inputValue('#genislik-mm'), '46')
  assert.equal(await sayfa.isDisabled('#btn-olcu-sil'), true)

  await uygulama.close()
})

test('bozuk ayar dosyasi uygulamayi engellemez', async () => {
  fs.writeFileSync(AYAR_DOSYASI, '{ bu gecerli JSON degil', 'utf8')
  await ac()

  const durum = await sayfa.evaluate(() => ({
    genislik: document.getElementById('genislik-mm').value,
    uyariGizli: document.getElementById('uyari').classList.contains('d-none')
  }))

  // Varsayilana donulur, kullaniciya hata gosterilmez.
  assert.equal(durum.genislik, '50')
  assert.equal(durum.uyariGizli, true)

  await uygulama.close()
})
