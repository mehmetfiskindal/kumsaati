# Kum Saati

An interval-repeating hourglass timer with audio cues, built with **GeaStack** and targeting **Web**, **iOS**, and **Sailfish OS (`aarch64`)**.

## Quick Start

```sh
npm install
npx gea doctor
npx gea dev
```

Web production build:

```sh
npx gea build --target web
```

iPhone/iPad simulator build and run:

```sh
npx gea build --target ios
npx gea run --target ios
```

Installing on a physical iOS device requires Apple code signing:

```sh
npx gea build --target ios --mode device
npx gea run --target ios --mode device
```

## App Behavior

The interval is adjusted with `−` and `+` in 5-second steps from 15 seconds to 6 minutes, with quick presets for 30, 35, 40, 45, and 50 seconds. Each cycle restarts automatically: short tones play during the final 5 seconds, double pulses during the final 2 seconds, and a distinct melody at the end of every cycle.

## Sailfish OS & GeaStack Documentation

- [Documentation Index](docs/README.md)
- [GeaStack Architecture & Example App](docs/geastack-architecture.md)
- [How GeaStack Runs Natively on Sailfish OS](docs/sailfish-os-architecture.md)
- [Sailfish OS Build, Packaging, and Device Installation Guide](docs/sailfish-os-build-and-install.md)
