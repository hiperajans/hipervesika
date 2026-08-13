'use strict'

// Uretilen dosyalardan fiziksel olcu okuma yardimcilari.

const zlib = require('node:zlib')

function pngOlcusu (baytlar) {
  const b = Buffer.from(baytlar)
  return { genislik: b.readUInt32BE(16), yukseklik: b.readUInt32BE(20) }
}

// PDF'te goruntunun kagida hangi olcude cizildigi (mm).
//
// Basilan fotografin buyuklugunu belirleyen sayi budur; MediaBox yalnizca kagit
// kutusudur ve Chromium onu 1/300 ince yuvarlar. Bu yuzden olcu dogrulugu
// cizim uzerinden denetlenir.
function pdfGoruntuOlcusuMm (baytlar) {
  const metin = Buffer.from(baytlar).toString('latin1')
  const desen = /stream\r?\n/g
  let eslesme

  while ((eslesme = desen.exec(metin)) !== null) {
    const bas = eslesme.index + eslesme[0].length
    const son = metin.indexOf('endstream', bas)
    if (son < 0) continue

    let akis
    try {
      akis = zlib.inflateSync(Buffer.from(baytlar).subarray(bas, son)).toString('latin1')
    } catch { continue }
    if (akis.length > 5000 || !/\/\w+\s+Do/.test(akis)) continue

    // Dis donusum tum sayfayi olcekler (72/300); goruntuyu cizen donusum ise
    // Do'dan hemen onceki cm'dir.
    const doYeri = akis.search(/\/\w+\s+Do/)
    const donusumler = [...akis.slice(0, doYeri).matchAll(/([\d.-]+) 0 0 ([\d.-]+) 0 ([\d.-]+) cm/g)]
    if (donusumler.length < 2) continue

    const dis = donusumler[0]
    const ic = donusumler[donusumler.length - 1]
    const olcek = Math.abs(Number(dis[1])) * (25.4 / 72)

    return {
      genislik: Math.abs(Number(ic[1])) * olcek,
      yukseklik: Math.abs(Number(ic[2])) * olcek
    }
  }

  return null
}

module.exports = { pngOlcusu, pdfGoruntuOlcusuMm }
