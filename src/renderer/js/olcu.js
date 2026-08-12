'use strict'

// Olcu motoru: milimetre <-> piksel donusumu, on ayarlar ve kirpma cercevesi
// geometrisi. Bu dosya saf hesap icerir; DOM'a veya Electron'a dokunmaz, bu yuzden
// hem arayuzde hem Node'da (birim testlerinde) calisir.
//
// Kural: olculer milimetre cinsinden tutulur, piksele yalnizca cizim ve disa
// aktarma aninda cevrilir (bkz. docs/FAZLAR.md).

;(function (kok) {
  const INC_MM = 25.4

  // Kirpma cercevesinin inebilecegi en kucuk kenar (kaynak gorsel pikseli).
  const EN_KUCUK_KIRPMA = 32

  // Kullanicinin girebilecegi olcu araligi.
  const EN_KUCUK_MM = 10
  const EN_BUYUK_MM = 300

  // Baski icin yeterli sayilan cozunurluk. Bunun altinda goruntu buyutulerek
  // basilir ve yumusak cikar.
  const HEDEF_DPI = 300
  const DUSUK_DPI = 200

  const FOTOGRAF_ONAYARLARI = [
    { kod: 'tr-biyometrik', ad: 'Türkiye biyometrik', genislikMm: 50, yukseklikMm: 60 },
    { kod: 'icao', ad: 'ICAO / Schengen', genislikMm: 35, yukseklikMm: 45 },
    { kod: 'abd', ad: 'ABD (2×2 inç)', genislikMm: 51, yukseklikMm: 51 }
  ]

  const DPI_SECENEKLERI = [150, 300, 600]

  function mmDenPiksel (mm, dpi) {
    return (mm / INC_MM) * dpi
  }

  function pikselDenMm (piksel, dpi) {
    return (piksel / dpi) * INC_MM
  }

  function oran (genislikMm, yukseklikMm) {
    return genislikMm / yukseklikMm
  }

  // Secilen DPI'da uretilecek dosyanin piksel olculeri.
  function ciktiBoyutu (olcuMm, dpi) {
    return {
      genislik: Math.round(mmDenPiksel(olcuMm.genislikMm, dpi)),
      yukseklik: Math.round(mmDenPiksel(olcuMm.yukseklikMm, dpi))
    }
  }

  // Kirpilan alanin kac DPI'a denk geldigi: kaynakta gercekten var olan
  // cozunurluk budur, secilen DPI degil.
  function efektifDpi (kaynakPiksel, olcuMm) {
    if (olcuMm <= 0) return 0
    return kaynakPiksel / (olcuMm / INC_MM)
  }

  function cozunurlukDurumu (efektif) {
    if (efektif >= HEDEF_DPI) return 'iyi'
    if (efektif >= DUSUK_DPI) return 'sinirda'
    return 'dusuk'
  }

  function olcuGecerliMi (mm) {
    return Number.isFinite(mm) && mm >= EN_KUCUK_MM && mm <= EN_BUYUK_MM
  }

  // --- Kirpma cercevesi geometrisi -------------------------------------------
  // Cerceve kaynak gorselin piksel uzayinda tutulur: { x, y, genislik, yukseklik }

  // Verilen orana uyan, gorsele sigan en buyuk ortalanmis cerceve.
  function baslangicCercevesi (gorselGenislik, gorselYukseklik, istenenOran) {
    let genislik = gorselGenislik
    let yukseklik = genislik / istenenOran

    if (yukseklik > gorselYukseklik) {
      yukseklik = gorselYukseklik
      genislik = yukseklik * istenenOran
    }

    return {
      x: (gorselGenislik - genislik) / 2,
      y: (gorselYukseklik - yukseklik) / 2,
      genislik,
      yukseklik
    }
  }

  // Cerceveyi boyutunu bozmadan gorsel sinirlarinin icine geri iter.
  function sinirlaraTasi (cerceve, gorselGenislik, gorselYukseklik) {
    const genislik = Math.min(cerceve.genislik, gorselGenislik)
    const yukseklik = Math.min(cerceve.yukseklik, gorselYukseklik)

    return {
      x: Math.min(Math.max(cerceve.x, 0), gorselGenislik - genislik),
      y: Math.min(Math.max(cerceve.y, 0), gorselYukseklik - yukseklik),
      genislik,
      yukseklik
    }
  }

  // Bir koseden suruklerken yeni cerceve. Karsi kose sabit kalir, oran korunur,
  // cerceve gorsel disina tasmaz.
  //
  // kose: { sagda, altta } -> suruklenen kosenin hangi kenarlarda oldugu
  function koseIleBoyutlandir (cerceve, kose, imlec, istenenOran, gorselGenislik, gorselYukseklik) {
    // Sabit kose (suruklenenin karsisi) ve o koseden itibaren kullanilabilir alan.
    const capaX = kose.sagda ? cerceve.x : cerceve.x + cerceve.genislik
    const capaY = kose.altta ? cerceve.y : cerceve.y + cerceve.yukseklik

    const enFazlaGenislik = kose.sagda ? gorselGenislik - capaX : capaX
    const enFazlaYukseklik = kose.altta ? gorselYukseklik - capaY : capaY

    const istekGenislik = kose.sagda ? imlec.x - capaX : capaX - imlec.x
    const istekYukseklik = kose.altta ? imlec.y - capaY : capaY - imlec.y

    // Iki eksenden hangisi daha cok cekiliyorsa onu esas al, digerini orana gore turet.
    let genislik = Math.max(istekGenislik, istekYukseklik * istenenOran)

    // Once ust sinir: ne genislik ne de turetilen yukseklik gorseli asabilir.
    genislik = Math.min(genislik, enFazlaGenislik, enFazlaYukseklik * istenenOran)
    // Sonra alt sinir.
    genislik = Math.max(genislik, EN_KUCUK_KIRPMA, EN_KUCUK_KIRPMA * istenenOran)

    // Cok kucuk gorsellerde alt sinir ust siniri asabilir; o durumda sigan kadari.
    genislik = Math.min(genislik, enFazlaGenislik, enFazlaYukseklik * istenenOran)

    const yukseklik = genislik / istenenOran

    return {
      x: kose.sagda ? capaX : capaX - genislik,
      y: kose.altta ? capaY : capaY - yukseklik,
      genislik,
      yukseklik
    }
  }

  // Oran degistiginde mevcut cerceveyi ayni merkez etrafinda yeni orana uydurur.
  function oranaUydur (cerceve, istenenOran, gorselGenislik, gorselYukseklik) {
    const merkezX = cerceve.x + cerceve.genislik / 2
    const merkezY = cerceve.y + cerceve.yukseklik / 2

    // Alani kabaca koruyacak bir baslangic boyu.
    const alan = cerceve.genislik * cerceve.yukseklik
    let genislik = Math.sqrt(alan * istenenOran)
    let yukseklik = genislik / istenenOran

    if (genislik > gorselGenislik) {
      genislik = gorselGenislik
      yukseklik = genislik / istenenOran
    }
    if (yukseklik > gorselYukseklik) {
      yukseklik = gorselYukseklik
      genislik = yukseklik * istenenOran
    }

    return sinirlaraTasi(
      { x: merkezX - genislik / 2, y: merkezY - yukseklik / 2, genislik, yukseklik },
      gorselGenislik,
      gorselYukseklik
    )
  }

  const olcu = {
    INC_MM,
    EN_KUCUK_KIRPMA,
    EN_KUCUK_MM,
    EN_BUYUK_MM,
    HEDEF_DPI,
    DUSUK_DPI,
    FOTOGRAF_ONAYARLARI,
    DPI_SECENEKLERI,
    mmDenPiksel,
    pikselDenMm,
    oran,
    ciktiBoyutu,
    efektifDpi,
    cozunurlukDurumu,
    olcuGecerliMi,
    baslangicCercevesi,
    sinirlaraTasi,
    koseIleBoyutlandir,
    oranaUydur
  }

  kok.HV = kok.HV || {}
  kok.HV.olcu = olcu

  // Node'da birim testlerinden erisim icin.
  if (typeof module !== 'undefined' && module.exports) module.exports = olcu
})(typeof globalThis !== 'undefined' ? globalThis : this)
