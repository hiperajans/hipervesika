'use strict'

// Panel adimlari arasinda gecis ve tanitim turu.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const calisma = new ortam.Calisma('panel')
const ADIMLAR = ['kadraj', 'rotus', 'cikti']

let uygulama, sayfa, kapat

test.before(async () => {
  ;({ uygulama, sayfa, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const kaydirma = () => sayfa.evaluate(() => {
  const kap = document.getElementById('panel-icerik')
  return { ust: kap.scrollTop, enFazla: kap.scrollHeight - kap.clientHeight }
})

const dibeIn = () => sayfa.evaluate(() => {
  const kap = document.getElementById('panel-icerik')
  kap.scrollTop = kap.scrollHeight
})

test('paneller gercekten kaydirilabiliyor', async () => {
  const sinirlar = {}
  for (const ad of ADIMLAR) {
    await ortam.adima(sayfa, ad)
    sinirlar[ad] = (await kaydirma()).enFazla
  }

  // Bu olmazsa asagidaki testler bos gecerdi.
  const kaydirilabilir = Object.values(sinirlar).filter((s) => s > 100).length
  assert.ok(kaydirilabilir >= 2, JSON.stringify(sinirlar))
})

for (const kaynak of ADIMLAR) {
  for (const hedef of ADIMLAR) {
    if (kaynak === hedef) continue

    test(`${kaynak} altindayken ${hedef} basa sariyor`, async () => {
      await ortam.adima(sayfa, kaynak)
      await dibeIn()
      await sayfa.waitForTimeout(300)

      const once = await kaydirma()
      if (once.enFazla < 20) return // kaydirilamayan panel bu testi bilgilendirmez

      assert.ok(once.ust > 0, 'panel dibine inilemedi')
      await ortam.adima(sayfa, hedef)
      assert.equal((await kaydirma()).ust, 0)
    })
  }
}

test('tanitim turu her adimda isigi pencere icinde tutuyor', async () => {
  await sayfa.evaluate(() => document.getElementById('panel-icerik').scrollTo(0, 0))

  await uygulama.evaluate(({ Menu }) => {
    const bul = (ogeler) => {
      for (const oge of ogeler) {
        if (oge.label === 'Tanıtım turu') return oge
        if (oge.submenu) {
          const bulunan = bul(oge.submenu.items)
          if (bulunan) return bulunan
        }
      }
      return null
    }
    bul(Menu.getApplicationMenu().items).click()
  })

  await sayfa.waitForFunction(
    () => !document.getElementById('tanitim-katmani').classList.contains('d-none'),
    null, { timeout: 30000 })

  const disarida = []
  let adimSayisi = 0

  for (let i = 0; i < 12; i++) {
    await sayfa.waitForTimeout(700)
    const acik = await sayfa.evaluate(
      () => !document.getElementById('tanitim-katmani').classList.contains('d-none'))
    if (!acik) break

    const olcum = await sayfa.evaluate(() => {
      const isik = document.getElementById('tanitim-isik').getBoundingClientRect()
      return {
        sayac: document.getElementById('tanitim-sayac').textContent,
        baslik: document.getElementById('tanitim-baslik').textContent,
        icerde: isik.top >= -4 && isik.left >= -4 &&
          isik.bottom <= window.innerHeight + 4 && isik.right <= window.innerWidth + 4,
        kutu: `${Math.round(isik.left)},${Math.round(isik.top)}`
      }
    })

    adimSayisi++
    if (!olcum.icerde) disarida.push(`${olcum.sayac} ${olcum.baslik} (${olcum.kutu})`)
    await sayfa.click('#btn-tanitim-ileri')
  }

  assert.ok(adimSayisi >= 5, `yalnızca ${adimSayisi} adım gösterildi`)
  assert.deepEqual(disarida, [], 'ışık pencerenin dışına düştü')
})

test('tur bitince katman kapaniyor ve arayuz tiklanabiliyor', async () => {
  await sayfa.waitForFunction(
    () => document.getElementById('tanitim-katmani').classList.contains('d-none'),
    null, { timeout: 20000 })

  await ortam.adima(sayfa, 'rotus')
  assert.equal(await sayfa.evaluate(
    () => document.getElementById('adim-rotus').classList.contains('active')), true)
})
