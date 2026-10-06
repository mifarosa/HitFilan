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
- Çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```

Canlı adres: https://hitfilan.mifarosa.com (GitHub Pages, `main` dalı, kök klasör; alan adı `CNAME` dosyasında).

## Kaynaklar
Hareket fotoğrafları [free-exercise-db](https://github.com/yuhonas/free-exercise-db) projesinden alınmıştır (Unlicense, kamu malı). Görseller 480 px WebP'ye küçültülüp `img/ex/` altında saklanır.
