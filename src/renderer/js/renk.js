'use strict'

// Cikti renk duzeni: sRGB, gri tonlama ve CMYK.
//
// Onemli sinir: tarayicinin kodlayicisi (canvas.toBlob) yalnizca RGB uretir,
// CMYK JPEG yazamaz. Bu yuzden CMYK secildiginde yalnizca PDF gercek anlamda
// CMYK olur (DeviceCMYK olarak gomulur); JPG/PNG ve dogrudan baski sRGB kalir.
//
// Cevrim ICC profili kullanmaz, aygit cevrimidir. Matbaa kendi profiliyle
// ayirmak isterse sRGB vermek daha dogrudur; bu yuzden varsayilan sRGB'dir.

;(function (kok) {
  const RENK_DUZENLERI = [
    {
      kod: 'srgb',
      ad: 'sRGB (standart)',
      aciklama: 'Fotoğraf baskısı ve çevrimiçi başvurular için doğru seçim.'
    },
    {
      kod: 'gri',
      ad: 'Gri tonlama',
      aciklama: 'Renk bilgisi atılır; siyah-beyaz istenen çıktılar için.'
    },
    {
      kod: 'cmyk',
      ad: 'CMYK (yalnızca PDF)',
      aciklama: 'PDF, DeviceCMYK olarak yazılır. JPG/PNG ve doğrudan baskı ' +
        'sRGB kalır. Çevrim ICC profili kullanmaz; matbaanız kendi profilini ' +
        'uygulamak isterse sRGB verin.'
    }
  ]

  function duzenBul (kod) {
    return RENK_DUZENLERI.find((d) => d.kod === kod) ?? RENK_DUZENLERI[0]
  }

  function duzenGecerliMi (kod) {
    return RENK_DUZENLERI.some((d) => d.kod === kod)
  }

  // --- Saf cevrimler ---------------------------------------------------------

  // Rec. 709 parlaklik agirliklari: goz yesili kirmiziden, kirmiziyi maviden
  // daha parlak gorur.
  function griTonu (r, g, b) {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
  }

  // Aygit cevrimi (profilsiz). 255 = tam murekkep.
  function rgbdenCmyk (r, g, b) {
    const enBuyuk = Math.max(r, g, b)
    if (enBuyuk === 0) return [0, 0, 0, 255]

    const k = 255 - enBuyuk
    const pay = 255 - k
    return [
      Math.round(((enBuyuk - r) * 255) / pay),
      Math.round(((enBuyuk - g) * 255) / pay),
      Math.round(((enBuyuk - b) * 255) / pay),
      k
    ]
  }

  // Geri cevrim; yalnizca dogrulama ve onizleme icin.
  function cmyktenRgb (c, m, y, k) {
    const pay = 255 - k
    return [
      Math.round(255 - k - (c * pay) / 255),
      Math.round(255 - k - (m * pay) / 255),
      Math.round(255 - k - (y * pay) / 255)
    ]
  }

  // --- Tuval uzerinde uygulama ----------------------------------------------

  function griyeCevir (tuval) {
    const ctx = tuval.getContext('2d')
    const goruntu = ctx.getImageData(0, 0, tuval.width, tuval.height)
    const veri = goruntu.data

    for (let i = 0; i < veri.length; i += 4) {
      const gri = griTonu(veri[i], veri[i + 1], veri[i + 2])
      veri[i] = gri
      veri[i + 1] = gri
      veri[i + 2] = gri
    }

    ctx.putImageData(goruntu, 0, 0)
    return tuval
  }

  // Secilen duzeni tuvale uygular. CMYK, tuval uzerinde temsil edilemedigi icin
  // sRGB gibi davranir; CMYK cevrimi yalnizca PDF yazilirken yapilir.
  function duzeniUygula (tuval, kod) {
    if (kod === 'gri') return griyeCevir(tuval)
    return tuval
  }

  // ICC ayrimi icin ham RGB ucluleri: piksel basina 3 bayt. Cevrimi ana surec
  // Little CMS ile yapar (bkz. src/main/icc.js); burada yalnizca alfa atilir.
  function rgbBaytlari (tuval) {
    const ctx = tuval.getContext('2d')
    const veri = ctx.getImageData(0, 0, tuval.width, tuval.height).data
    const cikti = new Uint8Array((veri.length / 4) * 3)

    for (let kaynak = 0, hedef = 0; kaynak < veri.length; kaynak += 4, hedef += 3) {
      // Saydam piksel kagit beyazi sayilir; sayfada zemin zaten beyaz.
      const alfa = veri[kaynak + 3]
      cikti[hedef] = alfa === 0 ? 255 : veri[kaynak]
      cikti[hedef + 1] = alfa === 0 ? 255 : veri[kaynak + 1]
      cikti[hedef + 2] = alfa === 0 ? 255 : veri[kaynak + 2]
    }

    return cikti
  }

  // PDF'e gomulecek DeviceCMYK ornekleri: piksel basina 4 bayt.
  function cmykBaytlari (tuval) {
    const ctx = tuval.getContext('2d')
    const veri = ctx.getImageData(0, 0, tuval.width, tuval.height).data
    const cikti = new Uint8Array((veri.length / 4) * 4)

    for (let kaynak = 0, hedef = 0; kaynak < veri.length; kaynak += 4, hedef += 4) {
      // Saydam piksel kagit beyazi sayilir; sayfada zemin zaten beyaz.
      const alfa = veri[kaynak + 3]
      const [c, m, y, k] = alfa === 0
        ? [0, 0, 0, 0]
        : rgbdenCmyk(veri[kaynak], veri[kaynak + 1], veri[kaynak + 2])

      cikti[hedef] = c
      cikti[hedef + 1] = m
      cikti[hedef + 2] = y
      cikti[hedef + 3] = k
    }

    return cikti
  }

  const renk = {
    RENK_DUZENLERI,
    duzenBul,
    duzenGecerliMi,
    griTonu,
    rgbdenCmyk,
    cmyktenRgb,
    griyeCevir,
    duzeniUygula,
    rgbBaytlari,
    cmykBaytlari
  }

  kok.HV = kok.HV || {}
  kok.HV.renk = renk

  if (typeof module !== 'undefined' && module.exports) module.exports = renk
})(typeof globalThis !== 'undefined' ? globalThis : this)
