# HitFilan
Home Gym PWA App — ev için kondisyon bisikleti zamanlayıcısı ve kuvvet devreleri.

## Özellikler
- **Bisiklet Akışı** (30 / 40 / 45 / 50 dk / 1 saat): boşta ısınma → orta → 1’er dk orta/ağır aralıklar → orta → boşta soğuma
- **Ana sayfa**: kişisel özet (yarım kalan antrenman, bugünkü hedefler, haftalık seri) ve yan yana Beslenme ile Serbest sayaç kartları
- **Hareketler** sekmesi: *Öneriler* (bisiklet akışları, kuvvet devreleri), *Planlarım* ve *Hareketler* (43 hareket; ekipmana ve bölgeye göre süzülür, fotoğraflı)
- **Planlarım**: bir hareket seç, set / tekrar (ya da süre) / kg / setler arası dinlenmeyi tek küçük formda gir; hareketleri sürükleyerek ya da oklarla sırala. Hareketler tek tek ilerler, tekrarlı setleri sen "yaptım" diyerek geçersin. Eski bölümlü planlar açılırken düz listeye çevrilir.
- **Serbest sayaç**: tek dev sayaç, istersen doz; ekran açık kalır
- **Paylaşım görselleri**: bitiş görseli (Arka planlı, 9:16 ve 16:9 boş kareli, Saydam, Çizgi)
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

## Beslenme (kalori dengesi)

Ayarlar'a boy, yaş ve cinsiyet girilince günlük ihtiyaç hesaplanır; yenenler "Beslenme" ekranına yazılır
(serbest metin → yapay zekâ kcal tahmini, her zaman düzeltilebilir ya da elle girilebilir). Kalori fazlası için
bisiklet/dumbbell programları önerilir. Yapay zekâ için Firebase konsolunda **AI Logic → Gemini Developer API**
(ücretsiz, kart gerekmez) açılmalı. Yemek kayıtlarının yedeklenmesi için `firestore.rules` yeniden yayınlanmalı.

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
