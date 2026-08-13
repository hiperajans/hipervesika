'use strict'

// Birden fazla fotograf birakildiginda acilan secim penceresinin saf hesaplari.
//
// Uygulama tek fotografla calisir: bu pencere yalnizca hangi fotografla
// calisilacagini sorar, secilen dosya normal yukleme yoluna girer. Yigin isleme
// yoktur; secimden sonra pencere kapanir ve mevcut akis degismez.

;(function (kok) {
  // Kucuk resmin uzun kenari (piksel). Izgarada 4 sutuna kadar cikildigi icin
  // bundan buyugu ekranda gorunmuyor, kucugu bulanik kaliyor.
  const KUCUK_RESIM = 320

  // Dosya adi kutunun altina tek satira sigmali.
  const AD_UZUNLUGU = 28

  // Secim penceresi yalnizca birden fazla fotograf varken anlamlidir; tek
  // fotograf eskisi gibi dogrudan yuklenir.
  function secimGerekli (dosyalar) {
    return (dosyalar?.length ?? 0) > 1
  }

  // Izgara sutun sayisi. Az sayida fotografta buyuk kutular, cok sayida
  // fotografta daha fazla sutun.
  function sutunSayisi (adet) {
    if (adet <= 2) return 2
    if (adet <= 6) return 3
    return 4
  }

  // Uzun dosya adini uzantisini koruyarak kisaltir: uzanti kullanicinin
  // fotografi ayirt etmesine yardim eder, atilmamali.
  function kisaAd (ad, enFazla = AD_UZUNLUGU) {
    if (typeof ad !== 'string' || ad.length <= enFazla) return ad ?? ''

    const nokta = ad.lastIndexOf('.')
    const uzanti = nokta > 0 ? ad.slice(nokta) : ''
    const govde = nokta > 0 ? ad.slice(0, nokta) : ad
    // Govdeye en az 4 karakter birakilir; aksi halde ad taninmaz olur.
    const kalan = Math.max(4, enFazla - uzanti.length - 1)

    return `${govde.slice(0, kalan)}…${uzanti}`
  }

  // Kucuk resmi en-boy oranini koruyarak kutuya sigdirir. Kucuk gorseller
  // buyutulmez; buyutmek yalnizca bulanik bir kutu verirdi.
  function kucukResimOlcusu (genislik, yukseklik, kutu = KUCUK_RESIM) {
    if (!(genislik > 0) || !(yukseklik > 0)) return { genislik: 1, yukseklik: 1 }

    const olcek = Math.min(1, kutu / Math.max(genislik, yukseklik))
    return {
      genislik: Math.max(1, Math.round(genislik * olcek)),
      yukseklik: Math.max(1, Math.round(yukseklik * olcek))
    }
  }

  // Klavye ile gezinme. adim +1/-1 yan yana, +sutun/-sutun alt alta hareket
  // eder. Uclarda basa doner: fotograf sayisi az oldugu icin donmek, kenarda
  // takilip kalmaktan daha rahat.
  function sonrakiSira (simdiki, adet, adim) {
    if (!(adet > 0)) return -1
    if (!Number.isInteger(simdiki) || simdiki < 0) return adim > 0 ? 0 : adet - 1
    return ((simdiki + adim) % adet + adet) % adet
  }

  const secim = {
    KUCUK_RESIM,
    AD_UZUNLUGU,
    secimGerekli,
    sutunSayisi,
    kisaAd,
    kucukResimOlcusu,
    sonrakiSira
  }

  kok.HV = kok.HV || {}
  kok.HV.secim = secim

  if (typeof module !== 'undefined' && module.exports) module.exports = secim
})(typeof globalThis !== 'undefined' ? globalThis : this)
