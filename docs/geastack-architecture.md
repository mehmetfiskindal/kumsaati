# GeaStack Architecture & Example App

## 1. What Is GeaStack?

**GeaStack** is a cross-platform application framework that **ahead-of-time (AOT) compiles** standard TypeScript/JSX (`ReactiveComponent`) and CSS into native **C++20** source code.

How it compares to common cross-platform approaches:

| Aspect | WebView / Electron / Capacitor | React Native | GeaStack (Native Targets) |
| --- | --- | --- | --- |
| Runtime JS engine | Browser engine (Chromium/WebKit) | Hermes / JSC | **None** (AOT compiled to C++20) |
| UI layer | HTML DOM | Native widget bridge | C++20 CSS/layout + RGB565 Canvas raster engine (or Apple native) |
| Target range | Desktop / mobile | Mobile | ESP32, RP2350, GeaOS, Web, iOS, macOS, Raspberry Pi OS, **Sailfish OS** |
| Package size (this app) | 50–150+ MB | 20–40 MB | **~1.9 MB RPM** (~5.4 MB installed) |

During development, the same `src/index.tsx` and `src/styles.css` run live in a browser through Vite (`npm run dev`), while native targets compile the app directly into platform binaries.

---

## 2. GeaStack Package Ecosystem

GeaStack is split into focused packages resolved from the application's `node_modules`:

| Package | Responsibility |
| --- | --- |
| `@geastack/core` | App API (`ReactiveComponent`, `mount`, `AudioContext` declarations), reactivity headers, shared native entry (`gea_app_entry.cpp`), Vite + `geatsc` orchestration (`scripts/build-gea-vite-geatsc.mjs`), and source manifest (`gea_sources.mjs`). |
| `@geastack/engine` | Native rendering engine: RGB565 `Canvas`, CSS layout & animation engine, UI node tree (`ui/Tree`), dirty-region tracking, touch dispatch (`TouchRuntime`), and runtime TTF font rasterizer (`rasterized_font.cpp`). |
| `@geastack/compiler` (`geatsc`) | AOT compiler that lowers TypeScript/JS modules into C++20. |
| `@geastack/geatsc-plugin-gea` | Compiler plugin that lowers Gea JSX templates, `ReactiveComponent` bindings, and CSS rules into C++20. |
| `@geastack/host` | Timers (`setInterval`/`setTimeout`), storage (`localStorage`), `libcurl`-backed HTTP/WebSocket, and audio host bridges. |
| `@geastack/elements` | Built-in UI primitives and element behaviors. |
| `@geastack/geaos` | Shared embedded/device runtime helpers. |
| `@geastack/linux` | Raspberry Pi OS and **Sailfish OS** platform C++ sources (SDL2/Wayland/Maliit/PulseAudio), CMake template, `.desktop`, and RPM `.spec` generator. |
| `@geastack/apple` | iOS / macOS target and simulator/device tooling. |
| `@geastack/cli` | `gea dev`, `gea build`, `gea run`, and `gea doctor` CLI commands. |

---

## 3. From TSX + CSS to Native C++20

When the Sailfish OS preparation script runs (`prepare.mjs` → `build-gea-vite-geatsc.mjs`), the app passes through four stages:

1. **Vite Production Bundle & Module-Graph Pruning:**
   Vite resolves `src/index.tsx` and `src/styles.css`. GeaStack's module-graph pass prunes unused runtime modules (such as `ble.ts`, `gpio.ts`, `audio-worklet.ts`, `images.ts`). For `Kum Saati`, 9 out of 11 tracked modules are shaken out.
2. **Embedded Asset & Font Generation (`generate-gea-embedded-assets`):**
   `assets/fonts/Inter-Regular.ttf`, referenced by `@font-face` in `src/styles.css`, is embedded as a C++ byte array in `gea_embedded_assets_generated.cpp`, removing any runtime dependency on system fonts.
3. **AOT C++20 Code Generation (`geatsc` + `@geastack/geatsc-plugin-gea`):**
   - JSX elements and reactive expressions compile to `gea::embedded::ui::NodeHandle` C++20 code.
   - CSS rules and responsive `@media (max-width: 720px)` / `@media (max-width: 360px)` queries compile into **static CSS tape tables** (`__GeaStaticCssLengthOp`, `__GeaStaticCssColorOp`, `registerStaticMediaConditionPlan`). No CSS text parsing happens at runtime.
   - For `Kum Saati`, 284 lines of `src/index.tsx` and 1,143 lines of `src/styles.css` compile into a 9,260-line `.gea-sailfish/generated/kusursuzzamanlayici/index.cpp`.
4. **Platform Staging & Native Build (CMake + GCC 13.4):**
   The generated C++ files are staged alongside `@geastack/{core,host,engine,elements,geaos}` and `@geastack/linux`'s Sailfish platform files (`sailfish_*.cpp`), then compiled into a single native ELF executable (`harbour-gea-kusursuzzamanlayici`) and packaged as an RPM.

---

## 4. Walkthrough: How `Kum Saati` Is Structured

### 4.1 `package.json` Metadata

App identity, icons, Sailfish sandbox permissions, and targets live under the `gea` key in `package.json`:

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

- `gea.id` determines the Harbour RPM package name (`harbour-gea-kusursuzzamanlayici`).
- `gea.icons["128"]` is automatically resized via `sharp` into `86x86`, `108x108`, `128x128`, and `172x172` Harbour PNG icons.
- `gea.sailfish.organizationName` and `applicationName` configure the `[X-Sailjail]` sandbox identity and persistent storage path.
- `gea.sailfish.devicePixelRatio` accepts either `"auto"` (recommended on ARM phones) or an explicit number (`0.5`–`8`).
- `gea.sailfish.permissions` populates `Permissions=` in `[X-Sailjail]`.

### 4.2 Reactive Component (`src/index.tsx`)

Components extend `ReactiveComponent`. Mutating fields on `this` automatically marks affected UI nodes dirty and schedules a repaint:

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

Key patterns used in `Kum Saati` for mobile/Sailfish:

1. **Touch/Click De-duplication & Scroll Guard:**
   `beginTouch` / `moveTouch` / `handleTouchAction` / `handleClickAction` cancel taps when the finger drags to scroll and suppress follow-up `click` events for 500 ms after a touch action.
2. **Smooth Hourglass & Sand Transforms:**
   A 50 ms `setInterval` updates `remainingMs` and `hourglassRotation`, driving inline `style={{ transform: 'scaleY(...)' }}` and `style={{ transform: 'rotate(...deg)' }}` directly in the native engine.
3. **Embedded Custom Font (`src/styles.css`):**
   ```css
   @font-face {
     font-family: 'Inter';
     src: url('../assets/fonts/Inter-Regular.ttf');
   }
   ```
   `Inter-Regular.ttf` is embedded in the binary and rasterized on demand at any runtime font size and DPR.
4. **Web Audio-Style Sound Cues:**
   Countdown ticks and end-of-cycle melodies use `__gea_audioContext.createOscillator()` (`sine`, `frequency.value`, `start`, `stop`), which maps to Web Audio in browsers, AVFoundation on iOS, and SDL2/PulseAudio on Sailfish OS.

---

## 5. Minimal Starter Example for Sailfish OS

To build a minimal GeaStack app from scratch for Sailfish OS, create this directory layout:

```text
counter-example/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── icons/
│   └── icon.png          (172x172 PNG or larger recommended)
└── src/
    ├── index.tsx
    └── styles.css
```

### `src/index.tsx`

```tsx
import { ReactiveComponent, mount } from '@geastack/core'
import './styles.css'

export class CounterApp extends ReactiveComponent {
  count = 0

  template() {
    return (
      <div class="screen">
        <h1>GeaStack Sailfish</h1>
        <div class="value">{this.count}</div>
        <div class="actions">
          <button onClick={() => (this.count -= 1)}>− Decrease</button>
          <button onClick={() => (this.count += 1)}>+ Increase</button>
        </div>
      </div>
    )
  }
}

mount(CounterApp)
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

### `package.json`

```json
{
  "name": "gea-counter-example",
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
    "id": "counter-example",
    "name": "Counter",
    "entry": "src/index.tsx",
    "icons": {
      "128": "icons/icon.png"
    },
    "sailfish": {
      "organizationName": "org.geastack",
      "applicationName": "counter_example",
      "devicePixelRatio": "auto",
      "permissions": []
    }
  }
}
```

Run `npm install` and follow the [Sailfish OS Build, Packaging, and Device Installation Guide](./sailfish-os-build-and-install.md) to produce an `aarch64` RPM.
