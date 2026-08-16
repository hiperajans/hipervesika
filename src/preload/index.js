'use strict'

// Ana surec ile arayuz arasindaki tek koprü. Arayuze Node veya Electron API'si
// dogrudan acilmaz; buraya yalnizca adi belli, dar kapsamli islevler eklenir.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hiperVesika', {
  // Kisayol adlari ve durum cubugundaki isletim sistemi adi bundan uretilir.
  platform: process.platform,

  // Kullaniciya kaydetme penceresi acar ve secilen yola yazar.
  // { kaydedildi: boolean, yol?: string, hata?: string } dondurur.
  gorseliKaydet: (istek) => ipcRenderer.invoke('gorsel:kaydet', istek),

  // Sistemde tanimli yazicilar: { yazicilar: [{ ad, gorunenAd, varsayilan }] }
  yaziciListesi: () => ipcRenderer.invoke('yazici:liste'),

  // Dizilmis sayfayi tam olcusunde basar.
  // { basildi: boolean, iptal?: boolean, hata?: string } dondurur.
  sayfayiBas: (istek) => ipcRenderer.invoke('sayfa:bas', istek),

  // Dizilmis sayfayi tam olculu PDF olarak kaydeder.
  sayfayiPdfKaydet: (istek) => ipcRenderer.invoke('sayfa:pdf', istek),

  // Ghostscript ile dogrudan baski: yazdirma paneli acilmaz, is secilen
  // yaziciya gider. { var, surum, kaynak, aygitlar } dondurur.
  ghostscriptDurumu: () => ipcRenderer.invoke('ghostscript:durum'),
  sayfayiDogrudanBas: (istek) => ipcRenderer.invoke('sayfa:dogrudan-bas', istek),

  // Kullanici ayarlari (kendi on ayarlari ve son kullanilan degerler).
  ayarlariOku: () => ipcRenderer.invoke('ayarlar:oku'),
  ayarlariYaz: (ayarlar) => ipcRenderer.invoke('ayarlar:yaz', ayarlar),

  // --- Acilis penceresi ---
  // Ana pencere: modellerin yuklenme durumunu bildirir, sonunda "bitti" der.
  // Uygulama penceresi bu haberden sonra gorunur.
  acilisAsamasi: (kod, durum) => ipcRenderer.send('acilis:asama', { kod, durum }),
  acilisBitti: () => ipcRenderer.send('acilis:bitti'),

  // Acilis penceresi: gelen durumu dinler.
  acilisDurumu: (geriCagri) => {
    ipcRenderer.on('acilis:durum', (olay, mesaj) => geriCagri(mesaj))
  },

  // Arayuz olcegini bir basamak degistirir ya da gercek boyuta dondurur
  // ('buyut' | 'kucult' | 'sifirla'). Gorunum menusundeki ogelerle ayni is.
  arayuzOlcegi: (komut) => ipcRenderer.send('olcek:degistir', komut),

  // Arayuzun icinde bulundugu mod ('basit' | 'gelismis'). Gorunum menusundeki
  // isareti gunceller; ayara yazmak ayri istir (ayarlariYaz).
  moduBildir: (mod) => ipcRenderer.send('mod:bildir', mod),

  // Menudeki kisayollar buradan arayuze bildirilir.
  menuKomutu: (geriCagri) => {
    ipcRenderer.on('menu', (olay, komut) => geriCagri(komut))
  }
})
