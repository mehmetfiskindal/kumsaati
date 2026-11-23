# GeaStack Mimarisi ve Uygulama Örneği

## 1. GeaStack Nedir?

**GeaStack**, standart TypeScript/JSX (`ReactiveComponent`) ve CSS ile yazılmış kullanıcı arayüzlerini **önceden derleyerek (AOT — Ahead-of-Time)** doğrudan yerel C++20 kaynak koduna dönüştüren çok platformlu bir uygulama yığınıdır.

Klasik hibrit yaklaşımlardan temel farkı:

| Özellik | WebView / Electron / Capacitor | React Native | GeaStack (Native Hedefler) |
| --- | --- | --- | --- |
| Çalışma zamanı JS motoru | Tarayıcı motoru (Chromium/WebKit) | Hermes / JSC | **Yok** (C++20'ye AOT derlenir) |
| UI katmanı | HTML DOM | Platform native widget köprüsü | Kendi C++20 CSS/Layout + RGB565 Canvas raster motoru (veya Apple native) |
| Hedef cihaz sınıfı | Masaüstü / mobil | Mobil | ESP32, RP2350, GeaOS, Web, iOS, macOS, Raspberry Pi OS, **Sailfish OS** |
| Paket boyutu (bu uygulama) | 50–150+ MB | 20–40 MB | **~1.9 MB RPM** (kurulu ~5.4 MB) |

Aynı kaynak kodu (`src/index.tsx`, `src/styles.css`) web geliştirme sırasında Vite üzerinden tarayıcıda canlı önizlenebilirken (`npm run dev`), yerel hedeflerde (`ios`, `raspberry-pi-os`, `sailfish-os`, `esp32`, `rp2350`) C++20 olarak derlenir.

---

## 2. GeaStack Paket Ekosistemi

GeaStack modüler paketlerden oluşur. `@geastack/cli` ve hedef betikleri, bu paketleri uygulamanın `node_modules` dizininden çözümler:

| Paket | Rolü |
| --- | --- |
| `@geastack/core` | Uygulama API'si (`ReactiveComponent`, `mount`, `AudioContext` tipleri), reaktivite başlıkları, ortak C++ giriş noktası (`gea_app_entry.cpp`), Vite + `geatsc` orkestrasyon betiği (`scripts/build-gea-vite-geatsc.mjs`) ve kaynak dosya manifesti (`gea_sources.mjs`). |
| `@geastack/engine` | Gömülü/yerel çizim motoru: RGB565 `Canvas`, CSS hesaplama ve animasyon motoru, düğüm ağacı (`ui/Tree`), kirli bölge (dirty-rect) takibi, dokunmatik yönlendirme (`TouchRuntime`) ve çalışma zamanı TTF rasterizer (`rasterized_font.cpp`). |
| `@geastack/compiler` (`geatsc`) | TypeScript/JS ara gösterimini C++20 kaynak koduna çeviren AOT derleyici. |
| `@geastack/geatsc-plugin-gea` | Gea JSX şablonlarını, `ReactiveComponent` bağlamalarını ve CSS kurallarını derleyici eklentisi olarak C++20'ye dönüştürür. |
| `@geastack/host` | Zamanlayıcılar (`setInterval`/`setTimeout`), depolama (`localStorage`), `libcurl` tabanlı HTTP/WebSocket ve ses soyutlamaları. |
| `@geastack/elements` | Temel UI bileşenleri ve yerleşik eleman davranışları. |
| `@geastack/geaos` | Ortak gömülü/cihaz çalışma zamanı yardımcıları. |
| `@geastack/linux` | Raspberry Pi OS ve **Sailfish OS** için SDL2/Wayland/Maliit platform C++ katmanı, CMake şablonu, `.desktop` ve RPM `.spec` üreticisi. |
| `@geastack/apple` | iOS / macOS derleme ve simülatör/cihaz hedefi. |
| `@geastack/cli` | `gea dev`, `gea build`, `gea run`, `gea doctor` komut satırı aracı. |

---

## 3. TSX + CSS'ten C++20'ye Dönüşüm Hattı

Sailfish OS hazırlık aşaması çalıştırıldığında (`prepare.mjs` → `build-gea-vite-geatsc.mjs`), uygulama şu 4 adımdan geçer:

1. **Vite Üretim Paketi ve Modül Grafiği Budama (Module-Graph Pruning):**
   Vite, `src/index.tsx` ve `src/styles.css` dosyalarını çözümler. GeaStack'in modül grafiği analizcisi kullanılmayan çalışma zamanı modüllerini (ör. `ble.ts`, `gpio.ts`, `audio-worklet.ts`, `images.ts`) eler. Bu uygulamada 11 modülden 9'u budanarak yalnızca gerekli çekirdek bırakılır.
2. **Gömülü Asset ve Font Üretimi (`generate-gea-embedded-assets`):**
   `src/styles.css` içindeki `@font-face` ile referans verilen `assets/fonts/Inter-Regular.ttf`, doğrudan C++ bayt dizisi olarak `gea_embedded_assets_generated.cpp` içine gömülür. Bu sayede cihazda sistem fontuna bağımlılık kalmaz.
3. **AOT C++20 Üretimi (`geatsc` + `@geastack/geatsc-plugin-gea`):**
   - JSX düğümleri ve reaktif ifadeler `gea::embedded::ui::NodeHandle` tabanlı C++20 fonksiyonlarına çevrilir.
   - `src/styles.css` içindeki kurallar ve `@media (max-width: 720px)`, `@media (max-width: 360px)` gibi medya sorguları **statik CSS tape tablolarına** (`__GeaStaticCssLengthOp`, `__GeaStaticCssColorOp`, `registerStaticMediaConditionPlan`) dönüştürülür. Çalışma zamanında CSS metni parse edilmez; doğrudan önceden derlenmiş `constexpr` tablolar yüklenir.
   - `Kum Saati` için bu adım 284 satırlık `src/index.tsx` ve 1143 satırlık `src/styles.css` dosyasından **9260 satırlık** tek bir `.gea-sailfish/generated/kusursuzzamanlayici/index.cpp` dosyası üretir.
4. **Hedef Platform Birleştirmesi (CMake + GCC 13.4):**
   Üretilen `index.cpp` ve `gea_embedded_assets_generated.cpp`, `@geastack/{core,host,engine,elements,geaos}` C++ kaynakları ve `@geastack/linux` Sailfish platform dosyaları (`sailfish_*.cpp`) ile birlikte tek bir C++20 yürütülebilir dosyasına (`harbour-gea-kusursuzzamanlayici`) derlenir.

---

## 4. `Kum Saati` Uygulamasının GeaStack Yapısı

### 4.1 `package.json` Yapılandırması

Uygulama kimliği, ikonlar, Sailfish sandbox izinleri ve hedef platformlar `package.json` içindeki `gea` bloğunda tanımlanır:

```json
{
  "name": "gea-kusursuzzamanlayici",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@geajs/core": "^1.3.0",
    "@geastack/apple": "^0.2.9",
    "@geastack/cli": "^0.1.82",
    "@geastack/core": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/core",
    "@geastack/engine": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/engine",
    "@geastack/linux": "github:mehmetfiskindal/linux#sailfish-device-fixes"
  },
  "gea": {
    "id": "kusursuzzamanlayici",
    "name": "Kum Saati",
    "entry": "src/index.tsx",
    "icons": {
      "128": "icons/icon-source.png"
    },
    "sailfish": {
      "organizationName": "org.geastack",
      "applicationName": "kusursuzzamanlayici",
      "devicePixelRatio": 2,
      "permissions": ["Audio"]
    },
    "targets": {
      "web": true,
      "ios": true,
      "esp32": false,
      "rp2350": false,
      "geaos": false,
      "macos": false,
      "android": false,
      "windows": false
    }
  }
}
```

- `gea.id`: RPM paket adını üretir (`harbour-gea-kusursuzzamanlayici`).
- `gea.icons["128"]`: Hazırlık betiği (`sharp` ile) buradan `86x86`, `108x108`, `128x128` ve `172x172` Harbour ikonlarını otomatik oluşturur.
- `gea.sailfish.organizationName` / `applicationName`: Sailjail veri dizini ve sandbox kimliğini belirler.
- `gea.sailfish.devicePixelRatio`: Sabit bir sayı (`2`) ya da `"auto"` olabilir.
- `gea.sailfish.permissions`: `.desktop` dosyasındaki `[X-Sailjail]` → `Permissions=` satırına yazılır.

### 4.2 Reaktif Bileşen Modeli (`src/index.tsx`)

GeaStack bileşenleri `ReactiveComponent` sınıfından türer. Sınıf alanlarındaki değişimler otomatik olarak ilgili UI düğümlerini kirletir (dirty) ve yeniden çizimi tetikler:

```tsx
import { ReactiveComponent, mount } from '@geastack/core'
import './styles.css'

export class App extends ReactiveComponent {
  selectedSeconds = 40
  remainingMs = 40_000
  isRunning = false

  template() {
    return (
      <div class="app">
        <div class="time-value">{this.formatTime(Math.ceil(this.remainingMs / 1000))}</div>
        <button
          onTouchStart={() => this.beginTouch()}
          onTouchMove={() => this.moveTouch()}
          onTouchEnd={() => this.handleTouchAction(() => this.toggleTimer())}
          onClick={() => this.handleClickAction(() => this.toggleTimer())}
        >
          {this.isRunning ? 'Duraklat' : 'Döngüyü başlat'}
        </button>
      </div>
    )
  }
}

mount(App)
```

`Kum Saati` içinde mobil/Sailfish deneyimi için kullanılan üç önemli desen:

1. **Dokunma ve Tıklama Çift Tetikleme Koruması:**
   `beginTouch` / `moveTouch` / `handleTouchAction` / `handleClickAction` yardımcıları, kaydırma (scroll) sırasında yanlışlıkla düğmeye basılmasını engeller ve bir dokunmanın ardından 500 ms boyunca gelen `click` olayını bastırır.
2. **Saat Akışı ve Kum Saati Dönüş Animasyonu:**
   `setInterval(..., 50)` ile 50 ms aralıklarla `remainingMs` ve `hourglassRotation` güncellenir; kum seviyeleri `style={{ transform: 'scaleY(...)' }}` ve cam dönüşü `style={{ transform: 'rotate(...deg)' }}` üzerinden doğrudan GeaStack'in native transform motoruna aktarılır.
3. **Özel TTF Font Gömme (`src/styles.css`):**
   ```css
   @font-face {
     font-family: 'Inter';
     src: url('../assets/fonts/Inter-Regular.ttf');
   }
   ```
   Bu tanım sayesinde `Inter-Regular.ttf` ikili dosyaya gömülür ve çalışma zamanında `stb_truetype` tabanlı rasterizer ile ihtiyaç duyulan boyutlarda çizilir.

---

## 5. Sıfırdan Minimal GeaStack + Sailfish OS Örneği

Yeni bir GeaStack uygulamasını Sailfish OS için hazırlamak üzere gereken en küçük yapı şöyledir:

```text
ornek-uygulama/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── icons/
│   └── icon.png          (en az 172x172 PNG önerilir)
└── src/
    ├── index.tsx
    └── styles.css
```

### `src/index.tsx`

```tsx
import { ReactiveComponent, mount } from '@geastack/core'
import './styles.css'

export class SayacApp extends ReactiveComponent {
  count = 0

  template() {
    return (
      <div class="screen">
        <h1>GeaStack Sailfish</h1>
        <div class="value">{this.count}</div>
        <div class="actions">
          <button onClick={() => (this.count -= 1)}>− Azalt</button>
          <button onClick={() => (this.count += 1)}>+ Artır</button>
        </div>
      </div>
    )
  }
}

mount(SayacApp)
```

### `src/styles.css`

```css
body {
  margin: 0;
  width: 100%;
  height: 100vh;
  background-color: #10120f;
  color: #f1f0e9;
}

.screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100vw;
  height: 100vh;
}

.value {
  font-size: 64px;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  padding: 14px 22px;
  border: 1px solid #4d5841;
  border-radius: 12px;
  background-color: #1e241b;
  color: #f1f0e9;
  font-size: 18px;
}
```

### `package.json` (minimum)

```json
{
  "name": "gea-sayac-ornek",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "dependencies": {
    "@geajs/core": "^1.3.0",
    "@geastack/cli": "^0.1.82",
    "@geastack/core": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/core",
    "@geastack/engine": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/engine",
    "@geastack/linux": "github:mehmetfiskindal/linux#sailfish-device-fixes"
  },
  "gea": {
    "id": "sayac-ornek",
    "name": "Sayaç",
    "entry": "src/index.tsx",
    "icons": {
      "128": "icons/icon.png"
    },
    "sailfish": {
      "organizationName": "org.geastack",
      "applicationName": "sayac_ornek",
      "devicePixelRatio": "auto",
      "permissions": []
    }
  }
}
```

Bu proje dizininde `npm install` sonrasında [Sailfish OS Derleme ve Kurulum Rehberi](./sailfish-os-derleme-ve-kurulum.md) adımları birebir uygulanarak doğrudan Sailfish OS `aarch64` RPM paketi üretilebilir.
