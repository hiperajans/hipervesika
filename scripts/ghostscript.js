'use strict'

// Ghostscript'i pakete hazirlar: bu makinedeki kurulumu vendor/ghostscript/
// <platform>/ altina kopyalar. electron-builder oradan alip paketin kaynaklar
// klasorune tasir (bkz. electron-builder.yml -> extraResources).
//
// Neden kopyalaniyor da indirilmiyor: Ghostscript'in resmi dagitimi her
// platformda ayri bicimde geliyor (Windows'ta kurulum programi, macOS'ta hic
// resmi ikili yok, Linux'ta tgz). Paketleme makinesinde zaten kurulu olan
// surumu kullanmak hem tek yol hem de kontrollu olan: hangi surumun dagitildigi
// paketleyenin bildigi bir sey olur.
//
// LISANS UYARISI: Ghostscript AGPL ile geliyor. Uygulamayla birlikte dagitmak
// ya tum urunun AGPL olmasini ya da Artifex'ten ticari lisans alinmasini
// gerektirir; ayrica Microsoft Store ve Mac App Store AGPL ikili tasiyan
// paketleri kabul etmiyor. Karar paketleyene aittir; bu betik yalnizca
// kopyalama isini yapar ve her calistiginda uyariyi yazar.
//
// Calistirma:  npm run ghostscript

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ghostscript = require('../src/main/ghostscript.js')

const DEPO = path.resolve(__dirname, '..')
const HEDEF_KOK = path.join(DEPO, 'vendor')

// Kopyalanacak alt klasorler. doc/ ve examples/ alinmaz: paketi 20 MB'den
// fazla sisiriyorlar ve calisma zamaninda okunmuyorlar.
const KLASORLER = ['lib', 'Resource', 'iccprofiles']

function bicimliBoyut (bayt) {
  const mb = bayt / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function klasorBoyutu (klasor) {
  let toplam = 0
  for (const oge of fs.readdirSync(klasor, { withFileTypes: true })) {
    const yol = path.join(klasor, oge.name)
    toplam += oge.isDirectory() ? klasorBoyutu(yol) : fs.statSync(yol).size
  }
  return toplam
}

// macOS'ta ikili Homebrew'in kitapliklarina bagli olabilir; oyleyse yalniz
// ikiliyi kopyalamak calismayan bir paket uretir. Durum tespit edilip
// paketleyene soylenir, sessizce bozuk bir paket uretilmez.
function macBagimliliklari (ikili) {
  try {
    const cikti = execFileSync('otool', ['-L', ikili], { encoding: 'utf8' })
    return cikti.split('\n')
      .map((satir) => satir.trim().split(' ')[0])
      .filter((yol) => yol.startsWith('/') &&
        !yol.startsWith('/usr/lib/') && !yol.startsWith('/System/'))
  } catch {
    return []
  }
}

function main () {
  const platform = process.platform
  const bulunan = ghostscript.bul({ platform })

  if (!bulunan) {
    console.error(
      'Ghostscript bulunamadı. Paketlemeden önce bu makineye kurun:\n' +
      '  Windows: https://ghostscript.com/releases/gsdnld.html\n' +
      '  macOS:   brew install ghostscript\n' +
      '  Linux:   apt install ghostscript  (ya da dağıtımın karşılığı)'
    )
    process.exitCode = 1
    return
  }

  const surum = execFileSync(bulunan.yol, ['--version'], { encoding: 'utf8' }).trim()
  const kaynakKok = path.dirname(path.dirname(bulunan.yol))
  const hedef = ghostscript.paketKlasoru(HEDEF_KOK, platform)
  const hedefBin = path.join(hedef, 'bin')

  fs.rmSync(hedef, { recursive: true, force: true })
  fs.mkdirSync(hedefBin, { recursive: true })

  // Ikili ve yanindaki kitapliklar. Windows'ta gswin64c.exe tek basina
  // calismaz, gsdll64.dll ayni klasorde olmali.
  const kaynakBin = path.dirname(bulunan.yol)
  for (const ad of fs.readdirSync(kaynakBin)) {
    if (/\.(lib|def|exp)$/i.test(ad)) continue
    const kaynak = path.join(kaynakBin, ad)
    if (!fs.statSync(kaynak).isFile()) continue
    fs.copyFileSync(kaynak, path.join(hedefBin, ad))
  }

  // PostScript baslangic dosyalari ve kaynaklar. POSIX'te kurulum bunlari
  // share/ghostscript/<surum> altinda tutuyor.
  const kaynakKlasorler = [
    ...KLASORLER.map((ad) => path.join(kaynakKok, ad)),
    path.join(kaynakKok, 'share', 'ghostscript', surum)
  ]

  for (const kaynak of kaynakKlasorler) {
    if (!fs.existsSync(kaynak)) continue
    const ad = path.basename(kaynak)
    // share/ghostscript/<surum> icerigi dogrudan koke acilir; Ghostscript
    // kendi lib/ ve Resource/ klasorlerini ikilinin yaninda arar.
    const hedefAlt = ad === surum ? hedef : path.join(hedef, ad)
    fs.cpSync(kaynak, hedefAlt, { recursive: true })
  }

  const kopyalananIkili = path.join(hedefBin, path.basename(bulunan.yol))

  if (platform === 'darwin') {
    const bagimliliklar = macBagimliliklari(kopyalananIkili)
    if (bagimliliklar.length) {
      console.warn(
        'UYARI: Kopyalanan ikili sistem dışı kitaplıklara bağlı:\n  ' +
        bagimliliklar.join('\n  ') +
        '\nBu kitaplıklar pakete girmezse uygulama açıldığı makinede çalışmaz. ' +
        'Statik derlenmiş bir Ghostscript kullanın ya da kitaplıkları elle taşıyıp ' +
        'install_name_tool ile yollarını düzeltin.'
      )
    }
  }

  // Kopyanin gercekten calistigi dogrulanir; eksik dosya en gec burada belli
  // olur, kullanicinin makinesinde degil.
  let kopyaSurumu = null
  try {
    kopyaSurumu = execFileSync(kopyalananIkili, ['--version'], { encoding: 'utf8' }).trim()
  } catch (hata) {
    console.error(`Kopyalanan Ghostscript çalışmadı: ${hata.message}`)
    process.exitCode = 1
    return
  }

  console.log(
    `ghostscript hazir: ${kopyaSurumu}, ${bicimliBoyut(klasorBoyutu(hedef))} ` +
    `-> ${path.relative(DEPO, hedef)}`
  )
  console.log(
    'Lisans: Ghostscript AGPL ile dağıtılır. Uygulamayla birlikte paketlemek ' +
    'ürünün de AGPL olmasını ya da Artifex ticari lisansını gerektirir; ' +
    'mağaza sürümlerinde bu paket kullanılmamalıdır.'
  )
}

main()
