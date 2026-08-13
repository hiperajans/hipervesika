'use strict'

// Tam cozunurluklu cikti uretimi.
//
// Onizleme kucultulmus kopya uzerinde calisir; burada ayni islemler kaynak
// goruntunun tam cozunurluklu haline tek seferde uygulanir. Sira onizlemedeki
// ile ayni olmak zorunda: dondurme + kirpma, arka plan beyazlatma, rotus,
// lekeler.

window.HV = window.HV || {}

window.HV.disaAktar = (() => {
  function tuvalOlustur (genislik, yukseklik) {
    const tuval = document.createElement('canvas')
    tuval.width = genislik
    tuval.height = yukseklik
    return tuval
  }

  // Dondurme ve kirpmayi tek donusumde uygular: cikti tuvalinin koordinatlari
  // dogrudan kirpma cercevesine karsilik gelir.
  function donusumuKur (ctx, gorsel, cerceve, olcek) {
    ctx.scale(olcek, olcek)
    ctx.translate(-cerceve.x, -cerceve.y)
    ctx.translate(gorsel.calisma.genislik / 2, gorsel.calisma.yukseklik / 2)
    if (gorsel.aci) ctx.rotate(-gorsel.aci)
  }

  function katmanCiz (hedef, gorsel, cerceve, olcek, kaynak) {
    const ctx = hedef.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.save()
    donusumuKur(ctx, gorsel, cerceve, olcek)
    ctx.drawImage(
      kaynak,
      -gorsel.asil.width / 2, -gorsel.asil.height / 2,
      gorsel.asil.width, gorsel.asil.height
    )
    ctx.restore()
    return hedef
  }

  // Kirpilmis, dondurulmus ve istenirse beyaz zeminli temel goruntu.
  function temelUret (gorsel, cerceve, olcek, cikti, maske) {
    const kisi = katmanCiz(
      tuvalOlustur(cikti.genislik, cikti.yukseklik), gorsel, cerceve, olcek, gorsel.asil
    )
    if (!maske) return kisi

    // Maske disi silinir, kalan kisi beyaz zemine yerlestirilir.
    const ctx = kisi.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    donusumuKur(ctx, gorsel, cerceve, olcek)
    ctx.drawImage(
      maske,
      -gorsel.asil.width / 2, -gorsel.asil.height / 2,
      gorsel.asil.width, gorsel.asil.height
    )
    ctx.restore()

    const sonuc = tuvalOlustur(cikti.genislik, cikti.yukseklik)
    const sonucCtx = sonuc.getContext('2d')
    sonucCtx.fillStyle = '#ffffff'
    sonucCtx.fillRect(0, 0, cikti.genislik, cikti.yukseklik)
    sonucCtx.drawImage(kisi, 0, 0)
    return sonuc
  }

  // Lekeler kaynak koordinatinda saklandigi icin once calisma uzayina, sonra
  // cikti pikseline cevrilir. Dondurme olcegi degistirmedigi icin yaricap
  // yalnizca olcek ile carpilir.
  function lekeleriCiz (tuval, gorsel, cerceve, olcek, lekeler) {
    const gorselOlcusu = { genislik: gorsel.asil.width, yukseklik: gorsel.asil.height }

    for (const leke of lekeler) {
      const calismaNoktasi = gorsel.aci
        ? window.HV.hizalama.calismayaTasi(leke, gorselOlcusu, gorsel.calisma, gorsel.aci)
        : leke

      window.HV.rotus.lekeKapat(
        tuval,
        { x: (calismaNoktasi.x - cerceve.x) * olcek, y: (calismaNoktasi.y - cerceve.y) * olcek },
        Math.max(1, leke.yaricap * olcek)
      )
    }
  }

  function tuvalUret ({ gorsel, cerceve, maske, rotusAyarlari, lekeler, olcuMm, dpi }) {
    const cikti = window.HV.olcu.ciktiBoyutu(olcuMm, dpi)
    const olcek = cikti.genislik / cerceve.genislik

    // temelUret her zaman yeni bir tuval uretir ve rotus.uygula ya onu ya da
    // yine yeni bir tuvali dondurur; ikisi de bize ait oldugu icin lekeler
    // dogrudan uzerine cizilebilir.
    let sonuc = temelUret(gorsel, cerceve, olcek, cikti, maske)
    sonuc = window.HV.rotus.uygula(sonuc, rotusAyarlari)
    if (lekeler.length) lekeleriCiz(sonuc, gorsel, cerceve, olcek, lekeler)

    return { tuval: sonuc, cikti }
  }

  async function baytlariUret (secenekler) {
    const { tuval, cikti } = tuvalUret(secenekler)
    const { tur, kalite, dpi } = secenekler

    const blob = await new Promise((cozumle) => {
      tuval.toBlob(cozumle, tur === 'png' ? 'image/png' : 'image/jpeg', kalite)
    })
    if (!blob) throw new Error('Görüntü kodlanamadı.')

    const ham = new Uint8Array(await blob.arrayBuffer())
    // Baski alan programlar fiziksel olcuyu bu bilgiden okuyor.
    return { baytlar: window.HV.metaveri.dpiYaz(ham, dpi, tur), cikti }
  }

  // "vesikalik-50x60mm-300dpi.jpg"
  function varsayilanAd (olcuMm, dpi, tur) {
    const olcu = `${olcuMm.genislikMm}x${olcuMm.yukseklikMm}`.replace(/\./g, ',')
    return `vesikalik-${olcu}mm-${dpi}dpi.${tur}`
  }

  return { tuvalUret, baytlariUret, varsayilanAd }
})()
