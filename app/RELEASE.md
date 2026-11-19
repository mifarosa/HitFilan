# HitFilan'ı TestFlight'a (ve sonra App Store'a) yüklemek

Bu adımlar iPhone için. Derleme ve gönderme Expo'nun bulutunda (EAS) yapılır, Mac gerekmez. Apple girişi
etkileşimli olduğu için komutları kendi bilgisayarında (ya da sunucuda, terminali açık) çalıştırırsın.

## Bir kerelik hazırlık

1. **Apple Developer hesabı** (yıllık 99 $) açık olsun: developer.apple.com. Wasorty için kullandığın hesap yeterli.
2. **App Store Connect'te uygulama kaydı:** appstoreconnect.apple.com → My Apps → **+** → New App.
   Platform iOS, ad **HitFilan**, ana dil Turkish, Bundle ID **com.mifarosa.hitfilan**, SKU `hitfilan`.
   (Bundle ID listede yoksa developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → + ile ekle;
   EAS ilk derlemede kendisi de oluşturabilir.)
3. Kayıt açılınca **App Information → Apple ID** (sayı) alanını `app/eas.json` içindeki
   `submit.production.ios.ascAppId` yerine yaz (`REPLACE_WITH_APP_STORE_CONNECT_APPLE_ID`).
4. Bilgisayarda:
   ```bash
   cd app
   npm install
   npx eas-cli login          # expo.dev hesabın (owner: mifarosacom)
   npx eas-cli init           # projeyi bu hesaba bağlar, app.json'a extra.eas.projectId yazar
   ```
   `eas init` sonrası değişen `app.json`'u commit'le.

## Derleme ve yükleme

```bash
cd app
npx eas-cli build -p ios --profile production   # Apple ID'nle giriş ister; sertifikaları EAS yönetir
npx eas-cli submit -p ios --latest              # App Store Connect'e yükler
```

Derleme sürüm numarasını EAS uzaktan artırır (`appVersionSource: remote`). Yüklemeden sonra App Store Connect
işlemeyi bitirmek için 10–30 dakika alır (e-posta gelir).

## TestFlight ile kendi iPhone'unda dene (Apple incelemesi yok)

1. App Store Connect → uygulama → **TestFlight** → **Internal Testing** → grup oluştur (ör. "Ben") → kendi Apple ID'ni ekle.
2. iPhone'a App Store'dan **TestFlight**'ı kur, aynı Apple ID ile aç → HitFilan'ı **Install**.
   Geliştirici Modu ya da cihaz kaydı gerekmez. Her yeni derleme TestFlight'ta güncelleme olarak çıkar.

## Expo Go ile fark

TestFlight derlemesi gerçek uygulamadır: **özel bildirim sesleri** (`assets/sounds/*.wav`) ve kilitli ekranda
bildirimler tam çalışır. Expo Go'da bildirimler varsayılan sesle gelir.

Geliştirirken gerçek derleme istersen (hızlı denemek için, TestFlight beklemeden):
`npx eas-cli build -p ios --profile development` (cihaz kaydı ister), ya da Android için APK.

## App Store'a yayın (sonra)

Apple incelemesi ister:

- Gizlilik politikası adresi: `https://hitfilan.mifarosa.com/privacy.html` (depoda `privacy.html`)
- App Privacy formu: veriler cihazda; isteğe bağlı Firebase yedeği (Google hesabı); yapay zekâ anahtarı yalnızca
  cihazda, istekler doğrudan kullanıcının seçtiği sağlayıcıya gider
- Ekran görüntüleri, açıklama, yaş derecesi, inceleme notu (inceleyici yapay zekâ özelliğini denemek için
  kendi anahtarını girer; anahtarsız uygulama tam çalışır, yapay zekâ özellikleri isteğe bağlıdır)

## Her sürümden önce

```bash
cd app && npm run typecheck && npm test && npm run bundle
```

Simgeler `node tools/make-icon.mjs` ile `icons/icon.svg`'den üretilir (1024×1024, saydamsız).
