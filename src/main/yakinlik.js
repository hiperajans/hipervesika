'use strict'

// Arayuz olcegi (yakinlastirma) basamaklari.
//
// Bu dosya saf hesap icerir (Electron'a dokunmaz), boylece birim testlerinde
// dogrudan calistirilabilir. Olcegi gercekten uygulayan yer src/main/index.js;
// kisayolu tusa ceviren yer src/renderer/js/kisayol.js.

// Olcek basamaklari. Chromium'un kendi merdiveninin bu uygulamaya uyan bolumu:
// pencerenin en kucuk genisligi 960 px, %67'nin altinda panel ile tuval yan
// yana sigmiyor; %200'un ustunde de tuvalda fotograf gorunecek yer kalmiyor.
const BASAMAKLAR = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
const VARSAYILAN = 1

// Arayuzden gelebilecek komutlar. Ana surec arayuze guvenmedigi icin gelen
// deger bu listeye vurulur (bkz. ayarlar.js'teki ayni yaklasim).
const KOMUTLAR = ['buyut', 'kucult', 'sifirla']

// getZoomFactor() yazilan degeri birebir geri vermeyebilir; basamak ararken
// tam esitlik yerine bu tolerans kullanilir.
const TOLERANS = 0.001

const EN_KUCUK = BASAMAKLAR[0]
const EN_BUYUK = BASAMAKLAR[BASAMAKLAR.length - 1]

function komutGecerliMi (komut) {
  return KOMUTLAR.includes(komut)
}

function sinirla (carpan) {
  if (!Number.isFinite(carpan) || carpan <= 0) return VARSAYILAN
  return Math.min(Math.max(carpan, EN_KUCUK), EN_BUYUK)
}

// Verilen olcekten sonraki (yon > 0) ya da onceki (yon < 0) basamak. Merdivenin
// disinda bir degerden baslanirsa o yondeki ilk basamaga oturulur; boylece
// disaridan gelen bir olcek de merdivene doner. Uclarda deger degismez.
function sonrakiBasamak (carpan, yon) {
  const simdiki = sinirla(carpan)

  if (yon > 0) {
    return BASAMAKLAR.find((basamak) => basamak > simdiki + TOLERANS) ?? EN_BUYUK
  }

  for (let i = BASAMAKLAR.length - 1; i >= 0; i--) {
    if (BASAMAKLAR[i] < simdiki - TOLERANS) return BASAMAKLAR[i]
  }
  return EN_KUCUK
}

// Komutun verilen olcekte urettigi yeni olcek.
function yeniOlcek (carpan, komut) {
  if (komut === 'sifirla') return VARSAYILAN
  return sonrakiBasamak(carpan, komut === 'buyut' ? 1 : -1)
}

module.exports = {
  BASAMAKLAR,
  KOMUTLAR,
  VARSAYILAN,
  EN_KUCUK,
  EN_BUYUK,
  komutGecerliMi,
  sinirla,
  sonrakiBasamak,
  yeniOlcek
}
