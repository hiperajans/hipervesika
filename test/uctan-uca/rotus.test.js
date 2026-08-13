'use strict'

// Arka plan beyazlatma ile rotusun birlikte davranisi.
//
// Bu testler gercek bir yuz ister (segmentasyon bir maske uretemezse olculecek
// bir zemin de olmaz), bu yuzden HV_FOTOGRAFLAR ayarli degilse atlanir:
//   HV_FOTOGRAFLAR=~/vesikalik-ornekleri npm run test:uctan-uca
// Gercek fotograflar depoya girmez (AGENTS.md, kural 5).

const test = require('node:test')
const assert = require('node:assert/strict')

const ortam = require('./ortam.js')

const ATLAMA_SEBEBI = ortam.yuzGerekli()
const calisma = new ortam.Calisma('rotus')

let sayfa, kapat

test.before(async () => {
  if (ATLAMA_SEBEBI) return

  ;({ sayfa, kapat } = await ortam.hazirla(
    calisma, { fotograf: calisma.fotograf(0, { gercek: true }) }))

  await ortam.adima(sayfa, 'rotus')
  await sayfa.click('#arkaplan-beyazlat')
  await sayfa.waitForFunction(
    () => /beyazlatıldı|ayrılamadı/.test(
      document.getElementById('arkaplan-durumu').textContent), null, { timeout: 300000 })
  await sayfa.waitForTimeout(800)

  // Zemin tanimi: hicbir rotus ayari yokken tam beyaz olan VE cevresi de tam
  // beyaz olan pikseller.
  //
  // "Tam beyaz" tek basina yetmiyor: kisinin uzerindeki beyaz bolgeler de
  // (ornegin tisortteki beyaz baski) bu tanima giriyor ve rotus onlari haklı
  // olarak degistiriyor. Cevre denetimi bu kucuk beyaz adalari eler, zeminin
  // buyuk butun alanini birakir.
  await sayfa.evaluate((yaricap) => {
    window.__ciktiVerisi = () => {
      const maskeler = ciktiMaskeleri()
      const { tuval } = window.HV.disaAktar.tuvalUret({
        gorsel: yuklenenGorsel,
        cerceve: kirpma.cerceve,
        maske: maskeler.maske,
        kisiMaskesi: maskeler.kisiMaskesi,
        rotusAyarlari,
        lekeler,
        olcuMm: olcuDurumu,
        dpi
      })
      window.__olcu = { genislik: tuval.width, yukseklik: tuval.height }
      return tuval.getContext('2d').getImageData(0, 0, tuval.width, tuval.height).data
    }

    const veri = window.__ciktiVerisi()
    const { genislik, yukseklik } = window.__olcu
    const beyaz = (x, y) => {
      const i = (y * genislik + x) * 4
      return veri[i] === 255 && veri[i + 1] === 255 && veri[i + 2] === 255
    }

    window.__zemin = []
    for (let y = yaricap; y < yukseklik - yaricap; y++) {
      for (let x = yaricap; x < genislik - yaricap; x++) {
        if (!beyaz(x, y)) continue

        let cevresiBeyaz = true
        for (let dy = -yaricap; dy <= yaricap && cevresiBeyaz; dy++) {
          for (let dx = -yaricap; dx <= yaricap; dx++) {
            if (!beyaz(x + dx, y + dy)) { cevresiBeyaz = false; break }
          }
        }
        if (cevresiBeyaz) window.__zemin.push((y * genislik + x) * 4)
      }
    }
  }, 6)
})

test.after(async () => {
  if (kapat) await kapat()
  calisma.temizle()
})

const zeminiOlc = () => sayfa.evaluate(() => {
  const veri = window.__ciktiVerisi()
  let sapan = 0
  let enKotu = null
  let enKotuFark = 0

  for (const i of window.__zemin) {
    const fark = Math.max(255 - veri[i], 255 - veri[i + 1], 255 - veri[i + 2])
    if (fark > 2) {
      sapan++
      if (fark > enKotuFark) {
        enKotuFark = fark
        enKotu = [veri[i], veri[i + 1], veri[i + 2]]
      }
    }
  }

  return { piksel: window.__zemin.length, sapan, enKotu }
})

test('beyazlatilan zemin yeterince genis (test bos degil)', async (t) => {
  if (ATLAMA_SEBEBI) return t.skip(ATLAMA_SEBEBI)

  const olcum = await zeminiOlc()
  assert.ok(olcum.piksel > 10000, `yalnızca ${olcum.piksel} zemin pikseli bulundu`)
  assert.equal(olcum.sapan, 0, 'sıfır ayarda zemin zaten bozuk')
})

// Rotus beyazlatmadan once uygulanir; hicbir kaydirac zemine islememeli.
for (const [secici, deger, ad] of [
  ['#rotus-sicaklik', -50, 'soğuk sıcaklık'],
  ['#rotus-sicaklik', 50, 'sıcak sıcaklık'],
  ['#rotus-kontrast', -50, 'düşük kontrast'],
  ['#rotus-kontrast', 50, 'yüksek kontrast'],
  ['#rotus-parlaklik', -50, 'düşük parlaklık'],
  ['#rotus-doygunluk', 50, 'yüksek doygunluk'],
  ['#rotus-keskinlik', 100, 'keskinlik'],
  ['#rotus-yumusatma', 100, 'cilt yumuşatma']
]) {
  test(`${ad} beyaz zemini bozmuyor`, async (t) => {
    if (ATLAMA_SEBEBI) return t.skip(ATLAMA_SEBEBI)

    await ortam.kaydiracAyarla(sayfa, secici, deger, 900)
    const olcum = await zeminiOlc()
    await ortam.kaydiracAyarla(sayfa, secici, 0, 400)

    assert.equal(olcum.sapan, 0,
      `${olcum.sapan}/${olcum.piksel} piksel bozuldu, en kötü ${JSON.stringify(olcum.enKotu)}`)
  })
}

test('sicaklik kisiyi gercekten etkiliyor', async (t) => {
  if (ATLAMA_SEBEBI) return t.skip(ATLAMA_SEBEBI)

  // Ayar bosuna calismamali: zemin korunurken kisi soguyacak.
  const yuzOlc = () => sayfa.evaluate(() => {
    const veri = window.__ciktiVerisi()
    const zemin = new Set(window.__zemin)
    let r = 0
    let b = 0
    let sayi = 0
    for (let i = 0; i < veri.length; i += 4) {
      if (zemin.has(i)) continue
      r += veri[i]
      b += veri[i + 2]
      sayi++
    }
    return { r: r / sayi, b: b / sayi }
  })

  const notr = await yuzOlc()
  await ortam.kaydiracAyarla(sayfa, '#rotus-sicaklik', -50, 900)
  const soguk = await yuzOlc()
  await ortam.kaydiracAyarla(sayfa, '#rotus-sicaklik', 0, 400)

  assert.ok(soguk.r < notr.r - 3, `R ${notr.r.toFixed(1)} → ${soguk.r.toFixed(1)}`)
  assert.ok(soguk.b > notr.b + 3, `B ${notr.b.toFixed(1)} → ${soguk.b.toFixed(1)}`)
})

test('beyazlatma acikken sicaklik ipucu dogru', async (t) => {
  if (ATLAMA_SEBEBI) return t.skip(ATLAMA_SEBEBI)

  assert.match(await sayfa.textContent('#sicaklik-durumu'), /zemine işlemez/)
})
