'use strict'

// Acilis penceresinin arayuzu (acilis.html).
//
// Pencere hicbir sey hesaplamaz ve hicbir seyi bekletmez: uygulamanin ne zaman
// acilacagina ana surec karar verir. Buradaki tek is, gelen hazirlik durumunu
// raya ve tek satirlik bir yaziya cevirmek.

const durumYazisi = document.getElementById('durum')
const ilerlemeCubugu = document.getElementById('ilerleme')
const surumYazisi = document.getElementById('surum')

const motor = window.HV.acilis
const durumlar = {}
let hataVar = false

// Surum ana surecten adres uzerinden gelir; acilis penceresi icin ayri bir
// koprü acmaya degmez.
const surum = new URLSearchParams(window.location.search).get('surum')
surumYazisi.textContent = surum ? `Sürüm ${surum}` : ''

durumYazisi.textContent = motor.YAZILAR.normal

// Ilk acilis uzun surer (ekran kartinin onbellegi bos); bir sure sonra bunu
// soylemek, sessizce beklemekten iyi.
const uzunYaziZamanlayicisi = setTimeout(() => {
  if (!hataVar) durumYazisi.textContent = motor.YAZILAR.uzun
}, motor.UZUN_SURE)

function durumuIsle (mesaj) {
  if (!motor.bildirimGecerliMi(mesaj)) return

  durumlar[mesaj.kod] = mesaj.durum
  ilerlemeCubugu.style.width = `${motor.ilerleme(durumlar)}%`

  // Bir hazirlik adimi tamamlanamazsa uygulama yine de acilir; kullaniciyi
  // bekleyen bir sey yok ama ekranda yazan sey de dogru olmali.
  if (mesaj.durum === 'hata') {
    hataVar = true
    clearTimeout(uzunYaziZamanlayicisi)
    ilerlemeCubugu.dataset.hata = 'var'
    durumYazisi.textContent = motor.YAZILAR.hata
  }
}

window.hiperVesika.acilisDurumu(durumuIsle)
