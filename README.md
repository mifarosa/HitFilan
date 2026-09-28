# HitFilan
Home Gym PWA App — ev için kondisyon bisikleti zamanlayıcısı ve kuvvet devreleri.

## Özellikler
- **Bisiklet Akışı** (30 / 40 / 45 / 50 dk / 1 saat): boşta ısınma → orta → 1’er dk orta/ağır aralıklar → orta → boşta soğuma
- **Kuvvet devreleri** (vücut ağırlığı + tek 7.5 kg dumbbell): Dumbbell Yağ Yakıcı, Vücut Ağırlığı HIIT, Kısa Kuvvet, Core Bitirici; çalış/dinlen/tur süreleri ayarlanabilir
- **Bisiklet + Core** kombinasyonu
- Müziğin üzerine çalan bip sesleri (3-2-1, geçiş, taraf değiştir), isteğe bağlı Türkçe sesli anons, titreşim
- Ekranı açık tutma (Wake Lock), ekran arka plana geçse bile doğru kalan zamanlayıcı
- Haftalık özet, antrenman geçmişi ve tahmini kalori
- Çevrimdışı çalışır, ana ekrana eklenebilir

## Çalıştırma
Derleme adımı yok; herhangi bir statik sunucu yeterli:

```sh
npx http-server -p 8080 .
```

GitHub Pages ile de yayınlanabilir (tüm yollar göreli).
