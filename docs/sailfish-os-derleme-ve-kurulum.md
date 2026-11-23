# Sailfish OS Derleme, Paketleme ve Cihaza Kurulum Rehberi

Bu rehber, **Kum Saati** uygulamasını sıfırdan `aarch64` Sailfish OS 5.1.0.11 RPM paketine derleyip USB Geliştirici Modu üzerinden fiziksel Sailfish OS cihazına (`defaultuser@192.168.2.15`) kurma adımlarını eksiksiz olarak anlatır.

---

## 1. Ön Koşullar

### Host (macOS Apple Silicon — Bu Projede Kullanılan Kurulum)
- **Node.js 20.19+** ve **npm 10+/11+** (bu ortamda Node `v26.13.1`, npm `11.20.0`)
- **Docker Desktop** (ARM64 Linux motoru çalışır durumda)
- **Sailfish ARM64 build ortamı:**
  - Docker imajı: `sailfish-arm64-probe:local` (Ubuntu 22.04 ARM64)
  - Docker volume: `sailfish-5.1.0.11-aarch64-build` (içinde Sailfish OS 5.1.0.11 `aarch64` sysroot + `gcc`, `gcc-c++`, `cmake`, `rpm-build`, `SDL2-devel`, `libcurl-devel`, `maliit-framework-wayland-devel` kurulu)
- **Fiziksel Sailfish OS (`aarch64`) cihazı** ve USB kablo

> **Linux veya Windows üzerinde resmi SDK kullanıyorsanız:** Docker chroot yerine doğrudan kurulu `sfdk` aracını kullanabilirsiniz (bkz. [Bölüm 5: Resmi `sfdk` ile Derleme](#5-alternatif-linux--windows-üzerinde-resmi-sfdk-ile-derleme)).

---

## 2. Bağımlılıkların Kurulumu ve Fork İnceliği

Proje `package.json` dosyasında iki özel GitHub fork'u kullanır:

```json
"dependencies": {
  "@geajs/core": "^1.3.0",
  "@geastack/apple": "^0.2.9",
  "@geastack/cli": "^0.1.82",
  "@geastack/core": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/core",
  "@geastack/engine": "github:mehmetfiskindal/core#77b980616b5be74b0e5cec70bda16864b9fce76a::path:packages/engine",
  "@geastack/linux": "github:mehmetfiskindal/linux#sailfish-device-fixes"
}
```

### Neden `core` için tam commit SHA kullanılıyor?
`mehmetfiskindal/core` bir **monorepo**dur (kök dizinde `package.json` yoktur; paketler `packages/core` ve `packages/engine` altındadır). `npm`'in `pacote` paketinde `#main::path:packages/core` gibi bir **branch adı** verildiğinde `addGitSha` branch'i SHA'ya çözerken `::path:...` ekini düşürür ve kök dizinde `package.json` arayıp `ENOENT` hatası verir.

Bunun yerine 40 karakterlik tam commit SHA'sı verildiğinde (`#<sha>::path:packages/...`), `pacote` `addGitSha` yoluna hiç girmeden alt dizini doğru biçimde çıkarır. `mehmetfiskindal/core` reposuna yeni commit attığınızda güncel SHA'yı şu komutla alıp `package.json`'da güncelleyebilirsiniz:

```sh
git ls-remote https://github.com/mehmetfiskindal/core.git refs/heads/main
```

### Kurulum ve Doğrulama

```sh
npm install
npm ls @geastack/core @geastack/engine @geastack/linux
npm run check
```

Beklenen sonuç:
- `@geastack/core@0.1.55`, `@geastack/engine@0.1.26` ve `@geastack/linux@0.1.3` tekil (`deduped`) olarak çözülür.
- `tsc --noEmit` hatasız çıkar.

---

## 3. Adım 1 — Host Üzerinde Sailfish Projesini Hazırlama (`--prepare-only`)

Bu adım Vite derlemesini, `geatsc` C++20 kod üretimini, `Inter-Regular.ttf` gömme işlemini, ikon boyutlandırmayı (`86/108/128/172px`) ve taşınabilir CMake + `.desktop` + `.spec` dizinini oluşturur:

```sh
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . --arch aarch64 --prepare-only
```

Üretilen dizin:

```text
.gea-sailfish/build/kusursuzzamanlayici-aarch64/project/
├── CMakeLists.txt
├── sources.cmake
├── harbour-gea-kusursuzzamanlayici.desktop
├── rpm/
│   └── harbour-gea-kusursuzzamanlayici.spec
├── icons/
│   ├── 86.png
│   ├── 108.png
│   ├── 128.png
│   └── 172.png
├── generated/
│   ├── index.cpp
│   └── gea_embedded_assets_generated.cpp
├── platform/
│   ├── include/   (sailfish_prelude.h, sailfish_keyboard.h, rpios_keyboard.h ...)
│   └── main/      (sailfish_main.cpp, sailfish_display.cpp ...)
└── framework/
    ├── core/
    ├── engine/
    ├── host/
    ├── elements/
    └── geaos/
```

> `.gea-sailfish/` dizini `.gitignore` içinde yer alır; repo geçmişine girmez.

---

## 4. Adım 2 — Docker + Sailfish OS 5.1.0.11 `aarch64` Chroot İçinde RPM Derleme

Hazırlanan proje dizini Docker container'a bağlanır, Linux ext4 volume'ü içindeki `/opt/sailfish/tmp/project` yoluna kopyalanır ve Sailfish OS 5.1.0.11 chroot'unda native GCC 13.4 + CMake 3.31 + `rpmbuild` ile RPM paketlenir:

```sh
docker run --rm --platform linux/arm64 \
  -v sailfish-5.1.0.11-aarch64-build:/opt/sailfish \
  -v "$(pwd)/.gea-sailfish/build/kusursuzzamanlayici-aarch64/project:/work/project" \
  sailfish-arm64-probe:local bash -euo pipefail -c '
JOBS=$(nproc)
rm -rf /opt/sailfish/tmp/project /opt/sailfish/tmp/rpmbuild
cp -a /work/project /opt/sailfish/tmp/project
mkdir -p /opt/sailfish/tmp/rpmbuild/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

chroot /opt/sailfish /bin/bash -euo pipefail -c "
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  cd /tmp/project
  rpmbuild --build-in-place -bb \
    --define \"_topdir /tmp/rpmbuild\" \
    --define \"_rpmdir /tmp/rpmbuild/RPMS\" \
    --define \"_smp_mflags -j$JOBS\" \
    --define \"debug_package %{nil}\" \
    rpm/harbour-gea-kusursuzzamanlayici.spec
"

rm -rf /work/project/RPMS
mkdir -p /work/project/RPMS
cp -a /opt/sailfish/tmp/rpmbuild/RPMS/. /work/project/RPMS/
ls -lh /work/project/RPMS/aarch64/
rm -rf /opt/sailfish/tmp/project /opt/sailfish/tmp/rpmbuild
'
```

### Üretilen RPM'i Doğrulama

```sh
docker run --rm --platform linux/arm64 \
  -v sailfish-5.1.0.11-aarch64-build:/opt/sailfish \
  -v "$(pwd)/.gea-sailfish/build/kusursuzzamanlayici-aarch64/project/RPMS/aarch64:/work/rpms:ro" \
  sailfish-arm64-probe:local bash -c '
cp /work/rpms/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm /opt/sailfish/tmp/check.rpm
chroot /opt/sailfish rpm -qip /tmp/check.rpm
chroot /opt/sailfish rpm -qlp /tmp/check.rpm
rm -f /opt/sailfish/tmp/check.rpm
'
```

Doğrulanmış paket içeriği:
- `/usr/bin/harbour-gea-kusursuzzamanlayici`
- `/usr/share/applications/harbour-gea-kusursuzzamanlayici.desktop`
- `/usr/share/icons/hicolor/{86x86,108x108,128x128,172x172}/apps/harbour-gea-kusursuzzamanlayici.png`

---

## 5. Alternatif: Linux / Windows Üzerinde Resmi `sfdk` ile Derleme

Kurulu Sailfish SDK (`sfdk`) olan bir Linux makinede hazırlık ve RPM derleme tek komutla yapılır:

```sh
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . --arch aarch64
# sfdk PATH üzerinde değilse:
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . \
  --arch aarch64 \
  --sfdk /path/to/SailfishOS/bin/sfdk
```

Windows (PowerShell) üzerinden (ör. emülatör için `i486` veya cihaz için `aarch64`):

```powershell
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.ps1 `
  -AppDirectory . -Architecture aarch64
```

Harbour'a göndermeden önce RPM uyumluluk denetimi:

```sh
sfdk check .gea-sailfish/build/kusursuzzamanlayici-aarch64/project/RPMS/aarch64/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm
```

---

## 6. Adım 3 — Sailfish OS Cihazına (`defaultuser@192.168.2.15`) Kurulum

### 6.1 Cihazı Hazırlama
1. Sailfish OS cihazda **Ayarlar → Geliştirici araçları (Developer tools)** ekranını açın.
2. **Geliştirici modu (Developer mode)** ve **Uzak bağlantı (Remote connection)** seçeneklerini etkinleştirin.
3. USB kablosuyla bilgisayara bağlayın ve bağlantı modunu **Geliştirici modu** seçin.
4. Cihazın varsayılan USB ağ adresi `192.168.2.15`, kullanıcı adı `defaultuser` olur.

Bağlantıyı doğrulama:

```sh
ssh defaultuser@192.168.2.15 'uname -a && cat /etc/os-release | head -n 4'
```

### 6.2 RPM'i Kopyalama ve Kurma

```sh
RPM=".gea-sailfish/build/kusursuzzamanlayici-aarch64/project/RPMS/aarch64/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"

scp "$RPM" defaultuser@192.168.2.15:/tmp/
ssh defaultuser@192.168.2.15 "pkcon -y install-local /tmp/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"
```

> **Alternatif (`devel-su` + `rpm`):** Aynı sürümü (`0.1.0-1`) üzerine yeniden kurarken `pkcon` zaten kurulu uyarısı verirse:
> ```sh
> ssh -t defaultuser@192.168.2.15 "devel-su rpm -Uvh --force /tmp/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"
> ```

### 6.3 Başlatma, Log İnceleme ve Kaldırma

Uygulama kurulduktan sonra Sailfish OS uygulama ızgarasında **Kum Saati** adıyla görünür.

SSH üzerinden logları canlı görerek başlatmak için (Sailjail ile):

```sh
ssh defaultuser@192.168.2.15 \
  "sailjail -p /usr/share/applications/harbour-gea-kusursuzzamanlayici.desktop /usr/bin/harbour-gea-kusursuzzamanlayici"
```

DPR veya ölçekleme testi yapmak için:

```sh
ssh defaultuser@192.168.2.15 \
  "GEA_SAILFISH_DPR=auto /usr/bin/harbour-gea-kusursuzzamanlayici"
```

Uygulamayı cihazdan kaldırmak için:

```sh
ssh defaultuser@192.168.2.15 "pkcon -y remove harbour-gea-kusursuzzamanlayici"
```

---

## 7. Sorun Giderme

| Belirti | Olası Neden | Çözüm |
| --- | --- | --- |
| `ssh: connect to host 192.168.2.15 port 22: Operation timed out` | USB kablosu bağlı değil, cihazda Geliştirici Modu / Uzak Bağlantı kapalı veya macOS USB ağ arayüzü (`en6` vb.) IP almamış. | Cihazda **Geliştirici modu + Uzak bağlantı** açın; macOS **Sistem Ayarları → Ağ** altında USB ağ arayüzünün bağlı olduğunu (`192.168.2.x`) kontrol edin. |
| `npm install` sırasında `ENOENT ... /git-clone.../package.json` | `mehmetfiskindal/core` için branch adı (`#main::path:...`) verilmiş; `npm`/`pacote` `::path:` kısmını düşürüyor. | Branch adı yerine 40 karakterlik tam commit SHA'sı kullanın (`#<sha>::path:packages/core`). |
| Türkçe karakterler (`Ğ, İ, Ş`) boş kutu/eksik çıkıyor | `@geastack/engine` upstream sürümünden çözülmüş. | `npm ls @geastack/engine` ile paketin `mehmetfiskindal/core` fork'undan geldiğini ve `node_modules/@geastack/engine/rasterized_font.cpp` içinde `0x011e..0x015f` kod noktalarının bulunduğunu doğrulayın. |
| `pkcon install-local` "package already installed" diyor | Aynı `version-release` (`0.1.0-1`) zaten kurulu. | `package.json` sürümünü artırıp yeniden derleyin veya `devel-su rpm -Uvh --force` kullanın. |
| Docker volume bulunamadı hatası | `sailfish-5.1.0.11-aarch64-build` volume'ü veya `sailfish-arm64-probe:local` imajı henüz hazırlanmamış. | `sailfishos-macos-developmentkit` ile Sailfish 5.1.0.11 `aarch64` sysroot volume'ünü ve gerekli `-devel` paketlerini (`SDL2-devel`, `libcurl-devel`, `maliit-framework-wayland-devel`, `gcc-c++`, `cmake`, `rpm-build`) kurun. |
