# Arayüz Tasarımı

Bu dosya arayüzün tasarım katmanını anlatır. Bağlayıcı kurallar için
[`AGENTS.md`](../AGENTS.md) kural 6 geçerlidir: Bootstrap, responsive, aydınlık tema, CDN yok.

## Yaklaşım

Bootstrap **bileşen ve davranış** katmanı olarak kullanılır (form denetimleri, `btn-check`,
sekmeler, modal, alert, `form-range`, `form-switch`, yardımcı sınıflar). Görünüm ise
`styles.css` içindeki ince bir katmanla verilir: Bootstrap'in CSS değişkenleri ezilir ve
uygulamaya özgü bileşenler tanımlanır. Bootstrap'in kendi dosyaları düzenlenmez.

Simgeler **bootstrap-icons** paketinden gelir; `scripts/vendor.js` yazı tipini
`src/renderer/vendor/bootstrap-icons/` altına kopyalar. CDN kullanılmaz.

## Tasarım değişkenleri

Tümü `:root` altında tanımlıdır ve `--hv-` ile başlar. Doğrudan renk kodu yazılmaz;
değişken kullanılır.

| Grup | Değişkenler |
| --- | --- |
| Yüzey | `--hv-zemin`, `--hv-yuzey`, `--hv-yuzey-ikincil` |
| Kenar | `--hv-kenar`, `--hv-kenar-belirgin` |
| Metin | `--hv-metin`, `--hv-metin-ikincil`, `--hv-metin-soluk` |
| Vurgu | `--hv-vurgu`, `--hv-vurgu-koyu`, `--hv-vurgu-soluk` |
| Durum | `--hv-basari`, `--hv-uyari(-zemin)`, `--hv-tehlike(-zemin)` |
| Biçim | `--hv-golge`, `--hv-golge-panel`, `--hv-yaricap`, `--hv-yaricap-kucuk` |
| Ölçü | `--hv-baslik-yuksekligi`, `--hv-durum-yuksekligi`, `--hv-panel-genisligi` |

**Tek vurgu rengi** vardır; ikinci bir renk yalnızca uyarı ve hata için girer. Arayüz notr
gri tonları üzerine kurulur, böylece fotoğrafın renkleri arayüzle yarışmaz.

## Yerleşim

```
hv-baslik          marka · açık dosya · Fotoğraf Seç
hv-govde-alani     hv-calisma (esner) | hv-panel (clamp 300–400px)
hv-durum-cubugu    durum · sürüm
```

- `hv-calisma`: üstte `hv-arac-cubugu` (görünüm, araç, geçmiş, Önce/Sonra), altta
  `hv-tuval-alani`. Tuvaller `position: absolute; inset: 0` ile kabı kaplar — yüzde
  yükseklik kullanılmaz, çünkü `d-none` kalkınca tuval kendi ölçüsünü kaba dayatıp her
  çizimde büyüyordu.
- Yakınlık denetimi tuvalin sağ alt köşesinde yüzer; araç çubuğunu şişirmez.
- `hv-panel`: yedi ayar kartı **üç adıma** indirildi — `1 Kadraj`, `2 Rötuş`, `3 Çıktı`.
  Sekmeler Bootstrap'in `data-bs-toggle="tab"` davranışını kullanır.
- 992 px altında panel çalışma alanının altına iner ve sayfa bir bütün olarak kayar.

## Bileşen sınıfları

| Sınıf | İş |
| --- | --- |
| `hv-bolum` + `hv-bolum-basligi` | Panel içindeki bölüm; başlık küçük, büyük harf, simgeli |
| `hv-alan` + `hv-etiket` + `hv-deger` | Tek ayar: etiket solda, değer sağda bir pul içinde |
| `hv-ikili`, `hv-uclu` | İki/üç kolonlu ayar ızgarası |
| `hv-dugme` (+ `-sade`, `-tehlike`) | Düğme; `btn-primary` ile birlikte de kullanılır |
| `hv-secim` | `btn-check` ile segment düğmesi (görünüm, araç, biçim) |
| `hv-simge` (+ `-yazili`) | Simge düğmesi |
| `hv-ipucu` | Açıklama ve durum satırı; renderer `text-danger/success` ekler |
| `hv-ozet` | Ad-değer özet listesi (çıktı boyutu, kaynak çözünürlük) |
| `hv-fotograf-araci` | Sayfa görünümünde gizlenen araçlar |
| `hv-secim-izgarasi` + `hv-secim-kutusu` | Fotoğraf seçim penceresinin ızgarası ve kutuları |

## Tanıtım turu

`src/renderer/js/tanitim.js` uygulamanın gerçek arayüzünü ışıklandırarak yedi adımda
anlatır. İlk açılışta kendiliğinden başlar, sonra **Yardım → Tanıtım turu** (F1) ile
tekrar açılır; görülüp görülmediği `ayarlar.json` içindeki `tanitimGoruldu` alanında durur.

- Adım listesi (`ADIMLAR`) hedefi CSS seçiciyle verir. **Hedefi bulunamayan adım sessizce
  düşürülür** — arayüz değişirse tur kırılmaz, kısalır.
- Adım bir panel sekmesine aitse (`panel: 'kadraj' | 'rotus' | 'cikti'`) tur sekmeyi
  kendisi açar; tur bitince başlangıçtaki sekmeye geri döner.
- Kart yerleştirme hesabı (`kartKonumu`) saftır ve test edilir: tercih edilen yön sığmazsa
  diğer yönler denenir, hiçbiri sığmazsa kart pencerenin içine çekilir.
- Karartma ayrı bir maske öğesiyle değil, ışık kutusunun çevresine verilen dev bir gölgeyle
  (`box-shadow: 0 0 0 9999px`) yapılır.
- Esc turu kapatır, ← → adımlar arasında gezer.
- Adım sekme değiştiriyorsa **`shown.bs.tab` beklenir**, sonra ölçülür: sekme geçişi paneli
  başa sardığı için önce ölçmek ışığı yanlış yere düşürürdü. Ölçümden hemen önce hedef
  `scrollIntoView({ block: 'nearest' })` ile görünür yapılır — bu olmadan panelin altında
  kalan hedeflerde ışık pencerenin dışına düşüyordu (ölçüldü: son adım `y = 1037`,
  pencere yüksekliği 747).

Yeni bir özellik eklendiğinde tura adım eklemek gerekiyorsa `ADIMLAR` dizisine bir kayıt
yazmak yeterlidir; yürütme kodu değişmez.

### Adımlar arası geçiş

Üç adım tek bir kaydırma kabını paylaşır (`#panel-icerik` / `.hv-panel-icerik`); ayrı ayrı
kaydırılan üç kutu değildir. Bu yüzden bir adımın altındayken diğerine geçilince ekran o
yükseklikte kalıyordu. `shown.bs.tab` ile her geçişte `scrollTop` sıfırlanır: yeni adım her
zaman başından başlar.

## Uygulama simgesi

Kaynak tek bir vektör tanımıdır: `scripts/simge/cizim.js`. Her boyut o tanımdan yeniden
rasterlenir; büyük bir görüntüyü küçültmek 16–32 px'te bulanık sonuç verirdi. Üretim
`npm run simge` ile yapılır ve çıktılar depoya işlenir (`build/icons/`, `assets/*.svg`).

**Çizim.** Kehribar (`#f59e0b`) yumuşatılmış köşeli kare; üstünde beyaz zeminli, 5:6
oranında (50 × 60 mm vesikalığın oranı) bir fotoğraf; içinde kişi silueti. Baş fotoğrafın
üstten %10'unda başlar ve yaklaşık yarısını kaplar — biyometrik ölçünün istediği yerleşim.
Fotoğrafın dört köşesinde uygulamanın kesim kılavuzuna karşılık gelen L işaretleri durur.

**Boyuta göre sadeleşme.** 16 px'lik çizim 1024 px'lik çizimin küçültülmüşü değildir:

| Ölçü | Ne değişir |
| --- | --- |
| < 48 px | Omuzlar başa değdirilir; boyun boşluğu yarım pikselin altına düşüp gri bulanıklığa dönüşürdü |
| < 64 px | Gölge çizilmez; fotoğrafın kenarını kirletirdi |
| < 128 px | Kesim işaretleri çizilmez; okunmaz bir tırtığa dönüşürlerdi |
| ≤ 64 px | Kenarlar tam piksele oturtulur; yarım piksele denk gelen kenar antialias ile griye yayılırdı |

**Platform yerleşimleri.** İkisi ayrı dosyadır, çünkü aynı çizim üç platformda aynı
görünmez:

- **macOS** (`icon.icns`): Apple'ın şablonu — 1024 px tuvalde 824 px gövde, altında yumuşak
  gölge. Tuvali dolduran bir `.icns` Dock'ta komşularından büyük durur; şablonun bıraktığı
  boşluk sistemin gölge ve seçim halkası için ayırdığı yerdir.
- **Windows** (`icon.ico`) ve **Linux** (PNG seti): gövde tuvali doldurur, yalnızca kenara
  yapışmasın diye %3 pay kalır. Bu ortamlarda simge sistemin çizdiği bir çerçeve içinde
  durmaz.

**Kap dosyaları.** `.ico` ve `.icns`, birden fazla boyuttaki PNG'yi taşıyan basit
kaplardır ve `scripts/simge/kap.js` içinde elle yazılırlar. Apple'ın `iconutil` aracı
yalnızca macOS'ta bulunur; üretim üç platformda da çalışmak zorunda (bkz. `AGENTS.md`,
kural 4). Rasterleme Electron'un tuvalinde yapılır — depoda görüntü işleyen bir bağımlılık
yok ve eklenmedi — donanım hızlandırma kapatılarak, böylece çıktı makineden makineye
değişmez.

## Kurallar

1. **Kimlikler mantığa aittir.** `renderer.js` öğeleri `id` ile bulur; tasarım değişikliği
   `id` değiştirmez. Sınıf adları serbesttir, kimlikler değildir.
2. Renderer'ın açıp kapattığı sınıflar korunur: `d-none`, `is-invalid`, `alert-warning`,
   `alert-danger`, `text-danger`, `text-success`, `text-body-secondary`, `surukleniyor`,
   `tasiniyor`.
3. Doğrudan renk kodu yazılmaz, `--hv-` değişkeni kullanılır.
4. Sabit piksel genişlik yerine `clamp()` ya da esnek ölçü kullanılır.
5. Karanlık tema yok; `prefers-color-scheme` dinlenmez.
