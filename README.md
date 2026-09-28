# Kum Saati

GeaStack ile hazırlanmış, ayarlanabilir aralıklarla tekrar eden sesli zamanlayıcı.

```sh
npm install
npx gea doctor
npx gea dev
```

Web üretim derlemesi için:

```sh
npx gea build --target web
```

iPhone/iPad simülatör derlemesi ve çalıştırması için:

```sh
npx gea build --target ios
npx gea run --target ios
```

Gerçek cihaza yüklemek için Apple geliştirme imzası gerekir:

```sh
npx gea build --target ios --mode device
npx gea run --target ios --mode device
```

Aralık `−` ve `+` düğmeleriyle 15 saniye ile 6 dakika arasında 5 saniyelik adımlarla ayarlanır. Hızlı seçimler 30, 35, 40, 45 ve 50 saniyedir. Her döngü otomatik yenilenir; son 5 saniyede kısa sesler, son 2 saniyede çift vuruş, döngü sonunda ayrı bir melodi çalar.
