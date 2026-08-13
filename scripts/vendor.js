'use strict'

// Bootstrap ve Human'in calisma zamani dosyalarini node_modules'tan renderer'in
// yanina kopyalar. Uygulama internet olmadan calismak zorunda oldugu icin
// (bkz. AGENTS.md, kural 6) bu dosyalar CDN'den degil diskten yuklenir.
// `npm install` sonrasi otomatik calisir.

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const hedefKok = path.join(root, 'src', 'renderer', 'vendor')

// Human'in tum model seti 28 MB; yalnizca kullandigimiz modeller kopyalanir.
//   blazeface       -> yuz bulma
//   facemesh        -> goz ve cene noktalari (egiklik ve yerlesim hesabi)
//   movenet-lightning -> govde pozu (omuz hizasi)
const MODELLER = ['blazeface', 'facemesh', 'movenet-lightning']

// Segmentasyon modeli human paketiyle gelmiyor, ayri model deposundan alinir.
// selfie ve meet modelleri denendi; bos maske urettikleri icin alpha matte
// veren rvm kullaniliyor.
const SEGMENTASYON_MODELLERI = ['rvm']

const kopyalanacaklar = [
  {
    kaynak: path.join(root, 'node_modules', 'bootstrap', 'dist'),
    hedef: path.join(hedefKok, 'bootstrap'),
    dosyalar: [path.join('css', 'bootstrap.min.css'), path.join('js', 'bootstrap.bundle.min.js')]
  },
  {
    kaynak: path.join(root, 'node_modules', '@vladmandic', 'human', 'dist'),
    hedef: path.join(hedefKok, 'human'),
    dosyalar: ['human.js']
  },
  {
    kaynak: path.join(root, 'node_modules', '@vladmandic', 'human', 'models'),
    hedef: path.join(hedefKok, 'human', 'models'),
    dosyalar: MODELLER.flatMap((ad) => [`${ad}.json`, `${ad}.bin`])
  },
  {
    kaynak: path.join(root, 'node_modules', '@vladmandic', 'human-models', 'models'),
    hedef: path.join(hedefKok, 'human', 'models'),
    dosyalar: SEGMENTASYON_MODELLERI.flatMap((ad) => [`${ad}.json`, `${ad}.bin`])
  }
]

let toplamBayt = 0

for (const grup of kopyalanacaklar) {
  if (!fs.existsSync(grup.kaynak)) {
    console.error(`kaynak bulunamadi: ${path.relative(root, grup.kaynak)}. Once "npm install" calistirin.`)
    process.exit(1)
  }

  for (const dosya of grup.dosyalar) {
    const from = path.join(grup.kaynak, dosya)
    const to = path.join(grup.hedef, dosya)

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    toplamBayt += fs.statSync(to).size
  }
}

console.log(
  `vendor hazir: ${kopyalanacaklar.reduce((t, g) => t + g.dosyalar.length, 0)} dosya, ` +
  `${(toplamBayt / (1024 * 1024)).toFixed(1)} MB`
)
