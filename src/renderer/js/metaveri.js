'use strict'

// Cikti dosyalarina fiziksel cozunurluk (DPI) bilgisini yazar.
//
// Tarayicinin urettigi JPEG ve PNG dosyalarinda bu bilgi bulunmuyor; baski
// alan programlar cozunurlugu okuyamayinca fotografi yanlis olcude basiyor.
// Ikisi de bayt duzeyinde duzenlenir, bu yuzden burasi saf hesaptir.

;(function (kok) {
  const INC_METRE = 39.3700787

  // --- CRC32 (PNG parca dogrulamasi) -----------------------------------------

  let crcTablosu = null

  function crcTablosunuHazirla () {
    if (crcTablosu) return crcTablosu

    crcTablosu = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let deger = i
      for (let bit = 0; bit < 8; bit++) {
        deger = deger & 1 ? 0xedb88320 ^ (deger >>> 1) : deger >>> 1
      }
      crcTablosu[i] = deger >>> 0
    }
    return crcTablosu
  }

  function crc32 (baytlar) {
    const tablo = crcTablosunuHazirla()
    let crc = 0xffffffff
    for (let i = 0; i < baytlar.length; i++) {
      crc = tablo[(crc ^ baytlar[i]) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
  }

  // --- PNG -------------------------------------------------------------------

  const PNG_IMZASI = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  function pngMi (baytlar) {
    return PNG_IMZASI.every((deger, i) => baytlar[i] === deger)
  }

  function parcaTuru (baytlar, konum) {
    return String.fromCharCode(
      baytlar[konum + 4], baytlar[konum + 5], baytlar[konum + 6], baytlar[konum + 7]
    )
  }

  function otuzIkiBitOku (baytlar, konum) {
    return (
      (baytlar[konum] << 24) | (baytlar[konum + 1] << 16) |
      (baytlar[konum + 2] << 8) | baytlar[konum + 3]
    ) >>> 0
  }

  function otuzIkiBitYaz (hedef, konum, deger) {
    hedef[konum] = (deger >>> 24) & 0xff
    hedef[konum + 1] = (deger >>> 16) & 0xff
    hedef[konum + 2] = (deger >>> 8) & 0xff
    hedef[konum + 3] = deger & 0xff
  }

  function pHYsParcasi (dpi) {
    const metreBasinaPiksel = Math.round(dpi * INC_METRE)
    const parca = new Uint8Array(21) // 4 uzunluk + 4 tur + 9 veri + 4 crc

    otuzIkiBitYaz(parca, 0, 9)
    parca.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
    otuzIkiBitYaz(parca, 8, metreBasinaPiksel)
    otuzIkiBitYaz(parca, 12, metreBasinaPiksel)
    parca[16] = 1 // birim: metre

    otuzIkiBitYaz(parca, 17, crc32(parca.subarray(4, 17)))
    return parca
  }

  // pHYs parcasi IHDR'den hemen sonra eklenir; varsa eskisi atilir.
  function pngDpiYaz (baytlar, dpi) {
    if (!pngMi(baytlar)) throw new Error('PNG imzasi bulunamadı.')

    const parcalar = []
    let konum = PNG_IMZASI.length

    while (konum < baytlar.length) {
      const uzunluk = otuzIkiBitOku(baytlar, konum)
      const tur = parcaTuru(baytlar, konum)
      const bitis = konum + 12 + uzunluk

      if (tur !== 'pHYs') parcalar.push({ tur, veri: baytlar.subarray(konum, bitis) })
      konum = bitis
      if (tur === 'IEND') break
    }

    const yeni = pHYsParcasi(dpi)
    const ihdrSirasi = parcalar.findIndex((parca) => parca.tur === 'IHDR')
    parcalar.splice(ihdrSirasi + 1, 0, { tur: 'pHYs', veri: yeni })

    const toplamUzunluk = PNG_IMZASI.length +
      parcalar.reduce((toplam, parca) => toplam + parca.veri.length, 0)
    const sonuc = new Uint8Array(toplamUzunluk)

    sonuc.set(PNG_IMZASI, 0)
    let yazma = PNG_IMZASI.length
    for (const parca of parcalar) {
      sonuc.set(parca.veri, yazma)
      yazma += parca.veri.length
    }

    return sonuc
  }

  // --- JPEG ------------------------------------------------------------------

  function jpegMi (baytlar) {
    return baytlar[0] === 0xff && baytlar[1] === 0xd8
  }

  // JFIF basligindaki yogunluk alanlarini gunceller; baslik yoksa eklenir.
  function jpegDpiYaz (baytlar, dpi) {
    if (!jpegMi(baytlar)) throw new Error('JPEG imzasi bulunamadı.')

    const yogunluk = Math.round(dpi)
    const jfifMi = baytlar[2] === 0xff && baytlar[3] === 0xe0 &&
      baytlar[6] === 0x4a && baytlar[7] === 0x46 &&
      baytlar[8] === 0x49 && baytlar[9] === 0x46

    if (jfifMi) {
      const sonuc = baytlar.slice()
      sonuc[13] = 1 // birim: inc
      sonuc[14] = (yogunluk >> 8) & 0xff
      sonuc[15] = yogunluk & 0xff
      sonuc[16] = (yogunluk >> 8) & 0xff
      sonuc[17] = yogunluk & 0xff
      return sonuc
    }

    // JFIF yoksa SOI'den hemen sonra eksiksiz bir APP0 eklenir.
    const app0 = new Uint8Array([
      0xff, 0xe0, 0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x02, // surum 1.02
      0x01, // birim: inc
      (yogunluk >> 8) & 0xff, yogunluk & 0xff,
      (yogunluk >> 8) & 0xff, yogunluk & 0xff,
      0x00, 0x00 // kucuk onizleme yok
    ])

    const sonuc = new Uint8Array(baytlar.length + app0.length)
    sonuc.set(baytlar.subarray(0, 2), 0)
    sonuc.set(app0, 2)
    sonuc.set(baytlar.subarray(2), 2 + app0.length)
    return sonuc
  }

  function dpiYaz (baytlar, dpi, tur) {
    return tur === 'png' ? pngDpiYaz(baytlar, dpi) : jpegDpiYaz(baytlar, dpi)
  }

  // --- Okuma (dogrulama icin) ------------------------------------------------

  function pngDpiOku (baytlar) {
    if (!pngMi(baytlar)) return null
    let konum = PNG_IMZASI.length

    while (konum < baytlar.length) {
      const uzunluk = otuzIkiBitOku(baytlar, konum)
      const tur = parcaTuru(baytlar, konum)
      if (tur === 'pHYs') {
        const birim = baytlar[konum + 16]
        const metreBasina = otuzIkiBitOku(baytlar, konum + 8)
        return birim === 1 ? Math.round(metreBasina / INC_METRE) : null
      }
      if (tur === 'IEND') break
      konum += 12 + uzunluk
    }
    return null
  }

  function jpegDpiOku (baytlar) {
    if (!jpegMi(baytlar)) return null
    if (!(baytlar[2] === 0xff && baytlar[3] === 0xe0)) return null
    if (baytlar[13] !== 1) return null
    return (baytlar[14] << 8) | baytlar[15]
  }

  function dpiOku (baytlar) {
    return pngMi(baytlar) ? pngDpiOku(baytlar) : jpegDpiOku(baytlar)
  }

  const metaveri = {
    INC_METRE,
    crc32,
    pngMi,
    jpegMi,
    pngDpiYaz,
    jpegDpiYaz,
    dpiYaz,
    pngDpiOku,
    jpegDpiOku,
    dpiOku
  }

  kok.HV = kok.HV || {}
  kok.HV.metaveri = metaveri

  if (typeof module !== 'undefined' && module.exports) module.exports = metaveri
})(typeof globalThis !== 'undefined' ? globalThis : this)
