'use strict'

// Acilis asamalari: uygulama acilirken yuklenen isler ve ilerleme hesabi.
//
// Asamalar kullaniciya tek tek gosterilmez — acilis penceresi "Açılıyor,
// lütfen bekleyiniz" der ve ilerlemeyi rayda gosterir. Liste yine de ortak
// tutulur, cunku iki taraf da ayni kodlari kullanir:
//   - ana pencere (renderer.js) isleri sirayla calistirir ve durum bildirir,
//   - acilis penceresi (acilis.js) raya ne kadar dolacagini buradan hesaplar.
//
// Saf hesap; DOM'a dokunmaz, Node'da birim testleriyle sinanir.

;(function (kok) {
  // Sira onemli: iki model de ayni ekran kartini kullaniyor, ust uste
  // binmesinler diye pespese calisirlar (bkz. yuz.js icindeki is sirasi).
  const ASAMALAR = ['yuz', 'arkaplan']

  const DURUMLAR = ['bekliyor', 'yukleniyor', 'hazir', 'hata']

  // Kullaniciya yazilan tek satir. Uygulamanin ne yaptigini degil, ne kadar
  // bekleyecegini anlatir; hangi modelin yuklendigi kullaniciyi ilgilendirmiyor.
  const YAZILAR = {
    normal: 'Açılıyor, lütfen bekleyiniz…',
    // Olculdu: ilk acilis ~23 sn (ekran kartinin onbellegi bos), sonraki
    // acilislar ~8 sn. Ilk seferde sessiz kalmak takilma izlenimi veriyordu.
    uzun: 'İlk açılış biraz uzun sürebilir, hazırlık sürüyor…',
    hata: 'Hazırlık tamamlanamadı, uygulama yine de açılıyor…'
  }

  // Bu sureden sonra hala bitmediyse uzun yaziya gecilir.
  const UZUN_SURE = 12000

  // Bildirim arayuzden ana surece, oradan acilis penceresine geciyor; iki uc
  // da ayni tanimi kullansin diye dogrulama burada.
  function bildirimGecerliMi (mesaj) {
    return ASAMALAR.includes(mesaj?.kod) && DURUMLAR.includes(mesaj?.durum)
  }

  // Ilerleme yuzdesi: biten asama tam, suren asama yarim sayilir. Yarim adim,
  // ilk model yuklenirken rayin kimildamasini saglar; bos bir ray uygulamanin
  // takildigi izlenimini veriyordu. Yuklenemeyen asama da bitmis sayilir,
  // aksi halde ray yarida kalirdi.
  function ilerleme (durumlar) {
    let deger = 0
    for (const kod of ASAMALAR) {
      const durum = durumlar?.[kod]
      if (durum === 'hazir' || durum === 'hata') deger += 1
      else if (durum === 'yukleniyor') deger += 0.5
    }
    return Math.round((deger / ASAMALAR.length) * 100)
  }

  const acilis = { ASAMALAR, DURUMLAR, YAZILAR, UZUN_SURE, bildirimGecerliMi, ilerleme }

  kok.HV = kok.HV || {}
  kok.HV.acilis = acilis

  if (typeof module !== 'undefined' && module.exports) module.exports = acilis
})(typeof globalThis !== 'undefined' ? globalThis : this)
