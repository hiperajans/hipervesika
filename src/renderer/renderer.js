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
  aracFircaSil: document.getElementById('arac-firca-sil'),
  aracFircaGetir: document.getElementById('arac-firca-getir'),
  fircaBoyu: document.getElementById('firca-boyu'),
  fircaBoyuDegeri: document.getElementById('firca-boyu-degeri')
}

const tuval = new window.HV.Tuval(el.tuval, {
  degisimde: (t) => {
    el.yakinlikOrani.textContent = t.gorsel ? `%${Math.round(t.olcek * 100)}` : ''
  }
})

const kirpma = new window.HV.KirpmaAraci(tuval, {
  degisimde: () => ciktiBilgisiniGuncelle()
})

const firca = new window.HV.Firca(tuval, {
  maskeyiAl: () => hamMaske,
  gorseliAl: () => yuklenenGorsel,
  degisimde: () => gosterimiTazele()
})

let yuklenenGorsel = null
let olcuDurumu = { genislikMm: 50, yukseklikMm: 60 }
let dpi = 300

// Segmentasyondan gelen ham maske ve kullanicinin firca duzeltmeleri burada
// birikir; kenar ayarlari her tazelemede bunun uzerine uygulanir.
let hamMaske = null

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
    el.otomatikHizala, el.donmeAcisi, el.donmeyiSifirla, el.arkaplanBeyazlat
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

    kirpma.cerceveAta(hizalamaMotoru.otomatikCerceve({
      cene,
      tepe: hizalamaMotoru.tepeNoktasi(cene, alin),
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

// Kenar ayarlarini uygulayip ekranda gosterilecek beyaz zeminli onizlemeyi
// yeniden uretir. Tam cozunurluklu birlestirme disa aktarmada yapilir.
function gosterimiTazele () {
  if (!yuklenenGorsel) return

  if (!hamMaske || !el.arkaplanBeyazlat.checked) {
    yuklenenGorsel.gosterim = null
    tuval.ciz()
    return
  }

  const maske = window.HV.arkaplan.maskeyiAyarla(hamMaske, {
    genislet: Number.parseFloat(el.maskeGenislet.value) / 100,
    yumusat: Number.parseFloat(el.maskeYumusat.value)
  })

  const kaynak = yuklenenGorsel.onizleme
  yuklenenGorsel.gosterim = window.HV.arkaplan.beyazZemineBirlestir(
    kaynak, maske, kaynak.width, kaynak.height
  )
  tuval.ciz()
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
    arkaplanDurumu(
      `Arka plan beyazlatıldı (kadrajın %${Math.round(kapsam * 100)}'i kişi). ` +
      'Kenarları fırçayla düzeltebilirsiniz.'
    )
  } catch (hata) {
    hamMaske = null
    el.arkaplanBeyazlat.checked = false
    arkaplanDurumu(`Arka plan ayrılamadı: ${hata.message}`, 'hata')
  } finally {
    el.arkaplanBeyazlat.disabled = false
  }
}

function aracSec () {
  const fircaModu = el.aracFircaSil.checked || el.aracFircaGetir.checked

  if (fircaModu) {
    firca.sil = el.aracFircaSil.checked
    tuval.etkilesim = firca
    tuval.ustKatman = (ctx, olcek) => {
      kirpma.ciz(ctx, olcek)
      firca.ciz(ctx, olcek)
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

function onayarlariDoldur () {
  for (const onayar of olcuMotoru.FOTOGRAF_ONAYARLARI) {
    const secenek = document.createElement('option')
    secenek.value = onayar.kod
    secenek.textContent = `${onayar.ad} — ${onayar.genislikMm}×${onayar.yukseklikMm} mm`
    el.onayarSecimi.append(secenek)
  }

  const ozel = document.createElement('option')
  ozel.value = 'ozel'
  ozel.textContent = 'Özel ölçü'
  el.onayarSecimi.append(ozel)
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
}

function onayariUygula (kod) {
  const onayar = olcuMotoru.FOTOGRAF_ONAYARLARI.find((o) => o.kod === kod)
  if (!onayar) return

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
    aracSec()
    arkaplanDurumu('Kişiyi arka plandan ayırır ve zemini beyaza çevirir.')
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

el.yakinlas.addEventListener('click', () => tuval.yakinlastir(1.25))
el.uzaklas.addEventListener('click', () => tuval.yakinlastir(0.8))
el.sigdir.addEventListener('click', () => tuval.sigdir())

// --- Olcu denetimleri --------------------------------------------------------

el.onayarSecimi.addEventListener('change', () => {
  if (el.onayarSecimi.value !== 'ozel') onayariUygula(el.onayarSecimi.value)
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
})

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
    arkaplanDurumu('Kişiyi arka plandan ayırır ve zemini beyaza çevirir.')
    return
  }

  // Maske zaten cikarilmissa yeniden hesaplanmaz.
  if (hamMaske) {
    el.arkaplanAyarlari.classList.remove('d-none')
    gosterimiTazele()
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

for (const secim of [el.aracKirpma, el.aracFircaSil, el.aracFircaGetir]) {
  secim.addEventListener('change', () => aracSec())
}

el.fircaBoyu.addEventListener('input', () => {
  firca.yaricap = Number.parseInt(el.fircaBoyu.value, 10) / 2
  el.fircaBoyuDegeri.textContent = `${el.fircaBoyu.value} px`
})

// --- Baslangic ---------------------------------------------------------------

onayarlariDoldur()
dpiSecenekleriniDoldur()
onayariUygula(olcuMotoru.FOTOGRAF_ONAYARLARI[0].kod)
firca.yaricap = Number.parseInt(el.fircaBoyu.value, 10) / 2
aracSec()
araclariEtkinlestir(false)

el.surumBilgisi.textContent =
  `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`
