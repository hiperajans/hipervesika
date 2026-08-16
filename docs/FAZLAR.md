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

Baskı `scaleFactor: 100` ile yapılır. **Baskı her zaman sistemin yazdırma panelinden geçer**
(`silent: false`); uygulama sessiz baskı yapmaz — aşağıya bakınız.

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

### Uygulanan çözüm

Ayarlar `app.getPath('userData')/ayarlar.json` dosyasında tutulur. Dosya elle
düzenlenebildiği ve bozulabildiği için okunan her değer `src/main/ayarlar.js` içinde
doğrulanır: ölçü sınırları, ad uzunluğu, tekrar eden kod ve en fazla 50 ön ayar. Anlaşılmayan
alan sessizce atılır, bozuk dosya uygulamayı açılmaktan alıkoymaz — varsayılanla açılır.

Yazma önce geçici dosyaya yapılıp `rename` ile yerine konur; yazarken uygulama kapanırsa eski
ayarlar bozulmadan kalır.

Kaydırgaç ve sayı girişleri her tuşta diske yazmasın diye 400 ms geciktirilir; **ön ayar
kaydetme ve silme beklemeden yazılır**, çünkü kullanıcı hemen ardından pencereyi kapatabilir.
Bekleyen bir yazma varken pencere kapanırsa `beforeunload` son değerleri yine de gönderir.

Ön ayarın kodu adından bağımsızdır (`kullanici-1`), böylece ad değişse de seçim bozulmaz.
Aynı adla kaydetmek eskisinin üzerine yazar, listeye ikinci bir satır eklemez.

## Faz 10 — Paketleme ve dağıtım

**Amaç:** Uygulamanın kurulabilir hale gelmesi.

- ~~`electron-builder` ile Windows, macOS ve Linux paketleri~~ — hazır. Platform başına tek
  biçim, yapılandırma [`electron-builder.yml`](../electron-builder.yml):

  | Platform | Biçim | Komut |
  | --- | --- | --- |
  | macOS Intel + Apple Silicon | `dmg` (ikisi ayrı) | `npm run paket:mac` |
  | Windows | NSIS kurulum programı | `npm run paket:win` |
  | Linux | `AppImage` | `npm run paket:linux` |

  Üçü de GitHub Actions'ta elle tetiklenen **Yayın paketleri** iş akışıyla derlenip ön
  yayın (pre-release) olarak yüklenir: [`.github/workflows/yayin.yml`](../.github/workflows/yayin.yml).
  Her push'ta çalışmaz.

  Pakete `src/**` ve `build/icons/**` giriyor, `node_modules` girmiyor: arayüz Bootstrap'i
  ve Human'ı npm paketlerinden değil, `scripts/vendor.js`'in `src/renderer/vendor/` altına
  kopyaladığı dosyalardan okuyor; ana süreçte hiçbir bağımlılık `require` edilmiyor.
  `vendor/` gitignore'da olduğu için `paket:*` komutları önce `npm run vendor` çalıştırır.

  **İmzalama.** Kod imzalama sertifikası yok. macOS paketi `afterPack` kancasında
  ad-hoc imzalanır ([`scripts/paket/imza.js`](../scripts/paket/imza.js)); bu şart, çünkü
  Apple Silicon çekirdeği imzasız bir arm64 ikilisini çalıştırmayı tümden reddeder — Intel'de
  çalışan imzasız paket arm64'te hiç açılmaz. Ad-hoc imza Gatekeeper'ı geçmez: kullanıcı ilk
  açılışta sağ tık → Aç demek zorunda. Windows'ta SmartScreen uyarısı çıkar. Kalan iş,
  Developer ID + noter onayı ve Windows imzalama sertifikası.

  Paket doğrulandı: asar içinde `node_modules` yok, Human model dosyaları (`rvm.bin` dahil)
  `app://` üzerinden asar içinden okunuyor, otomatik hizalama sonuna kadar çalışıyor, dmg
  bağlanıp içinden çalıştırıldığında konsol hatası vermiyor, her iki mimaride de imza
  `codesign --verify --deep --strict` denetiminden geçiyor.
- ~~Uygulama ikonları~~ — hazır: `npm run simge` üç platformun simgesini tek vektör
  kaynaktan üretir (`build/icons/`), ayrıntı [`ARAYUZ.md`](./ARAYUZ.md) → "Uygulama
  simgesi". Paketlemede `mac.icon` → `icon.icns`, `win.icon` → `icon.ico`, `linux.icon`
  → `build/icons/` gösterilir. Sürüm bilgisi ve lisans kaldı.
- Model dosyalarının ve Bootstrap'in pakete dahil edildiği doğrulanır; internet kapalıyken
  temiz bir makinede sınanır.

**Çıktı:** Üç platformda kurulup çalışan uygulama.

---

## Faz sonrası eklenenler

### Cilt yumuşatma ve göz canlandırma

`rotus.js` içine iki işlem daha girdi. **Cilt yumuşatma** yüzey bulanıklığıdır: bulanık bir
kopyayla karıştırılır ama yalnızca ayrıntının az olduğu yerlerde (parlaklık farkı
`YUMUSATMA_ESIGI`'nin altındaysa). Böylece ten dokusu yumuşar, göz-kaş-saç-kenar keskin
kalır. Bulanıklık yarıçapı kaynak görüntünün yüksekliğine oranlıdır, dolayısıyla 2 MP ile
24 MP fotoğrafta aynı güçte görünür ve önizleme ile çıktı ayrışmaz.

**Göz canlandırma** iki gözün çevresini yumuşak geçişle açar. Göz konumu ancak otomatik
hizalama çalıştığında bilindiği için kaydırgaç o zamana kadar kapalıdır. Yarıçap gözler
arası mesafeye oranlıdır. Koyu tonlar açık tonlardan daha çok açılır; göz akı yanmaz.

Sıra önemli: yumuşatma keskinleştirmeden **önce** gelir, aksi hâlde keskinleştirilen dokuyu
hemen geri bulanıklaştırırdık.

### Renk sıcaklığı yalnızca kişiye

Sıcaklık tüm kareye uygulandığında beyazlatılmış zemin de renkleniyordu: soğuk tarafta beyaz
maviye/camgöbeğine kaçıyordu (ölçüldü: `−50`'de `#ffffff` → `rgb(191, 255, 255)`). Bu yüzden
sıcaklık varsayılan olarak **yalnızca kişiye** uygulanır ve `Rötuş → Renk ve ton` altındaki
anahtarla kapatılabilir.

Kullanılan maske arka plan beyazlatmanın maskesidir — kenar ayarları (genişlet/yumuşat) ve
fırça düzeltmeleri dâhil aynı maske, dolayısıyla kenarlar iki işlemde ayrışmaz. Maske
beyazlatma kapalıyken de kullanılır; henüz çıkarılmamışsa (`Otomatik hizala` ya da
`Arka planı beyazlat` çalışmadıysa) sıcaklık fotoğrafın tamamına uygulanır ve kaydıracın
altındaki ipucu bunu söyler.

Uygulama sırası: sıcak/soğuk kopya üretilir, maskeye göre kırpılır ve asıl görüntünün üzerine
konur. Maske devredeyken sıcaklık ile keskinlik **iki ayrı SVG geçişinde** yapılır (keskinlik
her zaman tüm kareye uygulanır); maske yoksa ikisi eskisi gibi tek geçişte birleşir. Çıktıda
maske, rötuş adımlarıyla aynı çerçevede olması için önce döndürme + kırpma dönüşümünden
geçirilir.

### Rötuş sırası: önce rötuş, sonra beyazlatma

Yukarıdaki maskeli sıcaklık, zemini **tam olarak** korumaya yetmedi. Rötuş beyazlatmadan
_sonra_ uygulandığı sürece, beyaza boyanmış zeminin kendisi de rötuşun girdisi oluyordu:

| Ayar | Zeminin eski hâli (591×709 çıktıda 180 256 zemin pikseli) |
| --- | --- |
| Parlaklık `−50` | **Tümü** `rgb(127, 127, 127)` — zemin griye düşüyor |
| Kontrast `−50` | **Tümü** `rgb(191, 191, 191)` |
| Cilt yumuşatma `100` | 4 075 piksel bulanık kenardan kirleniyor |
| Sıcaklık `−50` | Maskenin yumuşak kenar bandında 1 449 piksel maviye kaçıyor (en kötü `rgb(194, 209, 215)`) |

Sıcaklık maskesi yalnızca ilk üçünü hiç görmüyordu; sonuncuyu ise kısmen kaçırıyordu, çünkü
kenar bandında maske alfası 0 ile 1 arasındadır ve o bantta zemin beyazı ile kişi zaten
karışmıştır — o karışımı sıcaklıkla boyamak beyazı da boyamak demektir.

Doğru çözüm sırayı değiştirmek: **önce rötuş, sonra beyazlatma.** Zemin en sonda düz beyaza
çevrildiği için hiçbir rötuş adımı ona ulaşamaz. Kenar bandı da doğru çıkar; sonuç
`a·rötuş(kişi) + (1−a)·beyaz` olur, yani kişinin kendi kenarı rötuşlanır, beyaz olduğu gibi
kalır. Beyazlatma açıkken sıcaklık maskesine artık gerek yoktur (`rotus.rotusMaskesi`);
kapalıyken kural değişmez ve sıcaklık yine kişiyle sınırlanır.

Ölçüldü (iki fotoğraf, 300 DPI çıktı): parlaklık, kontrast, doygunluk, sıcaklık, keskinlik ve
cilt yumuşatmanın uçlarında zemin pikselleri **istisnasız `rgb(255, 255, 255)`** kalıyor.
Sıcaklık `−50`'de beyazdan sapan açık mavi piksel sayısı 1 449 → 10'a düştü ve kalan 10'un
tamamı kişinin kendi silueti üzerinde, zeminde değil. Kişi hâlâ etkileniyor: yüz ortalaması
R 174,8 → 139,4 · B 77,5 → 88,4.

Önizleme ile çıktı aynı sırayı izler; ikisi ayrışırsa ekranda gördüğü ile kaydettiği farklı
olurdu.

### Renk düzeni (sRGB / gri tonlama / CMYK)

**Sınır:** `canvas.toBlob` yalnızca RGB üretir, CMYK JPEG yazamaz. Bu yüzden:

| Çıktı | sRGB | Gri tonlama | CMYK |
| --- | --- | --- | --- |
| JPG / PNG | ✓ | ✓ | sRGB kalır |
| PDF | ✓ | ✓ | ✓ gerçek `DeviceCMYK` |
| Doğrudan baskı | ✓ | ✓ | sRGB kalır (sürücü kendi ayrımını yapar) |

CMYK PDF için `printToPDF` kullanılamaz (o da RGB üretir); `src/main/pdf.js` sayfayı
kendisi yazar: katalog, tek sayfa, `FlateDecode` ile sıkıştırılmış `DeviceCMYK` görüntü ve
görüntüyü kağıda oturtan içerik akışı. 100×150 mm @ 300 DPI sayfa yaklaşık 2,6 MB.

Çevrim **ICC profili kullanmaz**, aygıt çevrimidir (`K = 255 - max(R,G,B)`). Matbaa kendi
profiliyle ayırmak isterse sRGB vermek daha doğrudur; arayüzde bu yazıyor ve varsayılan
sRGB'dir. Çevrimin tersi alındığında özgün RGB'ye 1 birim içinde dönüldüğü test edilir.

### Birden fazla fotoğraf bırakıldığında seçim

Fotoğrafçı çekimden çıkan 4-5 kareyi bir kerede sürükleyip bırakır. Eskiden bunların
**ilki sessizce alınır**, gerisi hiç haber verilmeden atılırdı — kullanıcı yanlış kareyle
çalıştığını ancak sonradan fark ederdi.

Artık birden fazla fotoğraf gelirse küçük resimlerini gösteren bir pencere açılır ve
hangisiyle çalışılacağı sorulur. **Uygulama tek fotoğrafla çalışmaya devam eder:** seçilen
dosya normal yükleme yoluna girer, diğerleri hiçbir yerde tutulmaz. Yığın işleme yoktur.

- Tek fotoğrafta pencere açılmaz; akış eskisi gibidir.
- Sürükle-bırak, `Fotoğraf Seç` (artık `multiple`) ve panodan yapıştırma aynı yolu kullanır
  (`dosyalariAl`). Yapıştırma sessizdir: her metin yapıştırmasında uyarı çıkmaz.
- Küçük resimler **sırayla** üretilir; hepsini birden çözmek 24 MP'lik beş fotoğrafta
  belleği gereksiz şişirirdi. Her bitmap çizildikten sonra `close()` ile bırakılır.
- Okunamayan ya da desteklenmeyen dosya (bozuk JPG, HEIC) kutusu **kapalı** gelir ve sebebi
  kutunun altında yazar. Eskiden hata ancak seçimden sonra görünürdü.
- Vazgeçilirse açık fotoğraf değişmez.
- Ok tuşlarıyla gezinilir (`secim.sonrakiSira`), Enter seçer, Esc vazgeçer.

**Kutu ölçüsü.** Kullanıcı hangi karenin iyi çıktığına bakarak seçtiği için küçük resim
büyük olmalı. Çerçeveye sabit yükseklik verilmez; yükseklik kutu genişliğinden türer
(`aspect-ratio: 3 / 4`) ve üstten `58vh` ile sınırlanır. Sabit değer, sütun sayısı
değiştiğinde ya fotoğrafı gereksiz küçültüyor ya da kutuda boş alan bırakıyordu — çünkü
dikey fotoğrafta bağlayıcı ölçü yüksekliktir, genişliği artırmak yalnızca boşluk ekler.

Ölçüldü (1440×747 CSS görünüm, dpr 2, ekrandaki gerçek piksel):

| Fotoğraf | Sütun | Çerçeve | Fotoğraf | Yatay taşma |
| --- | --- | --- | --- | --- |
| 2 | 2 | 531×433 | 289×433 | yok, dikey kaydırma da yok |
| 5 | 3 | 344×433 | 289×433 | yok |
| 8 | 4 | 251×334 | 223×334 | yok |

`58vh` sınırı ölçerek seçildi: tek satırlık yerleşim (2-3 fotoğraf) kaydırma çubuğu
çıkarmadan sığan en büyük değer. Kaynak küçük resim 1440 piksel uzun kenarda üretilir;
çerçeve yüksek çözünürlüklü ekranda ~1400 aygıt pikseline çıktığı için daha küçüğü
bulanık kalırdı.

Saf hesaplar `src/renderer/js/secim.js` içinde ve test edilir: seçim gerekli mi, sütun
sayısı, dosya adı kısaltma (uzantı korunur), küçük resim ölçüsü (büyütme yapılmaz),
klavye gezinmesi.

### Test altyapısı ve CI

Depoda yalnızca saf modüllerin birim testleri vardı; arayüz, IPC, baskı ve model yolları
hiçbir yerde kayıtlı değildi. `test/uctan-uca/` altında Playwright'ın `_electron`
sürücüsüyle gerçek uygulamayı açan **63 test** eklendi.

**Kişisel veri sorunu ve çözümü.** Gerçek vesikalık fotoğraflar depoya giremez (kural 5),
ama uçtan uca testler bir fotoğrafa muhtaç. `gorsel-uret.js` bağımlılıksız bir PNG
kodlayıcıyla 1200 × 1800'lük kaba bir portre üretiyor; testlerin çoğu onunla çalışıyor.
Yüz/omuz bulma ve arka plan ayırma **gerçek bir yüz** istediği için o 12 test
`HV_FOTOGRAFLAR` ayarlı değilse sebebiyle birlikte atlanıyor:

| Koşum | Sonuç |
| --- | --- |
| `npm run test:uctan-uca` | 51 geçti, 12 atlandı (~90 sn) |
| `HV_FOTOGRAFLAR=… npm run test:uctan-uca` | 63 geçti |

`npm test` artık testleri çalıştırıyor; eskiden `electron .` idi, yani uygulamayı açıyordu
ve bir CI makinesinde takılıp kalırdı.

**Biçim denetimi.** `eslint` + `neostandard`. Kaynak kod hiç değişiklik gerektirmeden temiz
geçti — 30 uyarının tamamı yeni test dosyalarındaydı. `promise/param-names` kapatıldı:
sözlerde Türkçe ad kullanılıyor (`cozumle`/`reddet`).

**CI.** `.github/workflows/testler.yml`; depo public olduğu için Actions ücretsiz. Biçim ve
birim testleri ubuntu'da, uçtan uca testler **ubuntu + macOS + Windows** üçlüsünde koşuyor.
Kural 4 kodun çapraz platform olmasını istiyordu ama bu hiç sınanmamıştı; ilk koşuda üç
platform da geçti (uçtan uca adımı sırasıyla 80, 99 ve 81 saniye).

### Baskı sorumluluğu sürücüye bırakıldı

Önce sessiz baskı denendi: yazıcı, kopya ve kalite uygulamada seçiliyor, `silent: true` ile
doğrudan gönderiliyordu. Gerekçe "kimse *kağıda sığdır* seçeneğini açık bırakamasın" idi.

Bu yaklaşım tersine çevrildi. Sebep, kalitenin uygulamanın erişemediği yerde belirlenmesi:
ölçüldü (Canon iX6800, macOS/CUPS) sürücü varsayılanı `CNIJMediaType=0` (**Plain Paper**)
ve `CNIJPrintQuality=10` (**Normal**) idi — fotoğraf kağıdına düz kağıt kipinde basmak,
uygulama ne yaparsa yapsın soluk ve yumuşak bir sonuç verir. Kağıt türü ve sürücü kalite
kipinin Electron'un baskı arayüzünde karşılığı yoktur. Uygulama bu ayarları seçemeyip
sonucun sahibi gibi görünürse, çıkan her kötü baskı uygulamanın sorunu sayılır.

Artık **`Sayfayı yazdır…` doğrudan sistemin yazdırma panelini açar** (`silent: false`).
Yazıcı, kopya, kağıt ve kalite orada seçilir; uygulama bunları kendi tarafında tutmaz.
Kaldırılan denetimler: yazıcı seçimi, kopya sayısı, baskı kalitesi, renkli anahtarı ve
`Yazıcı penceresi` anahtarı. Eski `ayarlar.json` dosyalarındaki `yazici`, `kopya`,
`yaziciPenceresi`, `baskiDpi` alanları sessizce yok sayılır.

**Uygulamada kalan tek baskı ayarı rasterleştirme çözünürlüğü.** Bu Chromium tarafıdır,
yazdırma panelinde karşılığı yoktur ve verilmezse aygıtın varsayılanına düşüp gözle görülür
biçimde yumuşak bir baskı verir. `baski.baskiCozunurlugu` ile 600 DPI sabit geçilir; aralık
dışı değer varsayılana düşer, kırpılmaz (0 gelseydi 72 DPI'ya inip sessizce berbat bir
baskı çıkardı).

**Ölçü doğruluğu artık kullanıcıya bağlı:** panelde ölçekleme `%100 / gerçek boyut`
kalmalıdır. Sabitlenmiş ölçü isteyen Noritsu, Fujifilm gibi laboratuvar makineleri için
doğru yol zaten sürücüden basmak değil, PDF ya da görüntü dosyasını vermektir.

### Basit / Gelişmiş mod ve sihirbaz

Arayüz elliye yakın denetime ulaşınca iki ayrı sorun ayrıştı: **akış** ("bu adımı bitirdim,
şimdi ne yapacağım?") ve **yoğunluk** ("bu kaydıraç ne demek?"). Sihirbaz gezinmesi
birincisini çözer, ikincisine dokunmaz — kullanıcıyı karmaşık ekranın etrafından değil
içinden geçirir. Bu yüzden ikisi tek anahtar altında birleştirildi: **basit mod** hem
sihirbaz şeridini açar hem uzman denetimlerini gizler.

Ölçülen ve karara giren noktalar:

- **Sihirbaz tıklama sayısını artırmaz.** Kullanıcı zaten `2` ve `3` sekmelerine tıklıyordu;
  İleri/Geri de iki tıklama. Kazanç hedefin büyük, sabit yerde ve varış yerini yazıyor
  olması. Bu yüzden sık kullananı yavaşlatmıyor.
- **Başa karşılama ekranı konmadı.** Fotoğraf bırakılınca kullanıcı zaten 1. adımda ve
  araçlar açılıyor; oraya bir "İleri" koymak iş yapmayan fazladan tıklama olurdu.
- **Adım şeridi kilitlenmedi.** Vesikalık işi doğrusal değildir; arka plan beyazlayınca
  saç kenarı için kadraja, sayfa görünümünde adet tutmayınca ölçüye dönmek gerekir.
- **Rötuş adımı çoğu fotoğrafta atlanır.** Zorunlu istasyon gibi görünmesin diye basit modda
  yalnızca dört denetim bırakıldı (arka plan, parlaklık, kontrast, cilt yumuşatma);
  kullanıcı hiçbir şey yapmadan geçebilmeli.
- **Otomatik başlangıç yapılmayacak.** Fotoğraf yüklenince hizalamanın ve beyazlatmanın
  kendiliğinden çalışması değerlendirildi ve kalıcı olarak reddedildi: kullanıcı ne olduğunu
  görmeden sonuç üretilmesini istemiyor. Basit mod da bu kuralı bozmaz.

Modun tek anahtarı gövdedeki `data-hv-mod`; gizlemeyi CSS yapar. Ayrıntı ve sınıf sözleşmesi
[`ARAYUZ.md`](./ARAYUZ.md) → "Basit ve Gelişmiş mod".

Bu iş sırasında ayarlarda gerçek bir hata çıktı: eşzamanlı iki yazma aynı geçici dosyayı
kullanıyor, yeniden adlandırılan dosyada bozuk JSON kalıyor ve okuma varsayılana düşerek
kullanıcının bütün ön ayarlarını siliyordu. Yazmalar artık sıraya alınıyor
(`src/main/ayarlar.js`).

### Modellerin açılışta yüklenmesi ve segmentasyon durumu

"Otomatik hizala" ilk tıklamada saniyelerce bekletiyordu; beklemenin tamamı işin kendisi
değil, hazırlıktı. Modeller (blazeface, facemesh, movenet, rvm — toplam ~11 MB) artık arayüz
yerine oturur oturmaz, boşta (`requestIdleCallback`) arka planda yükleniyor
(`modelleriOnyukle`, `src/renderer/renderer.js`).

- **Segmentasyon modeli de açılışta okunuyor.** `yuz.js` yapılandırmasında `segmentation`
  açık; bu yalnızca `load()` sırasında ağırlıkların diskten okunmasını sağlar, `detect()`
  bu modeli hiç çalıştırmaz — algılamaya ağırlık binmez.
- **Isıtma Human'ın `warmup()`'ı ile yapılamadı.** Human örnek görüntüyü `data:` adresinden
  `fetch` ediyor, uygulamanın güvenlik ilkesi (`connect-src 'self'`) bunu engelliyor ve
  geriye çözülmeyen bir söz kalıyordu. Yerine boş bir tuval işletiliyor.
- **Ölçüm (Intel mac, sentetik 900×1200):** maske çıkarma soğukta 5,5 sn; açılışta ısıtılınca
  3,9 sn; aynı ölçüde ikinci istek 0,7 sn. Kalan pay girdi ölçüsüne özel shader derlemesi —
  her yeni fotoğraf ölçüsünde bir kez ödeniyor, ısıtmayla kapatılamıyor (fotoğrafların
  ölçüsü önceden bilinemez).

Isıtma denemesi **mevcut sürümde duran gerçek bir hatayı** ortaya çıkardı: `rvm` bir video
modeli, her çalıştırmada yinelemeli bir durum üretip bir sonrakine taşıyor ve bu durum
girdinin ölçüsüne bağlı. Bir fotoğrafın arka planı beyazlatıldıktan sonra **farklı ölçüde**
ikinci bir fotoğrafta maske çıkmıyordu:

```
broadcastTo(): [1,38,29,64] cannot be broadcast to [1,32,32,64]
```

Human durumu yalnızca segmentasyon oranı değiştiğinde sıfırdan kuruyor, dışarıdan
sıfırlamanın başka yolu yok. Bu yüzden `arkaplan.js` her istekte oranı `0,000001` kadar
oynatıyor: iki değer de yuvarlandığında aynı iç ölçüyü verir, fark yalnızca durumu
sıfırlamaya yarar. Böylece her maske uygulama yeni açılmış gibi hesaplanır — vesikalıkta
kareler zaten birbirinden bağımsız.

İkinci bulgu: Human örneği tek ve içinde durum tutuyor. Açılıştaki ısıtma kullanıcının ilk
isteğiyle çakışınca maske **ısıtmanın ölçüsünde** (256×256) dönüyordu. Modeli çalıştıran her
iş artık `yuz.sirala` üzerinden sırayla geçiyor.

### Yayın hazırlığı

Mağazalara (Microsoft Store, Mac App Store) ve GitHub'a yayın öncesi yapılanlar:

- **Geliştirici araçları kapatıldı.** `webPreferences.devTools: false` kesin kapatmadır:
  menüden, kısayoldan ya da koddan açılmaz. Menüdeki *Geliştirici araçları* öğesi de
  kalktı. `HV_GELISTIRICI=1` ile geri açılır; kaynaktan çalıştırmada da varsayılan kapalı,
  böylece geliştirirken görülen uygulama kullanıcının gördüğünün aynısı oluyor.
- **Durum çubuğundaki sürüm satırı yerini işletim sisteminin adına bıraktı.**
  Electron/Chromium/Node numaraları kullanıcıya bir şey anlatmıyordu; uygulamanın kendi
  sürümü *Hakkında* penceresinde duruyor. Destek isteyen kullanıcıdan hangi sistemde
  olduğunu sormak yerine ekranda görmek işe yarıyor.
- **Mağaza logoları** `npm run simge` ile üretiliyor: `build/icons/magaza/` altında
  300×300 ve 512×512 (düz yerleşim, Microsoft Store listelemesi) ile macOS yerleşiminde
  1024×1024 (Mac App Store uygulama simgesi). Ayrı klasörde duruyorlar çünkü
  `build/icons/*.png` Linux simge seti olarak taranıyor.

### Arayüz ölçeği kısayolu ve klavye dizeni

*Görünüm* menüsündeki yakınlaştırma öğeleri Electron'un hazır `zoomIn` / `zoomOut`
rolleriyle duruyordu ve kısayolları hiç çalışmıyordu. Sebep klavye dizeni:
`CmdOrCtrl+Plus` hızlandırıcısı fiziksel tuşa göre eşleşiyor, Türkçe Q klavyede ise `+`
`Shift+4` ile yazılıyor. Kullanıcı menüde yazan kısayola basıyor, hiçbir şey olmuyordu.

Çözüm, kısayolu hızlandırıcıdan alıp **üretilen karaktere** bakan bir yola taşımak oldu:

- `src/renderer/js/kisayol.js` tuş olayını komuta çevirir (`+` `=` → büyüt, `-` `_` →
  küçült, `0` → gerçek boyut). Hangi tuşa basıldığı değil, hangi karakterin üretildiği
  önemli; böylece kısayol her dizende ve sayı adasında çalışır. AltGr (Windows'ta
  Ctrl+Alt) elenir, denetim tuşu macOS'ta Cmd, diğerlerinde Ctrl'dür.
- Komut `olcek:degistir` ile ana sürece gider; ölçek `src/main/yakinlik.js` içindeki
  merdivene (%67 – %200) oturur. Menü öğeleri de aynı işlevi çağırır.
- Menüdeki üç öğe kısayolu **gösterir ama sisteme kaydettirmez**
  (`registerAccelerator: false`), böylece tek tuşa iki işlem bağlanmaz. macOS bu seçeneği
  yok sayar; orada tuşu menü yakalarsa olay arayüze hiç ulaşmaz, sonuç yine tek olur.

**Baskı ayrı bir kaynağa taşındı.** Chromium yakınlık değerini kaynak (origin) başına
tutuyor: baskı penceresi de `app://hv` altında açıldığı için arayüzde seçilen ölçek
basılan sayfaya da geçerdi — ve baskı penceresi ölçeği sıfırlasa bu kez arayüzünki
bozulurdu. Baskı penceresi artık `app://baski` kaynağını kullanıyor; ölçüsü arayüzden
bağımsız. Uçtan uca testte arayüz %200'e çıkarılıp PDF üretiliyor ve 100 × 150 mm sayfa
hâlâ 0,2 mm toleransla doğru ölçüde çıkıyor.

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
2. Arayüz yalnızca Türkçe mi olacak, çok dil desteği planlanıyor mu?
3. Farklı ülkelerin biyometrik kuralları (yüz oranı, göz hattı) ön ayar olarak gelecek mi?

Kapananlar: rötuşun ne kadar ileri gideceği ("Cilt yumuşatma ve göz canlandırma" bölümüne
bakınız — cilt yumuşatma, göz canlandırma ve leke temizleme yapıldı).
