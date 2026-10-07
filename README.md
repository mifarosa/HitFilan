# HitFilan
Home Gym PWA App — ev için kondisyon bisikleti zamanlayıcısı ve kuvvet devreleri.

## Özellikler
- **Bisiklet Akışı** (30 / 40 / 45 / 50 dk / 1 saat): boşta ısınma → orta → 1’er dk orta/ağır aralıklar → orta → boşta soğuma
- **Planlarım**: kendi planını bölümlerden kur; adım seçici ekipmana göre (Dumbbell / Vücut ağırlığı / Bisiklet / Diğer) ve fotoğraflı (her bölüm istediğin kadar tur tekrar eder); adım olarak bisiklet seviyeleri, hareket kütüphanesi, dinlenme ya da kendi yazdığın hareketler. Hazır planlar kopyalanıp düzenlenebilir.
- **Kuvvet devreleri** (vücut ağırlığı + tek 7.5 kg dumbbell): Dumbbell Yağ Yakıcı, Vücut Ağırlığı HIIT, Kısa Kuvvet, Core Bitirici; çalış/dinlen/tur süreleri ayarlanabilir
- **Bisiklet + Core** kombinasyonu
- Müziğin üzerine çalan bip sesleri (3-2-1, geçiş, taraf değiştir), isteğe bağlı Türkçe sesli anons, titreşim
- Ekranı açık tutma (Wake Lock), ekran arka plana geçse bile doğru kalan zamanlayıcı
- Takvim: haftalık hedef ve seri, ay görünümü, tahmini kalori
- Hedefler: 30 günlük squat / şınav / mekik / plank meydan okumaları ve "1 ayda 1000 mekik" gibi kendi toplam hedefin
- İsteğe bağlı bulut yedeği (Google ile giriş, Firebase)
- Çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```

Canlı adres: https://hitfilan.mifarosa.com (GitHub Pages, `main` dalı, kök klasör; alan adı `CNAME` dosyasında).

## Bulut yedeği (Firebase)
Ayarlar → **Bulut yedeği** ile Google hesabıyla giriş yapılınca antrenman geçmişi, planlar, hedefler ve ayarlar Firestore'a kaydedilir ve cihazlar arasında eşitlenir. Uygulama önce telefondaki veriyle çalışır; internet yokken yapılan değişiklikler bağlanınca yüklenir. Aynı kayıt iki yerde değiştiyse en yenisi geçerli olur, silinen kayıtlar her yerde silinir.

- Kod: `js/sync.js` (Firebase bağlantısı), `js/sync-core.js` (birleştirme kuralları), `js/store.js` (değişiklik takibi), `js/firebase-config.js` (proje ayarları).
- Veri yolu: `users/{uid}/items/{docId}`; kurallar `firestore.rules` içinde.
- `js/firebase-config.js` boşken (`null`) bulut yedeği uygulamada görünmez.

### Firebase kurulumu (bir kerelik)
1. [console.firebase.google.com](https://console.firebase.google.com) → **Proje ekle** → ad: `hitfilan` (Google Analytics gerekmez).
2. **Build → Authentication → Get started → Sign-in method → Google** → Enable → Save.
3. **Authentication → Settings → Authorized domains** → `hitfilan.mifarosa.com` ekle.
4. **Build → Firestore Database → Create database** → konum `eur3 (europe-west)` → production mode.
5. **Firestore → Rules** → `firestore.rules` dosyasını yapıştır → **Publish**.
6. **Project settings → General → Your apps → Web (`</>`)** → uygulama adı `HitFilan` → kaydet; gösterilen `firebaseConfig` nesnesini `js/firebase-config.js` içine koy.

## Kaynaklar
Hareket fotoğrafları [free-exercise-db](https://github.com/yuhonas/free-exercise-db) projesinden alınmıştır (Unlicense, kamu malı). Görseller 480 px WebP'ye küçültülüp `img/ex/` altında saklanır.
