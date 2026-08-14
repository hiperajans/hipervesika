'use strict'

// Uygulama simgesinin cizimi.
//
// Burasi saf geometridir: DOM'a, Electron'a ve dosya sistemine dokunmaz.
// Boylece ayni kaynak hem tuvale cizim icin (scripts/simge/tuval.js), hem SVG
// metni uretmek icin, hem de birim testleri icin kullanilabilir.
//
// Tum olculer tuval kenarina orandir; 16 px ile 1024 px arasinda ayni sekil
// cikar. Sekil "vesikalik": kehribar zemin uzerinde beyaz zeminli bir
// biyometrik fotograf ve icinde kisi silueti.

// --- Kose ---------------------------------------------------------------

// Apple'in "continuous corner" kosesi daire yayi degildir: yayin iki ucuna,
// egriligi sifirdan yavasca yukselten birer Bezier eklenir. Yumusaklik 0
// verilirse duz yuvarlatilmis dikdortgen cikar, 1 verilirse kose tamamen
// Bezier'e doner. Apple'in kullandigi deger 0,6'dir.
const KOSE_YUMUSAKLIGI = 0.6

// 1024 px'lik Apple sablonunda govde 824 px ve kose yaricapi 185,4 px'tir;
// orani 0,2249. Govde kenarina oran olarak tutuluyor.
const GOVDE_YARICAP = 0.2249

// macOS sablonunda simge tuvali doldurmaz: 1024 px'lik tuvalde govde 824
// px'tir. Dock ve Finder bu bosluga golge ve secim halkasi cizer; tuvali
// doldurmak simgeyi komsularina gore buyuk gosterir.
const MACOS_GOVDE = 824 / 1024

// Windows ve Linux simgeleri tuvali doldurur; yalnizca kenara yapismasin diye
// dar bir pay birakilir.
const DUZ_GOVDE = 0.94

const derece = (aci) => (aci * Math.PI) / 180
const yuvarla = (sayi) => Number(sayi.toFixed(3))

// Bir kosenin yerel cozumu. Kose baslangicta, kenarlardan biri +x, digeri +y
// yonunde uzanir; yol (p,0) noktasindan (0,p) noktasina gider.
//
//   Bezier  : (p,0) -> A     egrilik 0'dan 1/r'ye
//   Yay     : A -> B         yaricap r
//   Bezier  : B -> (0,p)     egrilik 1/r'den 0'a
//
// Ilk Bezier'in iki denetim noktasi da x ekseni uzerindedir; ucu ile birlikte
// dogrusal olduklari icin baslangic egriligi tam olarak sifirdir, yani duz
// kenardan egriye gecis gorunur bir kirilma birakmaz.
function koseCozumu (r, yumusaklik) {
  const alfa = 45 * yumusaklik
  const p = (1 + yumusaklik) * r
  const kesme = r * Math.tan(derece(alfa) / 2)

  const a = { x: r - r * Math.sin(derece(alfa)), y: r - r * Math.cos(derece(alfa)) }
  const b = { x: a.y, y: a.x }
  const d2 = { x: a.x + kesme * Math.cos(derece(alfa)), y: 0 }
  const d1 = { x: (p + d2.x) / 2, y: 0 }

  return { p, a, b, d1, d2 }
}

// Yerel kose cozumunu dort koseye tasiyan donusumler. Her biri saf donmedir
// (yansima yok), bu yuzden yayin donus yonu dordunde de aynidir.
const KOSELER = [
  { koseX: 0, koseY: 0, tasi: (c, x, y) => ({ x: c.x + x, y: c.y + y }) },
  { koseX: 0, koseY: 1, tasi: (c, x, y) => ({ x: c.x + y, y: c.y - x }) },
  { koseX: 1, koseY: 1, tasi: (c, x, y) => ({ x: c.x - x, y: c.y - y }) },
  { koseX: 1, koseY: 0, tasi: (c, x, y) => ({ x: c.x - y, y: c.y + x }) }
]

// Yumusatilmis koseli dikdortgen. Yaricap, kenarin yarisindan buyuk
// istenirse sekil kendi uzerine binerdi; sigacak en buyuk degere cekilir.
function koseliKare (x, y, en, boy, yaricap, yumusaklik = KOSE_YUMUSAKLIGI) {
  const enBuyukP = Math.min(en, boy) / 2
  const r = Math.min(yaricap, enBuyukP / (1 + yumusaklik))
  const { p, a, b, d1, d2 } = koseCozumu(r, yumusaklik)

  const N = (sayi) => yuvarla(sayi)
  const parcalar = []

  for (const [sira, kose] of KOSELER.entries()) {
    const c = { x: x + kose.koseX * en, y: y + kose.koseY * boy }
    const nokta = (lx, ly) => kose.tasi(c, lx, ly)

    const basla = nokta(p, 0)
    const yayBas = nokta(a.x, a.y)
    const yaySon = nokta(b.x, b.y)
    const bit = nokta(0, p)
    const k1 = nokta(d1.x, d1.y)
    const k2 = nokta(d2.x, d2.y)
    const k3 = nokta(d2.y, d2.x)
    const k4 = nokta(d1.y, d1.x)

    parcalar.push(`${sira === 0 ? 'M' : 'L'} ${N(basla.x)} ${N(basla.y)}`)
    parcalar.push(`C ${N(k1.x)} ${N(k1.y)} ${N(k2.x)} ${N(k2.y)} ${N(yayBas.x)} ${N(yayBas.y)}`)
    parcalar.push(`A ${N(r)} ${N(r)} 0 0 0 ${N(yaySon.x)} ${N(yaySon.y)}`)
    parcalar.push(`C ${N(k3.x)} ${N(k3.y)} ${N(k4.x)} ${N(k4.y)} ${N(bit.x)} ${N(bit.y)}`)
  }

  parcalar.push('Z')
  return parcalar.join(' ')
}

// Elips; iki yarim yaydan olusur. Tuval ve SVG ayni yolu okuyabilsin diye
// <circle>/<ellipse> yerine yol kullaniliyor.
function elips (mx, my, rx, ry) {
  const N = (sayi) => yuvarla(sayi)
  return [
    `M ${N(mx - rx)} ${N(my)}`,
    `A ${N(rx)} ${N(ry)} 0 1 0 ${N(mx + rx)} ${N(my)}`,
    `A ${N(rx)} ${N(ry)} 0 1 0 ${N(mx - rx)} ${N(my)}`,
    'Z'
  ].join(' ')
}

// Kesim kilavuzu: fotografin dort kosesinde, disarida duran L isaretleri.
// Uygulamanin dizme sayfasindaki kesim kilavuzunun ta kendisi.
function kesimIsaretleri (kutu, uzunluk, kalinlik, aralik) {
  const N = (sayi) => yuvarla(sayi)
  const sol = kutu.x - aralik
  const sag = kutu.x + kutu.en + aralik
  const ust = kutu.y - aralik
  const alt = kutu.y + kutu.boy + aralik
  const yollar = []

  for (const [x, y, yonX, yonY] of [
    [sol, ust, 1, 1], [sag, ust, -1, 1], [sag, alt, -1, -1], [sol, alt, 1, -1]
  ]) {
    // Tek bir L; kalinligi kadar genisletilmis iki dikdortgenin birlesimi
    // yerine tek yol olarak yaziliyor.
    yollar.push([
      `M ${N(x)} ${N(y + yonY * uzunluk)}`,
      `L ${N(x)} ${N(y)}`,
      `L ${N(x + yonX * uzunluk)} ${N(y)}`
    ].join(' '))
  }

  return { yollar, kalinlik }
}

// --- Sahne --------------------------------------------------------------

const KEHRIBAR = '#f59e0b'
const KEHRIBAR_ACIK = '#fbbf24'
const KEHRIBAR_KOYU = '#e08a05'
const KAGIT = '#ffffff'
const MUREKKEP = '#1b2436'
const KESIM = 'rgba(255, 255, 255, 0.55)'

// Bir boyut icin cizilecek katmanlar. Katman: { d, dolgu | cizgi, kirp, golge }
//
// yerlesim: 'macos' (824/1024 sablonu, golgeli) ya da 'duz' (tuvali doldurur).
//
// Ayrinti boyuta gore degisir. Kucuk boyutlarda kesim isaretleri gri bir
// bulanikliga donuseceginden cizilmez; golge de 32 px altinda fotografin
// kenarini kirletir. Bu, macOS simgelerinin kendi yaptigi seydir: 16 px'lik
// cizim 1024 px'lik cizimin kucultulmusu degil, sadelestirilmisidir.
//
// golge ve kesim ontanimli olarak boyuta bakar; olceklenen bir SVG uretilirken
// karar boyuttan okunamayacagi icin ikisi de acikca verilebilir.
function sahne (boyut, { yerlesim = 'macos', golge = null, kesim = null } = {}) {
  const govdeOrani = yerlesim === 'macos' ? MACOS_GOVDE : DUZ_GOVDE

  // Kucuk boyutlarda kenarlar piksel izgarasina oturtulur. Yarim piksele
  // denk gelen bir kenar antialias ile griye yayilir; 16 px'de bu, simgenin
  // tamamini bulanik gosterir.
  const hizala = boyut <= 64 ? Math.round : (sayi) => sayi

  const pay = hizala((boyut - boyut * govdeOrani) / 2)
  const govde = boyut - 2 * pay
  const govdeX = pay
  const govdeY = pay

  const ayrinti = kesim ?? boyut >= 128
  const golgeVar = golge ?? boyut >= 64
  const govdeGolgesi = golgeVar && yerlesim === 'macos'

  // Fotograf: 50 x 60 mm vesikaligin orani (5:6).
  // Kucuk boyutlarda fotograf govdeye gore biraz buyutulur; yoksa 16 px'de
  // siluet birkac piksele duser ve simge okunmaz olur.
  const buyutme = boyut >= 48 ? 1 : 1.08
  const fotoBoy = hizala(govde * 0.605 * buyutme)
  const fotoEn = hizala(((govde * 0.605 * buyutme) * 5) / 6)
  const foto = {
    x: hizala(govdeX + (govde - fotoEn) / 2),
    y: hizala(govdeY + (govde - fotoBoy) / 2),
    en: fotoEn,
    boy: fotoBoy
  }

  const fotoYolu = koseliKare(foto.x, foto.y, foto.en, foto.boy, govde * 0.032)

  // Siluet biyometrik yerlesime uyar: bas fotograf yuksekliginin ustten
  // %10'unda baslar ve yaklasik yarisini kaplar — Turkiye biyometrik olcusu
  // 60 mm'lik fotografta 32-36 mm yuz yuksekligi ister. Omuzlar alt kenardan
  // ve yanlardan tasar, fotografa kirpilir; gercek bir vesikalikta oldugu
  // gibi alt kenari bastan basa doldururlar.
  const merkezX = foto.x + foto.en / 2
  const basY = foto.y + foto.boy * 0.318
  const basR = foto.boy * 0.222

  // Boyunda kalan bosluk 48 px altinda yarim pikselin altina duser ve gri bir
  // bulaniklik olarak cikar; o olculerde omuzlar basa degdirilir, siluet tek
  // parca olur.
  const omuzMerkezi = boyut >= 48 ? 1.0 : 0.95
  const govdeElipsi = elips(
    merkezX, foto.y + foto.boy * omuzMerkezi, foto.en * 0.5, foto.boy * 0.4
  )

  const katmanlar = [
    {
      ad: 'govde',
      d: koseliKare(govdeX, govdeY, govde, govde, govde * GOVDE_YARICAP),
      dolgu: {
        tur: 'dikey',
        y1: govdeY,
        y2: govdeY + govde,
        duraklar: [[0, KEHRIBAR_ACIK], [0.5, KEHRIBAR], [1, KEHRIBAR_KOYU]]
      },
      golge: govdeGolgesi
        ? { renk: 'rgba(63, 34, 0, 0.34)', bulanik: govde * 0.05, kayma: govde * 0.022 }
        : null
    },
    {
      ad: 'fotograf',
      d: fotoYolu,
      dolgu: KAGIT,
      golge: golgeVar
        ? { renk: 'rgba(94, 51, 0, 0.34)', bulanik: govde * 0.035, kayma: govde * 0.014 }
        : null
    },
    {
      ad: 'govde-siluet',
      d: govdeElipsi,
      dolgu: MUREKKEP,
      kirp: fotoYolu
    },
    {
      ad: 'bas-siluet',
      d: elips(merkezX, basY, basR, basR * 1.06),
      dolgu: MUREKKEP,
      kirp: fotoYolu
    }
  ]

  if (ayrinti) {
    const isaretler = kesimIsaretleri(
      foto,
      govde * 0.052,
      Math.max(1, govde * 0.0145),
      govde * 0.038
    )
    for (const [sira, d] of isaretler.yollar.entries()) {
      katmanlar.push({
        ad: `kesim-${sira + 1}`,
        d,
        cizgi: { renk: KESIM, kalinlik: isaretler.kalinlik }
      })
    }
  }

  return { boyut, katmanlar }
}

// --- SVG ----------------------------------------------------------------

function dolguMetni (dolgu, kimlik) {
  return typeof dolgu === 'string' ? dolgu : `url(#${kimlik})`
}

// Sahneyi SVG belgesine cevirir. Depoya kaynak olarak yazilan simge.svg bu
// islevden cikar; boylece vektor kaynak ile uretilen PNG'ler ayrisamaz.
function svgUret (boyut, secenekler) {
  const { katmanlar } = sahne(boyut, secenekler)
  const tanimlar = []
  const govdeler = []

  for (const [sira, katman] of katmanlar.entries()) {
    const kimlik = `d${sira}`

    if (typeof katman.dolgu === 'object' && katman.dolgu !== null) {
      const duraklar = katman.dolgu.duraklar
        .map(([yer, renk]) => `      <stop offset="${yer}" stop-color="${renk}"/>`)
        .join('\n')
      tanimlar.push(
        `    <linearGradient id="${kimlik}" x1="0" y1="${yuvarla(katman.dolgu.y1)}" ` +
        `x2="0" y2="${yuvarla(katman.dolgu.y2)}" gradientUnits="userSpaceOnUse">\n` +
        `${duraklar}\n    </linearGradient>`
      )
    }

    if (katman.golge) {
      tanimlar.push(
        // SVG filtreleri ontanimli olarak linearRGB uzayinda calisir, tuvalin
        // golgesi ise sRGB'de. Belirtilmezse ayni tanimdan farkli golge cikar.
        `    <filter id="g${sira}" x="-25%" y="-25%" width="150%" height="150%" ` +
        'color-interpolation-filters="sRGB">\n' +
        `      <feDropShadow dx="0" dy="${yuvarla(katman.golge.kayma)}" ` +
        `stdDeviation="${yuvarla(katman.golge.bulanik / 2)}" flood-color="${katman.golge.renk}"/>\n` +
        '    </filter>'
      )
    }

    if (katman.kirp) {
      tanimlar.push(
        `    <clipPath id="k${sira}">\n      <path d="${katman.kirp}"/>\n    </clipPath>`
      )
    }

    const nitelikler = [`d="${katman.d}"`]
    if (katman.cizgi) {
      nitelikler.push(
        'fill="none"',
        `stroke="${katman.cizgi.renk}"`,
        `stroke-width="${yuvarla(katman.cizgi.kalinlik)}"`,
        'stroke-linecap="butt"',
        'stroke-linejoin="miter"'
      )
    } else {
      nitelikler.push(`fill="${dolguMetni(katman.dolgu, kimlik)}"`)
    }
    if (katman.golge) nitelikler.push(`filter="url(#g${sira})"`)
    if (katman.kirp) nitelikler.push(`clip-path="url(#k${sira})"`)

    govdeler.push(`  <path ${nitelikler.join(' ')}/>`)
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" ` +
    `viewBox="0 0 ${boyut} ${boyut}">`,
    '  <title>Hiper Vesika</title>',
    '  <defs>',
    tanimlar.join('\n'),
    '  </defs>',
    govdeler.join('\n'),
    '</svg>',
    ''
  ].join('\n')
}

module.exports = {
  KOSE_YUMUSAKLIGI,
  GOVDE_YARICAP,
  MACOS_GOVDE,
  DUZ_GOVDE,
  koseliKare,
  elips,
  sahne,
  svgUret
}
