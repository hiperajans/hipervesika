'use strict'

// Hazir vesikalik olculeri ve kadraj profilleri.
//
// Otomatik hizalamanin kadraji gercekten kurdugu ancak yuz bulunabilen bir
// fotografla olculebilir (o testler HV_FOTOGRAFLAR ister); burada olcunun
// arayuze dogru bagli oldugu sinaniyor: secim, milimetre alanlari, cikti
// olcusu ve kullaniciya yazilan kadraj aciklamasi.

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ortam = require('./ortam.js')
const olcu = require(path.join(ortam.DEPO, 'src/renderer/js/olcu.js'))
const hizalama = require(path.join(ortam.DEPO, 'src/renderer/js/hizalama.js'))

const calisma = new ortam.Calisma('olcu')
let sayfa, hatalar, kapat

test.before(async () => {
  ;({ sayfa, hatalar, kapat } = await ortam.hazirla(calisma, { fotograf: calisma.fotograf(0) }))
  await ortam.adima(sayfa, 'kadraj')
})

test.after(async () => {
  await kapat()
  calisma.temizle()
})

const secenekler = () => sayfa.$$eval('#onayar-secimi option', (ogeler) =>
  ogeler.map((o) => ({ kod: o.value, metin: o.textContent })))

async function onayarSec (kod) {
  await sayfa.selectOption('#onayar-secimi', kod)
  await sayfa.waitForTimeout(400)
}

test('hazir olculerin tamami listede', async () => {
  const liste = await secenekler()
  for (const onayar of olcu.FOTOGRAF_ONAYARLARI) {
    assert.ok(liste.some((o) => o.kod === onayar.kod), `${onayar.kod} listede yok`)
  }
  assert.ok(liste.some((o) => o.kod === 'ozel'), 'özel ölçü seçeneği yok')
})

test('Turkiye vesikalik olcusu 45x60 mm uyguluyor', async () => {
  const liste = await secenekler()
  const oge = liste.find((o) => o.kod === 'tr-vesikalik')
  assert.ok(oge, 'Türkiye vesikalık seçeneği yok')
  assert.match(oge.metin, /Türkiye vesikalık/)
  assert.match(oge.metin, /45×60 mm/)

  await onayarSec('tr-vesikalik')
  assert.equal(await sayfa.inputValue('#genislik-mm'), '45')
  assert.equal(await sayfa.inputValue('#yukseklik-mm'), '60')

  // 45 mm @ 300 DPI = 531 px, 60 mm = 709 px.
  assert.equal(await sayfa.textContent('#cikti-piksel'), '531 × 709 px')
})

test('secilen olcunun kadraji kullaniciya yaziliyor', async () => {
  await onayarSec('tr-vesikalik')
  assert.equal(
    await sayfa.textContent('#onayar-aciklamasi'),
    hizalama.KADRAJLAR.vesikalik.aciklama
  )

  await onayarSec('tr-biyometrik')
  assert.equal(
    await sayfa.textContent('#onayar-aciklamasi'),
    hizalama.KADRAJLAR.biyometrik.aciklama
  )
})

test('elle olcu girmek varsayilan kadraja duser', async () => {
  await onayarSec('tr-vesikalik')
  await sayfa.fill('#genislik-mm', '44')
  await sayfa.waitForTimeout(400)

  assert.equal(await sayfa.inputValue('#onayar-secimi'), 'ozel')
  assert.equal(
    await sayfa.textContent('#onayar-aciklamasi'),
    hizalama.kadrajBul(hizalama.VARSAYILAN_KADRAJ).aciklama
  )

  assert.deepEqual(hatalar, [], 'arayuzde hata olusmamali')
})
