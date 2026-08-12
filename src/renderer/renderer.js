'use strict'

// Arayuz kodu. Node API'lerine erisim yok; ana surece ihtiyac duyulan her sey
// preload'daki window.hiperVesika koprusunden gelir.

const { versions } = window.hiperVesika
const olcuMotoru = window.HV.olcu

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
  kirpmayiSifirla: document.getElementById('btn-kirpmayi-sifirla')
}

const tuval = new window.HV.Tuval(el.tuval, {
  degisimde: (t) => {
    el.yakinlikOrani.textContent = t.gorsel ? `%${Math.round(t.olcek * 100)}` : ''
  }
})

const kirpma = new window.HV.KirpmaAraci(tuval, {
  degisimde: () => ciktiBilgisiniGuncelle()
})

let yuklenenGorsel = null
let olcuDurumu = { genislikMm: 50, yukseklikMm: 60 }
let dpi = 300

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
  for (const dugme of [el.yakinlas, el.uzaklas, el.sigdir, el.kirpmayiSifirla]) {
    dugme.disabled = !etkin
  }
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
    kirpma.gorselAta(gorsel.asil)

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

// --- Baslangic ---------------------------------------------------------------

onayarlariDoldur()
dpiSecenekleriniDoldur()
onayariUygula(olcuMotoru.FOTOGRAF_ONAYARLARI[0].kod)
araclariEtkinlestir(false)

el.surumBilgisi.textContent =
  `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`
