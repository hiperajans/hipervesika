'use strict'

// DPI meta verisi yazma/okuma testleri.

const test = require('node:test')
const assert = require('node:assert/strict')

const metaveri = require('../src/renderer/js/metaveri.js')

// --- Kucuk gecerli dosyalar uretmek icin yardimcilar --------------------------

function crcliParca (tur, veri) {
  const parca = new Uint8Array(12 + veri.length)
  const gorunum = new DataView(parca.buffer)
  gorunum.setUint32(0, veri.length)
  for (let i = 0; i < 4; i++) parca[4 + i] = tur.charCodeAt(i)
  parca.set(veri, 8)
  gorunum.setUint32(8 + veri.length, metaveri.crc32(parca.subarray(4, 8 + veri.length)))
  return parca
}

function ornekPng ({ pHYsEkle = false } = {}) {
  const imza = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const ihdr = crcliParca('IHDR', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]))
  const idat = crcliParca('IDAT', new Uint8Array([1, 2, 3, 4]))
  const iend = crcliParca('IEND', new Uint8Array(0))

  const parcalar = [ihdr]
  if (pHYsEkle) {
    // Eski, yanlis bir pHYs: yazma isleminin bunu atmasi gerekir.
    parcalar.push(crcliParca('pHYs', new Uint8Array([0, 0, 0x0b, 0x12, 0, 0, 0x0b, 0x12, 1])))
  }
  parcalar.push(idat, iend)

  const toplam = imza.length + parcalar.reduce((t, p) => t + p.length, 0)
  const sonuc = new Uint8Array(toplam)
  sonuc.set(imza, 0)
  let konum = imza.length
  for (const parca of parcalar) {
    sonuc.set(parca, konum)
    konum += parca.length
  }
  return sonuc
}

function ornekJpeg ({ jfifli = true } = {}) {
  const govde = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]
  if (!jfifli) return new Uint8Array([0xff, 0xd8, ...govde])

  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01,
    0x00, // birim: yok
    0x00, 0x01, 0x00, 0x01, // yogunluk 1x1
    0x00, 0x00,
    ...govde
  ])
}

// --- PNG ---------------------------------------------------------------------

test('PNG icin DPI yazilir ve geri okunur', () => {
  const yazili = metaveri.pngDpiYaz(ornekPng(), 300)
  assert.equal(metaveri.dpiOku(yazili), 300)
})

test('PNG pHYs parcasi IHDR ile IDAT arasina girer', () => {
  const yazili = metaveri.pngDpiYaz(ornekPng(), 300)
  const metin = Buffer.from(yazili).toString('latin1')

  assert.ok(metin.indexOf('IHDR') < metin.indexOf('pHYs'), 'pHYs IHDR oncesinde')
  assert.ok(metin.indexOf('pHYs') < metin.indexOf('IDAT'), 'pHYs IDAT sonrasinda')
})

test('PNG icinde birden fazla pHYs birikmez', () => {
  const yazili = metaveri.pngDpiYaz(metaveri.pngDpiYaz(ornekPng({ pHYsEkle: true }), 300), 600)
  const metin = Buffer.from(yazili).toString('latin1')

  assert.equal(metin.split('pHYs').length - 1, 1)
  assert.equal(metaveri.dpiOku(yazili), 600)
})

test('PNG yazimi IDAT ve IEND parcalarini korur', () => {
  const once = ornekPng()
  const sonra = metaveri.pngDpiYaz(once, 300)
  const metin = Buffer.from(sonra).toString('latin1')

  assert.ok(metin.includes('IDAT'))
  assert.ok(metin.endsWith('IEND' + Buffer.from(sonra.subarray(-4)).toString('latin1')))
  // Eklenen tek sey 21 baytlik pHYs parcasi olmali.
  assert.equal(sonra.length, once.length + 21)
})

test('PNG olmayan veri reddedilir', () => {
  assert.throws(() => metaveri.pngDpiYaz(new Uint8Array([1, 2, 3, 4]), 300), /PNG/)
})

// --- JPEG --------------------------------------------------------------------

test('JFIF basligi olan JPEG guncellenir, boyu degismez', () => {
  const once = ornekJpeg()
  const sonra = metaveri.jpegDpiYaz(once, 300)

  assert.equal(sonra.length, once.length)
  assert.equal(metaveri.dpiOku(sonra), 300)
  assert.equal(sonra[13], 1, 'birim inc olmali')
})

test('JFIF basligi olmayan JPEG icin baslik eklenir', () => {
  const once = ornekJpeg({ jfifli: false })
  const sonra = metaveri.jpegDpiYaz(once, 600)

  assert.equal(sonra.length, once.length + 18)
  assert.equal(metaveri.dpiOku(sonra), 600)
  // SOI basta kalmali
  assert.equal(sonra[0], 0xff)
  assert.equal(sonra[1], 0xd8)
  // Sonrasinda APP0 gelmeli
  assert.equal(sonra[2], 0xff)
  assert.equal(sonra[3], 0xe0)
})

test('JPEG govdesi degismeden kalir', () => {
  const once = ornekJpeg()
  const sonra = metaveri.jpegDpiYaz(once, 300)

  // JFIF segmenti 20 bayt; sonrasi birebir ayni olmali.
  assert.deepEqual(Array.from(sonra.subarray(20)), Array.from(once.subarray(20)))
})

test('JPEG olmayan veri reddedilir', () => {
  assert.throws(() => metaveri.jpegDpiYaz(new Uint8Array([1, 2, 3, 4]), 300), /JPEG/)
})

test('dpiYaz tur secimine gore dogru yazici kullanir', () => {
  assert.equal(metaveri.dpiOku(metaveri.dpiYaz(ornekPng(), 300, 'png')), 300)
  assert.equal(metaveri.dpiOku(metaveri.dpiYaz(ornekJpeg(), 300, 'jpg')), 300)
})

test('yaygin DPI degerleri yuvarlanma hatasi olmadan geri okunur', () => {
  for (const dpi of [150, 300, 600]) {
    assert.equal(metaveri.dpiOku(metaveri.pngDpiYaz(ornekPng(), dpi)), dpi, `png ${dpi}`)
    assert.equal(metaveri.dpiOku(metaveri.jpegDpiYaz(ornekJpeg(), dpi)), dpi, `jpeg ${dpi}`)
  }
})
