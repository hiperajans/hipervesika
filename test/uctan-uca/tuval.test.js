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
  // Surukleme gectigi yeri rotuslar: tek tiklamadan fazla leke birakir.
  assert.ok(await lekeSayisi() > onceLeke + 1, `leke sayisi ${await lekeSayisi()}`)
})

test('tek tiklama tek leke birakir', async () => {
  await aracSec('leke')
  const onceLeke = await lekeSayisi()

  const merkez = await tuvalMerkezi()
  await sayfa.mouse.click(merkez.x, merkez.y)
  await sayfa.waitForTimeout(150)

  assert.equal(await lekeSayisi(), onceLeke + 1)
})

test('surukleme sirasinda lekeler firca boyunca ust uste biner', async () => {
  await aracSec('leke')
  const onceLeke = await lekeSayisi()

  const merkez = await tuvalMerkezi()
  await sayfa.mouse.move(merkez.x - 60, merkez.y)
  await sayfa.mouse.down()
  await sayfa.mouse.move(merkez.x + 60, merkez.y, { steps: 24 })
  await sayfa.mouse.up()
  await sayfa.waitForTimeout(200)

  const eklenen = await lekeSayisi() - onceLeke
  // Her isaretci olayina leke konsaydi 24'e yakin olurdu; aralik firca
  // yaricapina bagli oldugu icin daha az ve duzenli olmali.
  assert.ok(eklenen >= 2, `yalnizca ${eklenen} leke eklendi`)
  assert.ok(eklenen < 24, `${eklenen} leke fazla; aralik uygulanmamis`)

  // Firca halkasi imleci takip etmeli: surukleme bitince son nokta sagda.
  const iz = await sayfa.evaluate(() => ({ ...lekeFircasi.sonIzNokta }))
  const sonLeke = await sayfa.evaluate(() => ({ ...lekeler.at(-1) }))
  assert.ok(Math.abs(iz.x - sonLeke.x) < 30, JSON.stringify({ iz, sonLeke }))
})

test('orta tus surukleyerek firca boyunu degistirir', async () => {
  await aracSec('leke')
  const boy = () => sayfa.inputValue('#leke-boyu')
  const onceBoy = Number(await boy())
  const onceLeke = await lekeSayisi()

  const merkez = await tuvalMerkezi()
  await sayfa.mouse.move(merkez.x, merkez.y)
  await sayfa.mouse.down({ button: 'middle' })
  // Yukari cekmek buyutur.
  await sayfa.mouse.move(merkez.x, merkez.y - 30, { steps: 6 })
  await sayfa.mouse.up({ button: 'middle' })
  await sayfa.waitForTimeout(150)

  const sonraBoy = Number(await boy())
  assert.ok(sonraBoy > onceBoy, `boy ${onceBoy} -> ${sonraBoy}`)
  assert.equal(await sayfa.textContent('#leke-boyu-degeri'), `${sonraBoy} px`)

  // Boy ayarlamak leke birakmamali.
  assert.equal(await lekeSayisi(), onceLeke)

  // Asagi cekmek kucultur.
  await sayfa.mouse.down({ button: 'middle' })
  await sayfa.mouse.move(merkez.x, merkez.y + 40, { steps: 6 })
  await sayfa.mouse.up({ button: 'middle' })
  await sayfa.waitForTimeout(150)

  assert.ok(Number(await boy()) < sonraBoy, `boy kuculmedi: ${await boy()}`)
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
