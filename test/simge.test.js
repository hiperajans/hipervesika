'use strict'

// Uygulama simgesinin birim testleri: geometri ile .ico/.icns kaplari.
// Rasterleme Electron gerektirir ve burada calismaz; onun yerine uretilen
// yollar ile depoya islenmis kap dosyalari denetlenir.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const cizim = require('../scripts/simge/cizim.js')
const kap = require('../scripts/simge/kap.js')

const simgeKlasoru = path.join(__dirname, '..', 'build', 'icons')

const yakin = (a, b, tolerans = 0.01) =>
  assert.ok(Math.abs(a - b) <= tolerans, `${a} ile ${b} arasindaki fark ${tolerans} degerini asiyor`)

// Yoldaki tum sayilari cikarir; sinir denetimleri icin yeterli.
function sayilar (d) {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
}

// Yoldaki gercek noktalari cikarir. Komut basina sayi sayisi farkli: M ve L
// iki (tek nokta), C alti (uc nokta), A yedi sayi tasir ama ilk besi yaricap,
// donme ve bayraklardir — yalnizca son ikisi nokta.
function noktalar (d) {
  const cikti = []
  for (const parca of d.trim().split(/(?=[MLCAZ])/)) {
    const komut = parca[0]
    const s = sayilar(parca) ?? []
    if (komut === 'M' || komut === 'L') cikti.push({ x: s[0], y: s[1] })
    else if (komut === 'C') for (let i = 0; i < 6; i += 2) cikti.push({ x: s[i], y: s[i + 1] })
    else if (komut === 'A') cikti.push({ x: s[5], y: s[6] })
  }
  return cikti
}

test('koseli kare verilen dikdortgenin disina tasmaz', () => {
  const d = cizim.koseliKare(10, 20, 100, 140, 30)
  for (const nokta of noktalar(d)) {
    assert.ok(nokta.x >= 9.99 && nokta.x <= 110.01, `x disarida: ${nokta.x}`)
    assert.ok(nokta.y >= 19.99 && nokta.y <= 160.01, `y disarida: ${nokta.y}`)
  }
})

test('koseli kare dort koseyi de yuvarlatir ve yolu kapatir', () => {
  const d = cizim.koseliKare(0, 0, 200, 200, 45)
  assert.ok(d.startsWith('M '))
  assert.ok(d.endsWith('Z'))
  assert.equal((d.match(/A /g) ?? []).length, 4, 'her kosede bir yay olmali')
  assert.equal((d.match(/C /g) ?? []).length, 8, 'her yayin iki yaninda birer Bezier olmali')
})

test('kare sekil kosegene gore bakisimlidir', () => {
  // Kose cozumu dogruysa (x,y) noktalarinin kumesi (y,x) kumesiyle ayni olur.
  const kume = new Set(noktalar(cizim.koseliKare(0, 0, 300, 300, 60)).map((n) => `${n.x},${n.y}`))
  for (const anahtar of kume) {
    const [x, y] = anahtar.split(',')
    assert.ok(kume.has(`${y},${x}`), `${anahtar} noktasinin kosegen esi yok`)
  }
})

test('asiri yaricap kenarin yarisina cekilir, sekil kendi uzerine binmez', () => {
  // Yaricap 500 istendi ama kenar 100; kose isteneni degil sigani kullanmali.
  const d = cizim.koseliKare(0, 0, 100, 100, 500)
  for (const nokta of noktalar(d)) {
    assert.ok(nokta.x >= -0.01 && nokta.x <= 100.01, `x disarida: ${nokta.x}`)
    assert.ok(nokta.y >= -0.01 && nokta.y <= 100.01, `y disarida: ${nokta.y}`)
  }
  // Yay yaricapi kenarin yarisini asamaz.
  const yay = /A (-?\d+(?:\.\d+)?) /.exec(d)
  assert.ok(Number(yay[1]) <= 50.01, `yay yaricapi ${yay[1]}`)
})

test('macOS yerlesimi 1024 tuvalde 824 govde birakir', () => {
  // Apple'in sablonu: simge tuvali doldurmaz, yoksa Dock'ta komsularindan
  // buyuk durur. Kullanicinin bildirdigi sorun tam olarak buydu.
  const { katmanlar } = cizim.sahne(1024, { yerlesim: 'macos' })
  const p = noktalar(katmanlar.find((k) => k.ad === 'govde').d)

  yakin(cizim.MACOS_GOVDE * 1024, 824, 0.5)
  yakin(Math.min(...p.map((n) => n.x)), 100, 1)
  yakin(Math.max(...p.map((n) => n.x)), 924, 1)
  yakin(Math.min(...p.map((n) => n.y)), 100, 1)
  yakin(Math.max(...p.map((n) => n.y)), 924, 1)
})

test('duz yerlesim tuvali doldurur ama kenara yapismaz', () => {
  const { katmanlar } = cizim.sahne(512, { yerlesim: 'duz' })
  const p = noktalar(katmanlar.find((k) => k.ad === 'govde').d)
  const enKucuk = Math.min(...p.map((n) => Math.min(n.x, n.y)))
  const enBuyuk = Math.max(...p.map((n) => Math.max(n.x, n.y)))

  assert.ok(enKucuk >= 0, `govde tuvalin disina tasmis: ${enKucuk}`)
  assert.ok(enKucuk <= 512 * 0.04, `govde tuvalin fazla icinde kalmis: ${enKucuk}`)
  assert.ok(enBuyuk <= 512, `govde tuvalin disina tasmis: ${enBuyuk}`)
})

test('her katman tuvalin icinde kalir', () => {
  for (const boyut of [16, 32, 128, 512, 1024]) {
    for (const yerlesim of ['macos', 'duz']) {
      const { katmanlar } = cizim.sahne(boyut, { yerlesim })
      for (const katman of katmanlar) {
        // Siluet fotografa kirpildigi icin disari tasabilir; kirpilmayanlar
        // tuvalin icinde durmali.
        if (katman.kirp) continue
        for (const sayi of sayilar(katman.d)) {
          assert.ok(sayi >= -1 && sayi <= boyut + 1, `${boyut}/${yerlesim}: ${sayi}`)
        }
      }
    }
  }
})

test('kesim isaretleri yalnizca buyuk boyutlarda cizilir', () => {
  const kesimSayisi = (boyut) =>
    cizim.sahne(boyut, {}).katmanlar.filter((k) => k.ad.startsWith('kesim')).length

  assert.equal(kesimSayisi(16), 0)
  assert.equal(kesimSayisi(64), 0)
  assert.equal(kesimSayisi(128), 4)
  assert.equal(kesimSayisi(1024), 4)
})

test('kucuk boyutlarda kenarlar tam piksele oturur', () => {
  // Yarim piksele denk gelen kenar antialias ile griye yayilir ve 16 px'lik
  // simge bulaniklasir.
  for (const boyut of [16, 24, 32, 48, 64]) {
    const { katmanlar } = cizim.sahne(boyut, { yerlesim: 'duz' })
    const p = noktalar(katmanlar.find((k) => k.ad === 'fotograf').d)
    const sol = Math.min(...p.map((n) => n.x))
    const sag = Math.max(...p.map((n) => n.x))
    assert.equal(sol, Math.round(sol), `${boyut} px: fotografin sol kenari ${sol}`)
    assert.equal(sag, Math.round(sag), `${boyut} px: fotografin sag kenari ${sag}`)
  }
})

test('golge kucuk boyutlarda kapatilir', () => {
  const golgeliMi = (boyut) => cizim.sahne(boyut, {}).katmanlar.some((k) => k.golge)
  assert.equal(golgeliMi(32), false)
  assert.equal(golgeliMi(256), true)
})

test('SVG kaynak tum katmanlari tasir', () => {
  const svg = cizim.svgUret(1024, { yerlesim: 'macos' })
  const { katmanlar } = cizim.sahne(1024, { yerlesim: 'macos' })
  assert.ok(svg.startsWith('<?xml'))
  assert.ok(svg.includes('viewBox="0 0 1024 1024"'))
  const kirpmaSayisi = katmanlar.filter((k) => k.kirp).length
  assert.equal(
    (svg.match(/<path /g) ?? []).length,
    katmanlar.length + kirpmaSayisi,
    'katmanlar ve kirpma yollari eksiksiz yazilmali'
  )
  assert.ok(svg.includes('#f59e0b'), 'kehribar zemin rengi yazilmali')
})

// --- Kaplar -------------------------------------------------------------

// Govde onemli degil; kap yaziclari icerige bakmaz.
const sahtePng = (boyut) => Buffer.from(`png-${boyut}`.padEnd(32, '.'))

test('ICO basligi girdileri dogru konum ve uzunlukla gosterir', () => {
  const boyutlar = [16, 32, 256]
  const govde = kap.icoUret(boyutlar.map((boyut) => ({ boyut, png: sahtePng(boyut) })))

  assert.equal(govde.readUInt16LE(0), 0)
  assert.equal(govde.readUInt16LE(2), 1)
  assert.equal(govde.readUInt16LE(4), boyutlar.length)

  for (const [sira, boyut] of boyutlar.entries()) {
    const yer = 6 + sira * 16
    // 256 alana sigmaz, bicim bunu 0 ile gosterir.
    assert.equal(govde.readUInt8(yer), boyut === 256 ? 0 : boyut)
    assert.equal(govde.readUInt16LE(yer + 6), 32, 'renk derinligi')

    const uzunluk = govde.readUInt32LE(yer + 8)
    const konum = govde.readUInt32LE(yer + 12)
    assert.deepEqual(govde.subarray(konum, konum + uzunluk), sahtePng(boyut))
  }
})

test('ICO 256 pikselden buyugunu reddeder', () => {
  assert.throws(() => kap.icoUret([{ boyut: 512, png: sahtePng(512) }]), /256/)
})

test('ICNS basligi ve oge uzunluklari dosya ile tutarli', () => {
  const pngler = new Map(
    [...new Set(kap.ICNS_TURLERI.map((t) => t.piksel))].map((n) => [n, sahtePng(n)])
  )
  const govde = kap.icnsUret(pngler)

  assert.equal(govde.subarray(0, 4).toString('ascii'), 'icns')
  assert.equal(govde.readUInt32BE(4), govde.length, 'baslikta yazan uzunluk dosyayla ayni degil')

  const turler = []
  let yer = 8
  while (yer < govde.length) {
    const tur = govde.subarray(yer, yer + 4).toString('ascii')
    const uzunluk = govde.readUInt32BE(yer + 4)
    assert.ok(uzunluk >= 8 && yer + uzunluk <= govde.length, `${tur} uzunlugu bozuk: ${uzunluk}`)
    turler.push(tur)
    yer += uzunluk
  }

  assert.equal(yer, govde.length, 'ogeler dosyayi tam doldurmali')
  assert.equal(turler[0], 'TOC ', 'icindekiler tablosu basta olmali')
  assert.deepEqual(turler.slice(1), kap.ICNS_TURLERI.map((t) => t.tur))
})

test('ICNS eksik boyutla uretilmez', () => {
  assert.throws(() => kap.icnsUret(new Map([[16, sahtePng(16)]])), /uretilmemis/)
})

// --- Depoya islenmis dosyalar -------------------------------------------

// PNG'nin ilk parcasi IHDR; olculeri 16. bayttan itibaren durur.
function pngOlcusu (govde) {
  assert.equal(govde.readUInt32BE(0), 0x89504e47, 'PNG imzasi yok')
  return { en: govde.readUInt32BE(16), boy: govde.readUInt32BE(20) }
}

test('islenmis icon.ico gecerli ve her girdisi bildirdigi olcude', (t) => {
  const dosya = path.join(simgeKlasoru, 'icon.ico')
  if (!fs.existsSync(dosya)) return t.skip('simgeler uretilmemis: npm run simge')

  const govde = fs.readFileSync(dosya)
  const adet = govde.readUInt16LE(4)
  assert.ok(adet >= 6, `ICO icinde yalnizca ${adet} boyut var`)

  for (let sira = 0; sira < adet; sira += 1) {
    const yer = 6 + sira * 16
    const bildirilen = govde.readUInt8(yer) || 256
    const png = govde.subarray(
      govde.readUInt32LE(yer + 12),
      govde.readUInt32LE(yer + 12) + govde.readUInt32LE(yer + 8)
    )
    assert.deepEqual(pngOlcusu(png), { en: bildirilen, boy: bildirilen })
  }
})

test('islenmis icon.icns gecerli ve macOS boyutlarinin tamamini tasir', (t) => {
  const dosya = path.join(simgeKlasoru, 'icon.icns')
  if (!fs.existsSync(dosya)) return t.skip('simgeler uretilmemis: npm run simge')

  const govde = fs.readFileSync(dosya)
  assert.equal(govde.subarray(0, 4).toString('ascii'), 'icns')
  assert.equal(govde.readUInt32BE(4), govde.length)

  const bulunan = new Map()
  let yer = 8
  while (yer < govde.length) {
    const tur = govde.subarray(yer, yer + 4).toString('ascii')
    const uzunluk = govde.readUInt32BE(yer + 4)
    if (tur !== 'TOC ') bulunan.set(tur, pngOlcusu(govde.subarray(yer + 8, yer + uzunluk)))
    yer += uzunluk
  }

  for (const { tur, piksel, ad } of kap.ICNS_TURLERI) {
    assert.deepEqual(bulunan.get(tur), { en: piksel, boy: piksel }, `${ad} (${tur}) eksik ya da bozuk`)
  }
})

test('islenmis Linux PNG dosyalari beklenen olculerde', (t) => {
  if (!fs.existsSync(simgeKlasoru)) return t.skip('simgeler uretilmemis: npm run simge')

  for (const boyut of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    const dosya = path.join(simgeKlasoru, `${boyut}x${boyut}.png`)
    assert.ok(fs.existsSync(dosya), `${boyut}x${boyut}.png yok`)
    assert.deepEqual(pngOlcusu(fs.readFileSync(dosya)), { en: boyut, boy: boyut })
  }

  assert.deepEqual(pngOlcusu(fs.readFileSync(path.join(simgeKlasoru, 'icon.png'))), {
    en: 512,
    boy: 512
  })
})
