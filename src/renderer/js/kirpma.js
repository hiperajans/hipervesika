'use strict'

// Orana kilitli kirpma cercevesi. Geometri hesaplari HV.olcu icindedir; burada
// yalnizca fare etkilesimi ve cizim var.
//
// Cerceve kaynak gorselin piksel uzayinda tutulur, bu yuzden yakinlik seviyesi
// degisince cerceve kaymaz.

window.HV = window.HV || {}

window.HV.KirpmaAraci = class KirpmaAraci {
  // Ekranda sabit kalmasi gereken olculer (CSS pikseli).
  static TUTAMAC_BOYU = 10
  static TUTAMAC_YAKALAMA = 14

  constructor (tuval, { degisimde } = {}) {
    this.tuval = tuval
    this.degisimde = degisimde ?? (() => {})

    this.gorselOlcusu = null
    this.cerceve = null
    this.oran = 50 / 60
    this.eylem = null

    tuval.ustKatman = (ctx, olcek) => this.ciz(ctx, olcek)
    tuval.etkilesim = this
  }

  get etkin () {
    return this.cerceve !== null
  }

  // Calisma alani: dondurme sonrasi kullanilabilir dikdortgen. Cerceve bunun
  // disina cikamaz, boylece dondurmeden dogan bos koseler kadraja giremez.
  calismaAta (calisma) {
    const ilkKez = this.gorselOlcusu === null
    this.gorselOlcusu = { genislik: calisma.genislik, yukseklik: calisma.yukseklik }

    if (ilkKez || !this.cerceve) {
      this.sifirla()
      return
    }

    // Alan degistiginde mevcut cerceve yeni sinirlara cekilir.
    this.cerceve = window.HV.olcu.sinirlaraTasi(
      this.cerceve, calisma.genislik, calisma.yukseklik
    )
    this.tuval.ciz()
    this.degisimde(this)
  }

  cerceveAta (cerceve) {
    if (!this.gorselOlcusu) return
    this.cerceve = window.HV.olcu.sinirlaraTasi(
      cerceve, this.gorselOlcusu.genislik, this.gorselOlcusu.yukseklik
    )
    this.tuval.ciz()
    this.degisimde(this)
  }

  temizle () {
    this.gorselOlcusu = null
    this.cerceve = null
    this.degisimde(this)
  }

  sifirla () {
    if (!this.gorselOlcusu) return
    this.cerceve = window.HV.olcu.baslangicCercevesi(
      this.gorselOlcusu.genislik,
      this.gorselOlcusu.yukseklik,
      this.oran
    )
    this.tuval.ciz()
    this.degisimde(this)
  }

  oranAta (yeniOran) {
    this.oran = yeniOran
    if (!this.gorselOlcusu) return

    this.cerceve = this.cerceve
      ? window.HV.olcu.oranaUydur(
        this.cerceve, yeniOran, this.gorselOlcusu.genislik, this.gorselOlcusu.yukseklik
      )
      : window.HV.olcu.baslangicCercevesi(
        this.gorselOlcusu.genislik, this.gorselOlcusu.yukseklik, yeniOran
      )

    this.tuval.ciz()
    this.degisimde(this)
  }

  // --- Tuval etkilesim arayuzu -----------------------------------------------

  basla (nokta, olcek) {
    if (!this.cerceve) return false

    const kose = this.#koseBul(nokta, olcek)
    if (kose) {
      this.eylem = { tur: 'boyutlandir', kose }
      return true
    }

    if (this.#icinde(nokta)) {
      this.eylem = {
        tur: 'tasi',
        fark: { x: nokta.x - this.cerceve.x, y: nokta.y - this.cerceve.y }
      }
      return true
    }

    return false
  }

  hareket (nokta) {
    if (!this.eylem) return
    const { genislik, yukseklik } = this.gorselOlcusu

    if (this.eylem.tur === 'boyutlandir') {
      this.cerceve = window.HV.olcu.koseIleBoyutlandir(
        this.cerceve, this.eylem.kose, nokta, this.oran, genislik, yukseklik
      )
    } else {
      this.cerceve = window.HV.olcu.sinirlaraTasi(
        {
          x: nokta.x - this.eylem.fark.x,
          y: nokta.y - this.eylem.fark.y,
          genislik: this.cerceve.genislik,
          yukseklik: this.cerceve.yukseklik
        },
        genislik,
        yukseklik
      )
    }

    this.degisimde(this)
  }

  bitir () {
    this.eylem = null
  }

  imlecTipi (nokta, olcek) {
    if (!this.cerceve) return null

    const kose = this.#koseBul(nokta, olcek)
    if (kose) return kose.sagda === kose.altta ? 'nwse-resize' : 'nesw-resize'
    return this.#icinde(nokta) ? 'move' : null
  }

  // --- Cizim -----------------------------------------------------------------

  ciz (ctx, olcek) {
    if (!this.cerceve || !this.gorselOlcusu) return

    const { genislik: gG, yukseklik: gY } = this.gorselOlcusu
    const c = this.cerceve
    const cizgi = 1 / olcek
    const tutamac = KirpmaAraci.TUTAMAC_BOYU / olcek

    ctx.save()

    // Cerceve disi karartilir: dis dikdortgen ve ic dikdortgen ters yonde
    // cizilerek delikli bir yol olusturulur.
    ctx.beginPath()
    ctx.rect(0, 0, gG, gY)
    ctx.rect(c.x, c.y, c.genislik, c.yukseklik)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fill('evenodd')

    // Ucte bir kilavuz cizgileri.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = cizgi
    ctx.beginPath()
    for (let i = 1; i < 3; i++) {
      const x = c.x + (c.genislik * i) / 3
      const y = c.y + (c.yukseklik * i) / 3
      ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + c.yukseklik)
      ctx.moveTo(c.x, y); ctx.lineTo(c.x + c.genislik, y)
    }
    ctx.stroke()

    // Cerceve kenari.
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = cizgi * 2
    ctx.strokeRect(c.x, c.y, c.genislik, c.yukseklik)

    // Kose tutamaklari.
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.lineWidth = cizgi
    for (const kose of this.#koseler()) {
      const x = kose.x - tutamac / 2
      const y = kose.y - tutamac / 2
      ctx.fillRect(x, y, tutamac, tutamac)
      ctx.strokeRect(x, y, tutamac, tutamac)
    }

    ctx.restore()
  }

  // --- Yardimcilar -----------------------------------------------------------

  #koseler () {
    const c = this.cerceve
    return [
      { sagda: false, altta: false, x: c.x, y: c.y },
      { sagda: true, altta: false, x: c.x + c.genislik, y: c.y },
      { sagda: false, altta: true, x: c.x, y: c.y + c.yukseklik },
      { sagda: true, altta: true, x: c.x + c.genislik, y: c.y + c.yukseklik }
    ]
  }

  // Tutamak yakalama alani ekranda sabit kalmali; bu yuzden olcege bolunur.
  #koseBul (nokta, olcek) {
    const yakalama = KirpmaAraci.TUTAMAC_YAKALAMA / olcek

    for (const kose of this.#koseler()) {
      if (Math.abs(nokta.x - kose.x) <= yakalama && Math.abs(nokta.y - kose.y) <= yakalama) {
        // Suruklenen kosenin karsi kosesi sabit kalacagi icin yalnizca hangi
        // kenarlarda oldugu bilgisi tasinir.
        return { sagda: kose.sagda, altta: kose.altta }
      }
    }
    return null
  }

  #icinde (nokta) {
    const c = this.cerceve
    return (
      nokta.x >= c.x && nokta.x <= c.x + c.genislik &&
      nokta.y >= c.y && nokta.y <= c.y + c.yukseklik
    )
  }
}
