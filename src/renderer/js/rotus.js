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
    keskinlik: 0
  })

  const FILTRE_ID = 'hv-rotus-filtresi'

  // Sicaklik -1..+1 araliginda; bu carpan kanallarin ne kadar kayacagini belirler.
  const SICAKLIK_ETKISI = 0.25

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
  function uygula (kaynak, ayarlar) {
    if (varsayilanMi(ayarlar)) return kaynak

    let sonuc = kaynak

    const css = cssFiltresi(ayarlar)
    if (css !== 'none') sonuc = tuvalKopyala(sonuc, css)

    if (ayarlar.sicaklik !== 0 || ayarlar.keskinlik > 0) {
      filtreyiGuncelle(ayarlar)
      sonuc = tuvalKopyala(sonuc, `url(#${FILTRE_ID})`)
    }

    return sonuc
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
    varsayilanAyarlar,
    varsayilanMi,
    cssFiltresi,
    sicaklikMatrisi,
    keskinlikCekirdegi,
    ortalamaRenk,
    uygula,
    lekeKapat,
    lekeleriUygula
  }

  kok.HV = kok.HV || {}
  kok.HV.rotus = rotus

  if (typeof module !== 'undefined' && module.exports) module.exports = rotus
})(typeof globalThis !== 'undefined' ? globalThis : this)
