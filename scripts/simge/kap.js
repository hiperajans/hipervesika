'use strict'

// Windows (.ico) ve macOS (.icns) simge kaplari. Ikisi de birden fazla
// boyuttaki PNG'yi tek dosyada tasiyan basit kaplardir; disaridan bir arac
// (iconutil, ImageMagick, png2icns) gerekmesin diye elle yaziliyorlar.
// iconutil yalnizca macOS'ta bulunur; uretim uc platformda da calismali
// (bkz. AGENTS.md, kural 4).

// --- Windows: ICO -------------------------------------------------------
//
//   ICONDIR      6 bayt   : ayrilmis(2)=0, tur(2)=1, adet(2)
//   ICONDIRENTRY 16 bayt  : en(1), boy(1), renk(1)=0, ayrilmis(1)=0,
//                           duzlem(2)=1, bit(2)=32, uzunluk(4), konum(4)
//   ...ardindan PNG govdeleri
//
// Vista'dan beri govde dogrudan PNG olabilir; BMP + AND maskesi gerekmez.

const ICO_EN_BUYUK = 256

function icoUret (girdiler) {
  if (girdiler.length === 0) throw new Error('ICO icin en az bir boyut gerekir')

  const basliklar = Buffer.alloc(6 + girdiler.length * 16)
  basliklar.writeUInt16LE(0, 0)
  basliklar.writeUInt16LE(1, 2)
  basliklar.writeUInt16LE(girdiler.length, 4)

  let konum = basliklar.length

  for (const [sira, girdi] of girdiler.entries()) {
    if (girdi.boyut > ICO_EN_BUYUK) {
      throw new Error(`ICO ${ICO_EN_BUYUK} px'ten buyuk goruntu tasiyamaz: ${girdi.boyut}`)
    }

    const yer = 6 + sira * 16
    // 256 px alanina sigmaz; bicim bunu 0 ile gosterir.
    basliklar.writeUInt8(girdi.boyut === ICO_EN_BUYUK ? 0 : girdi.boyut, yer)
    basliklar.writeUInt8(girdi.boyut === ICO_EN_BUYUK ? 0 : girdi.boyut, yer + 1)
    basliklar.writeUInt8(0, yer + 2)
    basliklar.writeUInt8(0, yer + 3)
    basliklar.writeUInt16LE(1, yer + 4)
    basliklar.writeUInt16LE(32, yer + 6)
    basliklar.writeUInt32LE(girdi.png.length, yer + 8)
    basliklar.writeUInt32LE(konum, yer + 12)

    konum += girdi.png.length
  }

  return Buffer.concat([basliklar, ...girdiler.map((girdi) => girdi.png)])
}

// --- macOS: ICNS --------------------------------------------------------
//
//   Baslik : 'icns' + toplam uzunluk (4 bayt, buyuk uclu)
//   Oge    : tur (4 bayt) + uzunluk (4 bayt, baslik dahil) + govde
//
// Tur kodlari iconutil'in .iconset klasoru icin kullandiklariyla ayni.
// Retina esleri ayri kodlardir: 16@2x ile 32 ayni piksel olcusunde olsa da
// sistem ikisini farkli baglamlarda kullanir, ikisi de yazilir.
const ICNS_TURLERI = [
  { tur: 'icp4', piksel: 16, ad: '16x16' },
  { tur: 'ic11', piksel: 32, ad: '16x16@2x' },
  { tur: 'icp5', piksel: 32, ad: '32x32' },
  { tur: 'ic12', piksel: 64, ad: '32x32@2x' },
  { tur: 'ic07', piksel: 128, ad: '128x128' },
  { tur: 'ic13', piksel: 256, ad: '128x128@2x' },
  { tur: 'ic08', piksel: 256, ad: '256x256' },
  { tur: 'ic14', piksel: 512, ad: '256x256@2x' },
  { tur: 'ic09', piksel: 512, ad: '512x512' },
  { tur: 'ic10', piksel: 1024, ad: '512x512@2x' }
]

function icnsOge (tur, govde) {
  const baslik = Buffer.alloc(8)
  baslik.write(tur, 0, 4, 'ascii')
  baslik.writeUInt32BE(govde.length + 8, 4)
  return Buffer.concat([baslik, govde])
}

function icnsUret (pngler) {
  const ogeler = []

  for (const { tur, piksel } of ICNS_TURLERI) {
    const png = pngler.get(piksel)
    if (!png) throw new Error(`ICNS icin ${piksel} px PNG uretilmemis`)
    ogeler.push(icnsOge(tur, png))
  }

  // Icindekiler tablosu: ardindan gelen her ogenin 8 baytlik basligi.
  // Apple'in kendi urettigi dosyalarda bulunur; okuyucular dosyayi bastan
  // taramak yerine buradan atlar.
  const tablo = icnsOge('TOC ', Buffer.concat(ogeler.map((oge) => oge.subarray(0, 8))))

  const govde = Buffer.concat([tablo, ...ogeler])
  const baslik = Buffer.alloc(8)
  baslik.write('icns', 0, 4, 'ascii')
  baslik.writeUInt32BE(govde.length + 8, 4)

  return Buffer.concat([baslik, govde])
}

module.exports = { ICNS_TURLERI, icoUret, icnsUret }
