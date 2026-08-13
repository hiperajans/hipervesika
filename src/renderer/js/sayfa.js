'use strict'

// Baski sayfasi yerlesimi: kagida kac vesikalik sigdigini hesaplar ve
// konumlarini uretir.
//
// Tum olculer milimetredir; piksele yalnizca cizim ve baski aninda cevrilir.
// Hesap kismi saf oldugu icin Node'da test edilir.

;(function (kok) {
  const KAGIT_ONAYARLARI = [
    { kod: '10x15', ad: '10 × 15 cm', genislik: 100, yukseklik: 150 },
    { kod: '13x18', ad: '13 × 18 cm', genislik: 130, yukseklik: 180 },
    { kod: '15x21', ad: '15 × 21 cm', genislik: 150, yukseklik: 210 },
    { kod: 'a4', ad: 'A4 (21 × 29,7 cm)', genislik: 210, yukseklik: 297 }
  ]

  // Kagit olcusu sinirlari (mm).
  const EN_KUCUK_KAGIT = 50
  const EN_BUYUK_KAGIT = 1000

  function kagitGecerliMi (mm) {
    return Number.isFinite(mm) && mm >= EN_KUCUK_KAGIT && mm <= EN_BUYUK_KAGIT
  }

  // Verilen foto yonu icin izgara hesabi.
  //
  // Bosluk varsayilan olarak sifirdir: fotograf laboratuvarlarinda vesikaliklar
  // bitisik dizilip aradan kesilir, boylece kagittan en cok adet cikar.
  function yerlesimHesapla ({
    kagitMm, fotoMm, kenarMm = 0, aralikMm = 0, enFazlaAdet = Infinity
  }) {
    const kullanilabilirGenislik = kagitMm.genislik - 2 * kenarMm
    const kullanilabilirYukseklik = kagitMm.yukseklik - 2 * kenarMm

    const sutun = Math.floor(
      (kullanilabilirGenislik + aralikMm) / (fotoMm.genislik + aralikMm)
    )
    const satir = Math.floor(
      (kullanilabilirYukseklik + aralikMm) / (fotoMm.yukseklik + aralikMm)
    )

    if (sutun < 1 || satir < 1) {
      return { sutun: 0, satir: 0, adet: 0, sigmiyor: true, konumlar: [], fotoMm }
    }

    const izgaraGenisligi = sutun * fotoMm.genislik + (sutun - 1) * aralikMm
    const izgaraYuksekligi = satir * fotoMm.yukseklik + (satir - 1) * aralikMm

    // Izgara kagida ortalanir; artan bosluk iki kenara esit dagilir.
    const baslangicX = (kagitMm.genislik - izgaraGenisligi) / 2
    const baslangicY = (kagitMm.yukseklik - izgaraYuksekligi) / 2

    const konumlar = []
    for (let satirNo = 0; satirNo < satir; satirNo++) {
      for (let sutunNo = 0; sutunNo < sutun; sutunNo++) {
        if (konumlar.length >= enFazlaAdet) break
        konumlar.push({
          x: baslangicX + sutunNo * (fotoMm.genislik + aralikMm),
          y: baslangicY + satirNo * (fotoMm.yukseklik + aralikMm)
        })
      }
    }

    return {
      sutun,
      satir,
      adet: konumlar.length,
      sigacakAdet: sutun * satir,
      sigmiyor: false,
      konumlar,
      fotoMm,
      kenarBoslugu: { x: baslangicX, y: baslangicY }
    }
  }

  // Fotografi dik ve yatik deneyip daha cok adet cikan yerlesimi secer.
  // Vesikaliklar kagittan kesilerek ayrildigi icin yatik dizmek sakinca degil.
  function enIyiYerlesim (secenekler) {
    const dik = yerlesimHesapla(secenekler)

    const yatikFoto = {
      genislik: secenekler.fotoMm.yukseklik,
      yukseklik: secenekler.fotoMm.genislik
    }
    const yatik = yerlesimHesapla({ ...secenekler, fotoMm: yatikFoto })

    return yatik.adet > dik.adet
      ? { ...yatik, dondurulmus: true }
      : { ...dik, dondurulmus: false }
  }

  // --- Cizim -----------------------------------------------------------------

  // Sayfayi verilen tuvale, kagidin gercek oranini koruyarak cizer.
  // fotoTuvali kirpilmis tek vesikaliktir.
  function sayfayiCiz (tuval, { kagitMm, yerlesim, fotoTuvali, kesimKilavuzu = true }) {
    const ctx = tuval.getContext('2d')
    const olcek = Math.min(tuval.width / kagitMm.genislik, tuval.height / kagitMm.yukseklik)

    const sayfaGenisligi = kagitMm.genislik * olcek
    const sayfaYuksekligi = kagitMm.yukseklik * olcek
    const kaymaX = (tuval.width - sayfaGenisligi) / 2
    const kaymaY = (tuval.height - sayfaYuksekligi) / 2

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, tuval.width, tuval.height)

    // Kagit
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(kaymaX, kaymaY, sayfaGenisligi, sayfaYuksekligi)

    ctx.save()
    ctx.translate(kaymaX, kaymaY)
    ctx.scale(olcek, olcek)

    const { fotoMm } = yerlesim

    if (fotoTuvali) {
      ctx.imageSmoothingQuality = 'high'
      for (const konum of yerlesim.konumlar) {
        if (yerlesim.dondurulmus) {
          // Yatik yerlesimde fotograf 90 derece cevrilerek yerlestirilir.
          ctx.save()
          ctx.translate(konum.x + fotoMm.genislik / 2, konum.y + fotoMm.yukseklik / 2)
          ctx.rotate(Math.PI / 2)
          ctx.drawImage(fotoTuvali, -fotoMm.yukseklik / 2, -fotoMm.genislik / 2, fotoMm.yukseklik, fotoMm.genislik)
          ctx.restore()
        } else {
          ctx.drawImage(fotoTuvali, konum.x, konum.y, fotoMm.genislik, fotoMm.yukseklik)
        }
      }
    }

    if (kesimKilavuzu && yerlesim.konumlar.length) {
      // Cizgiler ekranda ince kalsin diye olcege bolunur.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = 0.2
      ctx.setLineDash([2, 2])

      const dikeyler = new Set()
      const yataylar = new Set()
      for (const konum of yerlesim.konumlar) {
        dikeyler.add(konum.x)
        dikeyler.add(konum.x + fotoMm.genislik)
        yataylar.add(konum.y)
        yataylar.add(konum.y + fotoMm.yukseklik)
      }

      ctx.beginPath()
      for (const x of dikeyler) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, kagitMm.yukseklik)
      }
      for (const y of yataylar) {
        ctx.moveTo(0, y)
        ctx.lineTo(kagitMm.genislik, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()

    // Kagit kenari
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(kaymaX + 0.5, kaymaY + 0.5, sayfaGenisligi - 1, sayfaYuksekligi - 1)
  }

  const sayfa = {
    KAGIT_ONAYARLARI,
    EN_KUCUK_KAGIT,
    EN_BUYUK_KAGIT,
    kagitGecerliMi,
    yerlesimHesapla,
    enIyiYerlesim,
    sayfayiCiz
  }

  kok.HV = kok.HV || {}
  kok.HV.sayfa = sayfa

  if (typeof module !== 'undefined' && module.exports) module.exports = sayfa
})(typeof globalThis !== 'undefined' ? globalThis : this)
