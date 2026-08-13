'use strict'

// Testler icin sentetik fotograf uretir.
//
// Gercek vesikalik fotograflar depoya giremez (bkz. AGENTS.md, kural 5), bu
// yuzden uctan uca testler kendi goruntusunu uretir. Uretilen goruntu bir yuz
// degildir; yalnizca kadraj, olcu, kirpma, dizme ve kaydetme yollarini
// calistirmaya yeter. Yuz/omuz bulma ve arka plan ayirma gerektiren testler
// gercek fotograf ister (bkz. ortam.gercekFotograflar).

const zlib = require('node:zlib')

// PNG parcasi: uzunluk + tur + veri + CRC32.
function parca (tur, veri) {
  const uzunluk = Buffer.alloc(4)
  uzunluk.writeUInt32BE(veri.length)
  const govde = Buffer.concat([Buffer.from(tur, 'latin1'), veri])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(govde))
  return Buffer.concat([uzunluk, govde, crc])
}

const CRC_TABLOSU = (() => {
  const tablo = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tablo[i] = c >>> 0
  }
  return tablo
})()

function crc32 (baytlar) {
  let c = 0xffffffff
  for (const bayt of baytlar) c = CRC_TABLOSU[(c ^ bayt) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Kaba bir portre: acik zemin, ortada koyu bir oval "kafa" ve altinda govde.
// Renkli ve ayrintili olmasi onemli: rotus testleri parlaklik ve ayrinti
// olcuyor, duz bir zemin bunlari olcemez hale getirirdi.
function pikselRengi (x, y, genislik, yukseklik, tohum) {
  const merkezX = genislik / 2
  const kafaY = yukseklik * 0.32
  const kafaYariX = genislik * 0.2
  const kafaYariY = yukseklik * 0.17

  const kafa = ((x - merkezX) / kafaYariX) ** 2 + ((y - kafaY) / kafaYariY) ** 2
  // Govde: omuzlardan asagi genisleyen bir yay
  const govdeY = yukseklik * 0.62
  const govde = y > govdeY &&
    Math.abs(x - merkezX) < genislik * (0.22 + (y - govdeY) / yukseklik * 0.6)

  // Dokusu olan bir gurultu; ayrinti olcumleri icin gerekli.
  const gurultu = ((x * 7 + y * 13 + tohum) % 17) - 8

  if (kafa <= 1) return [214 + gurultu, 168 + gurultu, 140 + gurultu]
  if (govde) return [64 + gurultu, 78 + gurultu, 96 + gurultu]
  // Zemin: hafif degisken acik gri, duz beyaz degil ki beyazlatma olculebilsin.
  return [228 + gurultu, 231 + gurultu, 236 + gurultu]
}

const kirp = (deger) => Math.max(0, Math.min(255, Math.round(deger)))

// genislik x yukseklik olcusunde PNG uretir.
function pngUret (genislik = 1200, yukseklik = 1800, tohum = 0) {
  const satirBoyu = genislik * 3 + 1
  const ham = Buffer.alloc(satirBoyu * yukseklik)

  for (let y = 0; y < yukseklik; y++) {
    const satirBasi = y * satirBoyu
    ham[satirBasi] = 0 // filtre: yok
    for (let x = 0; x < genislik; x++) {
      const [r, g, b] = pikselRengi(x, y, genislik, yukseklik, tohum)
      const i = satirBasi + 1 + x * 3
      ham[i] = kirp(r)
      ham[i + 1] = kirp(g)
      ham[i + 2] = kirp(b)
    }
  }

  const baslik = Buffer.alloc(13)
  baslik.writeUInt32BE(genislik, 0)
  baslik.writeUInt32BE(yukseklik, 4)
  baslik[8] = 8 // bit derinligi
  baslik[9] = 2 // renk turu: truecolor
  // 10-12: sikistirma, filtre, aralama - hepsi 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', baslik),
    parca('IDAT', zlib.deflateSync(ham, { level: 6 })),
    parca('IEND', Buffer.alloc(0))
  ])
}

module.exports = { pngUret, crc32 }
