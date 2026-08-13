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

## Kurallar

1. **Kimlikler mantığa aittir.** `renderer.js` öğeleri `id` ile bulur; tasarım değişikliği
   `id` değiştirmez. Sınıf adları serbesttir, kimlikler değildir.
2. Renderer'ın açıp kapattığı sınıflar korunur: `d-none`, `is-invalid`, `alert-warning`,
   `alert-danger`, `text-danger`, `text-success`, `text-body-secondary`, `surukleniyor`,
   `tasiniyor`.
3. Doğrudan renk kodu yazılmaz, `--hv-` değişkeni kullanılır.
4. Sabit piksel genişlik yerine `clamp()` ya da esnek ölçü kullanılır.
5. Karanlık tema yok; `prefers-color-scheme` dinlenmez.
