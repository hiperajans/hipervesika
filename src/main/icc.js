'use strict'

// ICC profiliyle CMYK ayrimi.
//
// Uygulamanin kendi RGB -> CMYK cevrimi profilsizdir (aygit cevrimi, bkz.
// src/renderer/js/renk.js) ve matbaa isinde yetmiyor. Olculdu (U.S. Web Coated
// SWOP): profilsiz cevrim ten rengine %8 siyah karistiriyor, profilli cevrim
// hic karistirmiyor — vesikalikta yuz once bundan bozuluyor.
//
// Renk motoru Little CMS (lcms-wasm, MIT). Ana surecte calisir: WebAssembly'yi
// arayuzde calistirmak icerik guvenlik ilkesini gevsetmeyi gerektirirdi
// ('wasm-unsafe-eval'), oysa cevrim zaten burada, PDF yazilirken yapiliyor.
//
// Modul ESM oldugu icin ilk kullanimda dinamik import ile yuklenir; acilisa
// yuk bindirmez, CMYK secilmeyen oturumda hic okunmaz.

// Little CMS bicim kodlari. lcms-wasm bunlari disa acmiyor, tanimlari
// kutuphanenin kendi basliklarindan (lcms2.h) geliyor:
//   COLORSPACE_SH(PT) | CHANNELS_SH(n) | BYTES_SH(bayt)
const PT_RGB = 4
const PT_CMYK = 6
const TYPE_RGB_8 = (PT_RGB << 16) | (3 << 3) | 1
const TYPE_CMYK_8 = (PT_CMYK << 16) | (4 << 3) | 1

// Vesikalikta dogru olan bagil renk olcumu: gamut disindaki renkler en yakin
// basilabilir renge cekilir, gri dengesi korunur. Algisal niyet fotografik
// islerde tercih edilir ama profillerin cogunda tablosu yoktur ve sessizce
// bagila duser; acikca bagil istemek daha durust.
const NIYET_BAGIL = 1

// cmsInfoDescription — profilin insan okur adi.
const BILGI_ACIKLAMA = 0

let motor = null

async function hazirla () {
  motor ??= await (async () => {
    const lcms = await import('lcms-wasm')
    return lcms.instantiate()
  })()
  return motor
}

// Profili acar ve adiyla renk uzayini dondurur. Uygulama yalnizca CMYK
// profiliyle is yapabilir; RGB profili secen kullaniciya bunu soylemek gerek.
async function profilBilgisi (baytlar) {
  const lcms = await hazirla()
  const profil = lcms.cmsOpenProfileFromMem(baytlar, baytlar.byteLength)
  if (!profil) throw new Error('Profil okunamadı; dosya bozuk olabilir.')

  try {
    return {
      ad: lcms.cmsGetProfileInfoASCII(profil, BILGI_ACIKLAMA, 'en', 'US') || null,
      uzay: lcms.cmsGetColorSpaceASCII(profil)
    }
  } finally {
    lcms.cmsCloseProfile(profil)
  }
}

function cmykMi (uzay) {
  return typeof uzay === 'string' && uzay.trim().toUpperCase() === 'CMYK'
}

// RGB uclulerini (piksel basina 3 bayt) profile gore CMYK'ye cevirir; sonuc
// piksel basina 4 bayttir ve dogrudan pdf.cmykSayfaPdf'e verilir.
async function cmykeCevir ({ rgb, piksel, profilBaytlari }) {
  if (!(rgb instanceof Uint8Array) || rgb.length !== piksel * 3) {
    throw new Error('RGB verisi görüntü ölçüsüyle uyuşmuyor.')
  }

  const lcms = await hazirla()
  const hedef = lcms.cmsOpenProfileFromMem(profilBaytlari, profilBaytlari.byteLength)
  if (!hedef) throw new Error('Profil okunamadı; dosya bozuk olabilir.')

  const kaynak = lcms.cmsCreate_sRGBProfile()
  let cevirici = null

  try {
    if (!cmykMi(lcms.cmsGetColorSpaceASCII(hedef))) {
      throw new Error('Seçilen profil CMYK değil.')
    }

    cevirici = lcms.cmsCreateTransform(
      kaynak, TYPE_RGB_8, hedef, TYPE_CMYK_8, NIYET_BAGIL, 0
    )
    if (!cevirici) throw new Error('Renk çevrimi kurulamadı.')

    return lcms.cmsDoTransform(cevirici, rgb, piksel)
  } finally {
    if (cevirici) lcms.cmsDeleteTransform(cevirici)
    lcms.cmsCloseProfile(kaynak)
    lcms.cmsCloseProfile(hedef)
  }
}

module.exports = {
  TYPE_RGB_8,
  TYPE_CMYK_8,
  NIYET_BAGIL,
  hazirla,
  profilBilgisi,
  cmykMi,
  cmykeCevir
}
