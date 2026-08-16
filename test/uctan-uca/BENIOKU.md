# Uçtan uca testler

Gerçek uygulamayı Electron ile açıp arayüzü sürerler. Playwright'ın `_electron`
sürücüsü kullanılır; ayrı bir tarayıcı indirilmez.

```bash
npm run test:uctan-uca
```

## Fotoğraf kaynağı

**Gerçek vesikalık fotoğraflar depoya girmez** (bkz. [`AGENTS.md`](../../AGENTS.md),
kural 5). Testler bu yüzden kendi görüntüsünü üretir: `gorsel-uret.js` elle yazılmış
bir PNG kodlayıcıyla 1200 × 1800 boyutunda kaba bir portre çizer — açık zemin,
ortada oval bir "kafa", altında gövde ve ayrıntı ölçümleri anlamlı olsun diye
hafif bir doku.

Bu görüntü bir yüz değildir. Yüz/omuz bulma ve arka plan ayırma modelleri onun
üzerinde çalışamaz, dolayısıyla o testler **atlanır**. Çalıştırmak için kendi
fotoğraflarınızın bulunduğu bir klasörü gösterin:

```bash
HV_FOTOGRAFLAR=~/vesikalik-ornekleri npm run test:uctan-uca
```

Atlanan testler çıktıda `﹣` ile ve sebebiyle birlikte görünür.

## Dosyalar

| Dosya | İş |
| --- | --- |
| `ortam.js` | Ortak koşum takımı: uygulamayı açar, turu kapatır, geçici profil ve çıktı klasörü verir |
| `gorsel-uret.js` | Sentetik test fotoğrafı (bağımlılıksız PNG kodlayıcı) |
| `olcum.js` | Üretilen PNG/PDF dosyalarından fiziksel ölçü okuma |
| `secim.test.js` | Birden fazla fotoğraf bırakıldığında açılan seçim penceresi |
| `panel.test.js` | Adımlar arası geçiş, panelin başa sarması, tanıtım turu |
| `ayarlar.test.js` | Kullanıcı ön ayarları, son kullanılan değerler, bozuk ayar dosyası |
| `baski.test.js` | Menü kısayolları, PDF ölçü doğruluğu, sayfa kaydetme, geri al/yinele |
| `acilis.test.js` | Açılış penceresi: uygulama hazırlık bitene kadar görünmüyor |
| `ghostscript.test.js` | Doğrudan baskı anahtarı, yazıcı/çözünürlük seçimi, geçersiz istek |
| `olcu.test.js` | Hazır vesikalık ölçüleri ve kadraj profilinin arayüze bağlanması |
| `yakinlik.test.js` | Arayüz ölçeği kısayolları, Görünüm menüsü, ölçeğin baskıya sızmaması |
| `cikti.test.js` | JPG/PNG dışa aktarma, DPI bilgisi, renk düzeni, CMYK PDF |
| `cevrimdisi.test.js` | Ağ kapalıyken tam iş akışı ve "hiç uzak istek yok" denetimi |
| `rotus.test.js` | Rötuşun beyazlatılmış zemine işlememesi (gerçek fotoğraf ister) |

## Kurallar

- Her test kendi `--user-data-dir` klasöründe çalışır; kullanıcının gerçek
  ayarlarına dokunulmaz.
- **Açılış penceresi varsayılan olarak kapalıdır** (`HV_ACILIS=0`): her dosyada
  modellerin yüklenmesini beklemek süiti dakikalarca uzatırdı. `acilis.test.js`
  onu `ortam.uygulamayiAc(calisma, { acilis: true })` ile açıkça ister.
- Kaydetme pencereleri `dialog.showSaveDialog` değiştirilerek yönlendirilir,
  dosyalar geçici klasöre yazılır.
- **Gerçek yazıcıya iş gönderilmez.** Yazıcı tanımlı bir makinede baskı testi
  kendini atlar; ölçü doğruluğu PDF ve piksel üzerinden ölçülür. Ghostscript
  testi de yalnızca arayüzü ve reddedilen istekleri sınar; komut satırının
  kendisi birim testinde (`test/ghostscript.test.js`) doğrulanır.
- Testler öğeleri `id` ile bulur (bkz. [`docs/ARAYUZ.md`](../../docs/ARAYUZ.md)
  → "Kimlikler mantığa aittir").
