# Hiper Vesika

[![Testler](https://github.com/hiperajans/hipervesika/actions/workflows/testler.yml/badge.svg)](https://github.com/hiperajans/hipervesika/actions/workflows/testler.yml)

Vesikalık fotoğraf hazırlama ve baskı kağıdına dizme uygulaması. Bir portre fotoğrafını
biyometrik ölçülere göre hizalar, arka planını beyazlatır, rötuşlar ve istenen fiziksel
ölçüde çıktı üretir — tek fotoğraf olarak ya da bir baskı kağıdına dizilmiş halde.

Masaüstü uygulamasıdır (Electron); Windows, macOS ve Linux üzerinde çalışır. Arayüz ve
alan terimleri Türkçedir. Tüm görüntü işleme cihazda yapılır: uygulama hiçbir ağ bağlantısı
kurmaz, fotoğraflar hiçbir sunucuya gönderilmez.

> **Durum:** Etkin geliştirme aşamasında (sürüm 0.1.0). Fotoğraf alma, hizalama, arka plan
> beyazlatma, rötuş, dışa aktarma, dizme, baskı ve ön ayarlar çalışır durumdadır. Kurulabilir
> paketler (`electron-builder` ile Windows/macOS/Linux dağıtımları) henüz hazır değildir;
> uygulama şimdilik kaynaktan çalıştırılır. Yol haritası:
> [`docs/FAZLAR.md`](./docs/FAZLAR.md).

## Akış

```
fotoğraf sürükle-bırak → otomatik hizalama → arka plan beyazlatma → rötuş
    → ölçü seç → kırp → tek fotoğraf indir (JPG/PNG)
                      ↘ baskı kağıdına dizdir → yazdır ya da PDF/JPG olarak kaydet
```

## Özellikler

**Ölçü ve kadraj**

- Hazır fotoğraf ölçüleri: Türkiye biyometrik (50 × 60 mm), ICAO / Schengen (35 × 45 mm),
  ABD (51 × 51 mm). Kullanıcı kendi ölçüsünü milimetre olarak girebilir ve adlandırıp
  kaydedebilir.
- Seçilen ölçünün oranına kilitli kırpma çerçevesi; çerçeve taşınıp ölçeklendirilebilir,
  oran bozulmaz ve fotoğraf sınırlarının dışına taşmaz.
- Çıkacak gerçek çözünürlük gösterilir, baskı için düşük kaldığında uyarılır.
- Çıktı çözünürlüğü 150, 300 veya 600 DPI (varsayılan 300).

**Otomatik hizalama**

- Yüz ve gövde tanıma ([Human](https://github.com/vladmandic/human)) ile eğiklik düzeltme:
  iki göz arasındaki açı yataya getirilir, omuz farkı bilgi olarak gösterilir.
- Biyometrik yerleşim: yüz yüksekliği ve göz hattı standartların beklediği aralığa
  oturacak şekilde kadraj kurulur. Kafanın tepesi, yüz noktalarından kestirilmek yerine
  kişi maskesinden okunur; böylece saç hacmi kadrajın dışında kalmaz.
- Otomatik sonuç her zaman elle değiştirilebilir; yüz bulunamadığında kullanıcı
  bilgilendirilir.

**Arka plan**

- Segmentasyon ile kişi maskesi çıkarılır ve zemin beyaza çevrilir.
- Maske kenarı genişletilip yumuşatılabilir; kalan hatalar *Sil* ve *Geri getir*
  fırçalarıyla elle düzeltilir.

**Rötuş**

- Parlaklık, kontrast, doygunluk, renk sıcaklığı ve keskinlik.
- Renk sıcaklığı varsayılan olarak yalnızca kişiye uygulanır, böylece beyazlatılmış zemin
  nötr kalır.
- Cilt yumuşatma: yalnızca ayrıntının az olduğu alanlarda çalışır, göz-kaş-saç keskin kalır.
  Etkisi çözünürlükten bağımsızdır; önizleme ile çıktı ayrışmaz.
- Göz canlandırma ve leke temizleme fırçası.
- Tüm adımlar geri alınabilir (geri al / yinele) ve *Önce / Sonra* ile karşılaştırılabilir.

**Çıktı**

- Tek fotoğraf: JPG (kalite ayarlı) veya PNG. Dosya başlığına DPI bilgisi yazılır, böylece
  baskı alan yazılımlar fiziksel ölçüyü doğru okur.
- Renk düzeni: sRGB, gri tonlama veya CMYK (CMYK yalnızca PDF çıktısında gerçek
  `DeviceCMYK` olarak yazılır; çevrim ICC profili kullanmaz).
- Kaynak fotoğraf hiç bozulmadan saklanır: hizalama, rötuş ve kırpma parametre olarak
  tutulur ve dışa aktarmada tam çözünürlüklü görüntüye tek seferde uygulanır.

**Dizme ve baskı**

- Hazır kağıt ölçüleri: 10 × 15, 13 × 18, 15 × 21 cm ve A4; kendi ölçünüzü de girip
  kaydedebilirsiniz. Yatay/dikey seçilebilir.
- Kaç adet sığdığı, kenar boşlukları ve aradaki boşluklar kağıt ile fotoğraf ölçüsünden
  otomatik hesaplanır; adet ve boşluklar elle değiştirilebilir, sığmayan durumda uyarılır.
- Gerçek oranlı canlı sayfa önizlemesi ve açılıp kapatılabilen kesim kılavuzu.
- Doğrudan baskı (yazıcı ve kopya sayısı seçilebilir), PDF olarak kaydetme ya da sayfayı
  JPG/PNG olarak kaydetme.
- **Ölçü doğruluğu:** sayfa, kağıdın tam piksel karşılığında üretilir ve ölçüsü sabitlenmiş
  bir sayfaya yerleştirilir; yazıcı ölçeklemesi kapatılır. Üretilen PDF üzerinden ölçüldüğünde
  50 mm'lik bir vesikalığın kenarındaki sapma 0,04 mm'nin altındadır (ayrıntı ve kalan
  doğrulama adımları: [`docs/FAZLAR.md`](./docs/FAZLAR.md), Faz 8).

**Kullanım kolaylıkları**

- İlk açılışta rehberli tanıtım turu (`F1` ile her zaman tekrar açılabilir).
- Kendi fotoğraf ve kağıt ön ayarlarınız; son kullanılan değerler hatırlanır. Ayarlar
  işletim sisteminin kullanıcı verisi klasöründe JSON olarak tutulur.
- Sürükle-bırak, dosya seçme ve panodan yapıştırma ile fotoğraf alma; JPG, PNG ve WebP
  desteklenir. Telefon fotoğraflarının EXIF yön bilgisi uygulanır. HEIC şu an
  desteklenmiyor; kullanıcıya net bir uyarı verilir.

## Kurulum ve çalıştırma

Node.js (güncel LTS) ve npm gerekir. Depoyu klonlayıp bağımlılıkları kurun:

```
npm install
npm start
```

`npm install`, `postinstall` adımıyla Bootstrap, bootstrap-icons ve Human model dosyalarını
`src/renderer/vendor/` altına kopyalar. Uygulama harici bir CDN'e bağlanmadığı için bu adım
zorunludur; dosyalar sonradan tazelenmek istenirse `npm run vendor` yeterlidir.

| Komut | İş |
| --- | --- |
| `npm start` | Uygulamayı çalıştırır |
| `npm test` | Birim + uçtan uca testlerin tamamı |
| `npm run test:birim` | Yalnızca birim testleri (`node --test`, saniyeler) |
| `npm run test:uctan-uca` | Gerçek uygulamayı açan testler (~1,5 dk) |
| `npm run lint` | Kod biçimi denetimi (`npm run lint:duzelt` düzeltir) |
| `npm run vendor` | `vendor/` dosyalarını yeniler |

## Klavye kısayolları

| Kısayol | İş |
| --- | --- |
| `Ctrl/Cmd + O` | Fotoğraf aç |
| `Ctrl/Cmd + S` | Kaydet |
| `Ctrl/Cmd + Shift + S` | Dizilmiş sayfayı kaydet |
| `Ctrl/Cmd + P` | Sayfayı yazdır |
| `Ctrl/Cmd + Z` | Geri al |
| `Ctrl/Cmd + Shift + Z` | Yinele |
| `F1` | Tanıtım turu |

## Gizlilik

Vesikalık fotoğraflar kişisel veridir; uygulama buna göre tasarlanmıştır.

- Yüz tanıma ve segmentasyon modelleri uygulamanın içinde yereldir; hiçbir görüntü dışarıya
  gönderilmez.
- Arayüz `default-src 'self'` içerik güvenlik politikasıyla sunulur ve `connect-src 'self'`
  ile sınırlıdır: uygulamanın dışarıya bağlantı kurma yolu yoktur. İnternet bağlantısı
  olmadan tam işlevle çalışır.
- Fotoğraflar ve çıktılar yalnızca sizin seçtiğiniz konuma yazılır; uygulama ayarları
  işletim sisteminin kullanıcı verisi klasöründe kalır ve depoya girmez.

## Proje yapısı

```
src/main/          Ana süreç: pencere, app:// protokolü, kaydetme, baskı, PDF, ayarlar, menü
src/preload/       contextBridge köprüsü (window.hiperVesika) — renderer'ın tek geçidi
src/renderer/      Arayüz; js/ altında DOM'dan bağımsız hesap modülleri
scripts/vendor.js  Bootstrap, bootstrap-icons ve Human modellerini vendor/'a kopyalar
test/              node:test birim testleri
docs/              FAZLAR.md (yol haritası), ARAYUZ.md (tasarım katmanı)
```

Ölçüler milimetre olarak tutulur; piksele yalnızca çizim, dışa aktarma ve baskı anında
hedef DPI ile çevrilir. `src/renderer/js/` altındaki modüller DOM'a ve Electron'a dokunmaz,
böylece hem arayüzde hem testte çalışırlar.

## Katkı

Depoda çalışan herkes ve tüm yapay zeka ajanları için bağlayıcı kurallar
[`AGENTS.md`](./AGENTS.md) dosyasındadır: her değişiklik commit edilir, kod üç platformda
çalışır, kişisel veri depoya girmez, arayüz Bootstrap ile ve aydınlık temada yazılır.
Bir özelliğe başlamadan önce [`docs/FAZLAR.md`](./docs/FAZLAR.md) içindeki ilgili faz,
görünüme dokunmadan önce [`docs/ARAYUZ.md`](./docs/ARAYUZ.md) okunmalıdır.

## Lisans

[Apache-2.0](./LICENSE) — © Hiper Ajans
