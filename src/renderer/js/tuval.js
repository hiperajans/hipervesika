'use strict'

// Goruntuleme tuvali: sigdirma, yakinlastirma ve kaydirma.
// Koordinatlar her zaman asil goruntunun piksel uzayinda tutulur; olcek yalnizca
// ekrana cizerken uygulanir. Boylece sonraki fazlarda eklenecek kirpma cercevesi
// gibi ogeler yakinlik seviyesinden bagimsiz kalir.

window.HV = window.HV || {}

window.HV.Tuval = class Tuval {
  static EN_KUCUK_OLCEK = 0.02
  static EN_BUYUK_OLCEK = 8

  constructor (canvas, { degisimde } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.degisimde = degisimde ?? (() => {})

    this.gorsel = null
    this.olcek = 1
    this.kaydirma = { x: 0, y: 0 }
    this.surukleme = null

    // Goruntunun uzerine cizen katman (ornegin kirpma cercevesi) ve fare
    // olaylarini once gorecek etkilesim nesnesi. Ikisi de istege baglidir.
    this.ustKatman = null
    this.etkilesim = null
    this.etkilesimSuruyor = false

    this.#olcuyuGuncelle()
    new ResizeObserver(() => {
      const oncekiGorsel = this.gorsel
      this.#olcuyuGuncelle()
      if (oncekiGorsel) this.ciz()
    }).observe(canvas)

    this.#olaylariBagla()
  }

  gorselAta (gorsel) {
    this.gorsel = gorsel
    this.sigdir()
  }

  temizle () {
    this.gorsel = null
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.degisimde(this)
  }

  sigdir () {
    if (!this.gorsel) return

    const { width, height } = this.gorsel.asil
    const alan = this.#alanOlculeri()

    // Kenarlarda biraz bosluk birakilir ki gorsel kutuya yapisik durmasin.
    this.olcek = Math.min(alan.genislik / width, alan.yukseklik / height) * 0.95
    this.kaydirma = {
      x: (alan.genislik - width * this.olcek) / 2,
      y: (alan.yukseklik - height * this.olcek) / 2
    }
    this.ciz()
  }

  // Merkez verilmezse gorunur alanin ortasi esas alinir.
  yakinlastir (carpan, merkez) {
    if (!this.gorsel) return

    const alan = this.#alanOlculeri()
    const nokta = merkez ?? { x: alan.genislik / 2, y: alan.yukseklik / 2 }
    const yeniOlcek = Math.min(
      Math.max(this.olcek * carpan, Tuval.EN_KUCUK_OLCEK),
      Tuval.EN_BUYUK_OLCEK
    )

    // Imlecin ustunde duran goruntu noktasi ayni yerde kalsin.
    const oran = yeniOlcek / this.olcek
    this.kaydirma.x = nokta.x - (nokta.x - this.kaydirma.x) * oran
    this.kaydirma.y = nokta.y - (nokta.y - this.kaydirma.y) * oran
    this.olcek = yeniOlcek

    this.ciz()
  }

  ciz () {
    const { ctx, canvas } = this
    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!this.gorsel) return

    const { asil } = this.gorsel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(this.kaydirma.x, this.kaydirma.y)
    ctx.scale(this.olcek, this.olcek)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.#kaynakSec(), 0, 0, asil.width, asil.height)

    // Ust katman goruntu koordinat uzayinda cizer; ekranda sabit kalinligi olan
    // cizgiler icin olcegi kullanir.
    if (this.ustKatman) this.ustKatman(ctx, this.olcek)

    this.degisimde(this)
  }

  // Ekran koordinatini (tuvalin sol ust kosesine gore CSS pikseli) goruntunun
  // piksel uzayina cevirir.
  goruntuyeCevir (ekranNoktasi) {
    return {
      x: (ekranNoktasi.x - this.kaydirma.x) / this.olcek,
      y: (ekranNoktasi.y - this.kaydirma.y) / this.olcek
    }
  }

  // Ekranda gorunen boyut onizlemeden buyukse asil goruntuye gecilir; yakinlasinca
  // bulaniklik olusmaz, uzaklasinca da buyuk goruntuyu bosuna olceklemeyiz.
  #kaynakSec () {
    const { asil, onizleme } = this.gorsel
    if (onizleme === asil) return asil

    const gorunenGenislik = asil.width * this.olcek * (window.devicePixelRatio || 1)
    return gorunenGenislik > onizleme.width ? asil : onizleme
  }

  #alanOlculeri () {
    const dpr = window.devicePixelRatio || 1
    return {
      genislik: this.canvas.width / dpr,
      yukseklik: this.canvas.height / dpr
    }
  }

  #olcuyuGuncelle () {
    const dpr = window.devicePixelRatio || 1
    const kutu = this.canvas.getBoundingClientRect()
    this.canvas.width = Math.max(1, Math.round(kutu.width * dpr))
    this.canvas.height = Math.max(1, Math.round(kutu.height * dpr))
  }

  // Isaretci, olay islenene kadar birakilmis olabilir; yakalama basarisiz olursa
  // surukleme yine de calisir, bu yuzden hata yutulur.
  #yakala (olay) {
    try {
      this.canvas.setPointerCapture(olay.pointerId)
    } catch {
      /* yakalama zorunlu degil */
    }
  }

  #imlecKonumu (olay) {
    const kutu = this.canvas.getBoundingClientRect()
    return { x: olay.clientX - kutu.left, y: olay.clientY - kutu.top }
  }

  #olaylariBagla () {
    const canvas = this.canvas

    canvas.addEventListener('wheel', (olay) => {
      if (!this.gorsel) return
      olay.preventDefault()
      const carpan = Math.exp(-olay.deltaY * 0.0015)
      this.yakinlastir(carpan, this.#imlecKonumu(olay))
    }, { passive: false })

    canvas.addEventListener('pointerdown', (olay) => {
      if (!this.gorsel) return
      const ekran = this.#imlecKonumu(olay)

      // Once kirpma cercevesi gibi ust katmanlara sorulur; olayi o sahiplenmezse
      // kaydirmaya duser.
      if (this.etkilesim?.basla(this.goruntuyeCevir(ekran), this.olcek)) {
        this.#yakala(olay)
        this.etkilesimSuruyor = true
        return
      }

      this.#yakala(olay)
      this.surukleme = ekran
      canvas.classList.add('tasiniyor')
    })

    canvas.addEventListener('pointermove', (olay) => {
      const ekran = this.#imlecKonumu(olay)

      if (this.etkilesimSuruyor) {
        this.etkilesim.hareket(this.goruntuyeCevir(ekran), this.olcek)
        this.ciz()
        return
      }

      if (this.surukleme) {
        this.kaydirma.x += ekran.x - this.surukleme.x
        this.kaydirma.y += ekran.y - this.surukleme.y
        this.surukleme = ekran
        this.ciz()
        return
      }

      // Surukleme yokken imleci ust katmana gore guncelle.
      if (this.gorsel && this.etkilesim) {
        canvas.style.cursor = this.etkilesim.imlecTipi(this.goruntuyeCevir(ekran), this.olcek) ?? ''
      }
    })

    const suruklemeyiBitir = (olay) => {
      if (this.etkilesimSuruyor) {
        this.etkilesimSuruyor = false
        this.etkilesim.bitir()
        if (canvas.hasPointerCapture(olay.pointerId)) canvas.releasePointerCapture(olay.pointerId)
        return
      }

      if (!this.surukleme) return
      this.surukleme = null
      canvas.classList.remove('tasiniyor')
      if (canvas.hasPointerCapture(olay.pointerId)) canvas.releasePointerCapture(olay.pointerId)
    }

    canvas.addEventListener('pointerup', suruklemeyiBitir)
    canvas.addEventListener('pointercancel', suruklemeyiBitir)
  }
}
