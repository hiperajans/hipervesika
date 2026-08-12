'use strict'

// Dosyadan goruntu yukleme. Tarayici API'leri disinda bir sey kullanmaz;
// dosya icerigi renderer'da File/Blob olarak islenir.

window.HV = window.HV || {}

window.HV.gorsel = (() => {
  const DESTEKLENEN = ['jpg', 'jpeg', 'png', 'webp']
  const HEIC = ['heic', 'heif']

  // Bu boyutun uzerindeki gorseller ekranda kucultulmus bir kopyayla gosterilir.
  // Asil goruntu tam cozunurlukte saklanir; disa aktarma onun uzerinden yapilir.
  const ONIZLEME_UZUN_KENAR = 3000

  function uzanti (dosyaAdi) {
    const nokta = dosyaAdi.lastIndexOf('.')
    return nokta === -1 ? '' : dosyaAdi.slice(nokta + 1).toLowerCase()
  }

  function bicimDenetle (dosya) {
    const uz = uzanti(dosya.name)

    if (HEIC.includes(uz)) {
      throw new Error(
        'HEIC fotograflar su an desteklenmiyor. Fotografi JPG olarak disa aktarip tekrar deneyin.'
      )
    }

    if (!DESTEKLENEN.includes(uz) && !dosya.type.startsWith('image/')) {
      throw new Error('Desteklenmeyen dosya turu. JPG, PNG veya WEBP kullanin.')
    }
  }

  // Ekranda gosterilecek kucultulmus kopya. Gorsel zaten kucukse asil goruntu
  // dondurulur, gereksiz kopya olusturulmaz.
  async function onizlemeUret (bitmap) {
    const uzunKenar = Math.max(bitmap.width, bitmap.height)
    if (uzunKenar <= ONIZLEME_UZUN_KENAR) return bitmap

    const oran = ONIZLEME_UZUN_KENAR / uzunKenar
    return createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * oran),
      resizeHeight: Math.round(bitmap.height * oran),
      resizeQuality: 'high'
    })
  }

  async function dosyadanYukle (dosya) {
    bicimDenetle(dosya)

    let asil
    try {
      // imageOrientation: 'from-image' EXIF yon bilgisini piksel verisine uygular;
      // bu olmadan telefon fotograflarinin cogu yan gorunur.
      asil = await createImageBitmap(dosya, { imageOrientation: 'from-image' })
    } catch (hata) {
      throw new Error('Fotograf okunamadi. Dosya bozuk olabilir.')
    }

    return {
      asil,
      onizleme: await onizlemeUret(asil),
      dosyaAdi: dosya.name,
      bayt: dosya.size
    }
  }

  // Surukle-birak ve panodan gelen veriden ilk gorsel dosyayi secer.
  function veriDenGorselDosya (dataTransfer) {
    return Array.from(dataTransfer?.files ?? []).find((dosya) => {
      const uz = uzanti(dosya.name)
      return dosya.type.startsWith('image/') || DESTEKLENEN.includes(uz) || HEIC.includes(uz)
    })
  }

  return { dosyadanYukle, veriDenGorselDosya, DESTEKLENEN }
})()
