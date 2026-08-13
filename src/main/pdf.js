'use strict'

// DeviceCMYK PDF yazici.
//
// Chromium'un printToPDF'i her zaman RGB uretir; CMYK istendiginde sayfayi
// kendimiz yaziyoruz. Goruntu, piksel basina 4 bayt (C, M, Y, K) olarak
// sikistirilip PDF'e gomulur; 255 = tam murekkep.
//
// PDF'in kendisi disinda bir kutuphane kullanilmaz, bu yuzden yalnizca ihtiyac
// duyulan en kucuk yapi yazilir: katalog, tek sayfa, bir goruntu nesnesi ve
// goruntuyu sayfaya oturtan icerik akisi.

const zlib = require('node:zlib')

const INC_MM = 25.4

function punto (mm) {
  return (mm / INC_MM) * 72
}

// Sayilar PDF'e kisa ve nokta ayracli yazilir.
function sayi (deger) {
  return Number(deger.toFixed(4)).toString()
}

function cmykSayfaPdf ({ baytlar, genislik, yukseklik, kagitMm }) {
  if (!(baytlar instanceof Uint8Array) && !Buffer.isBuffer(baytlar)) {
    throw new Error('CMYK verisi geçersiz.')
  }
  if (!Number.isInteger(genislik) || !Number.isInteger(yukseklik) ||
      genislik < 1 || yukseklik < 1) {
    throw new Error('Görüntü ölçüsü geçersiz.')
  }
  if (baytlar.length !== genislik * yukseklik * 4) {
    throw new Error(
      `CMYK verisi ${genislik}×${yukseklik} ölçüsüyle uyuşmuyor ` +
      `(${baytlar.length} bayt, beklenen ${genislik * yukseklik * 4}).`
    )
  }

  const sayfaGenisligi = punto(kagitMm.genislik)
  const sayfaYuksekligi = punto(kagitMm.yukseklik)
  const goruntu = zlib.deflateSync(Buffer.from(baytlar), { level: 6 })

  // Goruntu sayfanin tamamini kaplar; olcu tasiyicisi MediaBox'tir.
  const icerik = Buffer.from(
    `q ${sayi(sayfaGenisligi)} 0 0 ${sayi(sayfaYuksekligi)} 0 0 cm /Im0 Do Q\n`,
    'latin1'
  )

  const nesneler = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R ' +
      `/MediaBox [0 0 ${sayi(sayfaGenisligi)} ${sayi(sayfaYuksekligi)}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    {
      sozluk: '<< /Type /XObject /Subtype /Image ' +
        `/Width ${genislik} /Height ${yukseklik} ` +
        '/ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode ' +
        `/Length ${goruntu.length} >>`,
      akis: goruntu
    },
    {
      sozluk: `<< /Length ${icerik.length} >>`,
      akis: icerik
    }
  ]

  const parcalar = []
  let uzunluk = 0
  const ekle = (metin) => {
    const parca = Buffer.isBuffer(metin) ? metin : Buffer.from(metin, 'latin1')
    parcalar.push(parca)
    uzunluk += parca.length
  }

  ekle('%PDF-1.7\n')
  // Ikili veri iceren dosya oldugunu bildiren alisilmis yorum satiri.
  ekle(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  const konumlar = []
  nesneler.forEach((nesne, sira) => {
    konumlar.push(uzunluk)
    ekle(`${sira + 1} 0 obj\n`)

    if (typeof nesne === 'string') {
      ekle(`${nesne}\n`)
    } else {
      ekle(`${nesne.sozluk}\nstream\n`)
      ekle(nesne.akis)
      ekle('\nendstream\n')
    }

    ekle('endobj\n')
  })

  const xrefKonumu = uzunluk
  let xref = `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`
  for (const konum of konumlar) {
    xref += `${String(konum).padStart(10, '0')} 00000 n \n`
  }
  ekle(xref)
  ekle(`trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\n`)
  ekle(`startxref\n${xrefKonumu}\n%%EOF\n`)

  return Buffer.concat(parcalar)
}

module.exports = { INC_MM, punto, sayi, cmykSayfaPdf }
