'use strict'

// Arka plan beyazlatma: kisi maskesini cikarir, kenarini ayarlar ve goruntuyu
// beyaz zemin uzerine birlestirir.
//
// Maske kaynak goruntunun kucultulmus bir kopyasinda tutulur (kaynak uzayinda,
// dondurmeden bagimsiz). Kaynak pikseller degismez; beyazlatma bir goruntuleme
// parametresidir ve disa aktarmada tam cozunurlukte yeniden uygulanir.

;(function (kok) {
  // Segmentasyon modeli. selfie ve meet modelleri denendi; bu goruntulerde
  // bos maske urettikleri icin alpha matte veren rvm secildi.
  const MODEL = 'rvm.json'

  // Maske cozunurlugu. Daha yuksek deger sac kenarlarinda biraz daha ayrinti
  // verir ama segmentasyon ve firca islemlerini yavaslatir.
  const MASKE_UZUN_KENAR = 1536

  // Kenar egrisinin dikligi. Yumusak alpha bandini yeniden keskinlestirir;
  // cok yuksek deger sac tellerini yok eder.
  const EGRI_SERTLIGI = 3

  // Saf hesap: alpha kanalina genislet/daralt egrisi uygular.
  // genislet: -1 ile +1 arasi. Pozitif deger maskeyi buyutur (arka plan azalir).
  //
  // Egri, tam saydam ve tam opak bolgeleri yerinde birakip yalnizca yumusak
  // kenar bandini kaydirir; sabit bir toplama islemi tum goruntuyu kirletirdi.
  function alphaEgrisi (veri, genislet, sertlik = EGRI_SERTLIGI) {
    const esik = 0.5 - genislet

    for (let i = 3; i < veri.length; i += 4) {
      const a = veri[i] / 255
      const yeni = (a - esik) * sertlik + 0.5
      veri[i] = Math.max(0, Math.min(1, yeni)) * 255
    }

    return veri
  }

  function kucultulmusTuval (bitmap, uzunKenarSiniri) {
    const uzunKenar = Math.max(bitmap.width, bitmap.height)
    const olcek = uzunKenar > uzunKenarSiniri ? uzunKenarSiniri / uzunKenar : 1

    const tuval = document.createElement('canvas')
    tuval.width = Math.max(1, Math.round(bitmap.width * olcek))
    tuval.height = Math.max(1, Math.round(bitmap.height * olcek))
    tuval.getContext('2d').drawImage(bitmap, 0, 0, tuval.width, tuval.height)

    return tuval
  }

  // Segmentasyon ciktisindan yalnizca alpha kanalini tutar; renk bilgisi asil
  // goruntuden gelecegi icin maske beyaz + alpha olarak saklanir.
  function alphayaIndirge (kaynakTuval) {
    const ctx = kaynakTuval.getContext('2d')
    const goruntu = ctx.getImageData(0, 0, kaynakTuval.width, kaynakTuval.height)
    const veri = goruntu.data

    for (let i = 0; i < veri.length; i += 4) {
      veri[i] = 255
      veri[i + 1] = 255
      veri[i + 2] = 255
    }

    ctx.putImageData(goruntu, 0, 0)
    return kaynakTuval
  }

  // Segmentasyon orani: model goruntuyu bu oranda kucultup calisiyor.
  const ORAN = 0.5

  // rvm bir video modeli: her calistirmada yinelemeli bir durum uretip bir
  // sonraki calistirmaya tasiyor. Vesikalikta kareler birbirinden bagimsiz,
  // ustelik bu durum girdinin olcusune bagli; farkli olcude ikinci bir fotograf
  // maske isterken hata veriyordu:
  //   broadcastTo(): [1,38,29,64] cannot be broadcast to [1,32,32,64]
  // (Ilk fotograf 900x1200, ikincisi 1000x1000 iken olculdu.)
  //
  // Human durumu yalnizca oran degistiginde sifirdan kuruyor, disaridan
  // sifirlamanin baska bir yolu yok. Bu yuzden her istekte oran cok kucuk bir
  // miktar oynatilir: iki deger de yuvarlandiginda ayni ic olcuyu verir
  // (1536 x 0.500001 = 768.0015 -> 768), fark yalnizca durumu sifirlamaya
  // yarar. Boylece her maske, uygulama yeni acilmis gibi hesaplanir.
  const ORAN_TIKI = 0.000001
  let tikli = false

  function siradakiOran () {
    tikli = !tikli
    return tikli ? ORAN + ORAN_TIKI : ORAN
  }

  function segmentasyonAyari () {
    return {
      segmentation: { enabled: true, modelPath: MODEL, mode: 'default', ratio: siradakiOran() }
    }
  }

  // Modelin agirliklari acilista okunuyor ama ilk calistirmadaki shader
  // derlemesi de pahali; bu bedel ya ilk beyazlatmada ya da (kafa tepesi
  // maskeden okundugu icin) otomatik hizalamada kullaniciya cikiyordu. Isitma
  // bir kez bos bir tuval isleterek bunun bir bolumunu arka plana alir.
  async function isit () {
    const human = await kok.HV.yuz.hazirla()

    const tuval = document.createElement('canvas')
    tuval.width = 256
    tuval.height = 256
    const ctx = tuval.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tuval.width, tuval.height)

    await kok.HV.yuz.sirala(async () => {
      const tensor = await human.segmentation(tuval, segmentasyonAyari())
      if (tensor) human.tf.dispose(tensor)
    })
  }

  // Kisi maskesini uretir. Sonuc, kaynak goruntunun kucultulmus kopyasi
  // olcusunde, alpha kanali kisiyi gosteren bir tuvaldir.
  async function maskeCikar (bitmap) {
    const human = await kok.HV.yuz.hazirla()
    const girdi = kucultulmusTuval(bitmap, MASKE_UZUN_KENAR)

    // Sonucun tensorunden okunana kadar model baska bir is yapmamali; bu
    // yuzden tuvale aktarma da sira icinde kalir.
    return kok.HV.yuz.sirala(async () => {
      const tensor = await human.segmentation(girdi, segmentasyonAyari())

      if (!tensor) throw new Error('Arka plan ayrılamadı.')

      const maske = document.createElement('canvas')
      maske.width = tensor.shape[1]
      maske.height = tensor.shape[0]

      try {
        await human.tf.browser.toPixels(tensor, maske)
      } finally {
        human.tf.dispose(tensor)
      }

      return alphayaIndirge(maske)
    })
  }

  // Maskenin kac pikselinin kisiye ait oldugu; bos maskeyi anlamak icin.
  function maskeKapsami (maske) {
    const veri = maske.getContext('2d')
      .getImageData(0, 0, maske.width, maske.height).data

    let kisi = 0
    for (let i = 3; i < veri.length; i += 4) if (veri[i] > 127) kisi++

    return kisi / (veri.length / 4)
  }

  // Maskede kafanin en ust noktasi. Yuz noktalarindan kestirilen tepe sac
  // hacmini hesaba katmadigi icin (olcumde 84-214 piksel asagida kaliyordu)
  // biyometrik kadraj bu degeri kullanir.
  //
  // Arama yalnizca yuz genisligi kadar bir sutun araliginda yapilir; aksi halde
  // kaldirilmis bir el ya da omuz kafa sanilirdi. Sonuc kaynak goruntunun
  // koordinat sisteminde y degeridir.
  function kafaTepesi (maske, { merkezX, yariGenislik, gorselGenislik }) {
    const olcek = maske.width / gorselGenislik
    const sol = Math.max(0, Math.round((merkezX - yariGenislik) * olcek))
    const sag = Math.min(maske.width - 1, Math.round((merkezX + yariGenislik) * olcek))
    if (sag < sol) return null

    const veri = maske.getContext('2d')
      .getImageData(0, 0, maske.width, maske.height).data

    for (let y = 0; y < maske.height; y++) {
      for (let x = sol; x <= sag; x++) {
        if (veri[(y * maske.width + x) * 4 + 3] > 127) return y / olcek
      }
    }

    return null
  }

  // Kullanicinin kenar ayarlarini uygulanmis yeni bir maske uretir.
  // Once genislet/daralt egrisi, sonra yumusatma: yumusatma en son uygulanir ki
  // istenen yumusaklik egri tarafindan yeniden keskinlestirilmesin.
  function maskeyiAyarla (maske, { genislet = 0, yumusat = 0 } = {}) {
    const egriliTuval = document.createElement('canvas')
    egriliTuval.width = maske.width
    egriliTuval.height = maske.height
    const egriliCtx = egriliTuval.getContext('2d')
    egriliCtx.drawImage(maske, 0, 0)

    if (genislet !== 0) {
      const goruntu = egriliCtx.getImageData(0, 0, maske.width, maske.height)
      alphaEgrisi(goruntu.data, genislet)
      egriliCtx.putImageData(goruntu, 0, 0)
    }

    if (yumusat <= 0) return egriliTuval

    const yumusakTuval = document.createElement('canvas')
    yumusakTuval.width = maske.width
    yumusakTuval.height = maske.height
    const yumusakCtx = yumusakTuval.getContext('2d')
    yumusakCtx.filter = `blur(${yumusat}px)`
    yumusakCtx.drawImage(egriliTuval, 0, 0)

    return yumusakTuval
  }

  // Goruntuyu maskeye gore beyaz zemin uzerine birlestirir.
  function beyazZemineBirlestir (bitmap, maske, hedefGenislik, hedefYukseklik) {
    const genislik = Math.max(1, Math.round(hedefGenislik))
    const yukseklik = Math.max(1, Math.round(hedefYukseklik))

    // Once kisi katmani: goruntu cizilir, maske disi silinir.
    const kisi = document.createElement('canvas')
    kisi.width = genislik
    kisi.height = yukseklik
    const kisiCtx = kisi.getContext('2d')
    kisiCtx.imageSmoothingQuality = 'high'
    kisiCtx.drawImage(bitmap, 0, 0, genislik, yukseklik)
    kisiCtx.globalCompositeOperation = 'destination-in'
    kisiCtx.drawImage(maske, 0, 0, genislik, yukseklik)

    // Sonra beyaz zemin uzerine yerlestirilir.
    const sonuc = document.createElement('canvas')
    sonuc.width = genislik
    sonuc.height = yukseklik
    const ctx = sonuc.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, genislik, yukseklik)
    ctx.drawImage(kisi, 0, 0)

    return sonuc
  }

  // Firca darbesi: maskeye dogrudan yazar. sil=true arka plan yapar,
  // sil=false kisiyi geri getirir.
  function fircaDarbesi (maske, nokta, yaricap, sil) {
    const ctx = maske.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = sil ? 'destination-out' : 'source-over'
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(nokta.x, nokta.y, yaricap, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const arkaplan = {
    MODEL,
    MASKE_UZUN_KENAR,
    EGRI_SERTLIGI,
    alphaEgrisi,
    isit,
    maskeCikar,
    maskeKapsami,
    kafaTepesi,
    maskeyiAyarla,
    beyazZemineBirlestir,
    fircaDarbesi
  }

  kok.HV = kok.HV || {}
  kok.HV.arkaplan = arkaplan

  if (typeof module !== 'undefined' && module.exports) module.exports = arkaplan
})(typeof globalThis !== 'undefined' ? globalThis : this)
