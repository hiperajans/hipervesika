'use strict'

// Olcu kalibrasyonu.
//
// Yazicilar kagidi bazen %1'e varan bir farkla basar: surucunun kendi
// olceklemesi, kagit besleme payi ya da mekanik tolerans. Vesikalikta bu fark
// dogrudan urunun vaadini bozar — 50 mm'lik fotograf 49,6 mm cikar.
//
// Cozum donanimsiz: uygulama olculeri bilinen bir kalibrasyon sayfasi basar,
// kullanici cetvelle olcup gercekte kac mm ciktigini girer, uygulama da
// duzeltme carpanini saklayip sonraki her baskida uygular.
//
// Carpan yazici basina tutulur (kagit basina degil): sapma surucunun ve
// mekanigin isi, kagit turuyle degismiyor.
//
// Geometri ve hesap saf; cizim ayni dosyada ama tuvali disaridan alir.

;(function (kok) {
  const VARSAYILAN = Object.freeze({ olcekX: 1, olcekY: 1 })

  // Makul sapma araligi. Bunun disina cikan bir olcum, olcum hatasi ya da
  // yanlis kagittir; duzeltmek yerine kullaniciya soylemek dogru.
  const EN_KUCUK_OLCEK = 0.9
  const EN_BUYUK_OLCEK = 1.1

  // Referans cizgilerinin kagit kenarina birakacagi pay.
  const KENAR_PAYI_MM = 12

  function sayiGecerliMi (deger) {
    return Number.isFinite(deger) && deger > 0
  }

  // Kagida sigan en uzun referans olculeri. Uzun cizgi daha hassas olcum
  // demek; 10 mm'lik adimlara yuvarlanir ki cetvelde okumak kolay olsun.
  function referanslar (kagitMm) {
    const uzunluk = (kenar) => Math.max(20, Math.floor((kenar - 2 * KENAR_PAYI_MM) / 10) * 10)
    return {
      yatayMm: uzunluk(kagitMm.genislik),
      dikeyMm: uzunluk(kagitMm.yukseklik)
    }
  }

  // Duzeltme carpani: yazici kucuk bastiysa carpan 1'den buyuk olur ve sonraki
  // baskida sayfa o kadar buyuk cizilir.
  function olcekHesapla (beklenenMm, olculenMm) {
    if (!sayiGecerliMi(beklenenMm) || !sayiGecerliMi(olculenMm)) return null

    const olcek = beklenenMm / olculenMm
    if (olcek < EN_KUCUK_OLCEK || olcek > EN_BUYUK_OLCEK) return null

    // Bes basamak yeter: 1 metrede 0,01 mm.
    return Math.round(olcek * 100000) / 100000
  }

  function olcekGecerliMi (olcek) {
    return Number.isFinite(olcek) && olcek >= EN_KUCUK_OLCEK && olcek <= EN_BUYUK_OLCEK
  }

  function temizle (ham) {
    const olcekX = Number(ham?.olcekX)
    const olcekY = Number(ham?.olcekY)
    if (!olcekGecerliMi(olcekX) || !olcekGecerliMi(olcekY)) return null
    return { olcekX, olcekY }
  }

  // Duzeltmesi olmayan yazici icin varsayilan doner; cagiran her zaman bir
  // deger alir ve "var mi" diye ayrica bakmaz.
  function yaziciIcin (kalibrasyonlar, yazici) {
    const kayit = (kalibrasyonlar ?? []).find((oge) => oge.yazici === yazici)
    return temizle(kayit) ?? { ...VARSAYILAN }
  }

  function etkinMi (kalibrasyon) {
    return kalibrasyon.olcekX !== 1 || kalibrasyon.olcekY !== 1
  }

  // Yuzde olarak okunabilir ozet: "%100,6 yatay · %99,8 dikey"
  function ozet (kalibrasyon) {
    const yuzde = (olcek) => (olcek * 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '')
    return `%${yuzde(kalibrasyon.olcekX)} yatay · %${yuzde(kalibrasyon.olcekY)} dikey`
  }

  // --- Kalibrasyon sayfasi ---------------------------------------------------

  // Sayfa, olculeri bilinen iki cizgiden ibaret; geri kalani ne yapilacagini
  // anlatan yazi. Cizgiler kagidin ortasindan gecer, cunku surucunun kenar
  // payi cizginin ucunu kirparsa olcum bozulur.
  function testSayfasiCiz (tuval, { kagitMm, yaziciAdi = '' }) {
    const ctx = tuval.getContext('2d')
    const olcek = tuval.width / kagitMm.genislik
    const { yatayMm, dikeyMm } = referanslar(kagitMm)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tuval.width, tuval.height)

    ctx.save()
    ctx.scale(olcek, olcek)
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineCap = 'butt'

    const merkezX = kagitMm.genislik / 2
    const merkezY = kagitMm.yukseklik / 2
    const cizgi = 0.25

    // Yatay referans: kagidin ortasinda, uclarinda bitis isaretleri.
    const yatayY = merkezY
    const yatayBas = merkezX - yatayMm / 2
    ctx.lineWidth = cizgi
    ctx.beginPath()
    ctx.moveTo(yatayBas, yatayY)
    ctx.lineTo(yatayBas + yatayMm, yatayY)
    // Her 10 mm'de tirnak; uclarda ve ortada daha uzun.
    for (let mm = 0; mm <= yatayMm; mm += 10) {
      const uzun = mm === 0 || mm === yatayMm || mm * 2 === yatayMm
      ctx.moveTo(yatayBas + mm, yatayY - (uzun ? 5 : 2))
      ctx.lineTo(yatayBas + mm, yatayY + (uzun ? 5 : 2))
    }
    ctx.stroke()

    // Dikey referans.
    const dikeyX = merkezX
    const dikeyBas = merkezY - dikeyMm / 2
    ctx.beginPath()
    ctx.moveTo(dikeyX, dikeyBas)
    ctx.lineTo(dikeyX, dikeyBas + dikeyMm)
    for (let mm = 0; mm <= dikeyMm; mm += 10) {
      const uzun = mm === 0 || mm === dikeyMm || mm * 2 === dikeyMm
      ctx.moveTo(dikeyX - (uzun ? 5 : 2), dikeyBas + mm)
      ctx.lineTo(dikeyX + (uzun ? 5 : 2), dikeyBas + mm)
    }
    ctx.stroke()

    // Yazilar. Punto degil milimetre ile olculuyor; olcek zaten uygulandi.
    const yaz = (metin, x, y, boy = 4, hiza = 'center') => {
      ctx.font = `${boy}px system-ui, sans-serif`
      ctx.textAlign = hiza
      ctx.fillText(metin, x, y)
    }

    yaz('Hiper Vesika · ölçü kalibrasyonu', merkezX, KENAR_PAYI_MM + 4, 4.5)
    yaz(
      'Aşağıdaki çizgileri cetvelle ölçüp uygulamaya girin.',
      merkezX, KENAR_PAYI_MM + 10, 3.5
    )
    yaz(`${yatayMm} mm`, merkezX, yatayY - 8, 5)
    ctx.save()
    ctx.translate(dikeyX - 8, merkezY)
    ctx.rotate(-Math.PI / 2)
    yaz(`${dikeyMm} mm`, 0, 0, 5)
    ctx.restore()

    const alt = [
      `${kagitMm.genislik} × ${kagitMm.yukseklik} mm kağıt`,
      yaziciAdi
    ].filter(Boolean).join(' · ')
    yaz(alt, merkezX, kagitMm.yukseklik - KENAR_PAYI_MM, 3.5)

    ctx.restore()
    return tuval
  }

  const kalibrasyon = {
    VARSAYILAN,
    EN_KUCUK_OLCEK,
    EN_BUYUK_OLCEK,
    KENAR_PAYI_MM,
    referanslar,
    olcekHesapla,
    olcekGecerliMi,
    temizle,
    yaziciIcin,
    etkinMi,
    ozet,
    testSayfasiCiz
  }

  kok.HV = kok.HV || {}
  kok.HV.kalibrasyon = kalibrasyon

  if (typeof module !== 'undefined' && module.exports) module.exports = kalibrasyon
})(typeof globalThis !== 'undefined' ? globalThis : this)
