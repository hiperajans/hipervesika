// Kod bicimi denetimi.
//
// Temel: neostandard (standard'in bakimi surdurulen surumu) — noktali virgul
// yok, iki bosluk girinti, tek tirnak. Depodaki kod zaten bu bicimde yazildi.
//
// Uc ayri ortam var ve global degiskenleri farkli:
//   src/main       -> Node (Electron ana surec)
//   src/renderer   -> tarayici (preload koprusu disinda Node yok)
//   test, scripts  -> Node
// Renderer modulleri hem tarayicida hem de birim testlerinde (Node) calisir,
// bu yuzden ikisinin de globallerini gorurler.

import neostandard from 'neostandard'

const YOK_SAY = [
  'node_modules/**',
  'src/renderer/vendor/**',
  'release/**',
  'dist-electron/**'
]

export default [
  { ignores: YOK_SAY },

  ...neostandard({ noStyle: false }),

  {
    // Renderer modulleri UMD kalibinda: tarayicida window.HV, Node'da
    // module.exports. Ikisinin de globallerine ihtiyac duyarlar.
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        globalThis: 'readonly',
        module: 'writable',
        require: 'readonly',
        console: 'readonly',
        Image: 'readonly',
        ImageData: 'readonly',
        ImageBitmap: 'readonly',
        createImageBitmap: 'readonly',
        DataTransfer: 'readonly',
        DragEvent: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        fetch: 'readonly'
      }
    }
  },

  {
    files: ['src/main/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        globalThis: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    }
  },

  {
    // Simge cizici Node'da degil, Electron'un olusturucu surecinde calisir;
    // dosya oraya metin olarak enjekte edilir.
    files: ['scripts/simge/tuval.js'],
    languageOptions: {
      globals: {
        globalThis: 'writable',
        document: 'readonly',
        Path2D: 'readonly'
      }
    }
  },

  {
    // Uctan uca testlerdeki page.evaluate() geri cagrilari Node'da degil,
    // uygulamanin icinde calisir; oradaki degiskenler ESLint icin gorunmez.
    files: ['test/uctan-uca/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        DataTransfer: 'readonly',
        DragEvent: 'readonly',
        File: 'readonly',
        atob: 'readonly',
        // renderer.js'in modul kapsamindaki durumu
        yuklenenGorsel: 'readonly',
        rotusAyarlari: 'readonly',
        lekeler: 'readonly',
        olcuDurumu: 'readonly',
        kirpma: 'readonly',
        dpi: 'readonly',
        ciktiMaskeleri: 'readonly'
      }
    }
  },

  {
    // Sozlerde Turkce ad kullaniliyor (cozumle/reddet); kural Ingilizce
    // "resolve/reject" bekliyor.
    rules: { 'promise/param-names': 'off' }
  }
]
