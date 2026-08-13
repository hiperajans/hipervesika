'use strict'

// Hizalama geometrisinin birim testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const hizalama = require('../src/renderer/js/hizalama.js')

const yakin = (a, b, tolerans = 0.001) =>
  assert.ok(Math.abs(a - b) <= tolerans, `${a} ile ${b} arasindaki fark ${tolerans} degerini asiyor`)

test('egiklik acisi goz hattindan hesaplanir', () => {
  // Duz duran gozler: donme yok.
  yakin(hizalama.egiklikAcisi({ x: 100, y: 200 }, { x: 300, y: 200 }), 0)

  // Sag goz asagida: pozitif aci. atan(50/200) = 14.04 derece.
  const aci = hizalama.egiklikAcisi({ x: 100, y: 200 }, { x: 300, y: 250 })
  yakin(hizalama.dereceye(aci), 14.036, 0.01)
})

test('aci olcumu nokta sirasindan bagimsizdir', () => {
  // Human'in "sol" dedigi noktalar goruntude sagda durur; ters sirada cagirmak
  // ayni egikligi vermeli, 180 derece civari bir deger degil.
  const a = { x: 100, y: 200 }
  const b = { x: 300, y: 250 }

  yakin(hizalama.egiklikAcisi(a, b), hizalama.egiklikAcisi(b, a))
  yakin(hizalama.dereceye(hizalama.egiklikAcisi(b, a)), 14.036, 0.01)

  yakin(hizalama.omuzSapmasi(a, b), hizalama.omuzSapmasi(b, a))
  assert.ok(Math.abs(hizalama.dereceye(hizalama.omuzSapmasi(b, a))) < 90)
})

test('egiklik acisi ust sinirla kisitlanir', () => {
  // 45 derecelik olcum 25 derecede kesilir; hatali algilamada goruntu
  // savrulmasin diye.
  const aci = hizalama.egiklikAcisi({ x: 0, y: 0 }, { x: 100, y: 100 })
  yakin(hizalama.dereceye(aci), 25)

  const ters = hizalama.egiklikAcisi({ x: 0, y: 0 }, { x: 100, y: -100 })
  yakin(hizalama.dereceye(ters), -25)
})

test('tepe noktasi cene-alin vektorunun uzatilmasiyla kestirilir', () => {
  const tepe = hizalama.tepeNoktasi({ x: 100, y: 400 }, { x: 100, y: 200 })
  yakin(tepe.x, 100)
  // 200 birimlik mesafe 1.2 katina cikar: 400 - 240 = 160
  yakin(tepe.y, 160)
})

test('donme yokken ic kutu kaynagin aynisidir', () => {
  const kutu = hizalama.enBuyukIcKutu(1200, 900, 0)
  yakin(kutu.genislik, 1200)
  yakin(kutu.yukseklik, 900)
})

test('donme arttikca ic kutu kuculur', () => {
  let oncekiAlan = 1200 * 900

  for (const derece of [2, 5, 10, 20]) {
    const kutu = hizalama.enBuyukIcKutu(1200, 900, hizalama.radyana(derece))
    const alan = kutu.genislik * kutu.yukseklik

    assert.ok(alan < oncekiAlan, `${derece} derecede alan kucumemis`)
    assert.ok(kutu.genislik <= 1200 && kutu.yukseklik <= 900, `${derece} derecede kutu buyumus`)
    oncekiAlan = alan
  }
})

test('ic kutunun koseleri dondurulmus goruntunun disina tasmaz', () => {
  const genislik = 1200
  const yukseklik = 900

  for (const derece of [1, 3, 7, 12, 20, -8]) {
    const aci = hizalama.radyana(derece)
    const kutu = hizalama.enBuyukIcKutu(genislik, yukseklik, aci)

    const koseler = [
      { x: 0, y: 0 },
      { x: kutu.genislik, y: 0 },
      { x: 0, y: kutu.yukseklik },
      { x: kutu.genislik, y: kutu.yukseklik }
    ]

    for (const kose of koseler) {
      // Calisma uzayindaki kose kaynak goruntude nereye dusuyor?
      const dx = kose.x - kutu.genislik / 2
      const dy = kose.y - kutu.yukseklik / 2
      const cos = Math.cos(aci)
      const sin = Math.sin(aci)
      const kaynakX = genislik / 2 + dx * cos - dy * sin
      const kaynakY = yukseklik / 2 + dx * sin + dy * cos

      assert.ok(
        kaynakX >= -0.01 && kaynakX <= genislik + 0.01 &&
        kaynakY >= -0.01 && kaynakY <= yukseklik + 0.01,
        `${derece} derecede kose goruntu disinda: ${kaynakX.toFixed(1)}, ${kaynakY.toFixed(1)}`
      )
    }
  }
})

test('nokta donusumu merkezi merkeze tasir', () => {
  const gorsel = { genislik: 1200, yukseklik: 900 }
  const aci = hizalama.radyana(10)
  const kutu = hizalama.enBuyukIcKutu(1200, 900, aci)

  const merkez = hizalama.calismayaTasi({ x: 600, y: 450 }, gorsel, kutu, aci)
  yakin(merkez.x, kutu.genislik / 2)
  yakin(merkez.y, kutu.yukseklik / 2)
})

test('nokta donusumu egik goz hattini yataya getirir', () => {
  const gorsel = { genislik: 1000, yukseklik: 1000 }
  const solGoz = { x: 400, y: 480 }
  const sagGoz = { x: 600, y: 520 } // sag goz asagida
  const aci = hizalama.egiklikAcisi(solGoz, sagGoz)
  const kutu = hizalama.enBuyukIcKutu(1000, 1000, aci)

  const sol = hizalama.calismayaTasi(solGoz, gorsel, kutu, aci)
  const sag = hizalama.calismayaTasi(sagGoz, gorsel, kutu, aci)

  // Donusumden sonra iki goz ayni yukseklikte olmali.
  yakin(sol.y, sag.y, 0.01)
})

test('otomatik cerceve yuz oranini ve goz hattini uygular', () => {
  const calisma = { genislik: 2000, yukseklik: 2000 }
  const cene = { x: 1000, y: 1200 }
  const tepe = { x: 1000, y: 900 } // 300 birim yuz yuksekligi
  const gozMerkezi = { x: 1000, y: 1050 }

  const cerceve = hizalama.otomatikCerceve({ cene, tepe, gozMerkezi, calisma, oran: 50 / 60 })

  // Yuz, kadrajin %75'i olmali: 300 / 0.75 = 400
  yakin(cerceve.yukseklik, 400)
  yakin(cerceve.genislik, 400 * (50 / 60))

  // Goz hatti kadrajin ustunden %45'te olmali.
  yakin((gozMerkezi.y - cerceve.y) / cerceve.yukseklik, hizalama.GOZ_HATTI_USTTEN)

  // Yatayda yuz merkezlenmis olmali.
  yakin(cerceve.x + cerceve.genislik / 2, gozMerkezi.x)
})

test('otomatik cerceve goruntu sinirlarini asmaz', () => {
  const calisma = { genislik: 500, yukseklik: 400 }
  // Kenara cok yakin ve buyuk bir yuz.
  const cerceve = hizalama.otomatikCerceve({
    cene: { x: 60, y: 380 },
    tepe: { x: 60, y: 40 },
    gozMerkezi: { x: 60, y: 200 },
    calisma,
    oran: 50 / 60
  })

  assert.ok(cerceve.x >= -0.001, 'sol kenar tasti')
  assert.ok(cerceve.y >= -0.001, 'ust kenar tasti')
  assert.ok(cerceve.x + cerceve.genislik <= calisma.genislik + 0.001, 'sag kenar tasti')
  assert.ok(cerceve.y + cerceve.yukseklik <= calisma.yukseklik + 0.001, 'alt kenar tasti')
  yakin(cerceve.genislik / cerceve.yukseklik, 50 / 60, 0.0001)
})

test('omuz sapmasi olculur', () => {
  yakin(hizalama.omuzSapmasi({ x: 100, y: 500 }, { x: 400, y: 500 }), 0)

  const sapma = hizalama.omuzSapmasi({ x: 100, y: 500 }, { x: 400, y: 530 })
  yakin(hizalama.dereceye(sapma), 5.71, 0.01)
})
