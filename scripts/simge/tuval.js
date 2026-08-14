'use strict'

// Sahneyi tuvale cizer. Bu dosya Node'da degil, Electron'un olusturucu
// surecinde calisir: scripts/simge-uret.js dosyayi metin olarak okuyup sayfaya
// enjekte eder. Bu yuzden require/module.exports kullanmaz.
//
// Cizim dogrudan hedef boyutta yapilir; buyuk cizip kucultmek yerine vektoru
// her boyutta yeniden rasterlemek 16-32 px'de gorunur bicimde daha keskindir.

globalThis.hvSimgeCiz = function (sahne) {
  const tuval = document.createElement('canvas')
  tuval.width = sahne.boyut
  tuval.height = sahne.boyut

  const ctx = tuval.getContext('2d')
  ctx.clearRect(0, 0, sahne.boyut, sahne.boyut)

  for (const katman of sahne.katmanlar) {
    ctx.save()

    if (katman.kirp) ctx.clip(new Path2D(katman.kirp))

    if (katman.golge) {
      ctx.shadowColor = katman.golge.renk
      // Tuvalin shadowBlur'u yaricap, SVG'nin stdDeviation'i sapmadir;
      // aralarindaki iki kat fark svgUret tarafinda kapatilir.
      ctx.shadowBlur = katman.golge.bulanik
      ctx.shadowOffsetY = katman.golge.kayma
    }

    const yol = new Path2D(katman.d)

    if (katman.cizgi) {
      ctx.strokeStyle = katman.cizgi.renk
      ctx.lineWidth = katman.cizgi.kalinlik
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
      ctx.stroke(yol)
    } else {
      let dolgu = katman.dolgu
      if (typeof dolgu === 'object' && dolgu !== null) {
        const gecis = ctx.createLinearGradient(0, dolgu.y1, 0, dolgu.y2)
        for (const [yer, renk] of dolgu.duraklar) gecis.addColorStop(yer, renk)
        dolgu = gecis
      }
      ctx.fillStyle = dolgu
      ctx.fill(yol)
    }

    ctx.restore()
  }

  return tuval.toDataURL('image/png')
}
