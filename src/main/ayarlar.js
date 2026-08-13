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

function varsayilanAyarlar () {
  return {
    surum: SURUM,
    fotografOnayarlari: [],
    kagitOnayarlari: [],
    sonKullanilan: {}
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

// Ayni kod iki kez bulunursa ilki kalir; liste uzunlugu sinirlanir.
function listeTemizle (ham, temizleyici) {
  if (!Array.isArray(ham)) return []

  const kodlar = new Set()
  const liste = []
  for (const oge of ham) {
    const temiz = temizleyici(oge)
    if (!temiz || kodlar.has(temiz.kod)) continue
    kodlar.add(temiz.kod)
    liste.push(temiz)
    if (liste.length >= EN_FAZLA_ONAYAR) break
  }
  return liste
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
  ayarlar.sonKullanilan = sonKullanilanTemizle(ham.sonKullanilan)
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
async function yaz (klasor, ayarlar) {
  const temiz = ayarlariDogrula(ayarlar)
  const hedef = dosyaYolu(klasor)
  const gecici = `${hedef}.gecici`

  await fs.mkdir(klasor, { recursive: true })
  await fs.writeFile(gecici, JSON.stringify(temiz, null, 2), 'utf8')
  await fs.rename(gecici, hedef)
  return temiz
}

module.exports = {
  SURUM,
  DOSYA_ADI,
  EN_FAZLA_ONAYAR,
  AD_UZUNLUGU,
  varsayilanAyarlar,
  adTemizle,
  ayarlariDogrula,
  benzersizKod,
  dosyaYolu,
  oku,
  yaz
}
