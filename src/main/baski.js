'use strict'

// Baski olcu cevrimleri ve basilacak sayfanin HTML'i.
//
// Kagit olcusu uygulamanin her yerinde milimetredir; Chromium'un istedigi
// birimlere yalnizca burada cevrilir. Bu dosya saf hesap icerir (Electron'a
// dokunmaz), boylece birim testlerinde dogrudan calistirilabilir.

const INC_MM = 25.4

// webContents.print pageSize'i mikron ister.
function mikron (mm) {
  return Math.round(mm * 1000)
}

// printToPDF pageSize'i inc ister.
function inc (mm) {
  return mm / INC_MM
}

// PDF ic olculeri punto (1/72 inc) cinsindendir. Uretilen PDF'in gercekten
// istenen olcude oldugu MediaBox'tan bu deger ile dogrulanir.
function punto (mm) {
  return (mm / INC_MM) * 72
}

function kopyaSayisi (deger) {
  const sayi = Math.trunc(Number(deger))
  if (!Number.isFinite(sayi)) return 1
  return Math.min(99, Math.max(1, sayi))
}

// Kagit olcusunu dogrular. Ana surec arayuzden gelen degere guvenmez.
function sayfaOlcusu (kagitMm) {
  const genislik = Number(kagitMm?.genislik)
  const yukseklik = Number(kagitMm?.yukseklik)

  const gecerli = (mm) => Number.isFinite(mm) && mm >= 10 && mm <= 2000
  if (!gecerli(genislik) || !gecerli(yukseklik)) {
    throw new Error('Kağıt ölçüsü geçersiz.')
  }

  return { genislik, yukseklik }
}

// Basilacak sayfa. Goruntu kagidin tamamini birebir kaplar ve olcu hem @page
// hem de img uzerinde milimetre olarak yazilir. Kenar boslugu sifirdir; boylece
// yazici surucusunun sayfayi "kagida sigdir" diye kucultmesi icin sebep kalmaz
// ve 50x60 mm vesikalik kagida 50x60 mm iner.
function baskiSayfasiHtml (kagitMm, gorselAdresi) {
  const { genislik, yukseklik } = sayfaOlcusu(kagitMm)
  const mm = (deger) => `${Number(deger.toFixed(3))}mm`
  const adres = encodeURI(gorselAdresi)

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src app:; style-src 'unsafe-inline'" />
    <title>Baskı</title>
    <style>
      @page { size: ${mm(genislik)} ${mm(yukseklik)}; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img {
        display: block;
        width: ${mm(genislik)};
        height: ${mm(yukseklik)};
        image-rendering: auto;
      }
    </style>
  </head>
  <body><img src="${adres}" alt="" /></body>
</html>
`
}

// Uretilen PDF'in ilk MediaBox'ini punto olarak okur. Dogrulama icindir:
// yazicinin ne yaptigini olcemeyiz ama PDF'in olcusu tam olarak olculebilir.
function pdfMediaBox (baytlar) {
  const metin = Buffer.from(baytlar).toString('latin1')
  const eslesme = metin.match(
    /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/
  )
  if (!eslesme) return null

  const [, x1, y1, x2, y2] = eslesme.map(Number)
  return { genislik: x2 - x1, yukseklik: y2 - y1 }
}

module.exports = {
  INC_MM,
  mikron,
  inc,
  punto,
  kopyaSayisi,
  sayfaOlcusu,
  baskiSayfasiHtml,
  pdfMediaBox
}
