'use strict'

// electron-builder afterPack kancasi: macOS paketini ad-hoc imzalar.
//
// Neden gerekli: Apple Silicon'da cekirdek, imzasiz bir arm64 ikilisini
// calistirmayi reddeder — uygulama acilmaz, "bozuk" der. Intel'de imzasiz
// paket calisir ama arm64'te calismaz. Developer ID sertifikamiz olmadigi
// icin ad-hoc imza (`codesign --sign -`) kullaniliyor: imza gecerlidir,
// kimlige bagli degildir.
//
// Ad-hoc imza Gatekeeper'i gecmez. Indirilen paket karantinaya alindigi icin
// kullanici ilk acilista sag tik -> Ac demek zorunda kalir. Cozumu Developer
// ID ile imzalayip noter onayina gondermektir; o adim henuz yok.

const { execFileSync } = require('node:child_process')

exports.default = async function imzala (baglam) {
  if (baglam.electronPlatformName !== 'darwin') return

  // codesign yalnizca macOS'ta var. Baska bir isletim sisteminde macOS
  // paketi uretiliyorsa imza atlanir; zaten dmg de uretilemez.
  if (process.platform !== 'darwin') {
    console.log('  • ad-hoc imza atlandi (codesign yalnizca macOS ta bulunur)')
    return
  }

  const uygulama = `${baglam.appOutDir}/${baglam.packager.appInfo.productFilename}.app`

  // --deep ic ice gecmis cerceveleri ve yardimci uygulamalari da imzalar.
  // Apple bunu kimlikli imzalar icin onermez ama ad-hoc imzada beklendigi
  // gibi calisir ve tek adimda biter.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', uygulama], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', uygulama], { stdio: 'inherit' })

  console.log(`  • ad-hoc imzalandi  arch=${baglam.arch} app=${uygulama}`)
}
