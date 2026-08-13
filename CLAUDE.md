# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Bu depodaki bağlayıcı kuralların tek kaynağı [`AGENTS.md`](./AGENTS.md) dosyasıdır.**
Herhangi bir işleme başlamadan önce `AGENTS.md` dosyasını oku ve tamamını uygula.

Özet (ayrıntısı `AGENTS.md` içinde):

1. **Her işlem commit'lenir** — hiçbir değişiklik commit edilmeden bırakılmaz; görev sonunda
   `git status` temiz olur. Bu, kullanıcının bu depo için verdiği kalıcı bir izindir; her
   commit için ayrıca onay istenmez.
2. **Commit atan ajan kendi adını ve e-postasını** `Co-Authored-By` satırıyla ekler.
   Claude Code için: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
3. **Yığın ElectronJS + NodeJS**'tir.
4. **Tüm kod cross-platform** (Windows/macOS/Linux) olmak zorundadır — `path.join`, sabit yol
   yok, platforma özel kabuk komutu yok.
5. **Kişisel bilgi asla depoya girmez** — gerçek vesikalık fotoğraflar, kimlik verileri,
   sırlar, yerel mutlak yollar commit edilmez.
6. **Arayüz Bootstrap ile yazılır** — npm'den yerel olarak yüklenir (CDN yok), tasarım
   responsive olur ve tema aydınlıktır (`data-bs-theme="light"`, karanlık tema yok).

## Proje

Hiper Vesika — vesikalık fotoğraf düzenleme ve dizdirme uygulaması. README ve alan terimleri
Türkçedir.

Komutlar: `npm start` (çalıştır), `npm run test:birim` (birim testleri), `npm run vendor`
(Bootstrap/simge/Human dosyalarını `src/renderer/vendor/` altına kopyalar).

Mimari ve yol haritası `AGENTS.md` → "Yapı" bölümü ile [`docs/FAZLAR.md`](./docs/FAZLAR.md)
içinde; arayüzün tasarım katmanı [`docs/ARAYUZ.md`](./docs/ARAYUZ.md) içinde anlatılır.
