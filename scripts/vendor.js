'use strict'

// Bootstrap'in dağıtım dosyalarını node_modules'tan renderer'ın yanına kopyalar.
// Arayüz CDN kullanmadığı için (bkz. AGENTS.md, kural 6) dosyaların uygulamayla
// birlikte paketlenmesi gerekir. `npm install` sonrası otomatik çalışır.

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'node_modules', 'bootstrap', 'dist')
const target = path.join(root, 'src', 'renderer', 'vendor', 'bootstrap')

const files = [
  path.join('css', 'bootstrap.min.css'),
  path.join('js', 'bootstrap.bundle.min.js')
]

if (!fs.existsSync(source)) {
  console.error('bootstrap bulunamadi. Once "npm install" calistirin.')
  process.exit(1)
}

for (const file of files) {
  const from = path.join(source, file)
  const to = path.join(target, file)

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log('kopyalandi:', path.relative(root, to))
}
