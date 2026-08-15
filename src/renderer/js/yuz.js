'use strict'

// Human kutuphanesi sarmalayicisi: yuz noktalari ve omuz konumlari.
// Modeller diskten yuklenir (vendor/human/models), internet gerekmez.

window.HV = window.HV || {}

window.HV.yuz = (() => {
  const MODEL_YOLU = 'vendor/human/models/'

  // Algilama tam cozunurlukte yapilmaz; 24 MP bir fotografta gereksiz yavas
  // olur ve dogruluga katkisi yoktur. Sonuc noktalari olcege bolunerek kaynak
  // koordinatlarina geri cevrilir.
  const ALGILAMA_UZUN_KENAR = 1280

  // MediaPipe facemesh nokta indeksleri (468 noktali agda sabittir).
  const NOKTA = {
    cene: 152,
    alin: 10,
    sagGozDis: 33,
    sagGozIc: 133,
    solGozDis: 263,
    solGozIc: 362
  }

  let human = null
  let hazirlik = null

  function sinifiBul () {
    // IIFE derlemesi surume gore Human'i farkli sekillerde disa aciyor.
    const kaynak = window.Human
    if (!kaynak) throw new Error('Human kutuphanesi yuklenemedi.')
    return kaynak.Human ?? kaynak.default ?? kaynak
  }

  // Human derlemesi 2 MB'in uzerinde; arayuzun ilk cizimini bekletmemek icin
  // betik etikete gomulmez, hazirla() cagrilinca eklenir. Arayuz bu cagriyi
  // acilistan hemen sonra arka planda yapar.
  function betigiYukle () {
    if (window.Human) return Promise.resolve()

    return new Promise((cozumle, reddet) => {
      const betik = document.createElement('script')
      betik.src = 'vendor/human/human.js'
      betik.addEventListener('load', () => cozumle())
      betik.addEventListener('error', () =>
        reddet(new Error('Human kutuphanesi yuklenemedi.')))
      document.head.append(betik)
    })
  }

  // Human ornegi tek ve icinde durum tutuyor; iki istek ust uste binince
  // sonuclar birbirine karisiyor (acilistaki isitma kullanicinin ilk istegiyle
  // cakisinca maske yanlis olcude donuyordu). Modeli calistiran her is buradan
  // sirayla gecer. Onceki is hata verse de sira ilerlemeli, bu yuzden iki dalda
  // da ayni is baslatilir.
  let sira = Promise.resolve()

  function sirala (is) {
    const sonuc = sira.then(is, is)
    sira = sonuc.catch(() => {})
    return sonuc
  }

  // Isitmalik goruntu: icerigi onemli degil, amac agin bir kez calismasi.
  function isitmaTuvali () {
    const tuval = document.createElement('canvas')
    tuval.width = 256
    tuval.height = 256
    const ctx = tuval.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tuval.width, tuval.height)
    return tuval
  }

  function hazirla () {
    if (hazirlik) return hazirlik

    hazirlik = (async () => {
      await betigiYukle()
      const Sinif = sinifiBul()
      const ornek = new Sinif({
        backend: 'webgl',
        modelBasePath: MODEL_YOLU,
        debug: false,
        // Duragan fotograf isliyoruz; onbellek karsilastirmasi kapatilir.
        cacheSensitivity: 0,
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { modelPath: 'blazeface.json', maxDetected: 4, minConfidence: 0.3 },
          mesh: { enabled: true, modelPath: 'facemesh.json' },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false }
        },
        body: { enabled: true, modelPath: 'movenet-lightning.json', minConfidence: 0.2 },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        // Segmentasyonun burada acik olmasi yalnizca modelin load() sirasinda
        // diskten okunmasini saglar; detect() bu modeli hic kullanmaz, agirligi
        // algilamaya binmez. Maske arkaplan.js icinde human.segmentation ile
        // ayrica istenir. Acik olmasaydi model ilk beyazlatmada (ve kafa tepesi
        // araniyorken hizalamada) yuklenir, kullaniciyi orada bekletirdi.
        segmentation: {
          enabled: true,
          modelPath: window.HV.arkaplan.MODEL,
          mode: 'default',
          ratio: 0.5
        }
      })

      await ornek.load()

      // Isitma: ilk gercek algilamada yapilacak shader derlemesi onceden
      // yapilir, boylece kullanicinin bekledigi an kisalir. Human'in kendi
      // warmup'i ornek goruntuyu data: adresinden getirdigi icin uygulamanin
      // guvenlik ilkesine (connect-src 'self') takiliyor ve cozulmeyen bir soz
      // birakiyor; onun yerine bos bir tuval isletilir. Zorunlu degildir,
      // basarisiz olursa yalnizca ilk algilama yavas kalir.
      try {
        await ornek.detect(isitmaTuvali())
      } catch {
        /* isitma zorunlu degil */
      }

      human = ornek
      return ornek
    })()

    // Basarisiz yukleme saklanmaz; aksi halde tek bir hata butun oturum
    // boyunca surer, kullanici yeniden denese de ayni sozu geri alirdi.
    hazirlik.catch(() => { hazirlik = null })

    return hazirlik
  }

  function kucult (bitmap) {
    const uzunKenar = Math.max(bitmap.width, bitmap.height)
    const olcek = uzunKenar > ALGILAMA_UZUN_KENAR ? ALGILAMA_UZUN_KENAR / uzunKenar : 1

    const tuval = document.createElement('canvas')
    tuval.width = Math.round(bitmap.width * olcek)
    tuval.height = Math.round(bitmap.height * olcek)
    tuval.getContext('2d').drawImage(bitmap, 0, 0, tuval.width, tuval.height)

    return { tuval, olcek }
  }

  // Human'in nokta bicimleri surume gore dizi ya da nesne olabiliyor.
  function noktayaCevir (ham, olcek) {
    if (!ham) return null
    const x = Array.isArray(ham) ? ham[0] : ham.x
    const y = Array.isArray(ham) ? ham[1] : ham.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: x / olcek, y: y / olcek }
  }

  function ortaNokta (a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function yuzuCoz (yuzler, olcek) {
    if (!yuzler?.length) return null

    // Birden fazla yuz varsa en buyugu esas alinir; vesikalikta on plandaki
    // kisi odur.
    const yuz = yuzler.reduce((enBuyuk, aday) => {
      const alan = (aday.box?.[2] ?? 0) * (aday.box?.[3] ?? 0)
      const enBuyukAlan = (enBuyuk.box?.[2] ?? 0) * (enBuyuk.box?.[3] ?? 0)
      return alan > enBuyukAlan ? aday : enBuyuk
    })

    const ag = yuz.mesh
    if (!ag || ag.length <= NOKTA.solGozIc) return null

    const cene = noktayaCevir(ag[NOKTA.cene], olcek)
    const alin = noktayaCevir(ag[NOKTA.alin], olcek)
    const sagGozDis = noktayaCevir(ag[NOKTA.sagGozDis], olcek)
    const sagGozIc = noktayaCevir(ag[NOKTA.sagGozIc], olcek)
    const solGozDis = noktayaCevir(ag[NOKTA.solGozDis], olcek)
    const solGozIc = noktayaCevir(ag[NOKTA.solGozIc], olcek)

    if (!cene || !alin || !sagGozDis || !sagGozIc || !solGozDis || !solGozIc) return null

    return {
      cene,
      alin,
      // Goz merkezleri dis ve ic kose noktalarinin ortasi.
      sagGoz: ortaNokta(sagGozDis, sagGozIc),
      solGoz: ortaNokta(solGozDis, solGozIc),
      guven: yuz.score ?? yuz.faceScore ?? 0
    }
  }

  function omuzlariCoz (govdeler, olcek) {
    const govde = govdeler?.[0]
    if (!govde?.keypoints?.length) return null

    const bul = (ad) => govde.keypoints.find((k) => k.part === ad)
    const sol = bul('leftShoulder')
    const sag = bul('rightShoulder')
    if (!sol || !sag) return null

    // Dusuk guvenli omuz noktalari yaniltici bir sapma bildirir.
    if ((sol.score ?? 0) < 0.3 || (sag.score ?? 0) < 0.3) return null

    const solNokta = noktayaCevir(sol.position, olcek)
    const sagNokta = noktayaCevir(sag.position, olcek)
    if (!solNokta || !sagNokta) return null

    return { sol: solNokta, sag: sagNokta }
  }

  async function algila (bitmap) {
    const ornek = await hazirla()
    const { tuval, olcek } = kucult(bitmap)
    const sonuc = await sirala(() => ornek.detect(tuval))

    return {
      yuzSayisi: sonuc.face?.length ?? 0,
      yuz: yuzuCoz(sonuc.face, olcek),
      omuz: omuzlariCoz(sonuc.body, olcek)
    }
  }

  return { hazirla, sirala, algila, get hazirMi () { return human !== null } }
})()
