# Sailfish OS Build, Packaging, and Device Installation Guide

This guide walks through building **Kum Saati** into a Sailfish OS 5.1.0.11 `aarch64` RPM and installing it on a physical Sailfish OS device (`defaultuser@192.168.2.15`) over USB Developer Mode.

---

## 1. Prerequisites

### Option A — Apple Silicon macOS (Used in This Project)
- **Node.js 20.19+** and **npm 10+/11+** (tested with Node `v26.13.1`, npm `11.20.0`)
- **Docker Desktop** with the `linux/arm64` engine running
- **Sailfish OS 5.1.0.11 `aarch64` chroot build volume:**
  - Container image: `sailfish-arm64-probe:local` (Ubuntu 22.04 ARM64)
  - Docker volume: `sailfish-5.1.0.11-aarch64-build` containing the extracted official `Sailfish_OS-5.1.0.11-Sailfish_SDK_Target-aarch64` sysroot with `gcc`, `gcc-c++`, `cmake`, `rpm-build`, `SDL2-devel`, `libcurl-devel`, and `maliit-framework-wayland-devel` installed inside the target.
- A physical **Sailfish OS (`aarch64`)** phone and USB cable.

### Option B — Linux or Windows with Official Sailfish SDK (`sfdk`)
- **Node.js 20.19+** and **npm 10+/11+**
- **Sailfish SDK** installed with the `SailfishOS-5.1.0.11-aarch64` (device) or `SailfishOS-5.1.0.11-i486` (emulator) target (see [Section 5](#5-alternative-building-with-official-sfdk-on-linux--windows)).

---

## 2. Installing Dependencies & GitHub Fork Pinning

`package.json` pulls `@geastack/core`, `@geastack/engine`, and `@geastack/linux` from the project's GitHub forks:

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

### Why `mehmetfiskindal/core` Uses a Full Commit SHA
`mehmetfiskindal/core` is a **monorepo** (there is no root `package.json`; packages live under `packages/core` and `packages/engine`). In `npm`/`pacote`, passing a branch name with a subdirectory specifier (`#main::path:packages/core`) triggers `addGitSha`, which drops `::path:...` when rewriting the resolved URL and fails with `ENOENT .../package.json`.

Pinning the full 40-character commit SHA (`#<sha>::path:packages/...`) bypasses `addGitSha` and extracts the subdirectory cleanly. Whenever new commits are pushed to `mehmetfiskindal/core`, fetch the latest SHA and update `package.json`:

```sh
git ls-remote https://github.com/mehmetfiskindal/core.git refs/heads/main
```

### Install & Type-Check

```sh
npm install
npm ls @geastack/core @geastack/engine @geastack/linux
npm run check
```

Expected result:
- `@geastack/core@0.1.55`, `@geastack/engine@0.1.26`, and `@geastack/linux@0.1.3` resolve and deduplicate cleanly across all `@geastack/*` packages.
- `tsc --noEmit` exits with code 0.

---

## 3. Step 1 — Stage the Portable Sailfish Project (`--prepare-only`)

Run the Sailfish preparation step on the host to bundle with Vite, compile TSX/CSS to C++20 via `geatsc`, embed `Inter-Regular.ttf`, generate Harbour icons (`86/108/128/172px`), and write `CMakeLists.txt`, `.desktop`, and `.spec`:

```sh
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . --arch aarch64 --prepare-only
```

Generated project directory:

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
│   ├── include/   (sailfish_prelude.h, sailfish_keyboard.h, rpios_keyboard.h, ...)
│   └── main/      (sailfish_main.cpp, sailfish_display.cpp, sailfish_audio.cpp, ...)
└── framework/
    ├── core/
    ├── engine/
    ├── host/
    ├── elements/
    └── geaos/
```

> `.gea-sailfish/` is listed in `.gitignore` and stays local to the app directory.

---

## 4. Step 2 — Build the `aarch64` RPM in the Sailfish OS 5.1.0.11 Chroot

Copy the staged project into the Linux ext4 Docker volume and run `rpmbuild --build-in-place` inside `chroot /opt/sailfish`:

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

### Verify the Produced RPM

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

Verified RPM contents (~1.9 MB):
- `/usr/bin/harbour-gea-kusursuzzamanlayici`
- `/usr/share/applications/harbour-gea-kusursuzzamanlayici.desktop`
- `/usr/share/icons/hicolor/{86x86,108x108,128x128,172x172}/apps/harbour-gea-kusursuzzamanlayici.png`

---

## 5. Alternative: Building with Official `sfdk` on Linux / Windows

On a Linux host with the official Sailfish SDK installed, preparation and RPM packaging run in one command:

```sh
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . --arch aarch64
# Or pass an explicit sfdk path:
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.sh . \
  --arch aarch64 \
  --sfdk /path/to/SailfishOS/bin/sfdk
```

On Windows (PowerShell), use `--arch i486` for the emulator or `aarch64` for a phone:

```powershell
./node_modules/@geastack/linux/targets/sailfish-os/build-sailfish-os.ps1 `
  -AppDirectory . -Architecture aarch64
```

Before submitting a device RPM to Harbour, validate it with:

```sh
sfdk check .gea-sailfish/build/kusursuzzamanlayici-aarch64/project/RPMS/aarch64/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm
```

---

## 6. Step 3 — Deploy to a Sailfish OS Device (`defaultuser@192.168.2.15`)

### 6.1 Prepare the Device
1. Open **Settings → Developer tools** on the Sailfish OS device.
2. Enable **Developer mode** and **Remote connection** (set a password or configure SSH keys).
3. Connect the phone via USB and select **Developer mode** as the USB connection mode.
4. The default USB network address is `192.168.2.15` with username `defaultuser`.

Check connectivity:

```sh
ssh defaultuser@192.168.2.15 'uname -a && cat /etc/os-release | head -n 4'
```

### 6.2 Copy and Install the RPM

```sh
RPM=".gea-sailfish/build/kusursuzzamanlayici-aarch64/project/RPMS/aarch64/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"

scp "$RPM" defaultuser@192.168.2.15:/tmp/
ssh defaultuser@192.168.2.15 "pkcon -y install-local /tmp/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"
```

> **Reinstalling the same version (`0.1.0-1`):** If `pkcon` reports the package is already installed, force-upgrade with `rpm`:
> ```sh
> ssh -t defaultuser@192.168.2.15 "devel-su rpm -Uvh --force /tmp/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm"
> ```

### 6.3 Launch, Debug, and Uninstall

After installation, **Kum Saati** appears in the Sailfish OS app grid.

To launch from SSH under Sailjail with live audio and display logs:

```sh
ssh defaultuser@192.168.2.15 \
  "GEA_AUDIO_DEBUG=1 sailjail -p /usr/share/applications/harbour-gea-kusursuzzamanlayici.desktop /usr/bin/harbour-gea-kusursuzzamanlayici"
```

To test alternative DPR scaling at runtime without rebuilding:

```sh
ssh defaultuser@192.168.2.15 \
  "GEA_SAILFISH_DPR=auto /usr/bin/harbour-gea-kusursuzzamanlayici"
```

To uninstall the app:

```sh
ssh defaultuser@192.168.2.15 "pkcon -y remove harbour-gea-kusursuzzamanlayici"
```

---

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `ssh: connect to host 192.168.2.15 port 22: Operation timed out` | USB cable disconnected, Developer Mode / Remote Connection off, or macOS USB network interface inactive. | Enable **Developer mode + Remote connection** on the phone and verify the USB Ethernet interface has a `192.168.2.x` address in macOS **System Settings → Network**. |
| `npm install` fails with `ENOENT .../git-clone.../package.json` | A branch name (`#main::path:...`) was used for `mehmetfiskindal/core`; `npm`/`pacote` strips `::path:` on branch resolution. | Pin the full 40-character commit SHA (`#<sha>::path:packages/core`). |
| Turkish characters (`Ğ, İ, Ş`) render missing/blank | `@geastack/engine` resolved from upstream instead of the fork. | Run `npm ls @geastack/engine` and verify `node_modules/@geastack/engine/rasterized_font.cpp` contains codepoints `0x011e..0x015f`. |
| No audio or audio ignores phone volume buttons | Built with older stub `sailfish_audio.cpp`, or `PULSE_PROP_media.role` overridden/unset. | Ensure the SDL2 audio `sailfish_audio.cpp` is used (which sets `PULSE_PROP_media.role=x-maemo`), keep `"permissions": ["Audio"]` in `package.json`, and run with `GEA_AUDIO_DEBUG=1` to confirm `driver=pulseaudio` and `media.role=x-maemo`. |
| `pkcon install-local` says package already installed | Same `version-release` (`0.1.0-1`) is already on the device. | Bump `version` in `package.json` and rebuild, or run `devel-su rpm -Uvh --force /tmp/harbour-gea-kusursuzzamanlayici-0.1.0-1.aarch64.rpm`. |
| Docker chroot build cannot find volume or image | `sailfish-5.1.0.11-aarch64-build` volume or `sailfish-arm64-probe:local` image not initialized. | Set up the ARM64 Sailfish 5.1.0.11 sysroot volume via `sailfishos-macos-developmentkit` and install `SDL2-devel`, `libcurl-devel`, `maliit-framework-wayland-devel`, `gcc-c++`, `cmake`, and `rpm-build` inside it. |
