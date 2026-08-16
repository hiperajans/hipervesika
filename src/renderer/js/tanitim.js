'use strict'

// Tanitim turu: uygulamanin gercek arayuzune tutunan adim adim aciklama.
//
// Adim listesi ve kart yerlestirme hesabi saftir (DOM'a dokunmaz), bu yuzden
// Node'da test edilir. Turu yuruten sinif ise DOM ile calisir.

;(function (kok) {
  // Isiklandirilan ogenin cevresinde birakilan bosluk (px).
  const ISIK_BOSLUGU = 6
  // Kartin pencere kenarina en fazla yaklasabilecegi mesafe (px).
  const KENAR_BOSLUGU = 12
  // Kart ile isiklandirilan oge arasindaki mesafe (px).
  const ARA = 14

  // hedef: CSS secici. panel: kartin hangi adim sekmesinde gosterilecegi.
  // tercih: kartin hedefe gore tercih edilen yonu.
  const ADIMLAR = [
    {
      kod: 'karsilama',
      hedef: '.hv-adimlar',
      tercih: 'alt',
      baslik: 'Hoş geldiniz',
      metin: 'Vesikalık hazırlamak üç adımda biter: kadrajı kurun, görüntüyü ' +
        'düzeltin, kağıda dizip basın. Sağdaki şeritten adımlar arasında geçersiniz.'
    },
    {
      kod: 'fotograf',
      hedef: '#btn-dosya-sec',
      tercih: 'alt',
      baslik: 'Fotoğrafı açın',
      metin: 'Fotoğrafı çalışma alanına sürükleyip bırakabilir, panodan ' +
        'yapıştırabilir ya da bu düğmeyle seçebilirsiniz. JPG, PNG ve WEBP okunur.'
    },
    {
      kod: 'hizalama',
      panel: 'kadraj',
      hedef: '#btn-otomatik-hizala',
      tercih: 'sol',
      baslik: 'Otomatik hizalama',
      metin: 'Yüzü bulur, omuz hattına göre eğikliği düzeltir ve seçtiğiniz ' +
        'ölçünün kadrajını kurar. Kadrajı sonradan köşelerinden tutup ' +
        'değiştirebilirsiniz.'
    },
    {
      kod: 'olcu',
      panel: 'kadraj',
      hedef: '#onayar-secimi',
      tercih: 'sol',
      baslik: 'Vesikalık ölçüsü',
      metin: 'Hazır ölçülerden seçin ya da milimetre olarak kendiniz girin. ' +
        'Ölçü yalnızca boyutu değil kadrajı da belirler: biyometrikte baş ' +
        'fotoğrafı doldurur, klasik vesikalıkta omuzlar görünür. Sık ' +
        'kullandığınız ölçüyü "Ölçüyü kaydet" ile listeye ekleyebilirsiniz.'
    },
    {
      kod: 'rotus',
      panel: 'rotus',
      hedef: '#arkaplan-beyazlat',
      tercih: 'sol',
      baslik: 'Arka plan ve rötuş',
      metin: 'Arka planı beyaza çevirir. Kalan kenarları üstteki Sil ve Geri ' +
        'getir fırçalarıyla düzeltir, lekeleri Leke aracıyla tek tıkla temizlersiniz.'
    },
    {
      kod: 'dizme',
      panel: 'cikti',
      hedef: '#kagit-onayari',
      tercih: 'sol',
      baslik: 'Kağıda dizme',
      metin: 'Baskı kağıdını seçin; uygulama kaç adet sığdığını kendisi hesaplar. ' +
        'Üstteki Sayfa görünümüne geçerek dizilmiş hâli görebilirsiniz.'
    },
    {
      kod: 'baski',
      panel: 'cikti',
      hedef: '#btn-sayfayi-bas',
      tercih: 'sol',
      baslik: 'Baskı ve kaydetme',
      metin: 'Sayfa kağıt ölçüsünde basılır. PDF ya da görüntü olarak da ' +
        'kaydedebilirsiniz. Turu Yardım menüsünden yeniden başlatabilirsiniz.'
    }
  ]

  // Isiklandirilacak alan: hedefin kutusu biraz genisletilir.
  function isikAlani (hedefKutusu, bosluk = ISIK_BOSLUGU) {
    return {
      x: hedefKutusu.x - bosluk,
      y: hedefKutusu.y - bosluk,
      genislik: hedefKutusu.genislik + bosluk * 2,
      yukseklik: hedefKutusu.yukseklik + bosluk * 2
    }
  }

  function sayiyiSinirla (deger, enKucuk, enBuyuk) {
    // Alan karta yetmiyorsa en az sol/ust kenarda kalsin.
    if (enBuyuk < enKucuk) return enKucuk
    return Math.min(Math.max(deger, enKucuk), enBuyuk)
  }

  // Kartin verilen yonde alacagi konum. Sigmazsa null doner.
  function yonKonumu (yon, isik, kart, pencere) {
    const ortaX = isik.x + isik.genislik / 2 - kart.genislik / 2
    const ortaY = isik.y + isik.yukseklik / 2 - kart.yukseklik / 2

    if (yon === 'sol') {
      const x = isik.x - ARA - kart.genislik
      return x < KENAR_BOSLUGU ? null : { x, y: ortaY }
    }
    if (yon === 'sag') {
      const x = isik.x + isik.genislik + ARA
      return x + kart.genislik > pencere.genislik - KENAR_BOSLUGU ? null : { x, y: ortaY }
    }
    if (yon === 'ust') {
      const y = isik.y - ARA - kart.yukseklik
      return y < KENAR_BOSLUGU ? null : { x: ortaX, y }
    }
    const y = isik.y + isik.yukseklik + ARA
    return y + kart.yukseklik > pencere.yukseklik - KENAR_BOSLUGU ? null : { x: ortaX, y }
  }

  // Kart once tercih edilen yone, sigmazsa sirayla diger yonlere konur; hicbiri
  // sigmazsa tercih edilen yon pencerenin icine cekilir.
  function kartKonumu ({ isik, kart, pencere, tercih = 'alt' }) {
    const sira = [tercih, ...['sag', 'sol', 'alt', 'ust'].filter((y) => y !== tercih)]

    let secilen = null
    let secilenYon = tercih
    for (const yon of sira) {
      const konum = yonKonumu(yon, isik, kart, pencere)
      if (konum) {
        secilen = konum
        secilenYon = yon
        break
      }
    }

    const ham = secilen ?? yonKonumu(tercih, isik, kart, pencere) ?? {
      x: isik.x + isik.genislik / 2 - kart.genislik / 2,
      y: isik.y + isik.yukseklik + ARA
    }

    return {
      yon: secilenYon,
      x: Math.round(sayiyiSinirla(
        ham.x, KENAR_BOSLUGU, pencere.genislik - kart.genislik - KENAR_BOSLUGU)),
      y: Math.round(sayiyiSinirla(
        ham.y, KENAR_BOSLUGU, pencere.yukseklik - kart.yukseklik - KENAR_BOSLUGU))
    }
  }

  // Hedefi bulunamayan adim atlanir: arayuz degisirse tur kirilmaz, kisalir.
  function gecerliAdimlar (adimlar, hedefVarMi) {
    return adimlar.filter((adim) => hedefVarMi(adim.hedef))
  }

  const tanitim = {
    ADIMLAR,
    ISIK_BOSLUGU,
    KENAR_BOSLUGU,
    ARA,
    isikAlani,
    yonKonumu,
    kartKonumu,
    gecerliAdimlar
  }

  kok.HV = kok.HV || {}
  kok.HV.tanitim = tanitim

  if (typeof module !== 'undefined' && module.exports) module.exports = tanitim
})(typeof globalThis !== 'undefined' ? globalThis : this)
