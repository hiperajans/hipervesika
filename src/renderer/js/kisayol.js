'use strict'

// Klavye kisayollari: tus olayindan komut cikarir.
//
// Saf hesap; DOM'a dokunmaz (olay nesnesinin yalnizca alanlarini okur), bu
// yuzden Node'da birim testleriyle sinanir.
//
// Kisayolun neden burada olduguna dair: uygulamanin diger kisayollari Electron
// menusunde tanimli, ama arayuz olcegininki menu hizlandiricisiyla calismiyor.
// 'CmdOrCtrl+Plus' fiziksel tusa gore eslesiyor ve Turkce Q klavyede '+'
// Shift+4 ile yazildigi icin kisayol hic tetiklenmiyordu. Burada basilan tusa
// degil URETILEN KARAKTERE bakilir, boylece kisayol her klavye dizeninde
// calisir. Sayi adasindaki + ve - de ayni karakteri urettigi icin ayrica ele
// alinmalari gerekmez.
//
// Menu ogeleri ayni isi yapar ama hizlandiricilari sisteme kaydedilmez
// (registerAccelerator: false); boylece tek tusa iki islem baglanmaz.

;(function (kok) {
  // '=' ve '_' de kabul edilir: bircok dizende '+' ve '-' bu tuslarin ustunde
  // durur, kullanici Shift'e basmadan da bekledigi sonucu alir.
  // Karsiliklari ana surecte: src/main/yakinlik.js -> KOMUTLAR.
  const YAKINLIK_TUSLARI = new Map([
    ['+', 'buyut'],
    ['=', 'buyut'],
    ['-', 'kucult'],
    ['_', 'kucult'],
    ['0', 'sifirla']
  ])

  // Arayuz olcegi komutu, yoksa null.
  function yakinlikKomutu (olay, { mac = false } = {}) {
    if (!olay) return null

    // Windows'ta AltGr, Ctrl+Alt olarak bildirilir; onunla yazilan karakterler
    // kisayol degildir.
    if (olay.altKey) return null

    // Denetim tusu platformun alistigi tus olmali: macOS'ta Cmd, digerlerinde
    // Ctrl. Ikisini birden kabul etmek macOS'ta Ctrl+- gibi kullanilmayan bir
    // birlesimi de kisayola cevirirdi.
    if (!(mac ? olay.metaKey : olay.ctrlKey)) return null

    return YAKINLIK_TUSLARI.get(olay.key) ?? null
  }

  const kisayol = { YAKINLIK_TUSLARI, yakinlikKomutu }

  kok.HV = kok.HV || {}
  kok.HV.kisayol = kisayol

  if (typeof module !== 'undefined' && module.exports) module.exports = kisayol
})(typeof globalThis !== 'undefined' ? globalThis : this)
