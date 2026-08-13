'use strict'

// Hizalama geometrisi: goz hattindan egiklik acisi, dondurulmus goruntunun
// kullanilabilir ic alani, nokta donusumu ve biyometrik kadraj hesabi.
//
// Saf hesap; DOM'a dokunmaz, Node'da birim testleriyle sinanir.

;(function (kok) {
  const olcu = (typeof module !== 'undefined' && module.exports)
    ? require('./olcu.js')
    : kok.HV.olcu

  // Biyometrik yerlesim olculeri. ICAO oneride yuz yuksekligi (cene-tepe)
  // fotografin %70-80'i, goz hatti alttan %50-60 arasinda olur; ortalari alindi.
  const YUZ_ORANI = 0.75
  const GOZ_HATTI_USTTEN = 0.45

  // Facemesh'in en ust noktasi (alin ortasi) sac cizgisinin biraz altinda kalir;
  // biyometrik olcunun istedigi tepe noktasi icin cene-alin vektoru uzatilir.
  const TEPE_CARPANI = 1.2

  // Bunun otesindeki bir egiklik olcumu muhtemelen hatali algilamadir; otomatik
  // dondurme bu deger ile sinirlanir.
  const EN_BUYUK_DONME_DERECE = 25

  const dereceye = (radyan) => (radyan * 180) / Math.PI
  const radyana = (derece) => (derece * Math.PI) / 180

  // Iki noktadan gecen dogrunun yatayla yaptigi aci (radyan), nokta sirasindan
  // bagimsiz olarak -90 ile +90 derece arasinda.
  //
  // Bu ayrim onemli: Human'in "leftEye" / "leftShoulder" dedigi noktalar
  // kisinin solu, yani goruntude SAGDA durur. Ham atan2 bu sirayla cagrildiginda
  // 180 derece civari bir deger uretir ve egiklik olcumu tamamen bozulur.
  function dogruEgimi (a, b) {
    let dx = b.x - a.x
    let dy = b.y - a.y
    if (dx < 0) {
      dx = -dx
      dy = -dy
    }
    return Math.atan2(dy, dx)
  }

  // Goz hattini yataya getirmek icin uygulanacak aci. Pozitif deger saat
  // yonunun tersine donduruldugu anlamina gelir.
  function egiklikAcisi (solGoz, sagGoz) {
    const ham = dogruEgimi(solGoz, sagGoz)
    const sinir = radyana(EN_BUYUK_DONME_DERECE)
    return Math.min(Math.max(ham, -sinir), sinir)
  }

  // Cene ve alin noktasindan tepe (kafa ustu) noktasini kestirir.
  function tepeNoktasi (cene, alin, carpan = TEPE_CARPANI) {
    return {
      x: cene.x + (alin.x - cene.x) * carpan,
      y: cene.y + (alin.y - cene.y) * carpan
    }
  }

  // Dondurulmus goruntunun icinde tamamen kalan, en buyuk alanli eksen hizali
  // dikdortgen. Dondurme sonrasi olusan bos koseler bu sayede calisma alaninin
  // disinda kalir ve kirpma cercevesi asla bos bolgeye giremez.
  // Not: sonucun orani kaynagin orani ile ayni degildir; en buyuk alanli
  // dikdortgen benzer olmak zorunda degil.
  function enBuyukIcKutu (genislik, yukseklik, aci) {
    if (genislik <= 0 || yukseklik <= 0) return { genislik: 0, yukseklik: 0 }

    const sinA = Math.abs(Math.sin(aci))
    const cosA = Math.abs(Math.cos(aci))
    const uzun = Math.max(genislik, yukseklik)
    const kisa = Math.min(genislik, yukseklik)
    const genislikDahaUzun = genislik >= yukseklik

    // Cok genis/dar dikdortgenlerde ve 45 derecede sinirlayici olan kisa kenardir.
    if (kisa <= 2 * sinA * cosA * uzun || Math.abs(sinA - cosA) < 1e-10) {
      const yarim = 0.5 * kisa
      return genislikDahaUzun
        ? { genislik: yarim / sinA, yukseklik: yarim / cosA }
        : { genislik: yarim / cosA, yukseklik: yarim / sinA }
    }

    const cosIki = cosA * cosA - sinA * sinA
    return {
      genislik: (genislik * cosA - yukseklik * sinA) / cosIki,
      yukseklik: (yukseklik * cosA - genislik * sinA) / cosIki
    }
  }

  // Kaynak goruntudeki bir noktayi, dondurulmus calisma uzayindaki karsiligina
  // tasir. Iki uzayin da merkezi ayni noktadir.
  function calismayaTasi (nokta, gorselOlcusu, calisma, aci) {
    const merkezX = gorselOlcusu.genislik / 2
    const merkezY = gorselOlcusu.yukseklik / 2
    const dx = nokta.x - merkezX
    const dy = nokta.y - merkezY

    // Goruntu -aci kadar donduruldugu icin noktalar da -aci ile donusur.
    const cos = Math.cos(-aci)
    const sin = Math.sin(-aci)

    return {
      x: calisma.genislik / 2 + dx * cos - dy * sin,
      y: calisma.yukseklik / 2 + dx * sin + dy * cos
    }
  }

  // calismayaTasi'nin tersi: calisma uzayindaki bir noktayi kaynak goruntudeki
  // karsiligina cevirir. Firca darbelerini maskeye yazarken gerekir.
  function kaynagaTasi (nokta, gorselOlcusu, calisma, aci) {
    const dx = nokta.x - calisma.genislik / 2
    const dy = nokta.y - calisma.yukseklik / 2

    const cos = Math.cos(aci)
    const sin = Math.sin(aci)

    return {
      x: gorselOlcusu.genislik / 2 + dx * cos - dy * sin,
      y: gorselOlcusu.yukseklik / 2 + dx * sin + dy * cos
    }
  }

  // Yuz olculerine gore biyometrik kadraj. Noktalar calisma uzayinda beklenir.
  function otomatikCerceve ({ cene, tepe, gozMerkezi, calisma, oran }) {
    const yuzYuksekligi = Math.hypot(tepe.x - cene.x, tepe.y - cene.y)

    let yukseklik = yuzYuksekligi / YUZ_ORANI
    let genislik = yukseklik * oran

    // Kadraj goruntuden buyuk cikarsa sigacak sekilde kucultulur.
    if (genislik > calisma.genislik) {
      genislik = calisma.genislik
      yukseklik = genislik / oran
    }
    if (yukseklik > calisma.yukseklik) {
      yukseklik = calisma.yukseklik
      genislik = yukseklik * oran
    }

    return olcu.sinirlaraTasi(
      {
        x: gozMerkezi.x - genislik / 2,
        y: gozMerkezi.y - yukseklik * GOZ_HATTI_USTTEN,
        genislik,
        yukseklik
      },
      calisma.genislik,
      calisma.yukseklik
    )
  }

  // Omuz cizgisinin yataydan sapmasi (radyan). Bilgi amaclidir; dondurme
  // kararini goz hatti verir.
  function omuzSapmasi (solOmuz, sagOmuz) {
    return dogruEgimi(solOmuz, sagOmuz)
  }

  const hizalama = {
    YUZ_ORANI,
    GOZ_HATTI_USTTEN,
    TEPE_CARPANI,
    EN_BUYUK_DONME_DERECE,
    dereceye,
    radyana,
    dogruEgimi,
    egiklikAcisi,
    tepeNoktasi,
    enBuyukIcKutu,
    calismayaTasi,
    kaynagaTasi,
    otomatikCerceve,
    omuzSapmasi
  }

  kok.HV = kok.HV || {}
  kok.HV.hizalama = hizalama

  if (typeof module !== 'undefined' && module.exports) module.exports = hizalama
})(typeof globalThis !== 'undefined' ? globalThis : this)
