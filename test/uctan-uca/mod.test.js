'use strict'

// Basit / Gelismis mod ve sihirbaz gezinmesi.
//
// Modun kendisi CSS ile calisiyor (govdedeki data-hv-mod), bu yuzden asil sinav
// gercek arayuzde bir denetimin gorunup gorunmedigi. Gizli sekmedeki oge de
// gorunmez sayildigi icin her denetim once kendi adimina gecilerek olculur.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('mod')
const AYAR_DOSYASI = path.join(calisma.profil, 'ayarlar.json')

let uygulama, sayfa, kapat

test.before(async () => {
  ;({ uygulama, sayfa, kapat } = await ortam.hazirla(calisma, { mod: 'basit' }))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const modu = () => sayfa.evaluate(() => document.body.dataset.hvMod)

// Gorunum menusundeki mod ogeleri ve hangisinin isaretli oldugu.
const menuModlari = () => uygulama.evaluate(({ Menu }) => {
  const gorunum = Menu.getApplicationMenu().items.find((ust) => ust.label === 'Görünüm')
  return (gorunum?.submenu?.items ?? [])
    .filter((oge) => oge.type === 'radio')
    .map((oge) => ({ etiket: oge.label, isaretli: oge.checked }))
})

// Menu ogesinin isleyicisini dogrudan cagirir: gercek tiklama isletim
// sisteminin menusunden gecerdi, testten erisilemez.
async function menudenModSec (etiket) {
  await uygulama.evaluate(({ Menu }, ad) => {
    const gorunum = Menu.getApplicationMenu().items.find((ust) => ust.label === 'Görünüm')
    gorunum.submenu.items.find((oge) => oge.label === ad).click()
  }, etiket)
  await sayfa.waitForTimeout(500)
}

// Verilen adimda bir denetim kumesinin gorunurlugunu topluca olcer.
async function gorunurluk (adim, seciciler) {
  await ortam.adima(sayfa, adim)
  const sonuc = {}
  for (const secici of seciciler) sonuc[secici] = await sayfa.isVisible(secici)
  return sonuc
}

test('secilen mod diske yazilir', () => {
  assert.equal(JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8')).mod, 'basit')
})

test('basit modda sihirbaz seridi gorunur', async () => {
  assert.equal(await modu(), 'basit')
  assert.equal(await sayfa.isVisible('.hv-sihirbaz'), true)
})

test('basit modda uzman denetimleri gizli, gerekli olanlar duruyor', async () => {
  assert.deepEqual(await gorunurluk('kadraj', [
    '#btn-otomatik-hizala', '#onayar-secimi', '#btn-kirpmayi-sifirla',
    '#donme-acisi', '#genislik-mm', '#btn-olcu-kaydet', '#dpi-secimi'
  ]), {
    // Basit modda kalanlar
    '#btn-otomatik-hizala': true,
    '#onayar-secimi': true,
    '#btn-kirpmayi-sifirla': true,
    // Uzman denetimleri
    '#donme-acisi': false,
    '#genislik-mm': false,
    '#btn-olcu-kaydet': false,
    '#dpi-secimi': false
  })

  assert.deepEqual(await gorunurluk('rotus', [
    '#arkaplan-beyazlat', '#rotus-parlaklik', '#rotus-yumusatma', '#btn-rotusu-sifirla',
    '#rotus-doygunluk', '#rotus-sicaklik', '#rotus-keskinlik', '#rotus-goz', '#leke-boyu'
  ]), {
    '#arkaplan-beyazlat': true,
    '#rotus-parlaklik': true,
    '#rotus-yumusatma': true,
    '#btn-rotusu-sifirla': true,
    '#rotus-doygunluk': false,
    '#rotus-sicaklik': false,
    '#rotus-keskinlik': false,
    '#rotus-goz': false,
    '#leke-boyu': false
  })

  assert.deepEqual(await gorunurluk('cikti', [
    '#btn-indir', '#kagit-onayari', '#dizme-adet', '#btn-sayfayi-bas',
    '#renk-duzeni', '#jpg-kalitesi', '#kagit-genislik', '#dizme-kenar', '#dizme-aralik'
  ]), {
    '#btn-indir': true,
    '#kagit-onayari': true,
    '#dizme-adet': true,
    '#btn-sayfayi-bas': true,
    '#renk-duzeni': false,
    '#jpg-kalitesi': false,
    '#kagit-genislik': false,
    '#dizme-kenar': false,
    '#dizme-aralik': false
  })
})

test('basit modda elle rotus araclari arac cubugundan kalkar', async () => {
  assert.equal(await sayfa.isVisible('label[for="arac-kirpma"]'), true)
  for (const arac of ['arac-leke', 'arac-firca-sil', 'arac-firca-getir']) {
    assert.equal(await sayfa.isVisible(`label[for="${arac}"]`), false, arac)
  }
})

test('sihirbaz ileri ve geri adimlar arasinda gezinir', async () => {
  await ortam.adima(sayfa, 'kadraj')
  assert.equal(await sayfa.isDisabled('#btn-sihirbaz-geri'), true)
  assert.equal((await sayfa.textContent('#sihirbaz-ileri-yazi')).trim(), 'Rötuşa geç')

  await sayfa.click('#btn-sihirbaz-ileri')
  await sayfa.waitForSelector('#adim-rotus.active')
  assert.equal(await sayfa.isDisabled('#btn-sihirbaz-geri'), false)
  assert.equal((await sayfa.textContent('#sihirbaz-ileri-yazi')).trim(), 'Çıktıya geç')

  // Son adimda ileri gidilecek yer yok.
  await sayfa.click('#btn-sihirbaz-ileri')
  await sayfa.waitForSelector('#adim-cikti.active')
  assert.equal(await sayfa.isVisible('#btn-sihirbaz-ileri'), false)

  await sayfa.click('#btn-sihirbaz-geri')
  await sayfa.waitForSelector('#adim-rotus.active')
  assert.equal(await sayfa.isVisible('#btn-sihirbaz-ileri'), true)
})

test('adim seridi basit modda da tiklanabilir kalir', async () => {
  // Sihirbaz ek bir yoldur, tek yol degil: kullanici adimlar arasinda
  // dogrudan atlayabilmeli.
  await ortam.adima(sayfa, 'cikti')
  await ortam.adima(sayfa, 'kadraj')
  assert.equal(await sayfa.isVisible('#adim-kadraj.active'), true)
})

test('Görünüm menüsü açık modu işaretler', async () => {
  assert.deepEqual(await menuModlari(), [
    { etiket: 'Basit mod', isaretli: true },
    { etiket: 'Gelişmiş mod', isaretli: false }
  ])
})

test('menuden gelismis moda gecilince denetimler geri gelir', async () => {
  await menudenModSec('Gelişmiş mod')

  assert.equal(await modu(), 'gelismis')
  assert.equal(await sayfa.isVisible('.hv-sihirbaz'), false)
  assert.deepEqual(await menuModlari(), [
    { etiket: 'Basit mod', isaretli: false },
    { etiket: 'Gelişmiş mod', isaretli: true }
  ])

  assert.deepEqual(await gorunurluk('kadraj', ['#donme-acisi', '#genislik-mm', '#dpi-secimi']), {
    '#donme-acisi': true,
    '#genislik-mm': true,
    '#dpi-secimi': true
  })

  // Secim kalici olmali: uygulama yeniden acilinca ayni modda gelsin.
  assert.equal(JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8')).mod, 'gelismis')
})

test('basit moda donunce ciktiyi etkileyen uzman degerleri varsayilana doner', async () => {
  // Gelismis modda goze batmayan bir secim yapiliyor; basit modda kullanici
  // bunu goremeyecegi icin etkisini de yasamamali.
  await ortam.adima(sayfa, 'cikti')
  await sayfa.selectOption('#renk-duzeni', 'cmyk')
  await ortam.adima(sayfa, 'kadraj')
  await sayfa.selectOption('#dpi-secimi', '150')
  await sayfa.waitForTimeout(400)

  await menudenModSec('Basit mod')

  assert.equal(await sayfa.inputValue('#renk-duzeni'), 'srgb')
  assert.equal(await sayfa.inputValue('#dpi-secimi'), '300')
})
