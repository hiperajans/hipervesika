'use strict'

// Uygulama tek ornek calisir: ayni kullanici verisi klasoruyle ikinci kez
// acilmak istendiginde yeni pencere ve yeni acilis olmaz, ikinci surec kapanir
// ve acik olan pencere one gelir.
//
// Test iki seyi olcer: ikinci surecin kendiliginden kapandigi ve ilk surecte
// pencere sayisinin degismedigi.

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawn } = require('node:child_process')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('tek-ornek')
let uygulama, kapat

test.before(async () => {
  ;({ uygulama, kapat } = await ortam.hazirla(calisma))

  // Haberin ulastigini sayabilmek icin ek bir dinleyici; uygulamanin kendi
  // dinleyicisi yerinde kalir.
  await uygulama.evaluate(({ app }) => {
    globalThis.__hvIkinciOrnek = 0
    app.on('second-instance', () => { globalThis.__hvIkinciOrnek += 1 })
  })
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const pencereler = () => uygulama.evaluate(({ BrowserWindow }) =>
  BrowserWindow.getAllWindows().map((pencere) => ({
    adres: pencere.webContents.getURL(),
    gorunur: pencere.isVisible()
  })))

// Ikinci ornegi playwright ile degil dogrudan baslatiyoruz: kilit yuzunden hic
// pencere acmadan kapaniyor, playwright ise pencere bekler.
//
// Sinyal de okunur: surec sinyalle olduruldugunde cikis kodu null gelir ve
// yalnizca kodu bildiren bir hata mesaji sebebi gizler.
function ikinciOrnek () {
  const surec = spawn(
    require(path.join(ortam.DEPO, 'node_modules', 'electron')),
    ['.', `--user-data-dir=${calisma.profil}`],
    { cwd: ortam.DEPO, env: { ...process.env, HV_ACILIS: '0' }, stdio: 'ignore' }
  )

  return new Promise((cozumle) => {
    const zamanlayici = setTimeout(() => {
      surec.kill()
      cozumle({ kapandi: false, kod: null, sinyal: null })
    }, 30000)

    surec.on('exit', (kod, sinyal) => {
      clearTimeout(zamanlayici)
      cozumle({ kapandi: true, kod, sinyal })
    })
  })
}

// Ilk surecin ikinci ornekten haber alip almadigi. Ikinci surec kilidi
// kaybettigini gorunce hemen cikiyor; haber vermeden cikarsa acik pencere one
// gelmez ve kullanici tiklamasinin hicbir karsiligi olmaz.
async function haberSayisi () {
  return uygulama.evaluate(() => globalThis.__hvIkinciOrnek ?? 0)
}

test('ikinci ornek kendiliginden kapaniyor', async () => {
  const oncekiler = await pencereler()
  assert.equal(oncekiler.length, 1, JSON.stringify(oncekiler))

  const sonuc = await ikinciOrnek()
  assert.ok(sonuc.kapandi, 'ikinci örnek kapanmadı; kilit çalışmıyor')
  assert.equal(sonuc.kod, 0, `çıkış kodu ${sonuc.kod}, sinyal ${sonuc.sinyal}`)

  // Ilk surecte ikinci bir pencere acilmamis olmali.
  const sonrakiler = await pencereler()
  assert.deepEqual(sonrakiler, oncekiler, JSON.stringify(sonrakiler))
})

test('ilk surec ikinci ornekten haber aliyor', async () => {
  // Haber kilit istegi sirasinda gonderiliyor ama olay ilk surecte biraz sonra
  // isleniyor; kisa bir sure beklenir.
  for (let deneme = 0; deneme < 40 && (await haberSayisi()) === 0; deneme += 1) {
    await new Promise((cozumle) => setTimeout(cozumle, 100))
  }

  assert.ok(await haberSayisi() >= 1, 'ilk surece second-instance ulasmadi')
})

test('acik pencere gorunur ve odakta kaliyor', async () => {
  const durum = await uygulama.evaluate(({ BrowserWindow }) => {
    const pencere = BrowserWindow.getAllWindows()[0]
    return { gorunur: pencere.isVisible(), kucultulmus: pencere.isMinimized() }
  })

  assert.equal(durum.gorunur, true)
  assert.equal(durum.kucultulmus, false)
})
