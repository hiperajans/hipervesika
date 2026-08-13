# Hiper Vesika — Geliştirme Fazları

Bu belge ürünün yol haritasıdır. Fazlar sıralıdır: her faz kendinden öncekinin üzerine kurulur
ve tek başına çalışır durumda bitirilir. Bir faz "bitti" sayılmak için çıktı maddelerinin
tamamı sağlanmalı ve değişiklikler commit edilmiş olmalıdır (bkz. `AGENTS.md`, kural 1).

## Ürün özeti

Herkesin kullanabileceği bir vesikalık hazırlama uygulaması. Akış:

```
fotoğraf sürükle-bırak → arka plan beyazlatma → yüz/omuz hizalama → rötuş
    → ölçü gir → kırp → tek fotoğraf indir (JPG/PNG)
                      ↘ baskı kağıdına dizdir → CMD/CTRL+P ile bas
                                              ↘ CMD/CTRL+S ile kaydet
```

## Teknik temel kararlar

Bu kararlar tüm fazları bağlar:

- **Ölçü birimi milimetredir, piksel değil.** Fotoğraf ve kağıt ölçüleri mm olarak tutulur;
  piksele yalnızca render ve dışa aktarma anında, hedef DPI ile çevrilir
  (`px = mm / 25.4 * dpi`). Varsayılan çıktı çözünürlüğü **300 DPI**. Bu kural baştan
  uygulanmazsa kırpma, dizme ve baskı ölçüleri birbirini tutmaz.
- **Görüntü işleme renderer sürecinde, canvas üzerinde yapılır.** Human (TensorFlow.js)
  WebGL hızlandırması istediği için renderer'da çalışır. Ana süreç yalnızca pencere, menü,
  dosya diyalogları, kaydetme ve baskıyla ilgilenir.
- **Human modelleri depoda yerel tutulur.** Human varsayılan olarak modelleri CDN'den çeker;
  bu, offline çalışma kuralıyla çelişir. Modeller `assets/models/` altına indirilir ve
  `modelBasePath` yerel klasöre ayarlanır.
- **Arayüz `app://` protokolü ile sunulur, `file://` ile değil.** Human'ın model
  dosyaları `fetch()` ile yükleniyor ve `fetch`, `file://` adreslerinde çalışmıyor. Ana
  süreçte ayrıcalıklı bir `app` şeması tanımlanır ve istekler `src/renderer` klasörüyle
  sınırlanır (yol aşımı denetimiyle). Bu aynı zamanda sayfaya düzgün bir origin kazandırır,
  böylece CSP beklendiği gibi uygulanır.
- **Kaynak görüntü hiç bozulmadan saklanır.** Tüm düzenlemeler (hizalama, rötuş, kırpma)
  parametre olarak tutulur ve dışa aktarmada orijinal çözünürlüklü görüntüye tek seferde
  uygulanır. Ekranda gösterilen, hız için küçültülmüş bir önizlemedir. Aksi halde her işlem
  kaliteyi biraz daha düşürür.

---

## Faz 0 — Uygulama iskeleti

**Amaç:** Açılan, güvenli ve kurallara uygun bir Electron kabuğu.

- `electron` ve `bootstrap` npm bağımlılığı olarak kurulur (CDN yok).
- Ana süreç `src/main/index.js`, arayüz `src/renderer/`, köprü `src/preload/`.
- Pencere güvenliği: `contextIsolation: true`, `nodeIntegration: false`; renderer'a yalnızca
  `preload` üzerinden, adı belli IPC kanalları açılır.
- Bootstrap yerel dosyadan yüklenir, `<html data-bs-theme="light">`, responsive iskelet.
- `npm start` üç platformda da uygulamayı açar.

**Çıktı:** Boş ama açılan, tema ve pencere davranışı doğru bir uygulama.

## Faz 1 — Fotoğraf alma ve görüntüleme

**Amaç:** Kullanıcı fotoğrafı uygulamaya sokabilsin.

- Ana ekrana sürükle-bırak; ayrıca "Dosya seç" düğmesi ve panodan yapıştırma.
- Kabul edilen formatlar: JPG, PNG, HEIC (HEIC için dönüştürme gerekir, desteklenmiyorsa
  kullanıcıya net mesaj verilir).
- **EXIF `Orientation` okunur ve piksel verisine uygulanır.** Telefon fotoğraflarının çoğu
  döndürme bilgisini EXIF'te taşır; bu adım atlanırsa fotoğraf yan görünür.
- Görüntü canvas'ta gösterilir; yakınlaştırma ve kaydırma çalışır.
- Çok büyük fotoğraflarda (24MP+) arayüz donmaz: ölçekli önizleme kullanılır.

**Çıktı:** Fotoğraf sürüklenip bırakılınca doğru yönde ve akıcı şekilde ekranda görünür.

## Faz 2 — Ölçü motoru ve kırpma

**Amaç:** Ürünün matematiksel çekirdeği. Sonraki her faz buna dayanır.

- mm ↔ piksel dönüşümü, DPI yönetimi, en-boy oranı hesapları tek bir modülde toplanır.
- Fotoğraf boyutu ön ayarları: **50×60 mm** (Türkiye biyometrik), **35×45 mm** (ICAO /
  Schengen), **51×51 mm** (2×2 inç, ABD). Kullanıcı kendi ölçüsünü mm olarak girebilir.
- Seçilen ölçünün oranına kilitli kırpma çerçevesi; kullanıcı çerçeveyi taşıyıp
  ölçeklendirebilir, oran bozulmaz.
- Kırpma alanı fotoğraf sınırlarının dışına taşamaz; çıkacak gerçek çözünürlük kullanıcıya
  gösterilir ve baskı için düşükse uyarılır.
- Bu modül saf hesap içerir ve arayüzden bağımsız test edilebilir.

**Çıktı:** Ölçü seçilip fotoğraf istenen orana doğru şekilde kırpılabiliyor.

## Faz 3 — Human ile yüz ve omuz hizalama

**Amaç:** Kullanıcıyı elle uğraştırmadan biyometrik yerleşimi kurmak.

- Human kurulur, modeller yerelden yüklenir; `face` (yüz ve göz konumu), `body` (omuz
  keypoint'leri) ve sonraki fazda kullanılacak `segmentation` modülleri etkinleştirilir.
- **Eğiklik düzeltme:** iki göz arasındaki açı ile fotoğraf döndürülür.
- **Omuz hizası:** gövde pozundan sol/sağ omuz noktaları alınır, omuz çizgisi yataya
  getirilir. Göz açısıyla omuz açısı çeliştiğinde göz hattı esas alınır (biyometrik
  standartların ölçütü odur), omuz farkı kullanıcıya bilgi olarak gösterilir.
- **Otomatik yerleşim:** yüz yüksekliği kadrajın %70–80'i, göz hattı alttan %50–60 aralığına
  gelecek şekilde kırpma çerçevesi konumlandırılır.
- **Kafanın tepesi Faz 4'ün kişi maskesinden okunur.** Yüz noktalarından (çene→alın vektörünü
  uzatarak) kestirilen tepe saç hacmini hesaba katmıyor; gerçek fotoğraflarda 84–214 piksel
  aşağıda kaldığı ölçüldü ve kadraj kafanın üstünü kesti. Maske alınamazsa kestirime düşülür.
- Yüz bulunamazsa veya birden fazla yüz varsa kullanıcı bilgilendirilir ve elle hizalamaya
  düşülür. Otomatik hizalama her zaman kullanıcı tarafından değiştirilebilir olmalıdır.

**Çıktı:** Fotoğraf yüklendikten sonra tek tuşla düzgün hizalanmış biyometrik kadraj.

## Faz 4 — Arka plan beyazlatma

**Amaç:** Vesikalığın beyaz zemin şartını sağlamak.

- Human'ın segmentasyon modeli ile kişi maskesi çıkarılır, maske dışı beyaza boyanır.
- **Model notu:** segmentasyon modelleri `@vladmandic/human` paketiyle gelmiyor;
  `@vladmandic/human-models` (devDependency, 173 MB) içinden vendor betiğiyle kopyalanıyor.
  `selfie` ve `meet` modelleri denendi ve test görüntülerinde **boş maske** ürettiler;
  bu yüzden alpha matte veren `rvm` (4,3 MB) kullanılıyor.
- Maske kenarı yumuşatılır (feather) ki kesik kenar oluşmasın.
- **Saç kenarları bu işin en zor kısmıdır.** Segmentasyon maskesi saç telleri arasında kaba
  kalır; kenar yumuşatma yetmezse kenar temizleme fırçası veya alpha matting adımı gerekir.
- Kullanıcı sonucu düzeltebilmeli: maskeyi büyütme/küçültme ve arka plana elle boyama.
- Zemin rengi varsayılan beyaz; açık gri gibi alternatifler ileride eklenebilir.

**Çıktı:** Karışık arka planlı bir fotoğraf, kabul edilebilir kenar kalitesiyle beyaz zeminli
hale geliyor.

## Faz 5 — Rötuş

**Amaç:** Fotoğrafı baskıya hazır hale getirecek düzeltmeler.

- Temel ayarlar: parlaklık, kontrast, pozlama, doygunluk, renk sıcaklığı, keskinlik.
- Nokta rötuşu: leke/sivilce temizleme fırçası.
- Tüm ayarlar geri alınabilir olmalı: geri al / yinele (CMD/CTRL+Z, CMD/CTRL+SHIFT+Z) ve
  "orijinale dön".
- Önce/sonra karşılaştırma.
- Ayarlar parametre olarak saklanır, dışa aktarımda tam çözünürlüğe uygulanır.

**Çıktı:** Kullanıcı fotoğrafı bozmadan, geri dönülebilir şekilde rötuşlayabiliyor.

## Faz 6 — Tek fotoğraf dışa aktarma

**Amaç:** Ürünün ilk uçtan uca çalışan hali.

- JPG veya PNG olarak kaydetme; JPG için kalite ayarı.
- Çıktı tam olarak istenen fiziksel ölçüde ve seçilen DPI'da üretilir; JPG/PNG başlığına DPI
  bilgisi yazılır (baskı alan yazılımlar bunu okur).
- Kaydetme yeri `dialog.showSaveDialog` ile sorulur, varsayılan klasör
  `app.getPath('pictures')` (sabit yol yazılmaz).
- Anlamlı varsayılan dosya adı.

**Çıktı:** Fotoğraf sürükle → hizala → rötuşla → kırp → indir akışı baştan sona çalışıyor.

## Faz 7 — Baskı kağıdına dizme

**Amaç:** Aynı vesikalığı bir kağıda çoğaltarak yerleştirmek.

- Kağıt ön ayarları: **10×15 cm**, **13×18 cm**, **15×21 cm**, **A4**. Kullanıcı kendi kağıt
  ölçüsünü mm olarak girebilir; yatay/dikey seçilebilir.
- Yerleşim hesabı kağıt ve fotoğraf ölçüsünden **otomatik** çıkar: kaç adet sığdığı, kenar
  boşlukları ve aradaki boşluklar hesaplanır (10×15'e 50×60 mm'den 4 adet, 15×21'e 6 adet
  gibi). Kullanıcı adet ve boşlukları değiştirebilir; sığmayan durumda uyarılır.
- Sayfanın gerçek oranını gösteren canlı önizleme.
- Kesim kılavuzu çizgileri açılıp kapatılabilir.

**Çıktı:** Vesikalık, seçilen kağıda doğru sayıda ve doğru fiziksel ölçüde diziliyor.

## Faz 8 — Baskı ve dizilmiş sayfayı kaydetme

**Amaç:** Çıktının kağıda birebir doğru ölçüde inmesi.

- **CMD/CTRL+P** ile baskı, **CMD/CTRL+S** ile kaydetme. Kısayollar Electron menüsünde
  `CmdOrCtrl+P` / `CmdOrCtrl+S` accelerator'ı ile tanımlanır; platform ayrımı elle yazılmaz.
- Dizilmiş sayfa JPG veya PNG olarak kaydedilebilir.
- **Ölçü doğruluğu bu fazın asıl işidir.** Yazıcı sürücüleri sayfayı kendiliğinden
  ölçekleyebilir ve 50×60 mm fotoğraf kağıda 48×58 mm olarak inebilir. Baskı, ölçüsü
  sabitlenmiş bir çıktı üzerinden yapılmalı (`printToPDF` ile tam ölçülü sayfa veya
  `webContents.print` ile `@page size` tanımlı, ölçeklemesi kapatılmış içerik) ve **üç
  platformda da cetvelle ölçülerek doğrulanmalıdır.**
- Yazıcı seçimi ve kopya sayısı; yazıcı bulunamadığında anlaşılır hata.

**Çıktı:** Basılan kağıttan kesilen fotoğraf, istenen ölçüde çıkıyor.

### Uygulanan çözüm ve ölçüm sonuçları

Sayfa, arayüzde seçilen DPI'da kağıdın tam piksel karşılığında üretilir ve ana süreçte
gizli bir pencerede `@page { size: <G>mm <Y>mm; margin: 0 }` tanımlı bir sayfaya
yerleştirilir. Baskı ile PDF aynı sayfadan çıkar, böylece iki ayrı ölçü yolu oluşmaz.
Sayfa görüntüsü diske değil, `app://hv/gecici/...` altında belleğe konur ve iş bitince
silinir.

Baskı varsayılan olarak `silent: true` ve `scaleFactor: 100` ile yapılır: yazıcı penceresi
açılmazsa kimse "kağıda sığdır" seçeneğini açık bırakamaz. Kullanıcı isterse pencereyi
açtırabilir.

Ölçü doğruluğu, üretilen PDF'in içindeki çizim dönüşümü okunarak ölçüldü
(`baski.pdfMediaBox` ve içerik akışındaki `cm` matrisi):

| Kağıt | Çizilen ölçü | 50 mm vesikalığın karşılığı |
| --- | --- | --- |
| 100×150 mm | 100,012 × 150,019 mm | 50,006 mm |
| 210×297 mm | 210,079 × 297,127 mm | 50,019 mm |
| 130×180 mm | 129,910 × 179,917 mm | 49,966 mm |

Yani vesikalık kenarındaki sapma **0,04 mm'nin altında**. Chromium'un PDF sayfa kutusunu
(MediaBox) 1/300 inç'e yuvarlaması ayrı bir konudur ve en çok 0,22 mm oynar; bu sapma
fotoğrafın ölçüsüne değil yalnızca kağıt sınırına yansır.

**Kalan doğrulama:** Yukarıdaki ölçüler dosya üzerinden alınmıştır. Yazıcı sürücüsünün
kendi ölçeklemesi ancak gerçek baskıda görülür; Windows, macOS ve Linux'ta birer sayfa
basılıp **cetvelle ölçülmesi** gerekir. Geliştirme makinesinde tanımlı yazıcı olmadığı için
bu adım yapılamadı.

## Faz 9 — Ön ayarlar ve kullanıcı ayarları

**Amaç:** Tekrar eden işi ortadan kaldırmak.

- Hazır ön ayarların yanına kullanıcı kendi fotoğraf ve kağıt ölçülerini kaydedebilir,
  adlandırabilir, silebilir.
- Ayarlar `app.getPath('userData')` altında JSON olarak saklanır — depoya girmez.
- Son kullanılan ayarlar hatırlanır; varsayılan DPI ve çıktı formatı tercih edilebilir.

**Çıktı:** Sık kullanılan ölçüler tek tıkla seçilebiliyor.

## Faz 10 — Paketleme ve dağıtım

**Amaç:** Uygulamanın kurulabilir hale gelmesi.

- `electron-builder` ile Windows, macOS ve Linux paketleri.
- Uygulama ikonları, sürüm bilgisi, lisans.
- Model dosyalarının ve Bootstrap'in pakete dahil edildiği doğrulanır; internet kapalıyken
  temiz bir makinede sınanır.

**Çıktı:** Üç platformda kurulup çalışan uygulama.

---

## Riskler

| Risk | Faz | Etki |
| --- | --- | --- |
| Baskıda fiziksel ölçünün yazıcı sürücüsünce kaydırılması | 8 | Ürünün temel vaadi bozulur |
| Segmentasyonun saç kenarlarında kaba kalması | 4 | Görünür kalite kaybı |
| Human model dosyalarının paket boyutunu büyütmesi | 3, 10 | İndirme boyutu, ilk açılış süresi |
| Büyük fotoğraflarda canvas işlemlerinin yavaşlaması | 1, 5 | Arayüz donması |

## Açık sorular

Bunlar ilgili faza gelindiğinde netleşmeli:

1. HEIC desteklenecek mi? (iPhone fotoğraflarının varsayılan formatı, ek dönüştürme gerekir)
2. Rötuş ne kadar ileri gitsin — temel ayarlar ve leke temizleme yeterli mi, yoksa cilt
   yumuşatma gibi güzelleştirme de olacak mı?
3. Arayüz yalnızca Türkçe mi olacak, çok dil desteği planlanıyor mu?
4. Farklı ülkelerin biyometrik kuralları (yüz oranı, göz hattı) ön ayar olarak gelecek mi?
