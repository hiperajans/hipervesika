'use strict'

// Kullanici ayarlari: kendi olcu on ayarlari ve son kullanilan degerler.
//
// Dosya app.getPath('userData') altinda durur, depoya girmez (bkz. AGENTS.md,
// kural 5). Elle duzenlenebilir ya da bozulabilir bir dosya oldugu icin okunan
// her deger dogrulanir; anlasilmayan alan sessizce atilir ve uygulama
// varsayilanla acilir.

const fs = require('node:fs/promises')
const path = require('node:path')

const SURUM = 1
const DOSYA_ADI = 'ayarlar.json'

// Arayuzdeki sinirlarin aynisi (src/renderer/js/olcu.js ve sayfa.js).
// Ana surec arayuze guvenmedigi icin burada tekrar yazilir.
const EN_KUCUK_FOTO_MM = 10
const EN_BUYUK_FOTO_MM = 300
const EN_KUCUK_KAGIT_MM = 50
const EN_BUYUK_KAGIT_MM = 1000

const EN_FAZLA_ONAYAR = 50
const AD_UZUNLUGU = 40

// Olcu duzeltmesinin makul araligi; arayuzdeki sinirin aynisi
// (src/renderer/js/kalibrasyon.js). Disina cikan bir deger olcum hatasidir.
const EN_KUCUK_OLCEK = 0.9
const EN_BUYUK_OLCEK = 1.1
const YAZICI_ADI_UZUNLUGU = 200
const ICC_YOLU_UZUNLUGU = 500

// Arayuz modlari. 'basit' sihirbaz gezinmesi verir ve uzman denetimlerini
// gizler, 'gelismis' her seyi gosterir. Ayarda null durmasi "kullaniciya henuz
// sorulmadi" demektir: ilk acilista mod secme penceresi bu yuzden acilir.
const MODLAR = ['basit', 'gelismis']

function varsayilanAyarlar () {
  return {
    surum: SURUM,
    fotografOnayarlari: [],
    kagitOnayarlari: [],
    // Yazici basina olcu duzeltmesi (bkz. src/renderer/js/kalibrasyon.js).
    kalibrasyonlar: [],
    // CMYK ayriminda kullanilacak ICC profilinin yolu. sonKullanilan icinde
    // tutulamaz: oradaki dizgi siniri (200) uzun yollara yetmiyor.
    iccProfili: null,
    sonKullanilan: {},
    // Tanitim turu bir kez gosterilir; kullanici Yardim menusunden tekrarlar.
    tanitimGoruldu: false,
    mod: null
  }
}

function adTemizle (deger) {
  if (typeof deger !== 'string') return null
  // Satir sonu ve arka arkaya bosluklar tek boslugu iner.
  const ad = deger.replace(/\s+/g, ' ').trim().slice(0, AD_UZUNLUGU)
  return ad.length ? ad : null
}

function olcuTemizle (deger, enKucuk, enBuyuk) {
  const sayi = Number(deger)
  if (!Number.isFinite(sayi) || sayi < enKucuk || sayi > enBuyuk) return null
  // Yarim milimetreden ince ayar arayuzde de yok.
  return Math.round(sayi * 10) / 10
}

function kodTemizle (deger) {
  return typeof deger === 'string' && /^[\w-]{1,40}$/.test(deger) ? deger : null
}

function fotografOnayariTemizle (ham) {
  const ad = adTemizle(ham?.ad)
  const kod = kodTemizle(ham?.kod)
  const genislikMm = olcuTemizle(ham?.genislikMm, EN_KUCUK_FOTO_MM, EN_BUYUK_FOTO_MM)
  const yukseklikMm = olcuTemizle(ham?.yukseklikMm, EN_KUCUK_FOTO_MM, EN_BUYUK_FOTO_MM)

  if (!ad || !kod || genislikMm === null || yukseklikMm === null) return null
  return { kod, ad, genislikMm, yukseklikMm }
}

function kagitOnayariTemizle (ham) {
  const ad = adTemizle(ham?.ad)
  const kod = kodTemizle(ham?.kod)
  const genislik = olcuTemizle(ham?.genislik, EN_KUCUK_KAGIT_MM, EN_BUYUK_KAGIT_MM)
  const yukseklik = olcuTemizle(ham?.yukseklik, EN_KUCUK_KAGIT_MM, EN_BUYUK_KAGIT_MM)

  if (!ad || !kod || genislik === null || yukseklik === null) return null
  return { kod, ad, genislik, yukseklik }
}

// Ayni anahtar iki kez bulunursa ilki kalir; liste uzunlugu sinirlanir.
function listeTemizle (ham, temizleyici, anahtar = 'kod') {
  if (!Array.isArray(ham)) return []

  const anahtarlar = new Set()
  const liste = []
  for (const oge of ham) {
    const temiz = temizleyici(oge)
    if (!temiz || anahtarlar.has(temiz[anahtar])) continue
    anahtarlar.add(temiz[anahtar])
    liste.push(temiz)
    if (liste.length >= EN_FAZLA_ONAYAR) break
  }
  return liste
}

// Yazici basina olcu duzeltmesi. Yazici adi sistemden geldigi icin kod
// bicimine uymaz; yalnizca uzunlugu sinirlanir.
function kalibrasyonTemizle (ham) {
  const yazici = typeof ham?.yazici === 'string' ? ham.yazici.trim() : ''
  const olcekX = Number(ham?.olcekX)
  const olcekY = Number(ham?.olcekY)

  const gecerli = (olcek) =>
    Number.isFinite(olcek) && olcek >= EN_KUCUK_OLCEK && olcek <= EN_BUYUK_OLCEK

  if (!yazici || yazici.length > YAZICI_ADI_UZUNLUGU) return null
  if (!gecerli(olcekX) || !gecerli(olcekY)) return null

  return {
    yazici,
    olcekX: Math.round(olcekX * 100000) / 100000,
    olcekY: Math.round(olcekY * 100000) / 100000
  }
}

// ICC profili: yol ve dosya adi. Dosyanin hala yerinde olup olmadigina
// bakilmaz — disk baglantisi gecici olabilir; kullanilacagi anda denetlenir
// (src/main/index.js -> iccProfiliGecerliMi).
function iccProfiliTemizle (ham) {
  const yol = typeof ham?.yol === 'string' ? ham.yol.trim() : ''
  if (!yol || yol.length > ICC_YOLU_UZUNLUGU || !/\.(icc|icm)$/i.test(yol)) return null

  const ad = adTemizle(ham?.ad) ?? path.basename(yol)
  return { yol, ad }
}

// Son kullanilan degerler yalnizca tur olarak dogrulanir; anlamsal denetimi
// arayuz kendi sinirlariyla yapar (gecersiz deger uygulanmaz).
function sonKullanilanTemizle (ham) {
  if (!ham || typeof ham !== 'object') return {}

  const temiz = {}
  for (const [anahtar, deger] of Object.entries(ham)) {
    if (!/^[\w]{1,40}$/.test(anahtar)) continue
    if (typeof deger === 'boolean') temiz[anahtar] = deger
    else if (typeof deger === 'number' && Number.isFinite(deger)) temiz[anahtar] = deger
    else if (typeof deger === 'string' && deger.length <= 200) temiz[anahtar] = deger
  }
  return temiz
}

function ayarlariDogrula (ham) {
  const ayarlar = varsayilanAyarlar()
  if (!ham || typeof ham !== 'object') return ayarlar

  ayarlar.fotografOnayarlari = listeTemizle(ham.fotografOnayarlari, fotografOnayariTemizle)
  ayarlar.kagitOnayarlari = listeTemizle(ham.kagitOnayarlari, kagitOnayariTemizle)
  ayarlar.kalibrasyonlar = listeTemizle(ham.kalibrasyonlar, kalibrasyonTemizle, 'yazici')
  ayarlar.iccProfili = iccProfiliTemizle(ham.iccProfili)
  ayarlar.sonKullanilan = sonKullanilanTemizle(ham.sonKullanilan)
  ayarlar.tanitimGoruldu = ham.tanitimGoruldu === true
  // Taninmayan mod null'a duser: bozuk dosyada kullaniciya yeniden sorulur,
  // uygulama kilitli bir moda saplanmaz.
  ayarlar.mod = MODLAR.includes(ham.mod) ? ham.mod : null
  return ayarlar
}

// Listede kullanilmayan bir kod uretir. Kod ada bagli degildir; kullanici adi
// degistirse de secim bozulmaz.
function benzersizKod (liste, onek = 'kullanici') {
  let sayac = 1
  let kod = `${onek}-${sayac}`
  const kodlar = new Set(liste.map((oge) => oge.kod))
  while (kodlar.has(kod)) kod = `${onek}-${++sayac}`
  return kod
}

function dosyaYolu (klasor) {
  return path.join(klasor, DOSYA_ADI)
}

async function oku (klasor) {
  try {
    const metin = await fs.readFile(dosyaYolu(klasor), 'utf8')
    return ayarlariDogrula(JSON.parse(metin))
  } catch {
    // Dosya yoksa ya da bozuksa varsayilanla acilir; kullanici is kaybetmez.
    return varsayilanAyarlar()
  }
}

// Once gecici dosyaya yazilip yeniden adlandirilir: yazma sirasinda uygulama
// kapanirsa eski ayarlar bozulmadan kalir.
async function yazmayiYap (klasor, ayarlar) {
  const temiz = ayarlariDogrula(ayarlar)
  const hedef = dosyaYolu(klasor)
  const gecici = `${hedef}.gecici`

  await fs.mkdir(klasor, { recursive: true })
  await fs.writeFile(gecici, JSON.stringify(temiz, null, 2), 'utf8')
  await fs.rename(gecici, hedef)
  return temiz
}

// Yazmalar siraya alinir. Iki istek ayni anda gelirse (ornegin mod secimi ile
// tanitim turunun bitisi pespese duserse) ikisi de ayni gecici dosyaya
// yazardi; ic ice gecen yazmalarin ardindan yeniden adlandirilan dosya bozuk
// JSON iceriyordu ve okuma varsayilana duserek kullanicinin tum on ayarlarini
// goturuyordu. Sira ayrica son istegin son yazma olmasini garanti eder.
let siradaki = Promise.resolve()

function yaz (klasor, ayarlar) {
  // Onceki yazma hata verse de sira devam etmeli; bu yuzden iki dalda da
  // ayni is baslatilir.
  const is = siradaki.then(
    () => yazmayiYap(klasor, ayarlar),
    () => yazmayiYap(klasor, ayarlar)
  )
  siradaki = is.catch(() => {})
  return is
}

module.exports = {
  SURUM,
  DOSYA_ADI,
  EN_FAZLA_ONAYAR,
  AD_UZUNLUGU,
  MODLAR,
  EN_KUCUK_OLCEK,
  EN_BUYUK_OLCEK,
  varsayilanAyarlar,
  adTemizle,
  kalibrasyonTemizle,
  iccProfiliTemizle,
  ayarlariDogrula,
  benzersizKod,
  dosyaYolu,
  oku,
  yaz
}
