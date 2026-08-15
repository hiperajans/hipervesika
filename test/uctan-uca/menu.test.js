'use strict'

// Uygulama menusu ve "Hakkinda" penceresi.
//
// Hakkinda penceresi isletim sisteminin cizdigi bir panel; icerigi buradan
// okunamaz. Okunabilen sey menunun yapisi ve panelin sorunsuz acilmasidir.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('menu')
const macOs = process.platform === 'darwin'

let uygulama, sayfa, hatalar, kapat

test.before(async () => {
  ;({ uygulama, sayfa, hatalar, kapat } = await ortam.hazirla(calisma))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

// Menuyu ana surecten okur: her ust menu ve altindaki etiketler.
const menuyuOku = () => uygulama.evaluate(({ Menu }) => {
  const ana = Menu.getApplicationMenu()
  return ana.items.map((ust) => ({
    baslik: ust.label,
    ogeler: (ust.submenu?.items ?? [])
      .filter((oge) => oge.type !== 'separator')
      .map((oge) => oge.label)
  }))
})

test('menunun tamami Turkce', async () => {
  const menu = await menuyuOku()
  const basliklar = menu.map((ust) => ust.baslik)

  assert.deepEqual(
    basliklar.slice(macOs ? 1 : 0),
    ['Dosya', 'Düzen', 'Görünüm', 'Pencere', 'Yardım']
  )

  // macOS'un uygulama menusu 'appMenu' rolu ile hazir gelir ama etiketleri
  // Ingilizce'dir; elle yazildigi icin burada Turkce olmali.
  if (macOs) {
    assert.equal(menu[0].baslik, 'Hiper Vesika')
    assert.deepEqual(menu[0].ogeler, [
      'Hiper Vesika Hakkında',
      'Hizmetler',
      "Hiper Vesika'yı Gizle",
      'Diğerlerini Gizle',
      'Tümünü Göster',
      "Hiper Vesika'dan Çık"
    ])
  }
})

test('Hakkinda her platformda menuden ulasilabilir', async () => {
  const menu = await menuyuOku()
  // macOS'ta Apple menusunun altinda, digerlerinde Yardim menusunde.
  const nerede = macOs ? menu[0] : menu.find((ust) => ust.baslik === 'Yardım')

  assert.ok(
    nerede.ogeler.includes('Hiper Vesika Hakkında'),
    `Hakkinda ogesi bulunamadi: ${JSON.stringify(nerede)}`
  )
})

test('gelistirici araclari kapali', async () => {
  const gorunum = (await menuyuOku()).find((ust) => ust.baslik === 'Görünüm')
  assert.equal(gorunum.ogeler.includes('Geliştirici araçları'), false)

  // Menude olmamasi yetmez: koddan da acilamamali (webPreferences.devTools).
  const acik = await uygulama.evaluate(async ({ BrowserWindow }) => {
    const pencere = BrowserWindow.getAllWindows()[0]
    pencere.webContents.openDevTools()
    await new Promise((cozumle) => setTimeout(cozumle, 500))
    return pencere.webContents.isDevToolsOpened()
  })

  assert.equal(acik, false)
})

test('durum cubugunda isletim sisteminin adi yazar', async () => {
  const beklenen = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform]
  assert.equal(await sayfa.textContent('#sistem-bilgisi'), beklenen)
})

test('Hakkinda penceresi acilabiliyor', async () => {
  const sonuc = await uygulama.evaluate(({ app }) => {
    try {
      app.showAboutPanel()
      return 'acildi'
    } catch (hata) {
      return `hata: ${hata.message}`
    }
  })

  assert.equal(sonuc, 'acildi')
  assert.deepEqual(hatalar, [], 'arayuzde hata olusmamali')

  // Panel acikken uygulama calismaya devam etmeli.
  assert.equal(await sayfa.evaluate(() => document.title), 'Hiper Vesika')
})
