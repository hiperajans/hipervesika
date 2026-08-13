'use strict'

// Maske duzeltme fircasi. Tuval'in etkilesim arayuzunu uygular; kirpma araci
// ile ayni yuvayi paylasir, aralarinda mod degistirilir.
//
// Tuval calisma (dondurulmus) uzayinda calisir, maske ise kaynak goruntu
// uzayindadir; her darbe once kaynak uzayina, sonra maske olcegine cevrilir.

window.HV = window.HV || {}

window.HV.Firca = class Firca {
  constructor (tuval, { maskeyiAl, gorseliAl, degisimde, bittiginde } = {}) {
    this.tuval = tuval
    this.maskeyiAl = maskeyiAl
    this.gorseliAl = gorseliAl
    this.degisimde = degisimde ?? (() => {})
    // Darbe bitince cagrilir; gecmise tek bir adim olarak kaydedilmesi icin.
    this.bittiginde = bittiginde ?? (() => {})

    // Ekran pikseli cinsinden yaricap; yakinlik degisince firca ayni kalinlikta
    // gorunsun diye cizim aninda olcege bolunur.
    this.yaricap = 24
    this.sil = true
    this.suruyor = false
    this.sonNokta = null
  }

  // --- Tuval etkilesim arayuzu -----------------------------------------------

  basla (nokta, olcek) {
    if (!this.maskeyiAl()) return false
    this.suruyor = true
    this.sonNokta = null
    this.#darbe(nokta, olcek)
    return true
  }

  hareket (nokta, olcek) {
    if (!this.suruyor) return
    this.#darbe(nokta, olcek)
  }

  bitir () {
    if (!this.suruyor) return
    this.suruyor = false
    this.sonNokta = null
    this.degisimde(this)
    this.bittiginde()
  }

  imlecTipi () {
    return 'crosshair'
  }

  // Firca izini tuvalin ustune cizer ki kullanici nereye basacagini gorsun.
  ciz (ctx, olcek) {
    if (!this.sonIzNokta) return
    ctx.save()
    ctx.strokeStyle = this.sil ? '#dc3545' : '#0d6efd'
    ctx.lineWidth = 1 / olcek
    ctx.beginPath()
    ctx.arc(this.sonIzNokta.x, this.sonIzNokta.y, this.yaricap / olcek, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  izGuncelle (nokta) {
    this.sonIzNokta = nokta
  }

  // --- Cizim -----------------------------------------------------------------

  #darbe (nokta, olcek) {
    const maske = this.maskeyiAl()
    const gorsel = this.gorseliAl()
    if (!maske || !gorsel) return

    const maskeNoktasi = this.#maskeye(nokta, gorsel, maske)
    // Maske kaynaktan kucuk oldugu icin yaricap da ayni oranda kuculur.
    const maskeOlcegi = maske.width / gorsel.asil.width
    const yaricap = (this.yaricap / olcek) * maskeOlcegi

    // Isaretci hizli hareket ettiginde noktalar arasinda bosluk kalmasin diye
    // iki darbe arasi doldurulur.
    if (this.sonNokta) {
      const mesafe = Math.hypot(maskeNoktasi.x - this.sonNokta.x, maskeNoktasi.y - this.sonNokta.y)
      const adim = Math.max(1, Math.floor(mesafe / (yaricap * 0.4)))
      for (let i = 1; i <= adim; i++) {
        const t = i / adim
        window.HV.arkaplan.fircaDarbesi(maske, {
          x: this.sonNokta.x + (maskeNoktasi.x - this.sonNokta.x) * t,
          y: this.sonNokta.y + (maskeNoktasi.y - this.sonNokta.y) * t
        }, yaricap, this.sil)
      }
    } else {
      window.HV.arkaplan.fircaDarbesi(maske, maskeNoktasi, yaricap, this.sil)
    }

    this.sonNokta = maskeNoktasi
    this.degisimde(this)
  }

  // Leke fircasindan da erisilebilsin diye ayri tutuldu.
  static kaynagaCevir (nokta, gorsel) {
    if (!gorsel.aci) return nokta
    return window.HV.hizalama.kaynagaTasi(
      nokta,
      { genislik: gorsel.asil.width, yukseklik: gorsel.asil.height },
      gorsel.calisma,
      gorsel.aci
    )
  }

  #maskeye (nokta, gorsel, maske) {
    const kaynak = Firca.kaynagaCevir(nokta, gorsel)
    const olcek = maske.width / gorsel.asil.width
    return { x: kaynak.x * olcek, y: kaynak.y * olcek }
  }
}

// Leke temizleme fircasi. Maskeye degil, rotus listesine yazar: her dokunus
// kaynak goruntu koordinatinda bir leke kaydi olur ve onizleme yeniden uretilir.
window.HV.LekeFircasi = class LekeFircasi {
  constructor (tuval, { gorseliAl, lekeEkle, degisimde } = {}) {
    this.tuval = tuval
    this.gorseliAl = gorseliAl
    this.lekeEkle = lekeEkle
    this.degisimde = degisimde ?? (() => {})

    this.yaricap = 12
    this.sonIzNokta = null
  }

  basla (nokta, olcek) {
    const gorsel = this.gorseliAl()
    if (!gorsel) return false

    const kaynak = window.HV.Firca.kaynagaCevir(nokta, gorsel)
    // Yaricap ekranda sabit gorunur; kaynak olcegine cevrilir.
    this.lekeEkle({ x: kaynak.x, y: kaynak.y, yaricap: this.yaricap / olcek })
    this.degisimde(this)
    return true
  }

  // Leke temizleme tek dokunusluk bir islem; suruklemede tekrar uygulanmaz.
  hareket () {}

  bitir () {}

  imlecTipi () {
    return 'crosshair'
  }

  izGuncelle (nokta) {
    this.sonIzNokta = nokta
  }

  ciz (ctx, olcek) {
    if (!this.sonIzNokta) return
    ctx.save()
    ctx.strokeStyle = '#198754'
    ctx.lineWidth = 1 / olcek
    ctx.beginPath()
    ctx.arc(this.sonIzNokta.x, this.sonIzNokta.y, this.yaricap / olcek, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}
