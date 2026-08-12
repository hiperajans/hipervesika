# AGENTS.md

Bu dosya, bu depoda çalışan **tüm yapay zeka ajanları** için bağlayıcı kuralları içerir
(Claude Code, Codex, Cursor, Copilot, Gemini CLI vb.). Bir işe başlamadan önce bu dosyanın
tamamı okunmalı ve uygulanmalıdır. Diğer ajan dosyaları (`CLAUDE.md`,
`.github/copilot-instructions.md`) bu dosyaya yönlendirir; kuralların tek kaynağı burasıdır.

## Proje

**Hiper Vesika** — vesikalık fotoğraf düzenleme ve dizdirme (baskı yerleşimi) uygulaması.
Arayüz ve alan terimleri Türkçedir.

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

Depo henüz kod içermiyor. Uygulama iskeleti kurulduğunda (package.json, ana/renderer süreç
ayrımı, derleme ve test komutları) bu bölüm ve `CLAUDE.md` güncellenir.
