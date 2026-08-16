# AGENTS.md

Bu dosya, bu depoda çalışan **tüm yapay zeka ajanları** için bağlayıcı kuralları içerir
(Claude Code, Codex, Cursor, Copilot, Gemini CLI vb.). Bir işe başlamadan önce bu dosyanın
tamamı okunmalı ve uygulanmalıdır. Diğer ajan dosyaları (`CLAUDE.md`,
`.github/copilot-instructions.md`) bu dosyaya yönlendirir; kuralların tek kaynağı burasıdır.

## Proje

**Hiper Vesika** — vesikalık fotoğraf düzenleme ve dizdirme (baskı yerleşimi) uygulaması.
Arayüz ve alan terimleri Türkçedir.

Ürün kapsamı, geliştirme fazları ve teknik temel kararlar (ölçü birimi, DPI, Human
kullanımı, süreç ayrımı) için: **[`docs/FAZLAR.md`](./docs/FAZLAR.md)**. Bir özellik üzerinde
çalışmadan önce ilgili fazın maddeleri okunmalıdır.

Arayüzün tasarım katmanı (tasarım değişkenleri, bileşen sınıfları, yerleşim) için:
**[`docs/ARAYUZ.md`](./docs/ARAYUZ.md)**. Görünüme dokunmadan önce okunmalıdır.

## Bağlayıcı Kurallar

### 1. Her işlem commit'lenir

Yapılan **her** değişiklik commit edilmeden iş bitmiş sayılmaz. Dosya oluşturma, düzenleme,
silme, yeniden adlandırma, bağımlılık ekleme — istisnasız hepsi.

- Bir görev birden fazla mantıksal adım içeriyorsa, her adım kendi commit'i olur.
- Çalışma ağacı, görev sonunda temiz (`git status` çıktısı boş) bırakılır.
- Commit mesajı ne yapıldığını açıkça anlatır.

### 2. Commit atan ajan kendini tanıtır

Commit atan her yapay zeka, commit mesajının sonuna **kendi adını ve e-posta adresini**
`Co-Authored-By` satırı olarak ekler:

```
Co-Authored-By: <Ajan Adı> <ajan@eposta.adresi>
```

Örnek (Claude Code):

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Başka bir ajanın adı/e-postası kullanılamaz; her ajan yalnızca kendini yazar.

### 3. Teknoloji: ElectronJS + NodeJS

Uygulama ElectronJS ve NodeJS üzerine kurulur. Bu yığının dışına çıkan bir çözüm
(farklı runtime, farklı masaüstü çatısı) önerilmeden ve onaylanmadan eklenmez.

### 4. Kod cross-platform olmak zorunda

Yazılan tüm kod Windows, macOS ve Linux üzerinde çalışmalıdır.

- Yol birleştirmede daima `path.join()` / `path.resolve()` kullanılır; elle `/` veya `\`
  yazılmaz. Yol ayracı gerekiyorsa `path.sep`.
- Kullanıcı dizinleri platforma göre çözülür: `app.getPath('userData' | 'pictures' | 'temp')`,
  `os.homedir()`, `os.tmpdir()`. Sabit yollar (`C:\...`, `/tmp/...`, `~/Documents`) yazılmaz.
- Platforma özel kabuk komutları (`ls`, `dir`, `open`, `xdg-open`, `cp`, `rm`) çağrılmaz;
  yerine Node API'leri (`fs`, `fs/promises`) veya Electron API'leri (`shell.openPath`,
  `shell.showItemInFolder`, `dialog`) kullanılır.
- Dosya adları büyük/küçük harfe duyarlı sayılır (Linux duyarlı, Windows/macOS genelde
  değil); `import`/`require` yolları dosya adıyla birebir aynı yazılır.
- Satır sonu farkları (CRLF/LF) koda sızmamalı; metin karşılaştırmalarında normalize edilir.
- Sadece belirli bir platformda çalışan yerel bağımlılıklar (native modüller, harici ikili
  dosyalar) eklenmeden önce üç platformda da karşılığı olduğu doğrulanır.
- Platform ayrımı gerektiğinde `process.platform` ile açık şekilde dallanılır ve üç platform
  da ele alınır.

### 5. Kişisel bilgi asla depoya girmez

GitHub'a yüklenen hiçbir şey kişisel veri içeremez.

- Gerçek vesikalık/portre fotoğrafları, kimlik belgeleri, tarama çıktıları commit edilmez.
  Test için yalnızca sentetik veya telifsiz örnek görseller kullanılır ve bunlar da
  gözden geçirilmeden eklenmez.
- Gerçek ad, adres, telefon, T.C. kimlik numarası, e-posta gibi veriler; API anahtarları,
  token'lar, lisans anahtarları, `.env` içerikleri koda veya commit mesajına yazılmaz.
- Yerel makineye ait mutlak yollar (kullanıcı adı içerenler dahil) koda, log'a veya
  dokümana yazılmaz.
- Ekran görüntüsü veya hata çıktısı paylaşılacaksa önce kişisel veri temizlenir.
- Kullanıcı fotoğrafları ve uygulama çıktıları `.gitignore` ile hariç tutulur; bu kayıtlar
  kaldırılmaz.

### 6. Arayüz: Bootstrap, responsive, aydınlık tema

GUI tarafı **Bootstrap** ile yazılır. Başka bir CSS çatısı (Tailwind, Bulma, Material vb.)
veya bileşen kütüphanesi eklenmez.

- Bootstrap **npm bağımlılığı olarak** projeye kurulur ve yerel dosyadan yüklenir. CDN
  bağlantısı kullanılmaz: uygulama internet olmadan da tam çalışmak zorundadır ve harici
  script yükleme Electron'un içerik güvenliği açısından kabul edilmez.
- Elle CSS yazmadan önce Bootstrap'in hazır sınıfları (grid, utility, bileşenler) kullanılır.
  Özel CSS yalnızca Bootstrap'in karşılamadığı yerler için, ayrı bir stil dosyasında yazılır;
  Bootstrap'in kendi dosyaları düzenlenmez.
- **Responsive zorunludur.** Yerleşim Bootstrap grid'i ve responsive yardımcı sınıflarıyla
  (`col-*`, `row`, `d-*`, `flex-*`) kurulur; sabit piksel genişlikli, pencere yeniden
  boyutlandırılınca bozulan tasarım yazılmaz. Pencere küçültüldüğünde arayüz kullanılabilir
  kalmalıdır.
- **Tema aydınlıktır.** `<html data-bs-theme="light">` kullanılır. Karanlık tema
  uygulanmaz ve işletim sisteminin karanlık mod tercihi izlenmez; `prefers-color-scheme`
  ile tema değiştiren kod yazılmaz. Renkler aydınlık zemine göre seçilir ve metin/zemin
  kontrastı okunur tutulur.

## Yapı

```
src/main/        Ana süreç: pencere, app:// protokolü, kaydetme, baskı, ayarlar, menü
src/preload/     contextBridge köprüsü (window.hiperVesika) — tek geçit
src/renderer/    Arayüz; js/ altında saf hesap modülleri, vendor/ gitignore'da
scripts/vendor.js  Bootstrap, bootstrap-icons ve Human modellerini vendor/'a kopyalar
scripts/simge/   Uygulama simgesinin vektör kaynağı ve .ico/.icns kapları
scripts/paket/   Paketleme kancaları (macOS ad-hoc imza)
assets/          Simgenin SVG kaynağı (üretilir, depoya işlenir)
build/icons/     Üretilmiş simgeler: icon.icns, icon.ico, Linux PNG seti
test/            node:test birim testleri (saf modüller)
docs/            FAZLAR.md (yol haritası), ARAYUZ.md (tasarım katmanı)
```

Komutlar:

| Komut | İş |
| --- | --- |
| `npm start` | Uygulamayı çalıştırır |
| `npm test` | Birim + uçtan uca testlerin tamamı |
| `npm run test:birim` | Yalnızca birim testleri (`node --test`, saniyeler) |
| `npm run test:uctan-uca` | Gerçek uygulamayı açan testler (~1,5 dk) |
| `npm run lint` | Kod biçimi denetimi (`npm run lint:duzelt` düzeltir) |
| `npm run simge` | Uygulama simgelerini vektör kaynaktan yeniden üretir |
| `npm run paket:mac` | macOS `.dmg` paketleri (Intel + Apple Silicon) |
| `npm run paket:win` | Windows kurulum programı |
| `npm run paket:linux` | Linux `AppImage` |
| `npm run vendor` | `vendor/` dosyalarını yeniler |
| `npm run ghostscript` | Doğrudan baskı için Ghostscript'i pakete hazırlar (isteğe bağlı) |

Geliştirici araçları kapalıdır (`webPreferences.devTools: false`) ve *Görünüm* menüsünde
görünmez; kullanıcıya sunulan uygulamada işi yok. Gerekirse açılır:
`HV_GELISTIRICI=1 npm start`.

Açılışta modeller bir tanıtım penceresinde yüklenir; hazırlık bitince uygulama görünür
(bkz. [`docs/ARAYUZ.md`](./docs/ARAYUZ.md) → "Açılış penceresi"). Geliştirirken beklememek
için kapatılabilir: `HV_ACILIS=0 npm start`.

`src/renderer/js/` altındaki modüller DOM'a ve Electron'a dokunmadan yazılır ki hem arayüzde
hem Node'da (testte) çalışsınlar. Ölçüler milimetre tutulur; piksele yalnızca çizim, dışa
aktarma ve baskı anında çevrilir.
