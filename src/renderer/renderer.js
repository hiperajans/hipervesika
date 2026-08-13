'use strict'

// Arayuz kodu. Node API'lerine erisim yok; ana surece ihtiyac duyulan her sey
// preload'daki window.hiperVesika koprusunden gelir.

const { versions } = window.hiperVesika
const olcuMotoru = window.HV.olcu
const hizalamaMotoru = window.HV.hizalama

const el = {
  tuval: document.getElementById('tuval'),
  birakmaKatmani: document.getElementById('birakma-katmani'),
  dosyaGirisi: document.getElementById('dosya-girisi'),
  dosyaSec: document.getElementById('btn-dosya-sec'),
  yakinlas: document.getElementById('btn-yakinlas'),
  uzaklas: document.getElementById('btn-uzaklas'),
  sigdir: document.getElementById('btn-sigdir'),
  yakinlikOrani: document.getElementById('yakinlik-orani'),
  gorselBilgisi: document.getElementById('gorsel-bilgisi'),
  uyari: document.getElementById('uyari'),
  durum: document.getElementById('durum'),
  surumBilgisi: document.getElementById('surum-bilgisi'),
  onayarSecimi: document.getElementById('onayar-secimi'),
  genislikMm: document.getElementById('genislik-mm'),
  yukseklikMm: document.getElementById('yukseklik-mm'),
  olcuHatasi: document.getElementById('olcu-hatasi'),
  dpiSecimi: document.getElementById('dpi-secimi'),
  ciktiPiksel: document.getElementById('cikti-piksel'),
  efektifDpi: document.getElementById('efektif-dpi'),
  cozunurlukUyarisi: document.getElementById('cozunurluk-uyarisi'),
  kirpmayiSifirla: document.getElementById('btn-kirpmayi-sifirla'),
  otomatikHizala: document.getElementById('btn-otomatik-hizala'),
  hizalamaDurumu: document.getElementById('hizalama-durumu'),
  donmeAcisi: document.getElementById('donme-acisi'),
  donmeDegeri: document.getElementById('donme-degeri'),
  donmeyiSifirla: document.getElementById('btn-donmeyi-sifirla'),
  arkaplanBeyazlat: document.getElementById('arkaplan-beyazlat'),
  arkaplanDurumu: document.getElementById('arkaplan-durumu'),
  arkaplanAyarlari: document.getElementById('arkaplan-ayarlari'),
  maskeGenislet: document.getElementById('maske-genislet'),
  maskeGenisletDegeri: document.getElementById('maske-genislet-degeri'),
  maskeYumusat: document.getElementById('maske-yumusat'),
  maskeYumusatDegeri: document.getElementById('maske-yumusat-degeri'),
  aracKirpma: document.getElementById('arac-kirpma'),
  aracLeke: document.getElementById('arac-leke'),
  aracFircaSil: document.getElementById('arac-firca-sil'),
  aracFircaGetir: document.getElementById('arac-firca-getir'),
  fircaBoyu: document.getElementById('firca-boyu'),
  fircaBoyuDegeri: document.getElementById('firca-boyu-degeri'),
  geriAl: document.getElementById('btn-geri-al'),
  yinele: document.getElementById('btn-yinele'),
  onceSonra: document.getElementById('btn-once-sonra'),
  lekeBoyu: document.getElementById('leke-boyu'),
  lekeBoyuDegeri: document.getElementById('leke-boyu-degeri'),
  lekeDurumu: document.getElementById('leke-durumu'),
  rotusuSifirla: document.getElementById('btn-rotusu-sifirla'),
  turJpg: document.getElementById('tur-jpg'),
  turPng: document.getElementById('tur-png'),
  kaliteAlani: document.getElementById('kalite-alani'),
  jpgKalitesi: document.getElementById('jpg-kalitesi'),
  jpgKalitesiDegeri: document.getElementById('jpg-kalitesi-degeri'),
  indir: document.getElementById('btn-indir'),
  indirmeDurumu: document.getElementById('indirme-durumu'),
  gorunumFoto: document.getElementById('gorunum-foto'),
  gorunumSayfa: document.getElementById('gorunum-sayfa'),
  sayfaTuvali: document.getElementById('sayfa-tuvali'),
  kagitOnayari: document.getElementById('kagit-onayari'),
  kagitGenislik: document.getElementById('kagit-genislik'),
  kagitYukseklik: document.getElementById('kagit-yukseklik'),
  kagitHatasi: document.getElementById('kagit-hatasi'),
  kagitCevir: document.getElementById('btn-kagit-cevir'),
  dizmeKenar: document.getElementById('dizme-kenar'),
  dizmeAralik: document.getElementById('dizme-aralik'),
  dizmeAdet: document.getElementById('dizme-adet'),
  dizmeAdetSiniri: document.getElementById('dizme-adet-siniri'),
  kesimKilavuzu: document.getElementById('kesim-kilavuzu'),
  dizmeDurumu: document.getElementById('dizme-durumu'),
  yaziciSecimi: document.getElementById('yazici-secimi'),
  kopyaSayisi: document.getElementById('kopya-sayisi'),
  yaziciPenceresi: document.getElementById('yazici-penceresi'),
  sayfayiBas: document.getElementById('btn-sayfayi-bas'),
  sayfayiPdf: document.getElementById('btn-sayfayi-pdf'),
  sayfayiKaydet: document.getElementById('btn-sayfayi-kaydet'),
  baskiDurumu: document.getElementById('baski-durumu'),
  baskiKisayollari: document.getElementById('baski-kisayollari'),
  olcuKaydet: document.getElementById('btn-olcu-kaydet'),
  olcuSil: document.getElementById('btn-olcu-sil'),
  kagitKaydet: document.getElementById('btn-kagit-kaydet'),
  kagitSil: document.getElementById('btn-kagit-sil'),
  onayarModali: document.getElementById('onayar-modali'),
  onayarModalBasligi: document.getElementById('onayar-modal-basligi'),
  onayarModalBilgisi: document.getElementById('onayar-modal-bilgisi'),
  onayarAdi: document.getElementById('onayar-adi'),
  onayarKaydet: document.getElementById('btn-onayar-kaydet')
}

// Rotus kaydiraclari -50..+50 arasinda; motorun bekledigi carpanlara cevrilir.
const ROTUS_KAYDIRACLARI = [
  { anahtar: 'parlaklik', giris: 'rotus-parlaklik', deger: 'rotus-parlaklik-degeri', tur: 'carpan' },
  { anahtar: 'kontrast', giris: 'rotus-kontrast', deger: 'rotus-kontrast-degeri', tur: 'carpan' },
  { anahtar: 'doygunluk', giris: 'rotus-doygunluk', deger: 'rotus-doygunluk-degeri', tur: 'carpan' },
  { anahtar: 'sicaklik', giris: 'rotus-sicaklik', deger: 'rotus-sicaklik-degeri', tur: 'birim' },
  { anahtar: 'keskinlik', giris: 'rotus-keskinlik', deger: 'rotus-keskinlik-degeri', tur: 'birim' }
]

const tuval = new window.HV.Tuval(el.tuval, {
  degisimde: (t) => {
    // Sayfa gorunumundeyken oran sayfaya aittir. Gizlenen tuvalin
    // ResizeObserver'i da ciz() cagirdigi icin bu denetim sart.
    if (el.gorunumSayfa.checked) return
    el.yakinlikOrani.textContent = t.gorsel ? `%${Math.round(t.olcek * 100)}` : ''
  }
})

const kirpma = new window.HV.KirpmaAraci(tuval, {
  degisimde: () => {
    ciktiBilgisiniGuncelle()
    sayfaKaresiniGecersizKil()
  }
})

const firca = new window.HV.Firca(tuval, {
  maskeyiAl: () => hamMaske,
  gorseliAl: () => yuklenenGorsel,
  degisimde: () => gosterimiTazele(),
  // Darbenin tamami tek bir geri alma adimi olur.
  bittiginde: () => durumuKaydet({ maskeDegisti: true })
})

const lekeFircasi = new window.HV.LekeFircasi(tuval, {
  gorseliAl: () => yuklenenGorsel,
  lekeEkle: (leke) => {
    lekeler.push(leke)
    gosterimiTazele()
    durumuKaydet()
    lekeDurumunuGuncelle()
  }
})

let yuklenenGorsel = null
let olcuDurumu = { genislikMm: 50, yukseklikMm: 60 }
let dpi = 300

// Segmentasyondan gelen ham maske ve kullanicinin firca duzeltmeleri burada
// birikir; kenar ayarlari her tazelemede bunun uzerine uygulanir.
let hamMaske = null

// Rotus ayarlari ve leke kayitlari deger olarak tutulur; goruntuye yazilmaz.
let rotusAyarlari = window.HV.rotus.varsayilanAyarlar()
let lekeler = []
let oncesiGosteriliyor = false

const gecmis = new window.HV.Gecmis()

// Kullanicinin kendi on ayarlari ve son kullandigi degerler. Ana surecten
// okunur; okunana kadar bos kabul edilir ve hicbir sey yazilmaz.
let kullaniciAyarlari = { fotografOnayarlari: [], kagitOnayarlari: [], sonKullanilan: {} }
let ayarlarHazir = false

// Bir ada karsilik gelmeyen, listede kullanilmayan kod. Kullanici adi
// degistirdiginde secim bozulmasin diye kod addan bagimsizdir.
function benzersizKod (liste) {
  let sayac = 1
  while (liste.some((oge) => oge.kod === `kullanici-${sayac}`)) sayac++
  return `kullanici-${sayac}`
}

// --- Bicimlendirme -----------------------------------------------------------

function baytBicimle (bayt) {
  const mb = bayt / (1024 * 1024)
  return mb >= 1
    ? `${mb.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`
    : `${Math.round(bayt / 1024)} KB`
}

// Kucuk gorsellerde tek basamak "0 MP" gosterecegi icin esige gore basamak secilir.
function megapikselBicimle (genislik, yukseklik) {
  const megapiksel = (genislik * yukseklik) / 1e6
  return megapiksel.toLocaleString('tr-TR', {
    maximumFractionDigits: megapiksel >= 1 ? 1 : 2
  })
}

function uyariGoster (mesaj) {
  el.uyari.textContent = mesaj
  el.uyari.classList.remove('d-none')
}

function uyariGizle () {
  el.uyari.classList.add('d-none')
}

function araclariEtkinlestir (etkin) {
  const ogeler = [
    el.yakinlas, el.uzaklas, el.sigdir, el.kirpmayiSifirla,
    el.otomatikHizala, el.donmeAcisi, el.donmeyiSifirla, el.arkaplanBeyazlat,
    el.onceSonra, el.rotusuSifirla, el.aracKirpma, el.aracLeke, el.indir,
    el.sayfayiBas, el.sayfayiPdf, el.sayfayiKaydet,
    ...ROTUS_KAYDIRACLARI.map((k) => document.getElementById(k.giris))
  ]
  for (const oge of ogeler) oge.disabled = !etkin
}

// --- Hizalama ----------------------------------------------------------------

// Donme bir goruntuleme parametresidir: kaynak pikseller degismez, yalnizca
// calisma alani ve cizim donusumu guncellenir.
function aciAta (aci) {
  if (!yuklenenGorsel) return

  const { width, height } = yuklenenGorsel.asil
  yuklenenGorsel.aci = aci
  yuklenenGorsel.calisma = aci === 0
    ? { genislik: width, yukseklik: height }
    : hizalamaMotoru.enBuyukIcKutu(width, height, aci)

  kirpma.calismaAta(yuklenenGorsel.calisma)
  tuval.sigdir()

  const derece = hizalamaMotoru.dereceye(aci)
  el.donmeAcisi.value = String(derece)
  el.donmeDegeri.textContent = `${derece.toLocaleString('tr-TR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1
  })}°`
}

function hizalamaDurumu (mesaj, tur = 'bilgi') {
  el.hizalamaDurumu.textContent = mesaj
  el.hizalamaDurumu.classList.toggle('text-danger', tur === 'hata')
  el.hizalamaDurumu.classList.toggle('text-body-secondary', tur !== 'hata')
}

// Kafanin gercek tepesi kisi maskesinden okunur; yuz noktalarindan kestirilen
// tepe sac hacmini hesaba katmadigi icin kadraj kafanin ustunu kesiyordu.
// Maske ayrica arka plan beyazlatmada yeniden kullanilir, ikinci kez uretilmez.
async function tepeNoktasiniBul (yuz, calismaya) {
  try {
    if (!hamMaske) {
      const aday = await window.HV.arkaplan.maskeCikar(yuklenenGorsel.asil)
      if (window.HV.arkaplan.maskeKapsami(aday) < 0.02) return null
      hamMaske = aday
    }

    const merkezX = (yuz.solGoz.x + yuz.sagGoz.x) / 2
    const tepeY = window.HV.arkaplan.kafaTepesi(hamMaske, {
      merkezX,
      yariGenislik: Math.abs(yuz.solGoz.x - yuz.sagGoz.x),
      gorselGenislik: yuklenenGorsel.asil.width
    })

    return tepeY === null ? null : calismaya({ x: merkezX, y: tepeY })
  } catch {
    // Maske alinamazsa kestirime dusulur; hizalama yine de calisir.
    return null
  }
}

async function otomatikHizala () {
  if (!yuklenenGorsel) return

  el.otomatikHizala.disabled = true
  hizalamaDurumu(
    window.HV.yuz.hazirMi ? 'Yüz aranıyor…' : 'Modeller yükleniyor, ilk çalıştırma biraz sürebilir…'
  )

  try {
    const bulgu = await window.HV.yuz.algila(yuklenenGorsel.asil)

    if (!bulgu.yuz) {
      hizalamaDurumu(
        'Yüz bulunamadı. Kadrajı elle ayarlayabilir veya daha net bir fotoğraf deneyebilirsiniz.',
        'hata'
      )
      return
    }

    // Egiklik goz hattindan hesaplanir; omuz sapmasi yalnizca bilgi olarak
    // gosterilir (bkz. docs/FAZLAR.md, Faz 3).
    const aci = hizalamaMotoru.egiklikAcisi(bulgu.yuz.solGoz, bulgu.yuz.sagGoz)
    aciAta(aci)

    const gorselOlcusu = {
      genislik: yuklenenGorsel.asil.width,
      yukseklik: yuklenenGorsel.asil.height
    }
    const calisma = yuklenenGorsel.calisma
    const calismaya = (nokta) =>
      hizalamaMotoru.calismayaTasi(nokta, gorselOlcusu, calisma, aci)

    const cene = calismaya(bulgu.yuz.cene)
    const alin = calismaya(bulgu.yuz.alin)
    const solGoz = calismaya(bulgu.yuz.solGoz)
    const sagGoz = calismaya(bulgu.yuz.sagGoz)

    const tepe = await tepeNoktasiniBul(bulgu.yuz, calismaya) ??
      hizalamaMotoru.tepeNoktasi(cene, alin)

    kirpma.cerceveAta(hizalamaMotoru.otomatikCerceve({
      cene,
      tepe,
      gozMerkezi: { x: (solGoz.x + sagGoz.x) / 2, y: (solGoz.y + sagGoz.y) / 2 },
      calisma,
      oran: olcuMotoru.oran(olcuDurumu.genislikMm, olcuDurumu.yukseklikMm)
    }))

    const parcalar = [`Eğiklik ${bicimliDerece(aci)} düzeltildi`]
    if (bulgu.yuzSayisi > 1) {
      parcalar.unshift(`${bulgu.yuzSayisi} yüz bulundu, en büyüğü kullanıldı`)
    }
    if (bulgu.omuz) {
      const sapma = hizalamaMotoru.omuzSapmasi(bulgu.omuz.sol, bulgu.omuz.sag)
      parcalar.push(`omuz farkı ${bicimliDerece(sapma)}`)
    } else {
      parcalar.push('omuzlar görünmüyor')
    }

    hizalamaDurumu(`${parcalar.join(' · ')}. Kadrajı elle değiştirebilirsiniz.`)
  } catch (hata) {
    hizalamaDurumu(`Hizalama yapılamadı: ${hata.message}`, 'hata')
  } finally {
    el.otomatikHizala.disabled = false
  }
}

// --- Arka plan ---------------------------------------------------------------

function arkaplanDurumu (mesaj, tur = 'bilgi') {
  el.arkaplanDurumu.textContent = mesaj
  el.arkaplanDurumu.classList.toggle('text-danger', tur === 'hata')
  el.arkaplanDurumu.classList.toggle('text-body-secondary', tur !== 'hata')
}

// Ekranda gosterilecek onizlemeyi kaynaktan yeniden uretir. Sira onemli:
// once arka plan beyazlatma, sonra rotus, en son lekeler. Ayni islem disa
// aktarmada tam cozunurlukte tekrarlanir.
function gosterimiTazele () {
  if (!yuklenenGorsel) return

  const kaynak = yuklenenGorsel.onizleme
  let sonuc = kaynak

  // "Önce / Sonra" basiliyken hicbir islem uygulanmaz: kullanici ozgun
  // fotografi gorur.
  if (!oncesiGosteriliyor) {
    if (hamMaske && el.arkaplanBeyazlat.checked) {
      const maske = window.HV.arkaplan.maskeyiAyarla(hamMaske, {
        genislet: Number.parseFloat(el.maskeGenislet.value) / 100,
        yumusat: Number.parseFloat(el.maskeYumusat.value)
      })
      sonuc = window.HV.arkaplan.beyazZemineBirlestir(sonuc, maske, kaynak.width, kaynak.height)
    }

    sonuc = window.HV.rotus.uygula(sonuc, rotusAyarlari)
    sonuc = window.HV.rotus.lekeleriUygula(sonuc, lekeler, kaynak.width / yuklenenGorsel.asil.width)
  }

  yuklenenGorsel.gosterim = sonuc === kaynak ? null : sonuc
  tuval.ciz()

  // Sayfadaki vesikalik karesi artik eski.
  sayfaKaresiniGecersizKil()
}

// --- Rotus -------------------------------------------------------------------

// Kaydirac degerini motorun bekledigi bicime cevirir: carpan tipi 1 etrafinda
// (0.5-1.5), birim tipi -1..+1 (keskinlikte 0..1) araliginda calisir.
function kaydiracDegeri (tur, ham) {
  return tur === 'carpan' ? 1 + ham / 100 : ham / 50
}

function rotusEtiketiYaz (kaydirac, ham) {
  document.getElementById(kaydirac.deger).textContent = String(ham)
}

function rotusuOku () {
  const ayarlar = {}
  for (const kaydirac of ROTUS_KAYDIRACLARI) {
    const ham = Number.parseInt(document.getElementById(kaydirac.giris).value, 10)
    ayarlar[kaydirac.anahtar] = kaydiracDegeri(kaydirac.tur, ham)
    rotusEtiketiYaz(kaydirac, ham)
  }
  return ayarlar
}

// Kaydiraclari verilen ayarlara gore geri yazar (geri al / sifirla sonrasi).
function rotusuYaz (ayarlar) {
  for (const kaydirac of ROTUS_KAYDIRACLARI) {
    const deger = ayarlar[kaydirac.anahtar]
    const ham = Math.round(kaydirac.tur === 'carpan' ? (deger - 1) * 100 : deger * 50)
    document.getElementById(kaydirac.giris).value = String(ham)
    rotusEtiketiYaz(kaydirac, ham)
  }
}

function lekeDurumunuGuncelle () {
  el.lekeDurumu.textContent = lekeler.length
    ? `${lekeler.length} leke temizlendi. Geri almak için ↶ düğmesini kullanın.`
    : 'Üstteki Leke aracıyla lekenin üzerine tıklayın.'
}

// --- Gecmis ------------------------------------------------------------------

function maskeKopyala (maske) {
  if (!maske) return null
  const kopya = document.createElement('canvas')
  kopya.width = maske.width
  kopya.height = maske.height
  kopya.getContext('2d').drawImage(maske, 0, 0)
  return kopya
}

// Maske anlik goruntusu yalnizca maske degistiginde alinir; rotus adimlari
// onceki kopyayi paylasir, boylece gecmis bellegi sisirmez.
function durumuKaydet ({ maskeDegisti = false } = {}) {
  const onceki = gecmis.simdiki
  gecmis.kaydet({
    ayarlar: { ...rotusAyarlari },
    lekeler: lekeler.map((leke) => ({ ...leke })),
    maske: maskeDegisti ? maskeKopyala(hamMaske) : (onceki?.maske ?? null),
    beyazlatma: el.arkaplanBeyazlat.checked
  })
  gecmisDugmeleriniGuncelle()
}

function durumuUygula (durum) {
  if (!durum) return

  rotusAyarlari = { ...durum.ayarlar }
  lekeler = durum.lekeler.map((leke) => ({ ...leke }))
  // Gecmisteki kopya korunmali; uzerine firca darbesi yazilmasin diye
  // calisma maskesi ayri bir kopyadir.
  hamMaske = maskeKopyala(durum.maske)

  el.arkaplanBeyazlat.checked = durum.beyazlatma && hamMaske !== null
  el.arkaplanAyarlari.classList.toggle('d-none', !el.arkaplanBeyazlat.checked)

  rotusuYaz(rotusAyarlari)
  lekeDurumunuGuncelle()
  aracSec()
  gosterimiTazele()
  gecmisDugmeleriniGuncelle()
}

function gecmisDugmeleriniGuncelle () {
  el.geriAl.disabled = !gecmis.geriAlinabilir
  el.yinele.disabled = !gecmis.yinelenebilir
}

function arkaplanBasariniBildir () {
  if (!hamMaske) return
  const kapsam = window.HV.arkaplan.maskeKapsami(hamMaske)
  arkaplanDurumu(
    `Arka plan beyazlatıldı (fotoğrafın %${Math.round(kapsam * 100)}'i kişi). ` +
    'Kenarları fırçayla düzeltebilirsiniz.'
  )
}

async function arkaplaniAyir () {
  if (!yuklenenGorsel) return

  el.arkaplanBeyazlat.disabled = true
  arkaplanDurumu(
    window.HV.yuz.hazirMi ? 'Arka plan ayrılıyor…' : 'Modeller yükleniyor, ilk çalıştırma biraz sürebilir…'
  )

  try {
    hamMaske = await window.HV.arkaplan.maskeCikar(yuklenenGorsel.asil)
    const kapsam = window.HV.arkaplan.maskeKapsami(hamMaske)

    // Bos ya da neredeyse bos maske: beyazlatma goruntuyu tamamen silerdi.
    if (kapsam < 0.02) {
      hamMaske = null
      el.arkaplanBeyazlat.checked = false
      el.arkaplanAyarlari.classList.add('d-none')
      arkaplanDurumu(
        'Kişi arka plandan ayrılamadı. Fotoğrafta kişi net görünmüyor olabilir.',
        'hata'
      )
      return
    }

    el.arkaplanAyarlari.classList.remove('d-none')
    gosterimiTazele()
    arkaplanBasariniBildir()
    aracSec()
    durumuKaydet({ maskeDegisti: true })
  } catch (hata) {
    hamMaske = null
    el.arkaplanBeyazlat.checked = false
    arkaplanDurumu(`Arka plan ayrılamadı: ${hata.message}`, 'hata')
  } finally {
    el.arkaplanBeyazlat.disabled = false
  }
}

function aracSec () {
  // Maske araclari yalnizca maske varken anlamli.
  const maskeVar = hamMaske !== null
  el.aracFircaSil.disabled = !maskeVar
  el.aracFircaGetir.disabled = !maskeVar
  if (!maskeVar && (el.aracFircaSil.checked || el.aracFircaGetir.checked)) {
    el.aracKirpma.checked = true
  }

  const maskeFircasi = el.aracFircaSil.checked || el.aracFircaGetir.checked

  if (maskeFircasi) {
    firca.sil = el.aracFircaSil.checked
    tuval.etkilesim = firca
    tuval.ustKatman = (ctx, olcek) => {
      kirpma.ciz(ctx, olcek)
      firca.ciz(ctx, olcek)
    }
  } else if (el.aracLeke.checked) {
    tuval.etkilesim = lekeFircasi
    tuval.ustKatman = (ctx, olcek) => {
      kirpma.ciz(ctx, olcek)
      lekeFircasi.ciz(ctx, olcek)
    }
  } else {
    tuval.etkilesim = kirpma
    tuval.ustKatman = (ctx, olcek) => kirpma.ciz(ctx, olcek)
  }

  tuval.ciz()
}

function bicimliDerece (radyan) {
  const derece = Math.abs(hizalamaMotoru.dereceye(radyan))
  return `${derece.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}°`
}

// --- Olcu paneli -------------------------------------------------------------

function secenekEkle (hedef, deger, metin) {
  const secenek = document.createElement('option')
  secenek.value = deger
  secenek.textContent = metin
  hedef.append(secenek)
}

// Kullanici on ayarlari ayri bir baslik altinda listelenir; hazir olculer
// silinemez, kullanicininkiler silinebilir.
function kullaniciGrubu (secim, onayarlar, etiketle) {
  if (!onayarlar.length) return

  const grup = document.createElement('optgroup')
  grup.label = 'Kendi ölçülerim'
  for (const onayar of onayarlar) secenekEkle(grup, onayar.kod, etiketle(onayar))
  secim.append(grup)
}

function fotoOnayariBul (kod) {
  return olcuMotoru.FOTOGRAF_ONAYARLARI.find((o) => o.kod === kod) ??
    kullaniciAyarlari.fotografOnayarlari.find((o) => o.kod === kod) ?? null
}

function onayarlariDoldur () {
  const onceki = el.onayarSecimi.value
  el.onayarSecimi.replaceChildren()

  for (const onayar of olcuMotoru.FOTOGRAF_ONAYARLARI) {
    secenekEkle(
      el.onayarSecimi, onayar.kod,
      `${onayar.ad} — ${onayar.genislikMm}×${onayar.yukseklikMm} mm`
    )
  }

  kullaniciGrubu(
    el.onayarSecimi, kullaniciAyarlari.fotografOnayarlari,
    (o) => `${o.ad} — ${o.genislikMm}×${o.yukseklikMm} mm`
  )
  secenekEkle(el.onayarSecimi, 'ozel', 'Özel ölçü')

  // Secili on ayar silinmisse ozel olcuye dusulur.
  el.onayarSecimi.value = onceki
  if (!el.onayarSecimi.value) el.onayarSecimi.value = 'ozel'
  silDugmeleriniGuncelle()
}

function silDugmeleriniGuncelle () {
  el.olcuSil.disabled = !kullaniciAyarlari.fotografOnayarlari
    .some((o) => o.kod === el.onayarSecimi.value)
  el.kagitSil.disabled = !kullaniciAyarlari.kagitOnayarlari
    .some((o) => o.kod === el.kagitOnayari.value)
}

function dpiSecenekleriniDoldur () {
  for (const secenekDpi of olcuMotoru.DPI_SECENEKLERI) {
    const secenek = document.createElement('option')
    secenek.value = String(secenekDpi)
    secenek.textContent = `${secenekDpi} DPI`
    if (secenekDpi === dpi) secenek.selected = true
    el.dpiSecimi.append(secenek)
  }
}

function olcuHatasiGoster (goster) {
  el.olcuHatasi.classList.toggle('d-none', !goster)
  el.genislikMm.classList.toggle('is-invalid', goster)
  el.yukseklikMm.classList.toggle('is-invalid', goster)
}

// Girislerdeki degerleri okur, gecerliyse kirpma oranina uygular.
function olculeriUygula () {
  const genislik = Number.parseFloat(el.genislikMm.value)
  const yukseklik = Number.parseFloat(el.yukseklikMm.value)

  if (!olcuMotoru.olcuGecerliMi(genislik) || !olcuMotoru.olcuGecerliMi(yukseklik)) {
    olcuHatasiGoster(true)
    return
  }

  olcuHatasiGoster(false)
  olcuDurumu = { genislikMm: genislik, yukseklikMm: yukseklik }
  kirpma.oranAta(olcuMotoru.oran(genislik, yukseklik))
  ciktiBilgisiniGuncelle()

  // Vesikalik olcusu degisince sayfaya sigan adet de degisir.
  sayfaKaresiniGecersizKil()
  adediEnFazlayaAyarla()
  ayarlariKaydet()
}

function onayariUygula (kod) {
  const onayar = fotoOnayariBul(kod)
  if (!onayar) return

  el.onayarSecimi.value = kod
  el.genislikMm.value = String(onayar.genislikMm)
  el.yukseklikMm.value = String(onayar.yukseklikMm)
  olculeriUygula()
}

function ciktiBilgisiniGuncelle () {
  const cikti = olcuMotoru.ciktiBoyutu(olcuDurumu, dpi)
  el.ciktiPiksel.textContent = `${cikti.genislik} × ${cikti.yukseklik} px`

  if (!kirpma.cerceve) {
    el.efektifDpi.textContent = '—'
    el.cozunurlukUyarisi.classList.add('d-none')
    return
  }

  // Kirpilan alanin kaynakta gercekten kac DPI ettigi. Secilen DPI'dan dusukse
  // goruntu buyutulerek basilir.
  const efektif = olcuMotoru.efektifDpi(kirpma.cerceve.genislik, olcuDurumu.genislikMm)
  el.efektifDpi.textContent = `≈ ${Math.round(efektif)} DPI`

  const durum = olcuMotoru.cozunurlukDurumu(efektif)
  el.cozunurlukUyarisi.classList.remove('alert-warning', 'alert-danger')

  if (durum === 'iyi') {
    el.cozunurlukUyarisi.classList.add('d-none')
    return
  }

  el.cozunurlukUyarisi.classList.remove('d-none')
  if (durum === 'sinirda') {
    el.cozunurlukUyarisi.classList.add('alert-warning')
    el.cozunurlukUyarisi.textContent =
      `Kırpılan alan ${olcuMotoru.HEDEF_DPI} DPI'ın altında kalıyor. Baskı kabul edilebilir, ` +
      'ancak daha geniş bir alan seçmek daha net sonuç verir.'
  } else {
    el.cozunurlukUyarisi.classList.add('alert-danger')
    el.cozunurlukUyarisi.textContent =
      'Kırpılan alan bu ölçü için çok küçük. Baskı bulanık çıkar; ' +
      'daha geniş bir alan seçin veya daha yüksek çözünürlüklü bir fotoğraf kullanın.'
  }
}

// --- Gorsel yukleme ----------------------------------------------------------

async function gorselYukle (dosya) {
  if (!dosya) return

  uyariGizle()
  el.durum.textContent = 'Fotograf yukleniyor...'

  try {
    const gorsel = await window.HV.gorsel.dosyadanYukle(dosya)
    yuklenenGorsel = gorsel
    tuval.gorselAta(gorsel)
    kirpma.calismaAta(gorsel.calisma)

    // Yeni fotografta onceki hizalama ve maske gecerli degil.
    el.donmeAcisi.value = '0'
    el.donmeDegeri.textContent = '0,0°'
    hamMaske = null
    el.arkaplanBeyazlat.checked = false
    el.arkaplanAyarlari.classList.add('d-none')
    el.aracKirpma.checked = true
    arkaplanDurumu('Kişiyi arka plandan ayırır ve zemini beyaza çevirir.')

    rotusAyarlari = window.HV.rotus.varsayilanAyarlar()
    lekeler = []
    oncesiGosteriliyor = false
    rotusuYaz(rotusAyarlari)
    lekeDurumunuGuncelle()
    aracSec()

    gecmis.temizle()
    durumuKaydet()
    hizalamaDurumu('Yüz ve omuz konumuna göre eğikliği düzeltir, biyometrik kadrajı kurar.')

    const { width, height } = gorsel.asil
    el.gorselBilgisi.textContent =
      `${gorsel.dosyaAdi} · ${width}×${height} · ` +
      `${megapikselBicimle(width, height)} MP · ${baytBicimle(gorsel.bayt)}`

    el.birakmaKatmani.classList.add('d-none')
    araclariEtkinlestir(true)
    el.durum.textContent = 'Hazir'
  } catch (hata) {
    uyariGoster(hata.message)
    el.durum.textContent = 'Hazir'
    if (!yuklenenGorsel) el.gorselBilgisi.textContent = ''
  }
}

// --- Dosya secme -------------------------------------------------------------

el.dosyaSec.addEventListener('click', () => el.dosyaGirisi.click())

el.dosyaGirisi.addEventListener('change', () => {
  gorselYukle(el.dosyaGirisi.files[0])
  // Ayni dosya art arda secilebilsin diye giris sifirlanir.
  el.dosyaGirisi.value = ''
})

// --- Surukle birak -----------------------------------------------------------

// Pencerenin herhangi bir yerine birakilan dosyanin tarayici gibi acilmasi
// engellenir; yalnizca birakma alani dosya kabul eder.
for (const olayAdi of ['dragover', 'drop']) {
  window.addEventListener(olayAdi, (olay) => olay.preventDefault())
}

const birakmaAlani = document.getElementById('tuval-sarmal')

birakmaAlani.addEventListener('dragenter', () => {
  birakmaAlani.classList.add('surukleniyor')
  el.birakmaKatmani.classList.remove('d-none')
})

birakmaAlani.addEventListener('dragleave', (olay) => {
  // Alt ogeler arasinda gezinirken tetiklenen dragleave'ler yok sayilir.
  if (olay.relatedTarget && birakmaAlani.contains(olay.relatedTarget)) return
  birakmaAlani.classList.remove('surukleniyor')
  if (yuklenenGorsel) el.birakmaKatmani.classList.add('d-none')
})

birakmaAlani.addEventListener('drop', (olay) => {
  olay.preventDefault()
  birakmaAlani.classList.remove('surukleniyor')

  const dosya = window.HV.gorsel.veriDenGorselDosya(olay.dataTransfer)
  if (dosya) {
    gorselYukle(dosya)
  } else {
    if (yuklenenGorsel) el.birakmaKatmani.classList.add('d-none')
    uyariGoster('Birakilan oge bir fotograf degil.')
  }
})

// --- Panodan yapistirma ------------------------------------------------------

window.addEventListener('paste', (olay) => {
  const dosya = window.HV.gorsel.veriDenGorselDosya(olay.clipboardData)
  if (dosya) gorselYukle(dosya)
})

// --- Yakinlik denetimleri ----------------------------------------------------

// Yakinlik denetimleri hangi gorunum acikse ona uygulanir.
el.yakinlas.addEventListener('click', () => {
  if (el.gorunumSayfa.checked) sayfayiYakinlastir(1.25)
  else tuval.yakinlastir(1.25)
})

el.uzaklas.addEventListener('click', () => {
  if (el.gorunumSayfa.checked) sayfayiYakinlastir(0.8)
  else tuval.yakinlastir(0.8)
})

el.sigdir.addEventListener('click', () => {
  if (el.gorunumSayfa.checked) {
    sayfaGorunumunuSifirla()
    sayfayiCiz()
  } else {
    tuval.sigdir()
  }
})

// --- Olcu denetimleri --------------------------------------------------------

el.onayarSecimi.addEventListener('change', () => {
  if (el.onayarSecimi.value !== 'ozel') onayariUygula(el.onayarSecimi.value)
  silDugmeleriniGuncelle()
  ayarlariKaydet()
})

// Olculeri elle degistirmek secimi otomatik olarak "Özel ölçü"ye tasir.
for (const giris of [el.genislikMm, el.yukseklikMm]) {
  giris.addEventListener('input', () => {
    el.onayarSecimi.value = 'ozel'
    olculeriUygula()
  })
}

el.dpiSecimi.addEventListener('change', () => {
  dpi = Number.parseInt(el.dpiSecimi.value, 10)
  ciktiBilgisiniGuncelle()
  ayarlariKaydet()
})

el.olcuKaydet.addEventListener('click', () => olcuyuOnayarKaydet())
el.olcuSil.addEventListener('click', () => onayarSil('fotograf'))
el.kagitKaydet.addEventListener('click', () => kagidiOnayarKaydet())
el.kagitSil.addEventListener('click', () => onayarSil('kagit'))

el.kirpmayiSifirla.addEventListener('click', () => kirpma.sifirla())

// --- Hizalama denetimleri ----------------------------------------------------

el.otomatikHizala.addEventListener('click', () => otomatikHizala())

el.donmeAcisi.addEventListener('input', () => {
  aciAta(hizalamaMotoru.radyana(Number.parseFloat(el.donmeAcisi.value)))
})

el.donmeyiSifirla.addEventListener('click', () => aciAta(0))

// --- Arka plan denetimleri ---------------------------------------------------

el.arkaplanBeyazlat.addEventListener('change', () => {
  if (!el.arkaplanBeyazlat.checked) {
    el.arkaplanAyarlari.classList.add('d-none')
    el.aracKirpma.checked = true
    aracSec()
    gosterimiTazele()
    // Beyazlatmayi kapatmak da geri alinabilir bir adimdir.
    durumuKaydet()
    arkaplanDurumu('Kişiyi arka plandan ayırır ve zemini beyaza çevirir.')
    return
  }

  // Maske zaten cikarilmissa (ornegin otomatik hizalama sirasinda) yeniden
  // hesaplanmaz.
  if (hamMaske) {
    el.arkaplanAyarlari.classList.remove('d-none')
    gosterimiTazele()
    arkaplanBasariniBildir()
    // Maske hizalama sirasinda uretilmis olabilir; gecmiste henuz yoktur.
    durumuKaydet({ maskeDegisti: true })
    return
  }

  arkaplaniAyir()
})

el.maskeGenislet.addEventListener('input', () => {
  el.maskeGenisletDegeri.textContent = el.maskeGenislet.value
  gosterimiTazele()
})

el.maskeYumusat.addEventListener('input', () => {
  el.maskeYumusatDegeri.textContent = `${el.maskeYumusat.value} px`
  gosterimiTazele()
})

for (const secim of [el.aracKirpma, el.aracLeke, el.aracFircaSil, el.aracFircaGetir]) {
  secim.addEventListener('change', () => aracSec())
}

el.fircaBoyu.addEventListener('input', () => {
  firca.yaricap = Number.parseInt(el.fircaBoyu.value, 10) / 2
  el.fircaBoyuDegeri.textContent = `${el.fircaBoyu.value} px`
})

// --- Rotus denetimleri -------------------------------------------------------

for (const kaydirac of ROTUS_KAYDIRACLARI) {
  const giris = document.getElementById(kaydirac.giris)

  // Surukleme boyunca onizleme tazelenir, gecmise ise yalnizca birakildiginda
  // tek bir adim yazilir.
  giris.addEventListener('input', () => {
    rotusAyarlari = rotusuOku()
    gosterimiTazele()
  })
  giris.addEventListener('change', () => durumuKaydet())
}

el.lekeBoyu.addEventListener('input', () => {
  lekeFircasi.yaricap = Number.parseInt(el.lekeBoyu.value, 10) / 2
  el.lekeBoyuDegeri.textContent = `${el.lekeBoyu.value} px`
})

el.rotusuSifirla.addEventListener('click', () => {
  rotusAyarlari = window.HV.rotus.varsayilanAyarlar()
  lekeler = []
  rotusuYaz(rotusAyarlari)
  lekeDurumunuGuncelle()
  gosterimiTazele()
  durumuKaydet()
})

// --- Indirme -----------------------------------------------------------------

function indirmeDurumu (mesaj, tur = 'bilgi') {
  el.indirmeDurumu.textContent = mesaj
  el.indirmeDurumu.classList.toggle('text-danger', tur === 'hata')
  el.indirmeDurumu.classList.toggle('text-success', tur === 'basari')
  el.indirmeDurumu.classList.toggle('text-body-secondary', tur === 'bilgi')
}

// Ciktida kullanilacak maske: onizlemedeki ile ayni kenar ayarlariyla uretilir.
function ciktiMaskesi () {
  if (!hamMaske || !el.arkaplanBeyazlat.checked) return null

  return window.HV.arkaplan.maskeyiAyarla(hamMaske, {
    genislet: Number.parseFloat(el.maskeGenislet.value) / 100,
    yumusat: Number.parseFloat(el.maskeYumusat.value)
  })
}

async function fotografiIndir () {
  if (!yuklenenGorsel || !kirpma.cerceve) return

  const tur = el.turPng.checked ? 'png' : 'jpg'
  el.indir.disabled = true
  indirmeDurumu('Görüntü hazırlanıyor…')

  try {
    const { baytlar, cikti } = await window.HV.disaAktar.baytlariUret({
      gorsel: yuklenenGorsel,
      cerceve: kirpma.cerceve,
      maske: ciktiMaskesi(),
      rotusAyarlari,
      lekeler,
      olcuMm: olcuDurumu,
      dpi,
      tur,
      kalite: Number.parseInt(el.jpgKalitesi.value, 10) / 100
    })

    const sonuc = await window.hiperVesika.gorseliKaydet({
      baytlar,
      tur,
      varsayilanAd: window.HV.disaAktar.varsayilanAd(olcuDurumu, dpi, tur)
    })

    if (sonuc.hata) {
      indirmeDurumu(`Kaydedilemedi: ${sonuc.hata}`, 'hata')
    } else if (sonuc.kaydedildi) {
      indirmeDurumu(
        `Kaydedildi: ${cikti.genislik}×${cikti.yukseklik} px, ${dpi} DPI ` +
        `(${olcuDurumu.genislikMm}×${olcuDurumu.yukseklikMm} mm).`,
        'basari'
      )
    } else {
      indirmeDurumu('Kaydetme iptal edildi.')
    }
  } catch (hata) {
    indirmeDurumu(`Görüntü hazırlanamadı: ${hata.message}`, 'hata')
  } finally {
    el.indir.disabled = false
  }
}

// --- Sayfaya dizme -----------------------------------------------------------

// Sayfada kullanilan tek vesikalik karesi. Fotograf ya da ayarlar degistiginde
// gecersiz kilinir; sayfa cizilirken gerekirse yeniden uretilir.
let sayfaKaresi = null

// Onizleme icin 150 DPI yeterli; sayfa zaten kucultulerek gosteriliyor.
const SAYFA_ONIZLEME_DPI = 150

// Sayfa gorunumunun kendi yakinligi vardir: fotograf tuvalindeki olcek kaynak
// pikseline gore, buradaki ise "sigdir" haline gore olculur (%100 = tam sigmis).
const SAYFA_EN_KUCUK_YAKINLIK = 0.2
const SAYFA_EN_BUYUK_YAKINLIK = 8

let sayfaYakinligi = 1
let sayfaKaymasi = { x: 0, y: 0 }
// Kagit olcusu degisince gorunum sifirlanir; eski kayma yeni kagitta anlamsiz.
let sonCizilenKagit = null

function sayfaTuvalOlcusu () {
  return { genislik: el.sayfaTuvali.width, yukseklik: el.sayfaTuvali.height }
}

// Kayma ve yakinlik hesabi tuval pikselinde yapilir; imlec konumu da oyle.
function sayfaImlecKonumu (olay) {
  const oran = window.devicePixelRatio || 1
  const kutu = el.sayfaTuvali.getBoundingClientRect()
  return { x: (olay.clientX - kutu.left) * oran, y: (olay.clientY - kutu.top) * oran }
}

function sayfaGorunumunuSifirla () {
  sayfaYakinligi = 1
  sayfaKaymasi = { x: 0, y: 0 }
}

function sayfayiYakinlastir (carpan, merkez) {
  const kagitMm = kagitOlcusu()
  if (!kagitMm) return

  const yeniYakinlik = Math.min(
    Math.max(sayfaYakinligi * carpan, SAYFA_EN_KUCUK_YAKINLIK),
    SAYFA_EN_BUYUK_YAKINLIK
  )
  if (yeniYakinlik === sayfaYakinligi) return

  const tuvalOlcusu = sayfaTuvalOlcusu()
  sayfaKaymasi = window.HV.sayfa.yakinlastirmaKaymasi({
    tuvalOlcusu,
    kagitMm,
    yakinlik: sayfaYakinligi,
    yeniYakinlik,
    kayma: sayfaKaymasi,
    // Merkez verilmezse tuvalin ortasi esas alinir.
    merkez: merkez ?? { x: tuvalOlcusu.genislik / 2, y: tuvalOlcusu.yukseklik / 2 }
  })
  sayfaYakinligi = yeniYakinlik
  sayfayiCiz()
}

function sayfaKaresiniGecersizKil () {
  sayfaKaresi = null
  if (el.gorunumSayfa.checked) sayfayiCiz()
}

function sayfaKaresiniAl () {
  if (sayfaKaresi) return sayfaKaresi
  if (!yuklenenGorsel || !kirpma.cerceve) return null

  const { tuval: kare } = window.HV.disaAktar.tuvalUret({
    gorsel: yuklenenGorsel,
    cerceve: kirpma.cerceve,
    maske: ciktiMaskesi(),
    rotusAyarlari,
    lekeler,
    olcuMm: olcuDurumu,
    dpi: SAYFA_ONIZLEME_DPI
  })

  sayfaKaresi = kare
  return kare
}

function kagitOlcusu () {
  const genislik = Number.parseFloat(el.kagitGenislik.value)
  const yukseklik = Number.parseFloat(el.kagitYukseklik.value)

  const gecerli = window.HV.sayfa.kagitGecerliMi(genislik) &&
    window.HV.sayfa.kagitGecerliMi(yukseklik)

  el.kagitHatasi.classList.toggle('d-none', gecerli)
  el.kagitGenislik.classList.toggle('is-invalid', !gecerli)
  el.kagitYukseklik.classList.toggle('is-invalid', !gecerli)

  return gecerli ? { genislik, yukseklik } : null
}

function yerlesimiHesapla () {
  const kagitMm = kagitOlcusu()
  if (!kagitMm) return null

  const istenenAdet = Number.parseInt(el.dizmeAdet.value, 10)

  return window.HV.sayfa.enIyiYerlesim({
    kagitMm,
    fotoMm: { genislik: olcuDurumu.genislikMm, yukseklik: olcuDurumu.yukseklikMm },
    kenarMm: Number.parseFloat(el.dizmeKenar.value) || 0,
    aralikMm: Number.parseFloat(el.dizmeAralik.value) || 0,
    enFazlaAdet: Number.isFinite(istenenAdet) && istenenAdet > 0 ? istenenAdet : Infinity
  })
}

function sayfayiCiz () {
  const kagitMm = kagitOlcusu()
  const yerlesim = yerlesimiHesapla()

  if (!kagitMm || !yerlesim) {
    el.dizmeDurumu.textContent = 'Kağıt ölçüsü geçersiz.'
    el.dizmeDurumu.classList.add('text-danger')
    return
  }
  el.dizmeDurumu.classList.remove('text-danger')

  // Kagit degistiginde onceki yakinlik ve kayma yeni sayfaya uymuyor.
  const kagitAnahtari = `${kagitMm.genislik}x${kagitMm.yukseklik}`
  if (sonCizilenKagit !== kagitAnahtari) {
    sonCizilenKagit = kagitAnahtari
    sayfaGorunumunuSifirla()
  }

  // Tuvalin arkaplan cozunurlugu ekran yogunluguna gore ayarlanir.
  const oran = window.devicePixelRatio || 1
  const kutu = el.sayfaTuvali.getBoundingClientRect()
  if (kutu.width < 1 || kutu.height < 1) return

  // Olcu degismediyse dokunulmaz: canvas.width atamasi tuvali temizliyor ve
  // ResizeObserver ile birlikte gereksiz bir donguye yol aciyor.
  const genislik = Math.max(1, Math.round(kutu.width * oran))
  const yukseklik = Math.max(1, Math.round(kutu.height * oran))
  if (el.sayfaTuvali.width !== genislik || el.sayfaTuvali.height !== yukseklik) {
    el.sayfaTuvali.width = genislik
    el.sayfaTuvali.height = yukseklik
  }

  window.HV.sayfa.sayfayiCiz(el.sayfaTuvali, {
    kagitMm,
    yerlesim,
    fotoTuvali: sayfaKaresiniAl(),
    kesimKilavuzu: el.kesimKilavuzu.checked,
    yakinlik: sayfaYakinligi,
    kayma: sayfaKaymasi
  })

  // Sayfada %100, kagidin tam sigdigi hali demektir.
  el.yakinlikOrani.textContent = `%${Math.round(sayfaYakinligi * 100)}`

  // Etiketin yaninda dar bir alanda duruyor; yalnizca ust sinir yazilir.
  el.dizmeAdetSiniri.textContent = yerlesim.sigmiyor ? '' : `≤ ${yerlesim.sigacakAdet}`
  el.dizmeAdetSiniri.title = yerlesim.sigmiyor ? '' : `Kağıda en fazla ${yerlesim.sigacakAdet} adet sığıyor`
  el.dizmeAdet.max = String(Math.max(1, yerlesim.sigacakAdet ?? 1))

  if (yerlesim.sigmiyor) {
    el.dizmeDurumu.classList.add('text-danger')
    el.dizmeDurumu.textContent =
      `${olcuDurumu.genislikMm}×${olcuDurumu.yukseklikMm} mm vesikalık bu kağıda sığmıyor. ` +
      'Daha büyük bir kağıt seçin veya kenar boşluğunu azaltın.'
    return
  }

  const parcalar = [
    `${kagitMm.genislik}×${kagitMm.yukseklik} mm kağıda ` +
    `${yerlesim.sutun}×${yerlesim.satir} düzeninde ${yerlesim.sigacakAdet} adet sığıyor`
  ]
  if (yerlesim.adet < yerlesim.sigacakAdet) parcalar.push(`${yerlesim.adet} adet diziliyor`)
  if (yerlesim.dondurulmus) parcalar.push('fotoğraflar yatay yerleştirildi')

  el.dizmeDurumu.textContent = `${parcalar.join(' · ')}.`
}

function gorunumuUygula () {
  const sayfaGorunumu = el.gorunumSayfa.checked

  el.tuval.classList.toggle('d-none', sayfaGorunumu)
  el.sayfaTuvali.classList.toggle('d-none', !sayfaGorunumu)
  // Kirpma, leke ve firca araclari sayfa gorunumunde is gormez.
  for (const oge of document.querySelectorAll('.hv-fotograf-araci')) {
    oge.classList.toggle('d-none', sayfaGorunumu)
  }
  // Fotograf araclari sayfa gorunumunde anlamsiz.
  el.birakmaKatmani.classList.toggle('d-none', sayfaGorunumu || yuklenenGorsel !== null)

  if (sayfaGorunumu) sayfayiCiz()
  else tuval.ciz()
}

function kagitOnayariBul (kod) {
  return window.HV.sayfa.KAGIT_ONAYARLARI.find((k) => k.kod === kod) ??
    kullaniciAyarlari.kagitOnayarlari.find((k) => k.kod === kod) ?? null
}

function kagitOnayarlariniDoldur () {
  const onceki = el.kagitOnayari.value
  el.kagitOnayari.replaceChildren()

  for (const onayar of window.HV.sayfa.KAGIT_ONAYARLARI) {
    secenekEkle(el.kagitOnayari, onayar.kod, onayar.ad)
  }

  kullaniciGrubu(
    el.kagitOnayari, kullaniciAyarlari.kagitOnayarlari,
    (k) => `${k.ad} — ${k.genislik}×${k.yukseklik} mm`
  )
  secenekEkle(el.kagitOnayari, 'ozel', 'Özel ölçü')

  el.kagitOnayari.value = onceki
  if (!el.kagitOnayari.value) el.kagitOnayari.value = 'ozel'
  silDugmeleriniGuncelle()
}

function kagitOnayariniUygula (kod) {
  const onayar = kagitOnayariBul(kod)
  if (!onayar) return

  el.kagitOnayari.value = kod
  el.kagitGenislik.value = String(onayar.genislik)
  el.kagitYukseklik.value = String(onayar.yukseklik)
  adediEnFazlayaAyarla()
  silDugmeleriniGuncelle()
}

// Kagit ya da olcu degisince adet, sigan en buyuk degere cekilir.
function adediEnFazlayaAyarla () {
  const kagitMm = kagitOlcusu()
  if (!kagitMm) return

  const tam = window.HV.sayfa.enIyiYerlesim({
    kagitMm,
    fotoMm: { genislik: olcuDurumu.genislikMm, yukseklik: olcuDurumu.yukseklikMm },
    kenarMm: Number.parseFloat(el.dizmeKenar.value) || 0,
    aralikMm: Number.parseFloat(el.dizmeAralik.value) || 0
  })

  el.dizmeAdet.value = String(Math.max(1, tam.adet))
  if (el.gorunumSayfa.checked) sayfayiCiz()
}

// --- Baski ve sayfayi kaydetme -----------------------------------------------

function baskiDurumu (mesaj, tur = 'bilgi') {
  el.baskiDurumu.textContent = mesaj
  el.baskiDurumu.classList.toggle('text-danger', tur === 'hata')
  el.baskiDurumu.classList.toggle('text-success', tur === 'basari')
  el.baskiDurumu.classList.toggle('text-body-secondary', tur === 'bilgi')
}

// Basilacak / kaydedilecek sayfa. Onizlemedeki 150 DPI'lik kare degil, secilen
// DPI'da yeniden uretilmis tam cozunurluklu vesikalik kullanilir. Tuvalin
// piksel olcusu kagidin milimetre olcusunun tam karsiligidir; boylece sayfada
// 1 mm her zaman ayni sayida piksele denk gelir.
function baskiSayfasiUret () {
  if (!yuklenenGorsel || !kirpma.cerceve) {
    baskiDurumu('Önce bir fotoğraf açıp kadrajı ayarlayın.', 'hata')
    return null
  }

  const kagitMm = kagitOlcusu()
  const yerlesim = yerlesimiHesapla()

  if (!kagitMm || !yerlesim) {
    baskiDurumu('Kağıt ölçüsü geçersiz.', 'hata')
    return null
  }
  if (yerlesim.sigmiyor) {
    baskiDurumu('Vesikalık bu kağıda sığmıyor; önce kağıt ölçüsünü değiştirin.', 'hata')
    return null
  }

  const { tuval: kare } = window.HV.disaAktar.tuvalUret({
    gorsel: yuklenenGorsel,
    cerceve: kirpma.cerceve,
    maske: ciktiMaskesi(),
    rotusAyarlari,
    lekeler,
    olcuMm: olcuDurumu,
    dpi
  })

  const sayfaTuvali = document.createElement('canvas')
  sayfaTuvali.width = Math.round(olcuMotoru.mmDenPiksel(kagitMm.genislik, dpi))
  sayfaTuvali.height = Math.round(olcuMotoru.mmDenPiksel(kagitMm.yukseklik, dpi))

  window.HV.sayfa.sayfayiCiz(sayfaTuvali, {
    kagitMm,
    yerlesim,
    fotoTuvali: kare,
    kesimKilavuzu: el.kesimKilavuzu.checked,
    // Kagidin kenarina cizgi cekilirse basilan kagitta gercek bir cerceve olur.
    kagitKenari: false
  })

  return { tuval: sayfaTuvali, kagitMm, yerlesim }
}

async function sayfaBaytlari (sayfaTuvali, tur, kalite) {
  const blob = await new Promise((cozumle) => {
    sayfaTuvali.toBlob(cozumle, tur === 'png' ? 'image/png' : 'image/jpeg', kalite)
  })
  if (!blob) throw new Error('Sayfa kodlanamadı.')

  const ham = new Uint8Array(await blob.arrayBuffer())
  return window.HV.metaveri.dpiYaz(ham, dpi, tur)
}

function baskiDugmeleri (etkin) {
  for (const dugme of [el.sayfayiBas, el.sayfayiPdf, el.sayfayiKaydet]) {
    dugme.disabled = !etkin
  }
}

// Sayfayi JPG/PNG olarak kaydeder. Bicim ve kalite ayari Indir kartindakiyle
// ayni; uygulamada tek bir cikti bicimi ayari var.
async function sayfayiGoruntuKaydet () {
  const sayfa = baskiSayfasiUret()
  if (!sayfa) return

  const tur = el.turPng.checked ? 'png' : 'jpg'
  baskiDugmeleri(false)
  baskiDurumu('Sayfa hazırlanıyor…')

  try {
    const baytlar = await sayfaBaytlari(
      sayfa.tuval, tur, Number.parseInt(el.jpgKalitesi.value, 10) / 100
    )

    const sonuc = await window.hiperVesika.gorseliKaydet({
      baytlar,
      tur,
      baslik: 'Sayfayı kaydet',
      varsayilanAd: window.HV.sayfa.sayfaDosyaAdi(sayfa.kagitMm, sayfa.yerlesim.adet, dpi, tur)
    })

    if (sonuc.hata) baskiDurumu(`Kaydedilemedi: ${sonuc.hata}`, 'hata')
    else if (sonuc.kaydedildi) {
      baskiDurumu(
        `Kaydedildi: ${sayfa.kagitMm.genislik}×${sayfa.kagitMm.yukseklik} mm sayfa, ` +
        `${sayfa.yerlesim.adet} adet, ${dpi} DPI.`,
        'basari'
      )
    } else baskiDurumu('Kaydetme iptal edildi.')
  } catch (hata) {
    baskiDurumu(`Sayfa hazırlanamadı: ${hata.message}`, 'hata')
  } finally {
    baskiDugmeleri(true)
  }
}

async function sayfayiPdfKaydet () {
  const sayfa = baskiSayfasiUret()
  if (!sayfa) return

  baskiDugmeleri(false)
  baskiDurumu('PDF hazırlanıyor…')

  try {
    // PDF'e her zaman kayipsiz PNG gomulur; olcu tasiyicisi PDF'in kendisidir.
    const baytlar = await sayfaBaytlari(sayfa.tuval, 'png')

    const sonuc = await window.hiperVesika.sayfayiPdfKaydet({
      baytlar,
      kagitMm: sayfa.kagitMm,
      varsayilanAd: window.HV.sayfa.sayfaDosyaAdi(
        sayfa.kagitMm, sayfa.yerlesim.adet, dpi, 'pdf'
      )
    })

    if (sonuc.hata) baskiDurumu(`PDF kaydedilemedi: ${sonuc.hata}`, 'hata')
    else if (sonuc.kaydedildi) {
      baskiDurumu(
        `PDF kaydedildi: ${sayfa.kagitMm.genislik}×${sayfa.kagitMm.yukseklik} mm sayfa. ` +
        'Yazdırırken ölçekleme "gerçek boyut / %100" seçilmelidir.',
        'basari'
      )
    } else baskiDurumu('Kaydetme iptal edildi.')
  } catch (hata) {
    baskiDurumu(`PDF hazırlanamadı: ${hata.message}`, 'hata')
  } finally {
    baskiDugmeleri(true)
  }
}

async function sayfayiBas () {
  const sayfa = baskiSayfasiUret()
  if (!sayfa) return

  const yaziciAdi = el.yaziciSecimi.value
  if (!yaziciAdi && !el.yaziciPenceresi.checked) {
    baskiDurumu(
      'Yazıcı bulunamadı. Sistem ayarlarından bir yazıcı ekleyin veya sayfayı ' +
      'PDF olarak kaydedip başka bir bilgisayarda bastırın.',
      'hata'
    )
    return
  }

  baskiDugmeleri(false)
  baskiDurumu('Baskıya gönderiliyor…')

  try {
    const baytlar = await sayfaBaytlari(sayfa.tuval, 'png')

    const sonuc = await window.hiperVesika.sayfayiBas({
      baytlar,
      kagitMm: sayfa.kagitMm,
      yaziciAdi,
      kopya: Number.parseInt(el.kopyaSayisi.value, 10) || 1,
      pencereGoster: el.yaziciPenceresi.checked
    })

    if (sonuc.basildi) {
      const kopya = Number.parseInt(el.kopyaSayisi.value, 10) || 1
      baskiDurumu(
        `Baskıya gönderildi: ${kopya} kopya, ` +
        `${sayfa.kagitMm.genislik}×${sayfa.kagitMm.yukseklik} mm.`,
        'basari'
      )
    } else if (sonuc.iptal) {
      baskiDurumu('Baskı iptal edildi.')
    } else {
      baskiDurumu(`Baskı yapılamadı: ${sonuc.hata}`, 'hata')
    }
  } catch (hata) {
    baskiDurumu(`Sayfa hazırlanamadı: ${hata.message}`, 'hata')
  } finally {
    baskiDugmeleri(true)
  }
}

async function yazicilariDoldur () {
  const { yazicilar, hata } = await window.hiperVesika.yaziciListesi()

  el.yaziciSecimi.replaceChildren()

  if (hata || !yazicilar.length) {
    const secenek = document.createElement('option')
    secenek.value = ''
    secenek.textContent = 'Yazıcı bulunamadı'
    el.yaziciSecimi.append(secenek)
    el.yaziciSecimi.disabled = true
    return
  }

  el.yaziciSecimi.disabled = false
  for (const yazici of yazicilar) {
    const secenek = document.createElement('option')
    secenek.value = yazici.ad
    secenek.textContent = yazici.gorunenAd
    if (yazici.varsayilan) secenek.selected = true
    el.yaziciSecimi.append(secenek)
  }
}

// Kisayol adlari platforma gore yazilir; menudeki CmdOrCtrl ile ayni tuslar.
function kisayollariYaz () {
  const mac = window.hiperVesika.platform === 'darwin'
  const tus = (harf, ustKarakter = false) => mac
    ? `${ustKarakter ? '⇧' : ''}⌘${harf}`
    : `Ctrl+${ustKarakter ? 'Shift+' : ''}${harf}`

  el.baskiKisayollari.innerHTML =
    `Kısayollar: <kbd>${tus('P')}</kbd> yazdır · ` +
    `<kbd>${tus('S')}</kbd> kaydet · <kbd>${tus('S', true)}</kbd> PDF`
}

// --- Kullanici ayarlari ------------------------------------------------------

// Electron'da window.prompt calismaz; ad kucuk bir pencerede sorulur.
// Vazgecilirse null doner.
let adPenceresi = null

function onayarAdiSor ({ baslik, bilgi, varsayilanAd }) {
  return new Promise((cozumle) => {
    adPenceresi = adPenceresi ?? new window.bootstrap.Modal(el.onayarModali)

    el.onayarModalBasligi.textContent = baslik
    el.onayarModalBilgisi.textContent = bilgi
    el.onayarAdi.value = varsayilanAd
    el.onayarAdi.classList.remove('is-invalid')

    // Cevap, pencerenin kapanma animasyonu beklenmeden verilir: kaydetme
    // tiklamanin hemen ardindan olur.
    let cevaplandi = false

    const bitir = (ad) => {
      if (cevaplandi) return
      cevaplandi = true
      el.onayarKaydet.removeEventListener('click', kaydet)
      el.onayarAdi.removeEventListener('keydown', tusla)
      cozumle(ad)
    }

    function kaydet () {
      const ad = el.onayarAdi.value.trim()
      if (!ad) {
        el.onayarAdi.classList.add('is-invalid')
        return
      }
      adPenceresi.hide()
      bitir(ad)
    }

    function tusla (olay) {
      if (olay.key !== 'Enter') return
      olay.preventDefault()
      kaydet()
    }

    el.onayarKaydet.addEventListener('click', kaydet)
    el.onayarAdi.addEventListener('keydown', tusla)
    el.onayarModali.addEventListener('shown.bs.modal', () => el.onayarAdi.select(), { once: true })
    // Vazgecme, kapatma dugmesi, ESC ve disariya tiklama buraya duser.
    el.onayarModali.addEventListener('hidden.bs.modal', () => bitir(null), { once: true })

    adPenceresi.show()
  })
}

// Ayni adla kaydetmek eskisinin uzerine yazar; kod korunur, boylece secim
// listede yerinde kalir.
function onayarYerlestir (liste, ad, degerler) {
  const mevcut = liste.find((o) => o.ad === ad)
  const kod = mevcut ? mevcut.kod : benzersizKod(liste)
  const yeni = { kod, ad, ...degerler }

  return {
    kod,
    liste: mevcut ? liste.map((o) => (o.kod === kod ? yeni : o)) : [...liste, yeni]
  }
}

const EN_FAZLA_ONAYAR = 50

function onayarSayisiUygunMu (liste, ad) {
  if (liste.length < EN_FAZLA_ONAYAR || liste.some((o) => o.ad === ad)) return true
  uyariGoster(`En fazla ${EN_FAZLA_ONAYAR} ön ayar kaydedilebilir. Önce birini silin.`)
  return false
}

async function olcuyuOnayarKaydet () {
  const { genislikMm, yukseklikMm } = olcuDurumu
  if (!olcuMotoru.olcuGecerliMi(genislikMm) || !olcuMotoru.olcuGecerliMi(yukseklikMm)) return

  const ad = await onayarAdiSor({
    baslik: 'Ölçüyü kaydet',
    bilgi: `${genislikMm}×${yukseklikMm} mm bu adla hazır ölçülerin altına eklenir.`,
    varsayilanAd: `${genislikMm}×${yukseklikMm} mm`
  })
  if (!ad || !onayarSayisiUygunMu(kullaniciAyarlari.fotografOnayarlari, ad)) return

  const { kod, liste } = onayarYerlestir(
    kullaniciAyarlari.fotografOnayarlari, ad, { genislikMm, yukseklikMm }
  )
  kullaniciAyarlari.fotografOnayarlari = liste

  onayarlariDoldur()
  el.onayarSecimi.value = kod
  silDugmeleriniGuncelle()
  ayarlariKaydet({ hemen: true })
  el.durum.textContent = `"${ad}" ön ayarı kaydedildi.`
}

async function kagidiOnayarKaydet () {
  const kagitMm = kagitOlcusu()
  if (!kagitMm) return

  const ad = await onayarAdiSor({
    baslik: 'Kağıdı kaydet',
    bilgi: `${kagitMm.genislik}×${kagitMm.yukseklik} mm bu adla kağıt listesine eklenir.`,
    varsayilanAd: `${kagitMm.genislik}×${kagitMm.yukseklik} mm`
  })
  if (!ad || !onayarSayisiUygunMu(kullaniciAyarlari.kagitOnayarlari, ad)) return

  const { kod, liste } = onayarYerlestir(kullaniciAyarlari.kagitOnayarlari, ad, kagitMm)
  kullaniciAyarlari.kagitOnayarlari = liste

  kagitOnayarlariniDoldur()
  el.kagitOnayari.value = kod
  silDugmeleriniGuncelle()
  ayarlariKaydet({ hemen: true })
  el.durum.textContent = `"${ad}" ön ayarı kaydedildi.`
}

function onayarSil (tur) {
  const fotograf = tur === 'fotograf'
  const secim = fotograf ? el.onayarSecimi : el.kagitOnayari
  const liste = fotograf
    ? kullaniciAyarlari.fotografOnayarlari
    : kullaniciAyarlari.kagitOnayarlari

  const onayar = liste.find((o) => o.kod === secim.value)
  if (!onayar) return

  const kalan = liste.filter((o) => o.kod !== onayar.kod)
  if (fotograf) kullaniciAyarlari.fotografOnayarlari = kalan
  else kullaniciAyarlari.kagitOnayarlari = kalan

  // Silinen on ayar seciliydi; olculer degismez, secim "Özel ölçü"ye duser.
  secim.value = 'ozel'
  if (fotograf) onayarlariDoldur()
  else kagitOnayarlariniDoldur()

  ayarlariKaydet({ hemen: true })
  el.durum.textContent = `"${onayar.ad}" ön ayarı silindi.`
}

// Uygulama yeniden acildiginda ayni yerden devam edilsin diye tutulan degerler.
function sonKullanilaniTopla () {
  return {
    fotoOnayar: el.onayarSecimi.value,
    genislikMm: olcuDurumu.genislikMm,
    yukseklikMm: olcuDurumu.yukseklikMm,
    dpi,
    tur: el.turPng.checked ? 'png' : 'jpg',
    kalite: Number.parseInt(el.jpgKalitesi.value, 10),
    kagitOnayar: el.kagitOnayari.value,
    kagitGenislik: Number.parseFloat(el.kagitGenislik.value),
    kagitYukseklik: Number.parseFloat(el.kagitYukseklik.value),
    kenarMm: Number.parseFloat(el.dizmeKenar.value) || 0,
    aralikMm: Number.parseFloat(el.dizmeAralik.value) || 0,
    kesimKilavuzu: el.kesimKilavuzu.checked,
    yazici: el.yaziciSecimi.value,
    kopya: Number.parseInt(el.kopyaSayisi.value, 10) || 1,
    yaziciPenceresi: el.yaziciPenceresi.checked
  }
}

let yazmaZamanlayicisi = null

function diskeYaz () {
  kullaniciAyarlari.sonKullanilan = sonKullanilaniTopla()
  return window.hiperVesika.ayarlariYaz(kullaniciAyarlari)
}

// Tur ilk acilisin bir parcasi; baslangicta kullanilan bos ayar nesnesinde de
// bulunmali ki tur bittiginde yazilan dosyada kaybolmasin.
kullaniciAyarlari.tanitimGoruldu = false

// Kaydirac ve sayi girisleri her tusta yazmasin diye gecikmeli toplanir.
// On ayar kaydetme/silme gibi tek seferlik islerde beklenmez: kullanici hemen
// ardindan pencereyi kapatirsa kaydi kaybetmemeli.
function ayarlariKaydet ({ hemen = false } = {}) {
  if (!ayarlarHazir) return

  clearTimeout(yazmaZamanlayicisi)
  if (hemen) {
    diskeYaz()
    return
  }
  yazmaZamanlayicisi = setTimeout(diskeYaz, 400)
}

// Bekleyen bir yazma varken pencere kapanirsa son degerler yine de gonderilir.
window.addEventListener('beforeunload', () => {
  if (!ayarlarHazir || yazmaZamanlayicisi === null) return
  clearTimeout(yazmaZamanlayicisi)
  diskeYaz()
})

function sonKullanilaniUygula (son) {
  // Once kagit: olcu uygulanirken sigan adet buna gore hesaplaniyor.
  const kagitGenislik = Number(son.kagitGenislik)
  const kagitYukseklik = Number(son.kagitYukseklik)
  if (window.HV.sayfa.kagitGecerliMi(kagitGenislik) &&
      window.HV.sayfa.kagitGecerliMi(kagitYukseklik)) {
    el.kagitGenislik.value = String(kagitGenislik)
    el.kagitYukseklik.value = String(kagitYukseklik)
    el.kagitOnayari.value = kagitOnayariBul(son.kagitOnayar) ? son.kagitOnayar : 'ozel'
  }

  if (Number.isFinite(son.kenarMm)) el.dizmeKenar.value = String(son.kenarMm)
  if (Number.isFinite(son.aralikMm)) el.dizmeAralik.value = String(son.aralikMm)
  if (typeof son.kesimKilavuzu === 'boolean') el.kesimKilavuzu.checked = son.kesimKilavuzu

  if (olcuMotoru.olcuGecerliMi(son.genislikMm) && olcuMotoru.olcuGecerliMi(son.yukseklikMm)) {
    el.genislikMm.value = String(son.genislikMm)
    el.yukseklikMm.value = String(son.yukseklikMm)
    el.onayarSecimi.value = fotoOnayariBul(son.fotoOnayar) ? son.fotoOnayar : 'ozel'
    olculeriUygula()
  }

  if (olcuMotoru.DPI_SECENEKLERI.includes(son.dpi)) {
    dpi = son.dpi
    el.dpiSecimi.value = String(son.dpi)
    ciktiBilgisiniGuncelle()
  }

  if (son.tur === 'png' || son.tur === 'jpg') {
    el.turPng.checked = son.tur === 'png'
    el.turJpg.checked = son.tur === 'jpg'
    el.kaliteAlani.classList.toggle('d-none', el.turPng.checked)
  }
  if (Number.isFinite(son.kalite) && son.kalite >= 60 && son.kalite <= 100) {
    el.jpgKalitesi.value = String(son.kalite)
    el.jpgKalitesiDegeri.textContent = `%${son.kalite}`
  }

  if (Number.isFinite(son.kopya)) {
    el.kopyaSayisi.value = String(Math.min(99, Math.max(1, Math.trunc(son.kopya))))
  }
  if (typeof son.yaziciPenceresi === 'boolean') {
    el.yaziciPenceresi.checked = son.yaziciPenceresi
  }
  // Yazici listeden kaldirilmis olabilir; yoksa varsayilan secili kalir.
  if (son.yazici && [...el.yaziciSecimi.options].some((o) => o.value === son.yazici)) {
    el.yaziciSecimi.value = son.yazici
  }

  adediEnFazlayaAyarla()
  silDugmeleriniGuncelle()
}

async function ayarlariYukle () {
  try {
    const okunan = await window.hiperVesika.ayarlariOku()
    kullaniciAyarlari = {
      fotografOnayarlari: okunan?.fotografOnayarlari ?? [],
      kagitOnayarlari: okunan?.kagitOnayarlari ?? [],
      sonKullanilan: okunan?.sonKullanilan ?? {},
      tanitimGoruldu: okunan?.tanitimGoruldu === true
    }
  } catch {
    // Ayarlar okunamazsa uygulama varsayilanlarla acilir.
  }

  onayarlariDoldur()
  kagitOnayarlariniDoldur()
  sonKullanilaniUygula(kullaniciAyarlari.sonKullanilan)

  // Bu noktadan sonra yapilan her degisiklik diske yazilir.
  ayarlarHazir = true

  // Ilk acilista tanitim turu kendiliginden baslar.
  if (!kullaniciAyarlari.tanitimGoruldu) turuBaslat()
}

// --- Tanitim turu ------------------------------------------------------------

// Tur, uygulamanin gercek arayuzunu isiklandirarak anlatir. Ilk acilista
// kendiliginden baslar, sonra Yardim menusunden (F1) tekrar acilir.
const tanitimMotoru = window.HV.tanitim

let turAdimlari = []
let turSirasi = 0
let turAcik = false
// Tur sekmeleri kendisi degistirdigi icin baslangictaki sekme geri alinir:
// ilk acilista Kadraj'a, F1 ile acildiginda kullanicinin kaldigi yere doner.
let turOncekiSekme = null

const turOgeleri = {
  katman: document.getElementById('tanitim-katmani'),
  isik: document.getElementById('tanitim-isik'),
  kart: document.getElementById('tanitim-karti'),
  sayac: document.getElementById('tanitim-sayac'),
  baslik: document.getElementById('tanitim-baslik'),
  metin: document.getElementById('tanitim-metin'),
  geri: document.getElementById('btn-tanitim-geri'),
  ileri: document.getElementById('btn-tanitim-ileri'),
  atla: document.getElementById('btn-tanitim-atla')
}

function adimSekmesiniAc (panel) {
  if (!panel) return
  const dugme = document.getElementById(`adim-${panel}-dugmesi`)
  if (dugme && !dugme.classList.contains('active')) dugme.click()
}

function turAdiminiGoster () {
  const adim = turAdimlari[turSirasi]
  if (!adim) return turuBitir()

  adimSekmesiniAc(adim.panel)

  const hedef = document.querySelector(adim.hedef)
  if (!hedef) {
    // Hedef arada kaybolduysa adim atlanir; tur kirilmaz.
    turAdimlari.splice(turSirasi, 1)
    return turAdimlari.length ? turAdiminiGoster() : turuBitir()
  }

  turOgeleri.sayac.textContent = `${turSirasi + 1} / ${turAdimlari.length}`
  turOgeleri.baslik.textContent = adim.baslik
  turOgeleri.metin.textContent = adim.metin
  turOgeleri.geri.disabled = turSirasi === 0
  turOgeleri.ileri.textContent = turSirasi === turAdimlari.length - 1 ? 'Bitir' : 'İleri'

  // Sekme gecisi ve metin degisimi yerlesimi etkiler; olcumler sonrasinda alinir.
  requestAnimationFrame(() => {
    const kutu = hedef.getBoundingClientRect()
    const isik = tanitimMotoru.isikAlani({
      x: kutu.left, y: kutu.top, genislik: kutu.width, yukseklik: kutu.height
    })

    turOgeleri.isik.style.left = `${isik.x}px`
    turOgeleri.isik.style.top = `${isik.y}px`
    turOgeleri.isik.style.width = `${isik.genislik}px`
    turOgeleri.isik.style.height = `${isik.yukseklik}px`

    const kartKutusu = turOgeleri.kart.getBoundingClientRect()
    const konum = tanitimMotoru.kartKonumu({
      isik,
      kart: { genislik: kartKutusu.width, yukseklik: kartKutusu.height },
      pencere: { genislik: window.innerWidth, yukseklik: window.innerHeight },
      tercih: adim.tercih
    })

    turOgeleri.kart.style.left = `${konum.x}px`
    turOgeleri.kart.style.top = `${konum.y}px`
  })
}

function turuBaslat () {
  turAdimlari = tanitimMotoru.gecerliAdimlar(
    tanitimMotoru.ADIMLAR, (secici) => document.querySelector(secici) !== null
  )
  if (!turAdimlari.length) return

  turSirasi = 0
  turAcik = true
  turOncekiSekme = document.querySelector('.hv-adim.active')?.id ?? null
  turOgeleri.katman.classList.remove('d-none')
  turAdiminiGoster()
  turOgeleri.ileri.focus()
}

function turuBitir () {
  if (!turAcik) return

  turAcik = false
  turOgeleri.katman.classList.add('d-none')

  const oncekiSekme = turOncekiSekme && document.getElementById(turOncekiSekme)
  if (oncekiSekme && !oncekiSekme.classList.contains('active')) oncekiSekme.click()
  turOncekiSekme = null

  // Tur bir kez gosterilir; kullanici Yardim menusunden tekrar acabilir.
  if (!kullaniciAyarlari.tanitimGoruldu) {
    kullaniciAyarlari.tanitimGoruldu = true
    ayarlariKaydet({ hemen: true })
  }
}

function turAdimiDegistir (yon) {
  const yeni = turSirasi + yon
  if (yeni < 0) return
  if (yeni >= turAdimlari.length) return turuBitir()

  turSirasi = yeni
  turAdiminiGoster()
}

turOgeleri.ileri.addEventListener('click', () => turAdimiDegistir(1))
turOgeleri.geri.addEventListener('click', () => turAdimiDegistir(-1))
turOgeleri.atla.addEventListener('click', () => turuBitir())

// Katmanin bosluguna tiklamak turu kapatir.
turOgeleri.katman.addEventListener('pointerdown', (olay) => {
  if (olay.target === turOgeleri.katman) turuBitir()
})

window.addEventListener('keydown', (olay) => {
  if (!turAcik) return

  if (olay.key === 'Escape') {
    olay.preventDefault()
    turuBitir()
  } else if (olay.key === 'ArrowRight' || olay.key === 'Enter') {
    olay.preventDefault()
    turAdimiDegistir(1)
  } else if (olay.key === 'ArrowLeft') {
    olay.preventDefault()
    turAdimiDegistir(-1)
  }
})

// Pencere boyutu degisince isik ve kart hedefin uzerinde kalmali.
window.addEventListener('resize', () => {
  if (turAcik) turAdiminiGoster()
})

// --- Once / sonra ------------------------------------------------------------

// Dugme basili tutuldugu surece ozgun fotograf gosterilir.
function oncesiniGoster (goster) {
  if (oncesiGosteriliyor === goster) return
  oncesiGosteriliyor = goster
  gosterimiTazele()
}

el.onceSonra.addEventListener('pointerdown', () => oncesiniGoster(true))
for (const olay of ['pointerup', 'pointerleave', 'pointercancel']) {
  el.onceSonra.addEventListener(olay, () => oncesiniGoster(false))
}

// --- Dizme denetimleri -------------------------------------------------------

for (const secim of [el.gorunumFoto, el.gorunumSayfa]) {
  secim.addEventListener('change', () => gorunumuUygula())
}

el.kagitOnayari.addEventListener('change', () => {
  if (el.kagitOnayari.value !== 'ozel') kagitOnayariniUygula(el.kagitOnayari.value)
  silDugmeleriniGuncelle()
  ayarlariKaydet()
})

for (const giris of [el.kagitGenislik, el.kagitYukseklik]) {
  giris.addEventListener('input', () => {
    el.kagitOnayari.value = 'ozel'
    adediEnFazlayaAyarla()
    silDugmeleriniGuncelle()
    ayarlariKaydet()
  })
}

el.kagitCevir.addEventListener('click', () => {
  const genislik = el.kagitGenislik.value
  el.kagitGenislik.value = el.kagitYukseklik.value
  el.kagitYukseklik.value = genislik
  el.kagitOnayari.value = 'ozel'
  adediEnFazlayaAyarla()
  silDugmeleriniGuncelle()
  ayarlariKaydet()
})

for (const giris of [el.dizmeKenar, el.dizmeAralik]) {
  giris.addEventListener('input', () => {
    adediEnFazlayaAyarla()
    ayarlariKaydet()
  })
}

el.dizmeAdet.addEventListener('input', () => {
  if (el.gorunumSayfa.checked) sayfayiCiz()
})

el.kesimKilavuzu.addEventListener('change', () => {
  if (el.gorunumSayfa.checked) sayfayiCiz()
  ayarlariKaydet()
})

// Sayfa tuvalinde tekerlekle yakinlasma ve surukleyerek kaydirma. Fotograf
// tuvalindeki Tuval sinifi kaynak goruntu uzerine kurulu oldugu icin sayfa
// kendi basit denetimini kullanir.
el.sayfaTuvali.addEventListener('wheel', (olay) => {
  olay.preventDefault()
  sayfayiYakinlastir(Math.exp(-olay.deltaY * 0.0015), sayfaImlecKonumu(olay))
}, { passive: false })

let sayfaSuruklemesi = null

el.sayfaTuvali.addEventListener('pointerdown', (olay) => {
  sayfaSuruklemesi = sayfaImlecKonumu(olay)
  el.sayfaTuvali.classList.add('tasiniyor')
  try {
    el.sayfaTuvali.setPointerCapture(olay.pointerId)
  } catch {
    /* yakalama zorunlu degil */
  }
})

el.sayfaTuvali.addEventListener('pointermove', (olay) => {
  if (!sayfaSuruklemesi) return

  const nokta = sayfaImlecKonumu(olay)
  sayfaKaymasi = {
    x: sayfaKaymasi.x + nokta.x - sayfaSuruklemesi.x,
    y: sayfaKaymasi.y + nokta.y - sayfaSuruklemesi.y
  }
  sayfaSuruklemesi = nokta
  sayfayiCiz()
})

const sayfaSuruklemesiniBitir = (olay) => {
  if (!sayfaSuruklemesi) return
  sayfaSuruklemesi = null
  el.sayfaTuvali.classList.remove('tasiniyor')
  if (el.sayfaTuvali.hasPointerCapture(olay.pointerId)) {
    el.sayfaTuvali.releasePointerCapture(olay.pointerId)
  }
}

el.sayfaTuvali.addEventListener('pointerup', sayfaSuruklemesiniBitir)
el.sayfaTuvali.addEventListener('pointercancel', sayfaSuruklemesiniBitir)

// Pencere yeniden boyutlandiginda sayfa onizlemesi de yeniden cizilir.
new ResizeObserver(() => {
  if (el.gorunumSayfa.checked) sayfayiCiz()
}).observe(el.sayfaTuvali)

// --- Indirme denetimleri -----------------------------------------------------

for (const secim of [el.turJpg, el.turPng]) {
  secim.addEventListener('change', () => {
    // Kalite ayari yalnizca JPEG icin anlamli.
    el.kaliteAlani.classList.toggle('d-none', el.turPng.checked)
    ayarlariKaydet()
  })
}

el.jpgKalitesi.addEventListener('input', () => {
  el.jpgKalitesiDegeri.textContent = `%${el.jpgKalitesi.value}`
  ayarlariKaydet()
})

el.indir.addEventListener('click', () => fotografiIndir())

// --- Geri al / yinele --------------------------------------------------------

el.geriAl.addEventListener('click', () => durumuUygula(gecmis.geriAl()))
el.yinele.addEventListener('click', () => durumuUygula(gecmis.yinele()))

// --- Baski denetimleri -------------------------------------------------------

el.yaziciSecimi.addEventListener('change', () => ayarlariKaydet())
el.kopyaSayisi.addEventListener('input', () => ayarlariKaydet())
el.yaziciPenceresi.addEventListener('change', () => ayarlariKaydet())

el.sayfayiBas.addEventListener('click', () => sayfayiBas())
el.sayfayiPdf.addEventListener('click', () => sayfayiPdfKaydet())
el.sayfayiKaydet.addEventListener('click', () => sayfayiGoruntuKaydet())

// --- Menu komutlari ----------------------------------------------------------

// Kisayollar Electron menusunde tanimli; tarayici tarafinda ikinci bir
// keydown dinleyicisi yok, boylece tek tusa iki islem baglanmiyor.
window.hiperVesika.menuKomutu((komut) => {
  switch (komut) {
    case 'ac':
      el.dosyaGirisi.click()
      break
    case 'kaydet':
      // Kaydetme ekranda ne varsa onu kaydeder.
      if (el.gorunumSayfa.checked) sayfayiGoruntuKaydet()
      else fotografiIndir()
      break
    case 'pdf':
      sayfayiPdfKaydet()
      break
    case 'yazdir':
      sayfayiBas()
      break
    case 'geri-al':
      durumuUygula(gecmis.geriAl())
      break
    case 'yinele':
      durumuUygula(gecmis.yinele())
      break
    case 'tanitim':
      turuBaslat()
      break
  }
})

// --- Baslangic ---------------------------------------------------------------

onayarlariDoldur()
dpiSecenekleriniDoldur()
kagitOnayarlariniDoldur()
onayariUygula(olcuMotoru.FOTOGRAF_ONAYARLARI[0].kod)
kagitOnayariniUygula(window.HV.sayfa.KAGIT_ONAYARLARI[0].kod)
firca.yaricap = Number.parseInt(el.fircaBoyu.value, 10) / 2
lekeFircasi.yaricap = Number.parseInt(el.lekeBoyu.value, 10) / 2
rotusuYaz(rotusAyarlari)
aracSec()
araclariEtkinlestir(false)
gecmisDugmeleriniGuncelle()
kisayollariYaz()

// Yazicilar once doldurulur: kayitli yazici ancak listedeyse secilebilir.
yazicilariDoldur().then(ayarlariYukle)

el.surumBilgisi.textContent =
  `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`
