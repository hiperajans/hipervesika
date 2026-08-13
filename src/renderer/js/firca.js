'use strict'

// Maske duzeltme fircasi. Tuval'in etkilesim arayuzunu uygular; kirpma araci
// ile ayni yuvayi paylasir, aralarinda mod degistirilir.
//
// Tuval calisma (dondurulmus) uzayinda calisir, maske ise kaynak goruntu
// uzayindadir; her darbe once kaynak uzayina, sonra maske olcegine cevrilir.

window.HV = window.HV || {}

window.HV.Firca = class Firca {
  constructor (tuval, { maskeyiAl, gorseliAl, degisimde } = {}) {
    this.tuval = tuval
    this.maskeyiAl = maskeyiAl
    this.gorseliAl = gorseliAl
    this.degisimde = degisimde ?? (() => {})

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
    this.suruyor = false
    this.sonNokta = null
    this.degisimde(this)
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

  #maskeye (nokta, gorsel, maske) {
    const gorselOlcusu = { genislik: gorsel.asil.width, yukseklik: gorsel.asil.height }
    const kaynak = gorsel.aci
      ? window.HV.hizalama.kaynagaTasi(nokta, gorselOlcusu, gorsel.calisma, gorsel.aci)
      : nokta

    const olcek = maske.width / gorselOlcusu.genislik
    return { x: kaynak.x * olcek, y: kaynak.y * olcek }
  }
}
