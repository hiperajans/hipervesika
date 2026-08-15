'use strict'

// Arka plan maskesinin ard arda cikarilmasi.
//
// rvm bir video modeli: her calistirmada yinelemeli bir durum uretip bir
// sonrakine tasiyor ve bu durum girdinin olcusune bagli. Farkli olcude ikinci
// bir fotografta maske su hatayla cikmiyordu:
//   broadcastTo(): [1,38,29,64] cannot be broadcast to [1,32,32,64]
//
// Sinav gercek yuz istemez; hata goruntunun icerigiyle degil olcusuyle ilgili.
// Sentetik goruntude maske neredeyse bos doner, olculeri yine de dogru olmali.
//
// Test acilistan hemen sonra kostugu icin arka plandaki model isitmasiyla
// cakisma ihtimali de var; sira calismasaydi ilk maske isitmanin olcusunde
// (256x256) donerdi.

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')
const { pngUret } = require('./gorsel-uret.js')

const calisma = new ortam.Calisma('maske')

let sayfa, hatalar, kapat

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(calisma))
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

async function maskeOlcusu (genislik, yukseklik, tohum) {
  const png = pngUret(genislik, yukseklik, tohum).toString('base64')

  return sayfa.evaluate(async (veri) => {
    const gorsel = new Image()
    gorsel.src = `data:image/png;base64,${veri}`
    await gorsel.decode()

    const maske = await window.HV.arkaplan.maskeCikar(await createImageBitmap(gorsel))
    return [maske.width, maske.height]
  }, png)
}

test('farkli olcudeki fotograflarda maske ard arda cikarilabiliyor', async () => {
  assert.deepEqual(await maskeOlcusu(900, 1200, 0), [900, 1200])
  assert.deepEqual(await maskeOlcusu(1000, 1000, 3), [1000, 1000])
  // Ilk olcuye donunce de calismali: durum her istekte sifirlaniyor.
  assert.deepEqual(await maskeOlcusu(900, 1200, 0), [900, 1200])
})

test('maske cikarma arayuzde hata birakmadi', () => {
  assert.deepEqual(hatalar, [])
})
