'use strict'

// Fotograf tuvalinde bosluk tusuyla kaydirma.
//
// Leke ve firca araclari her tiklamayi kendileri sahiplendigi icin bu
// araclardayken fotografi surukleyerek tasimanin baska yolu yok. Bosluk tusu
// basiliyken araclar devreden cikar ve surukleme kaydirmaya doner.
//
// Olcum tuvalin kendi durumundan okunur: kaydirma ekran pikseli cinsindendir,
// cizim sonucundan geri hesaplamak gereksiz derecede kirilgan olurdu.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('tuval')

let sayfa, hatalar, kapat

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(
    calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'kadraj')
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const kaydirma = () => sayfa.evaluate(() => ({ ...tuval.kaydirma }))
const lekeSayisi = () => sayfa.evaluate(() => lekeler.length)
const imlec = () => sayfa.evaluate(() => document.getElementById('tuval').style.cursor)

async function tuvalMerkezi () {
  const kutu = await sayfa.locator('#tuval').boundingBox()
  return { x: kutu.x + kutu.width / 2, y: kutu.y + kutu.height / 2 }
}

// Verilen kadar surukler. Bosluk basiliyken imlec once tuvalin uzerine
// getirilir: tus yalnizca orada kaydirma anlamina gelir.
async function surukle ({ bosluk = false } = {}) {
  const merkez = await tuvalMerkezi()

  await sayfa.mouse.move(merkez.x, merkez.y)
  if (bosluk) await sayfa.keyboard.down('Space')

  await sayfa.mouse.down()
  await sayfa.mouse.move(merkez.x + 60, merkez.y + 40, { steps: 6 })
  await sayfa.mouse.up()

  if (bosluk) await sayfa.keyboard.up('Space')
  await sayfa.waitForTimeout(100)
}

async function aracSec (arac) {
  await sayfa.click(`label[for="arac-${arac}"]`)
  await sayfa.waitForTimeout(100)
}

// Leke araciyla olculur: silme ve geri getirme fircalari maske olmadan kapali
// oldugu icin sentetik fotografta secilemiyor. Ucu de Tuval'in ayni etkilesim
// yuvasindan gectigi icin sinav ucu icin de gecerli.
test('leke aracindayken bosluk basili surukleme fotografi tasir', async () => {
  await aracSec('leke')

  const once = await kaydirma()
  const onceLeke = await lekeSayisi()

  await surukle({ bosluk: true })

  const sonra = await kaydirma()
  assert.ok(Math.abs(sonra.x - once.x) > 30, `x kaymadi: ${JSON.stringify([once, sonra])}`)
  assert.ok(Math.abs(sonra.y - once.y) > 20, `y kaymadi: ${JSON.stringify([once, sonra])}`)

  // Bosluk basiliyken arac hic devreye girmemeli.
  assert.equal(await lekeSayisi(), onceLeke)
})

test('bosluk birakilinca leke araci yeniden calisir', async () => {
  await aracSec('leke')

  const once = await kaydirma()
  const onceLeke = await lekeSayisi()

  await surukle()

  assert.deepEqual(await kaydirma(), once, 'fotograf tasinmamaliydi')
  assert.equal(await lekeSayisi(), onceLeke + 1)
})

test('bosluk imleci tasima imlecine cevirir', async () => {
  await aracSec('leke')

  const merkez = await tuvalMerkezi()
  await sayfa.mouse.move(merkez.x, merkez.y)
  await sayfa.waitForTimeout(100)
  assert.equal(await imlec(), 'crosshair')

  await sayfa.keyboard.down('Space')
  await sayfa.waitForTimeout(100)
  assert.equal(await imlec(), 'grab')

  await sayfa.keyboard.up('Space')
  await sayfa.waitForTimeout(100)
  assert.notEqual(await imlec(), 'grab')
})

test('imlec tuvalin disindayken bosluk kaydirmaya donmez', async () => {
  await aracSec('leke')

  // Panelin uzerinde bosluk tusu odaktaki denetimin isi; tuval karismamali.
  const panel = await sayfa.locator('#panel-icerik').boundingBox()
  await sayfa.mouse.move(panel.x + panel.width / 2, panel.y + 20)
  await sayfa.keyboard.down('Space')
  await sayfa.waitForTimeout(100)

  const bosluktaMi = await sayfa.evaluate(() => tuval.bosluk)
  await sayfa.keyboard.up('Space')

  assert.equal(bosluktaMi, false)
})

test('kaydirma arayuzde hata birakmadi', () => {
  assert.deepEqual(hatalar, [])
})
