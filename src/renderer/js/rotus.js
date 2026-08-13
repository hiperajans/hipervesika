'use strict'

// Rotus: parlaklik, kontrast, doygunluk, renk sicakligi, keskinlik ve leke
// temizleme.
//
// Ayarlar deger olarak tutulur, goruntuye yazilmaz; onizleme her degisiklikte
// kaynaktan yeniden uretilir, disa aktarmada ayni islem tam cozunurlukte
// tekrarlanir.
//
// Sicaklik ve keskinlik CSS filtrelerinde karsiligi olmadigi icin SVG filtresi
// ile yapilir. Olculdu: canvas'ta CSS filtreleri ile url(#id) ayni dizede
// zincirlenince sonuc siyah cikiyor, bu yuzden iki ayri gecis uygulanir.

;(function (kok) {
  const VARSAYILAN = Object.freeze({
    parlaklik: 1,
    kontrast: 1,
    doygunluk: 1,
    sicaklik: 0,
    keskinlik: 0,
    yumusatma: 0,
    gozCanliligi: 0
  })

  const FILTRE_ID = 'hv-rotus-filtresi'

  // Sicaklik -1..+1 araliginda; bu carpan kanallarin ne kadar kayacagini belirler.
  const SICAKLIK_ETKISI = 0.25

  // Cilt yumusatmada "ayrinti" sayilan parlaklik farki (0-255). Bunun altindaki
  // fark gozenek/ton gecisi kabul edilip yumusatilir, ustu (goz, kas, sac, kenar)
  // oldugu gibi kalir. Olculdu: 22 civari ten dokusunu alirken gozleri bozmuyor.
  const YUMUSATMA_ESIGI = 22

  // Bulanikligin yaricapi kaynak goruntunun yuksekliginin bu kadari olur; boylece
  // 2 MP ile 24 MP fotografta ayni gucte gorunur.
  const YUMUSATMA_ORANI = 0.0026

  // Goz canlandirmanin en fazla ne kadar parlaklik ekleyecegi.
  const GOZ_ETKISI = 0.5

  function varsayilanAyarlar () {
    return { ...VARSAYILAN }
  }

  function varsayilanMi (ayarlar) {
    return Object.keys(VARSAYILAN).every((anahtar) => ayarlar[anahtar] === VARSAYILAN[anahtar])
  }

  // --- Saf hesaplar ----------------------------------------------------------

  function cssFiltresi ({ parlaklik, kontrast, doygunluk }) {
    const parcalar = []
    if (parlaklik !== 1) parcalar.push(`brightness(${parlaklik})`)
    if (kontrast !== 1) parcalar.push(`contrast(${kontrast})`)
    if (doygunluk !== 1) parcalar.push(`saturate(${doygunluk})`)
    return parcalar.length ? parcalar.join(' ') : 'none'
  }

  // Pozitif deger sicak (kirmizi artar, mavi azalir), negatif deger soguk.
  function sicaklikMatrisi (sicaklik) {
    const k = sicaklik * SICAKLIK_ETKISI
    return [
      1 + k, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1 - k, 0, 0,
      0, 0, 0, 1, 0
    ]
  }

  // 3x3 keskinlestirme cekirdegi. Toplam 1 oldugu icin genel parlaklik degismez.
  function keskinlikCekirdegi (miktar) {
    // "|| 0" eksi sifiri engeller; SVG niteligine "-0" yazilmasin.
    const komsu = -miktar || 0

    return [
      0, komsu, 0,
      komsu, 1 + 4 * miktar, komsu,
      0, komsu, 0
    ]
  }

  // Yumusatma agirligi: ayrinti azaldikca 1'e yaklasir, esikte 0 olur.
  function yumusatmaAgirligi (ayrintiFarki, esik = YUMUSATMA_ESIGI) {
    if (esik <= 0) return 0
    const oran = Math.abs(ayrintiFarki) / esik
    return oran >= 1 ? 0 : 1 - oran
  }

  // Bulaniklik yaricapi hedef tuval pikseli cinsinden. olcek, hedef tuvalin
  // kaynak goruntuye orani (lekelerde kullanilan olcegin aynisi).
  function yumusatmaYaricapi (kaynakYukseklik, olcek) {
    return Math.max(0.6, kaynakYukseklik * YUMUSATMA_ORANI * olcek)
  }

  // Gozun icinde parlaklik: koyu tonlar daha cok, acik tonlar daha az acilir;
  // boylece goz akinda yanma olmaz.
  function gozParlakligi (deger, miktar) {
    const hedef = deger + (255 - deger) * 0.45
    return Math.round(deger + (hedef - deger) * miktar * GOZ_ETKISI)
  }

  // Goz cevresinin yaricapi iki goz arasindaki mesafeye baglidir; boylece
  // yakin cekim ile uzak cekimde ayni oranda etkiler.
  function gozYaricapi (sol, sag) {
    return Math.hypot(sol.x - sag.x, sol.y - sag.y) * 0.26
  }

  // Merkezden kenara yumusak azalma (0 kenarda, 1 merkezde).
  function gozAgirligi (uzaklik, yaricap) {
    if (yaricap <= 0 || uzaklik >= yaricap) return 0
    const oran = 1 - uzaklik / yaricap
    // Kare almak gecisi daha yumusak yapar.
    return oran * oran
  }

  // Leke temizlemede kullanilan halka orneklerinin ortalamasi.
  function ortalamaRenk (ornekler) {
    if (!ornekler.length) return null
    const toplam = ornekler.reduce(
      (t, [r, g, b]) => [t[0] + r, t[1] + g, t[2] + b],
      [0, 0, 0]
    )
    return toplam.map((deger) => Math.round(deger / ornekler.length))
  }

  // --- SVG filtresi ----------------------------------------------------------

  function filtreyiHazirla () {
    let filtre = document.getElementById(FILTRE_ID)
    if (filtre) return filtre

    const AD_ALANI = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(AD_ALANI, 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.position = 'absolute'

    filtre = document.createElementNS(AD_ALANI, 'filter')
    filtre.id = FILTRE_ID
    // sRGB olmazsa filtreler dogrusal renk uzayinda calisip beklenenden
    // farkli sonuc veriyor.
    filtre.setAttribute('color-interpolation-filters', 'sRGB')

    filtre.append(
      document.createElementNS(AD_ALANI, 'feColorMatrix'),
      document.createElementNS(AD_ALANI, 'feConvolveMatrix')
    )

    svg.append(filtre)
    document.body.append(svg)
    return filtre
  }

  function filtreyiGuncelle ({ sicaklik, keskinlik }) {
    const filtre = filtreyiHazirla()
    const [renkMatrisi, konvolusyon] = filtre.children

    renkMatrisi.setAttribute('type', 'matrix')
    renkMatrisi.setAttribute('values', sicaklikMatrisi(sicaklik).join(' '))

    if (keskinlik > 0) {
      konvolusyon.setAttribute('order', '3')
      konvolusyon.setAttribute('kernelMatrix', keskinlikCekirdegi(keskinlik).join(' '))
    } else {
      // Birim cekirdek: keskinlestirme kapali.
      konvolusyon.setAttribute('order', '1')
      konvolusyon.setAttribute('kernelMatrix', '1')
    }
    konvolusyon.setAttribute('preserveAlpha', 'true')
  }

  // --- Uygulama --------------------------------------------------------------

  function tuvalKopyala (kaynak, filtre) {
    const hedef = document.createElement('canvas')
    hedef.width = kaynak.width
    hedef.height = kaynak.height
    const ctx = hedef.getContext('2d')
    if (filtre) ctx.filter = filtre
    ctx.drawImage(kaynak, 0, 0)
    return hedef
  }

  // Ayarlari uygular ve yeni bir tuval dondurur. Hicbir ayar degismemisse
  // kaynak oldugu gibi dondurulur, bosuna kopya alinmaz.
  // olcek ve kaynakYukseklik yalnizca cilt yumusatma icin gerekir: bulaniklik
  // yaricapi kaynak goruntuye gore hesaplanir, boylece onizleme ile cikti ayni
  // gucte gorunur.
  function uygula (kaynak, ayarlar, { olcek = 1, kaynakYukseklik = 0 } = {}) {
    if (varsayilanMi(ayarlar)) return kaynak

    let sonuc = kaynak

    const css = cssFiltresi(ayarlar)
    if (css !== 'none') sonuc = tuvalKopyala(sonuc, css)

    // Yumusatma keskinlestirmeden once gelir: sira tersi olsa keskinlestirilen
    // dokuyu hemen geri bulanik yapardik.
    if (ayarlar.yumusatma > 0 && kaynakYukseklik > 0) {
      sonuc = ciltYumusat(sonuc, {
        miktar: ayarlar.yumusatma,
        yaricap: yumusatmaYaricapi(kaynakYukseklik, olcek)
      })
    }

    if (ayarlar.sicaklik !== 0 || ayarlar.keskinlik > 0) {
      filtreyiGuncelle(ayarlar)
      sonuc = tuvalKopyala(sonuc, `url(#${FILTRE_ID})`)
    }

    return sonuc
  }

  // --- Cilt yumusatma --------------------------------------------------------

  // Yuzey bulanikligi: bulanik kopya ile karistirilir ama yalnizca ayrintinin
  // az oldugu yerlerde. Boylece ten dokusu yumusar, goz-kas-sac keskin kalir.
  function ciltYumusat (kaynak, { miktar, yaricap }) {
    if (miktar <= 0 || yaricap <= 0) return kaynak

    const hedef = tuvalKopyala(kaynak, null)
    const ctx = hedef.getContext('2d')
    const bulanik = tuvalKopyala(kaynak, `blur(${yaricap}px)`)

    const asilVeri = ctx.getImageData(0, 0, hedef.width, hedef.height)
    const bulanikVeri = bulanik.getContext('2d')
      .getImageData(0, 0, hedef.width, hedef.height).data
    const veri = asilVeri.data

    for (let i = 0; i < veri.length; i += 4) {
      // Saydam pikselde islem yapmak kenarlarda hayalet olusturur.
      if (veri[i + 3] === 0) continue

      const asilLuma = 0.2126 * veri[i] + 0.7152 * veri[i + 1] + 0.0722 * veri[i + 2]
      const bulanikLuma = 0.2126 * bulanikVeri[i] + 0.7152 * bulanikVeri[i + 1] +
        0.0722 * bulanikVeri[i + 2]

      const agirlik = yumusatmaAgirligi(asilLuma - bulanikLuma) * miktar
      if (agirlik <= 0) continue

      veri[i] += (bulanikVeri[i] - veri[i]) * agirlik
      veri[i + 1] += (bulanikVeri[i + 1] - veri[i + 1]) * agirlik
      veri[i + 2] += (bulanikVeri[i + 2] - veri[i + 2]) * agirlik
    }

    ctx.putImageData(asilVeri, 0, 0)
    return hedef
  }

  // --- Goz canlandirma -------------------------------------------------------

  // Verilen noktalarin cevresini yumusak gecisle acar. Noktalar hedef tuvalin
  // koordinatindadir; cevrimi cagiran yapar (lekelerde oldugu gibi).
  function gozleriCanlandir (kaynak, noktalar, miktar) {
    if (miktar <= 0 || !noktalar.length) return kaynak

    const hedef = tuvalKopyala(kaynak, null)
    const ctx = hedef.getContext('2d')

    for (const nokta of noktalar) {
      const yaricap = Math.max(2, nokta.yaricap)
      const solX = Math.max(0, Math.floor(nokta.x - yaricap))
      const ustY = Math.max(0, Math.floor(nokta.y - yaricap))
      const sagX = Math.min(hedef.width, Math.ceil(nokta.x + yaricap))
      const altY = Math.min(hedef.height, Math.ceil(nokta.y + yaricap))
      if (sagX <= solX || altY <= ustY) continue

      const alan = ctx.getImageData(solX, ustY, sagX - solX, altY - ustY)
      const veri = alan.data

      for (let y = ustY; y < altY; y++) {
        for (let x = solX; x < sagX; x++) {
          const uzaklik = Math.hypot(x - nokta.x, y - nokta.y)
          const agirlik = gozAgirligi(uzaklik, yaricap)
          if (agirlik <= 0) continue

          const i = ((y - ustY) * alan.width + (x - solX)) * 4
          if (veri[i + 3] === 0) continue

          for (let kanal = 0; kanal < 3; kanal++) {
            veri[i + kanal] = gozParlakligi(veri[i + kanal], miktar * agirlik)
          }
        }
      }

      ctx.putImageData(alan, solX, ustY)
    }

    return hedef
  }

  // --- Leke temizleme --------------------------------------------------------

  // Lekenin cevresindeki halkadan renk ornekleri toplar.
  function halkaOrnekleri (ctx, nokta, yaricap) {
    const ornekler = []
    const halkaYaricapi = yaricap * 1.4

    for (let aci = 0; aci < Math.PI * 2; aci += Math.PI / 8) {
      const x = Math.round(nokta.x + Math.cos(aci) * halkaYaricapi)
      const y = Math.round(nokta.y + Math.sin(aci) * halkaYaricapi)
      if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue
      const veri = ctx.getImageData(x, y, 1, 1).data
      ornekler.push([veri[0], veri[1], veri[2]])
    }

    return ornekler
  }

  // Tek bir lekeyi kapatir: cevredeki ten rengini yumusak kenarli bir disk
  // olarak lekenin uzerine koyar.
  function lekeKapat (tuval, nokta, yaricap) {
    const ctx = tuval.getContext('2d')
    const renk = ortalamaRenk(halkaOrnekleri(ctx, nokta, yaricap))
    if (!renk) return

    const [r, g, b] = renk
    const gradyan = ctx.createRadialGradient(nokta.x, nokta.y, 0, nokta.x, nokta.y, yaricap)
    gradyan.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
    gradyan.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.95)`)
    gradyan.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

    ctx.save()
    ctx.fillStyle = gradyan
    ctx.beginPath()
    ctx.arc(nokta.x, nokta.y, yaricap, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Lekeler kaynak goruntu koordinatinda saklanir; hedef tuval kucultulmus
  // olabilecegi icin olcek ile cevrilir.
  function lekeleriUygula (kaynak, lekeler, olcek) {
    if (!lekeler.length) return kaynak

    const hedef = tuvalKopyala(kaynak, null)
    for (const leke of lekeler) {
      lekeKapat(hedef, { x: leke.x * olcek, y: leke.y * olcek }, Math.max(1, leke.yaricap * olcek))
    }
    return hedef
  }

  const rotus = {
    VARSAYILAN,
    SICAKLIK_ETKISI,
    YUMUSATMA_ESIGI,
    YUMUSATMA_ORANI,
    GOZ_ETKISI,
    varsayilanAyarlar,
    varsayilanMi,
    cssFiltresi,
    sicaklikMatrisi,
    keskinlikCekirdegi,
    ortalamaRenk,
    yumusatmaAgirligi,
    yumusatmaYaricapi,
    gozParlakligi,
    gozAgirligi,
    gozYaricapi,
    ciltYumusat,
    gozleriCanlandir,
    uygula,
    lekeKapat,
    lekeleriUygula
  }

  kok.HV = kok.HV || {}
  kok.HV.rotus = rotus

  if (typeof module !== 'undefined' && module.exports) module.exports = rotus
})(typeof globalThis !== 'undefined' ? globalThis : this)
