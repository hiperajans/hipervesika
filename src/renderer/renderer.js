'use strict'

// Arayuz kodu. Node API'lerine erisim yok; ana surece ihtiyac duyulan her sey
// preload'daki window.hiperVesika koprusunden gelir.

const { versions } = window.hiperVesika

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
  surumBilgisi: document.getElementById('surum-bilgisi')
}

const tuval = new window.HV.Tuval(el.tuval, {
  degisimde: (t) => {
    el.yakinlikOrani.textContent = t.gorsel ? `%${Math.round(t.olcek * 100)}` : ''
  }
})

let yuklenenGorsel = null

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
  for (const dugme of [el.yakinlas, el.uzaklas, el.sigdir]) dugme.disabled = !etkin
}

async function gorselYukle (dosya) {
  if (!dosya) return

  uyariGizle()
  el.durum.textContent = 'Fotograf yukleniyor...'

  try {
    const gorsel = await window.HV.gorsel.dosyadanYukle(dosya)
    yuklenenGorsel = gorsel
    tuval.gorselAta(gorsel)

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

araclariEtkinlestir(false)

el.surumBilgisi.textContent =
  `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`
