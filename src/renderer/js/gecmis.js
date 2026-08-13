'use strict'

// Geri al / yinele yigini. Durumun ne oldugunu bilmez; yalnizca sirasini tutar,
// bu yuzden saf ve test edilebilir.

;(function (kok) {
  // Maske anlik goruntuleri bellek tuttugu icin gecmis sinirli uzunlukta.
  const VARSAYILAN_SINIR = 15

  class Gecmis {
    constructor (sinir = VARSAYILAN_SINIR) {
      this.sinir = sinir
      this.yigin = []
      this.konum = -1
    }

    // Yeni bir durum ekler. Geri alinmis adimlar varsa onlar atilir; yeni dal
    // bu noktadan devam eder.
    kaydet (durum) {
      this.yigin = this.yigin.slice(0, this.konum + 1)
      this.yigin.push(durum)

      if (this.yigin.length > this.sinir) this.yigin.shift()
      this.konum = this.yigin.length - 1
    }

    get simdiki () {
      return this.yigin[this.konum] ?? null
    }

    get geriAlinabilir () {
      return this.konum > 0
    }

    get yinelenebilir () {
      return this.konum < this.yigin.length - 1
    }

    geriAl () {
      if (!this.geriAlinabilir) return null
      this.konum -= 1
      return this.simdiki
    }

    yinele () {
      if (!this.yinelenebilir) return null
      this.konum += 1
      return this.simdiki
    }

    // Ilk duruma doner (fotograf yuklendigi andaki hali).
    basaDon () {
      if (!this.yigin.length) return null
      this.konum = 0
      return this.simdiki
    }

    temizle () {
      this.yigin = []
      this.konum = -1
    }
  }

  kok.HV = kok.HV || {}
  kok.HV.Gecmis = Gecmis

  if (typeof module !== 'undefined' && module.exports) module.exports = Gecmis
})(typeof globalThis !== 'undefined' ? globalThis : this)
