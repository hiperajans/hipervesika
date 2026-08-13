'use strict'

// Maske kenar egrisinin birim testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const arkaplan = require('../src/renderer/js/arkaplan.js')

// RGBA dizisi uretir; yalnizca alpha degerleri onemli.
const alphaDizisi = (degerler) => {
  const veri = new Uint8ClampedArray(degerler.length * 4)
  degerler.forEach((a, i) => { veri[i * 4 + 3] = a })
  return veri
}

const alphalari = (veri) => Array.from({ length: veri.length / 4 }, (_, i) => veri[i * 4 + 3])

test('egri tam saydam ve tam opak bolgeleri yerinde birakir', () => {
  // Bu ozellik onemli: sabit bir toplama islemi arka planin tamaminda
  // hayalet bir gorunurluk birakirdi.
  for (const genislet of [-0.3, -0.1, 0, 0.1, 0.3]) {
    const sonuc = alphalari(arkaplan.alphaEgrisi(alphaDizisi([0, 255]), genislet))
    assert.deepEqual(sonuc, [0, 255], `genislet ${genislet} icin uc degerler bozuldu`)
  }
})

test('pozitif genislet yumusak kenari maske lehine kaydirir', () => {
  const oncesi = [64, 128, 192]
  const sonrasi = alphalari(arkaplan.alphaEgrisi(alphaDizisi(oncesi), 0.2))

  for (let i = 0; i < oncesi.length; i++) {
    assert.ok(sonrasi[i] >= oncesi[i], `${oncesi[i]} degeri buyumemis: ${sonrasi[i]}`)
  }
  // Esik 0.3'e indigi icin 0.3 civari degerler orta seviyeye cikar.
  assert.ok(sonrasi[1] > 200, `orta deger yeterince buyumemis: ${sonrasi[1]}`)
})

test('negatif genislet maskeyi daraltir', () => {
  const oncesi = [64, 128, 192]
  const sonrasi = alphalari(arkaplan.alphaEgrisi(alphaDizisi(oncesi), -0.2))

  for (let i = 0; i < oncesi.length; i++) {
    assert.ok(sonrasi[i] <= oncesi[i], `${oncesi[i]} degeri kucumemis: ${sonrasi[i]}`)
  }
  assert.equal(sonrasi[0], 0)
})

test('egri sonuclari 0-255 araligini asmaz', () => {
  const sonuc = alphalari(arkaplan.alphaEgrisi(alphaDizisi([0, 32, 96, 160, 224, 255]), 0.4))
  for (const deger of sonuc) {
    assert.ok(deger >= 0 && deger <= 255, `aralik disi deger: ${deger}`)
  }
})

test('genislet sifirken orta degerler keskinlesir ama yon degistirmez', () => {
  const sonuc = alphalari(arkaplan.alphaEgrisi(alphaDizisi([100, 128, 156]), 0))
  assert.ok(sonuc[0] < 128, 'esigin altindaki deger yukselmis')
  // 128/255 tam olarak 0.5 etmedigi icin orta deger bir birim kayabilir.
  assert.ok(Math.abs(sonuc[1] - 128) <= 1, `orta deger kaymis: ${sonuc[1]}`)
  assert.ok(sonuc[2] > 128, 'esigin ustundeki deger dusmus')
})
