'use strict'

// ICC profiliyle CMYK ayrimi (Little CMS).
//
// Testler sistemde kurulu bir CMYK profili arar; bulunamazsa atlanir. Depoya
// profil konmuyor: ICC dosyalari baskasinin telifli verisi olabiliyor ve
// isletim sistemleri zaten bir dizi profille geliyor.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const icc = require('../src/main/icc.js')
const renk = require('../src/renderer/js/renk.js')

// Isletim sistemlerinin profil klasorleri.
const KLASORLER = [
  path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'spool', 'drivers', 'color'),
  '/System/Library/ColorSync/Profiles',
  '/Library/ColorSync/Profiles',
  '/usr/share/color/icc',
  '/usr/share/color/icc/colord'
]

// Adindan CMYK oldugu anlasilan profiller once denenir; hepsini acip bakmak
// yavas olurdu.
const ADAYLAR = /(swop|fogra|coated|japancolor|cmyk|euroscale|sheetfed|newsprint)/i

function cmykProfiliBul () {
  for (const klasor of KLASORLER) {
    let dosyalar = []
    try {
      dosyalar = fs.readdirSync(klasor).filter((ad) => /\.(icc|icm)$/i.test(ad))
    } catch {
      continue
    }

    const sirali = [
      ...dosyalar.filter((ad) => ADAYLAR.test(ad)),
      ...dosyalar.filter((ad) => !ADAYLAR.test(ad))
    ]

    for (const ad of sirali.slice(0, 12)) {
      const yol = path.join(klasor, ad)
      // Uzay bilgisi profilin basligindaki 16. bayttan itibaren durur; dosyayi
      // acmadan once bakmak taramayi hizlandirir.
      try {
        const bas = Buffer.alloc(20)
        const dosya = fs.openSync(yol, 'r')
        fs.readSync(dosya, bas, 0, 20, 0)
        fs.closeSync(dosya)
        if (bas.toString('latin1', 16, 20) === 'CMYK') return yol
      } catch { /* okunamayan dosya */ }
    }
  }
  return null
}

const PROFIL = cmykProfiliBul()
const ATLAMA = PROFIL ? null : 'sistemde CMYK profili bulunamadı'

test('profil adi ve renk uzayi okunuyor', async (t) => {
  if (ATLAMA) return t.skip(ATLAMA)

  const bilgi = await icc.profilBilgisi(await fs.promises.readFile(PROFIL))
  assert.equal(bilgi.uzay, 'CMYK')
  assert.ok(bilgi.ad && bilgi.ad.length > 2, `ad okunamadi: ${bilgi.ad}`)
})

test('CMYK olmayan profil ayirt edilir', () => {
  assert.equal(icc.cmykMi('CMYK'), true)
  assert.equal(icc.cmykMi('cmyk'), true)
  assert.equal(icc.cmykMi('RGB'), false)
  assert.equal(icc.cmykMi('GRAY'), false)
  assert.equal(icc.cmykMi(null), false)
})

test('profilli ayrim ten rengine siyah karistirmiyor', async (t) => {
  if (ATLAMA) return t.skip(ATLAMA)

  const ten = [235, 190, 165]
  const cikti = await icc.cmykeCevir({
    rgb: new Uint8Array([255, 255, 255, 0, 0, 0, ...ten]),
    piksel: 3,
    profilBaytlari: await fs.promises.readFile(PROFIL)
  })

  assert.equal(cikti.length, 12)

  // Kagit beyazi: hicbir murekkep yok.
  assert.deepEqual(Array.from(cikti.subarray(0, 4)), [0, 0, 0, 0])

  // Siyah: profilli ayrim zengin siyah kurar, yalnizca K degil.
  const siyah = Array.from(cikti.subarray(4, 8))
  assert.ok(siyah[3] > 200, `K ${siyah[3]}`)
  assert.ok(siyah[0] + siyah[1] + siyah[2] > 100, `CMY ${siyah.slice(0, 3)}`)

  // Asil kazanc: aygit cevrimi ten rengine siyah katiyor, profilli katmiyor.
  const profilliK = cikti[11]
  const aygitK = renk.rgbdenCmyk(...ten)[3]
  assert.ok(aygitK > 0, `aygit cevrimi K ${aygitK}`)
  assert.ok(profilliK < aygitK, `profilli K ${profilliK}, aygit K ${aygitK}`)
})

test('gecersiz veri ve profil reddediliyor', async (t) => {
  if (ATLAMA) return t.skip(ATLAMA)

  const profilBaytlari = await fs.promises.readFile(PROFIL)

  await assert.rejects(
    () => icc.cmykeCevir({ rgb: new Uint8Array(5), piksel: 3, profilBaytlari }),
    /uyuşmuyor/
  )
  await assert.rejects(
    () => icc.cmykeCevir({
      rgb: new Uint8Array(9), piksel: 3, profilBaytlari: new Uint8Array(64)
    }),
    /okunamadı/
  )
})

test('ayarlar ICC profilini dogruluyor', () => {
  const ayarlar = require('../src/main/ayarlar.js')

  assert.deepEqual(
    ayarlar.iccProfiliTemizle({ yol: '/profiller/matbaa.icc', ad: 'Matbaa' }),
    { yol: '/profiller/matbaa.icc', ad: 'Matbaa' }
  )
  // Ad verilmemisse dosya adindan turetilir.
  assert.equal(ayarlar.iccProfiliTemizle({ yol: '/a/b/Foto.icm' }).ad, 'Foto.icm')

  assert.equal(ayarlar.iccProfiliTemizle({ yol: '/a/b/resim.png' }), null)
  assert.equal(ayarlar.iccProfiliTemizle({ yol: '' }), null)
  assert.equal(ayarlar.iccProfiliTemizle(null), null)
  assert.equal(ayarlar.iccProfiliTemizle({ yol: `/${'x'.repeat(600)}.icc` }), null)
  assert.equal(ayarlar.ayarlariDogrula({ iccProfili: { yol: 'bozuk' } }).iccProfili, null)
})
