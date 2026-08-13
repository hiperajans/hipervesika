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
        'HEIC fotoğraflar şu an desteklenmiyor. Fotoğrafı JPG olarak dışa aktarıp tekrar deneyin.'
      )
    }

    if (!DESTEKLENEN.includes(uz) && !dosya.type.startsWith('image/')) {
      throw new Error('Desteklenmeyen dosya türü. JPG, PNG veya WEBP kullanın.')
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
      throw new Error('Fotoğraf okunamadı. Dosya bozuk olabilir.')
    }

    return {
      asil,
      onizleme: await onizlemeUret(asil),
      dosyaAdi: dosya.name,
      bayt: dosya.size,
      // Hizalama donmesi (radyan) ve donme sonrasi kullanilabilir alan.
      // Kaynak goruntu degismez; donme bir goruntuleme parametresidir.
      aci: 0,
      calisma: { genislik: asil.width, yukseklik: asil.height }
    }
  }

  function gorselMi (dosya) {
    const uz = uzanti(dosya.name)
    return dosya.type.startsWith('image/') || DESTEKLENEN.includes(uz) || HEIC.includes(uz)
  }

  // Surukle-birak ve panodan gelen verideki tum gorsel dosyalar. Birden fazlasi
  // birakildiginda secim penceresi bu listeyi gosterir.
  function veriDenGorselDosyalari (dataTransfer) {
    return Array.from(dataTransfer?.files ?? []).filter(gorselMi)
  }

  // Tek dosya bekleyen yollar (panodan yapistirma) icin ilki.
  function veriDenGorselDosya (dataTransfer) {
    return veriDenGorselDosyalari(dataTransfer)[0]
  }

  // Secim penceresindeki kucuk resim. Okunamayan ya da desteklenmeyen dosyada
  // dosyadanYukle ile ayni hatayi firlatir; kullanici sebebi kutunun uzerinde
  // gorur, secmeye calisip hata almaz.
  async function kucukResim (dosya, kutu) {
    bicimDenetle(dosya)

    let bitmap
    try {
      bitmap = await createImageBitmap(dosya, { imageOrientation: 'from-image' })
    } catch (hata) {
      throw new Error('Fotoğraf okunamadı. Dosya bozuk olabilir.')
    }

    const { width, height } = bitmap
    const olcu = window.HV.secim.kucukResimOlcusu(width, height, kutu)

    const tuval = document.createElement('canvas')
    tuval.width = olcu.genislik
    tuval.height = olcu.yukseklik
    const ctx = tuval.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, olcu.genislik, olcu.yukseklik)

    // Tam cozunurluklu bitmap 24 MP fotografta ~96 MB tutar; kucuk resim
    // cizildikten sonra beklemesi icin bir sebep yok.
    bitmap.close()

    return { tuval, genislik: width, yukseklik: height }
  }

  return {
    dosyadanYukle,
    veriDenGorselDosya,
    veriDenGorselDosyalari,
    kucukResim,
    DESTEKLENEN
  }
})()
