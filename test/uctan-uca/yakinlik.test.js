'use strict'

// Arayuz olcegi: Ctrl/Cmd ile + - 0 kisayollari ve Gorunum menusu.
//
// Kisayol menu hizlandiricisiyla degil, uretilen karakterle eslesiyor
// (bkz. src/renderer/js/kisayol.js); burada tustan pencerenin olcegine kadar
// butun zincirin calistigi sinaniyor.
// Ayrica arayuz olceginin baskiya sizmadigi olculuyor: Chromium yakinligi
// kaynak basina tuttugu icin bu ayri bir kaynakla cozuldu ve olcu dogrulugu
// urunun temel vaadi.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ortam = require('./ortam.js')
const olcum = require('./olcum.js')
const yakinlik = require(path.join(ortam.DEPO, 'src/main/yakinlik.js'))

const calisma = new ortam.Calisma('yakinlik')
const denetim = process.platform === 'darwin' ? 'Meta' : 'Control'

let uygulama, sayfa, hatalar, kapat

test.before(async () => {
  ;({ uygulama, sayfa, hatalar, kapat } = await ortam.hazirla(calisma))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

// Ana pencerenin olcegi. Baski penceresi gecicidir ve is bitince yok edilir.
const olcegiOku = () => uygulama.evaluate(({ BrowserWindow }) =>
  BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())

const olcegiYaz = (deger) => uygulama.evaluate(({ BrowserWindow }, olcek) => {
  BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(olcek)
}, deger)

async function tusaBas (tus) {
  await sayfa.keyboard.press(`${denetim}+${tus}`)
  await sayfa.waitForTimeout(250)
}

test.beforeEach(async () => {
  await olcegiYaz(yakinlik.VARSAYILAN)
  await sayfa.waitForTimeout(150)
})

test('Ctrl ile + ve - arayuz olcegini basamak basamak degistirir', async () => {
  await tusaBas('=')
  assert.equal(await olcegiOku(), yakinlik.sonrakiBasamak(1, 1))

  await tusaBas('-')
  assert.equal(await olcegiOku(), 1)

  await tusaBas('-')
  assert.equal(await olcegiOku(), yakinlik.sonrakiBasamak(1, -1))
})

test('Shift ile yazilan + de buyutur', async () => {
  // Turkce Q klavyede '+' Shift+4 ile yazilir; menu hizlandiricisi bu yuzden
  // hic tetiklenmiyordu. Onemli olan uretilen karakter, basilan tus degil.
  await sayfa.keyboard.press(`${denetim}+Shift+Equal`)
  await sayfa.waitForTimeout(250)

  assert.equal(await olcegiOku(), yakinlik.sonrakiBasamak(1, 1))
})

test('Ctrl+0 gercek boyuta dondurur', async () => {
  await tusaBas('=')
  await tusaBas('=')
  assert.notEqual(await olcegiOku(), 1)

  await tusaBas('0')
  assert.equal(await olcegiOku(), yakinlik.VARSAYILAN)
})

test('olcek merdivenin disina cikmaz', async () => {
  for (let i = 0; i < yakinlik.BASAMAKLAR.length + 2; i++) await tusaBas('=')
  assert.equal(await olcegiOku(), yakinlik.EN_BUYUK)

  for (let i = 0; i < yakinlik.BASAMAKLAR.length + 2; i++) await tusaBas('-')
  assert.equal(await olcegiOku(), yakinlik.EN_KUCUK)
})

test('kisayol yalnizca denetim tusuyla calisir', async () => {
  await sayfa.keyboard.press('=')
  await sayfa.keyboard.press('-')
  await sayfa.waitForTimeout(250)

  assert.equal(await olcegiOku(), yakinlik.VARSAYILAN)
})

test('Gorunum menusundeki ogeler kisayolu gosterir ve calisir', async () => {
  const gorunum = await uygulama.evaluate(({ Menu }) => {
    const ust = Menu.getApplicationMenu().items.find((m) => m.label === 'Görünüm')
    return ust.submenu.items
      .filter((o) => o.type !== 'separator')
      .map((o) => ({ etiket: o.label, kisayol: o.accelerator || null }))
  })

  const kisayolu = (etiket) => gorunum.find((o) => o.etiket === etiket)?.kisayol
  assert.equal(kisayolu('Yakınlaştır'), 'CmdOrCtrl+Plus')
  assert.equal(kisayolu('Uzaklaştır'), 'CmdOrCtrl+-')
  assert.equal(kisayolu('Gerçek boyut'), 'CmdOrCtrl+0')

  const menuTikla = (etiket) => uygulama.evaluate(({ Menu }, ad) => {
    const ust = Menu.getApplicationMenu().items.find((m) => m.label === 'Görünüm')
    ust.submenu.items.find((o) => o.label === ad).click()
  }, etiket)

  await menuTikla('Yakınlaştır')
  await sayfa.waitForTimeout(250)
  assert.equal(await olcegiOku(), yakinlik.sonrakiBasamak(1, 1))

  await menuTikla('Gerçek boyut')
  await sayfa.waitForTimeout(250)
  assert.equal(await olcegiOku(), yakinlik.VARSAYILAN)
})

// Asil olcut: kullanici arayuzu buyutmusken bastigi sayfa yine tam olcusunde
// cikmali. Chromium yakinligi kaynak basina tuttugu icin baski penceresi ayri
// bir kaynakta acilir; bu test o ayrimin korundugunu gosterir.
test('arayuz olcegi basilan sayfayi etkilemez', async () => {
  await ortam.fotografYukle(sayfa, calisma.fotograf(0))
  await ortam.adima(sayfa, 'cikti')
  await sayfa.click('label[for="gorunum-sayfa"]')
  await sayfa.fill('#kagit-genislik', '100')
  await sayfa.fill('#kagit-yukseklik', '150')
  await sayfa.waitForTimeout(600)

  await olcegiYaz(yakinlik.EN_BUYUK)
  await sayfa.waitForTimeout(400)

  const yol = calisma.cikti('olcekli-sayfa.pdf')
  await ortam.kaydetmeyiYonlendir(uygulama, yol)
  await sayfa.click('#btn-sayfayi-pdf')
  await sayfa.waitForFunction(
    () => /kaydedildi|kaydedilemedi|hazırlanamadı|iptal/i.test(
      document.getElementById('baski-durumu').textContent),
    null, { timeout: 180000 })

  assert.ok(fs.existsSync(yol), await sayfa.textContent('#baski-durumu'))

  const cizim = olcum.pdfGoruntuOlcusuMm(fs.readFileSync(yol))
  assert.ok(cizim, 'PDF içindeki çizim bulunamadı')
  assert.ok(Math.abs(cizim.genislik - 100) <= 0.2,
    `çizim ${cizim.genislik.toFixed(3)} mm, kağıt 100 mm`)
  assert.ok(Math.abs(cizim.yukseklik - 150) <= 0.2,
    `çizim ${cizim.yukseklik.toFixed(3)} mm, kağıt 150 mm`)

  // Baski penceresinin olcegi sifirlanirken arayuzunki de sifirlanmamali.
  assert.equal(await olcegiOku(), yakinlik.EN_BUYUK)
  assert.deepEqual(hatalar, [], 'arayuzde hata olusmamali')
})
