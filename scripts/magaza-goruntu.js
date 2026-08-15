'use strict'

// Magaza listelemesi icin ekran goruntuleri uretir: `npm run magaza`
//
// Gercek uygulamayi acar, her magazanin istedigi olcude bir pencere kurar ve
// dort sahnenin goruntusunu alir. Elle ekran goruntusu almanin iki sorunu
// vardi: olculer tutmuyordu ve her surumde bastan cekmek gerekiyordu.
//
// Fotograf kaynagi testlerdekiyle ayni (bkz. test/uctan-uca/ortam.js):
//   HV_FOTOGRAFLAR=~/vesikalik-ornekleri npm run magaza
// Degisken ayarli degilse sentetik portre kullanilir; goruntuler o zaman
// yalnizca yerlesimi gosterir, magazaya gonderilmez. Gercek fotograf varsa
// otomatik hizalama ve arka plan beyazlatma da calistirilir.
//
// Cikti release/magaza/ altina yazilir; release/ .gitignore'da, boylece gercek
// bir yuz iceren goruntu kazara depoya girmez (AGENTS.md, kural 5).

const path = require('node:path')
const fs = require('node:fs')

const ortam = require('../test/uctan-uca/ortam.js')

const KOK = path.resolve(__dirname, '..')
const CIKTI = path.join(KOK, 'release', 'magaza')

// Magazalarin kabul ettigi olculer:
//   Microsoft Store  en az 1366x768; 1920x1080 her listelemede iyi duruyor.
//   Mac App Store    yalnizca 1280x800, 1440x900, 2560x1600, 2880x1800 kabul
//                    ediliyor. 2880x1800 = 1440x900 pencere, iki kat piksel
//                    yogunlugu (--force-device-scale-factor=2).
const MAGAZALAR = [
  { kod: 'microsoft', ad: 'Microsoft Store', genislik: 1920, yukseklik: 1080, olcek: 1 },
  { kod: 'apple', ad: 'Mac App Store', genislik: 1440, yukseklik: 900, olcek: 2 }
]

// Islem bitene kadar bekler; bekleme penceresi hem hizalamada hem beyazlatmada
// aciliyor, goruntude kalmamali.
async function islemiBekle (sayfa) {
  await sayfa.waitForSelector('#islem-modali.show', { state: 'hidden', timeout: 300000 })
  await sayfa.waitForTimeout(600)
}

// Sahneler sirayla kurulur: her biri bir oncekinin birakti yerden devam eder.
const SAHNELER = [
  {
    ad: 'kadraj',
    async kur (sayfa, { gercek }) {
      await ortam.adima(sayfa, 'kadraj')
      if (!gercek) return

      await sayfa.click('#btn-otomatik-hizala')
      await islemiBekle(sayfa)
    }
  },
  {
    ad: 'rotus',
    async kur (sayfa, { gercek }) {
      await ortam.adima(sayfa, 'rotus')
      if (!gercek) return

      await sayfa.click('#arkaplan-beyazlat')
      await islemiBekle(sayfa)
    }
  },
  {
    ad: 'sayfa',
    async kur (sayfa) {
      await ortam.adima(sayfa, 'cikti')
      await sayfa.click('label[for="gorunum-sayfa"]')
      await sayfa.waitForTimeout(1200)
    }
  },
  {
    ad: 'basit-mod',
    async kur (sayfa, { uygulama }) {
      // Menu ogesinin isleyicisi dogrudan cagrilir: isletim sisteminin
      // menusune tiklamak buradan mumkun degil.
      await uygulama.evaluate(({ Menu }) => {
        const gorunum = Menu.getApplicationMenu().items.find((ust) => ust.label === 'Görünüm')
        gorunum.submenu.items.find((oge) => oge.label === 'Basit mod').click()
      })
      await sayfa.waitForTimeout(600)
      await ortam.adima(sayfa, 'kadraj')
    }
  }
]

async function magazayiCek (magaza, gercek) {
  const calisma = new ortam.Calisma(`magaza-${magaza.kod}`)
  const klasor = path.join(CIKTI, magaza.kod)
  fs.mkdirSync(klasor, { recursive: true })

  const { uygulama, sayfa, kapat } = await ortam.hazirla(calisma, {
    fotograf: calisma.fotograf(0, { gercek }),
    // Piksel yogunlugu acilista veriliyor; sonradan degistirilemiyor.
    ekArgumanlar: [`--force-device-scale-factor=${magaza.olcek}`]
  })

  try {
    // Olcu pencereye degil, Chromium'un olcum katmanina verilir: pencereyi
    // buyutmek ekrana takiliyor (1080 satirlik pencere 1080'lik bir ekrana
    // sigmaz) ve goruntu sessizce kisa cikiyordu. Emulasyon ekrandan
    // bagimsizdir, yerlesim istenen olcude yeniden akar.
    //
    // Piksel yogunlugu --force-device-scale-factor ile veriliyor;
    // deviceScaleFactor: 0 "olani kullan" demek, ikisi carpilmasin diye.
    const oturum = await uygulama.context().newCDPSession(sayfa)
    await oturum.send('Emulation.setDeviceMetricsOverride', {
      width: magaza.genislik,
      height: magaza.yukseklik,
      deviceScaleFactor: 0,
      mobile: false
    })
    await sayfa.waitForTimeout(1200)

    for (const [sira, sahne] of SAHNELER.entries()) {
      await sahne.kur(sayfa, { gercek, uygulama })
      const dosya = path.join(klasor, `${String(sira + 1).padStart(2, '0')}-${sahne.ad}.png`)
      await sayfa.screenshot({ path: dosya })
      console.log(`  ${path.relative(KOK, dosya)}`)
    }
  } finally {
    await kapat()
    calisma.temizle()
  }
}

;(async () => {
  const gercek = ortam.gercekFotograflar().length > 0

  if (!gercek) {
    console.log(
      'Uyarı: HV_FOTOGRAFLAR ayarlı değil, sentetik portre kullanılıyor.\n' +
      '       Görüntüler yerleşimi gösterir ama mağazaya gönderilmez.\n')
  }

  for (const magaza of MAGAZALAR) {
    const olcu = `${magaza.genislik * magaza.olcek}x${magaza.yukseklik * magaza.olcek}`
    console.log(`${magaza.ad} (${olcu})`)
    await magazayiCek(magaza, gercek)
  }
})().catch((hata) => {
  console.error('Mağaza görüntüleri üretilemedi:', hata)
  process.exit(1)
})
