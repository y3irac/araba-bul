# Araba Bul

Yakın çekim fotoğraftan arabanın modelini bilme oyunu. Açık temalı, mobil uyumlu PWA; ileride Capacitor ile iOS ve Android paketine sarılabilir.

## Oyun

- **3 kategori:** Arka Stop, Ön Far, Kokpit.
- **2 seviye:**
  - **Ekspert:** marka ve modeli bil. 20 saniye, turda bir 50:50 hakkı.
  - **ProEkspert:** nesli ve kasa kodunu da bil (şıklarda aynı modelin diğer nesilleri çıkar). Fotoğraf yakın kadrajla açılır, 12 saniye, joker yok.
- Tur 10 soru. Puan: doğru cevap + kalan saniye bonusu, seri arttıkça %10'ar artar (en fazla %50).
- **Günün Turu:** herkes için aynı 10 soru, üç kategoriden karışık, günde bir kez. Sonuç 🟩🟥 dizisiyle paylaşılır.
- **Meydan okuma:** her turun sonunda bir kod ve link çıkar (`#m-a-e-1x9k3f-1840`). Arkadaşın aynı 10 soruyu oynar ve senin puanını hedef olarak görür. Kod ana sayfadaki kutuya da yazılabilir.
- **Görevler:** her gün 3 (biri her zaman Günün Turu), her hafta 3 görev. Bitince XP otomatik eklenir. Gün serisi, seviye ve unvan (Çırak → Efsane).
- **Garaj:** ilk kez doğru bildiğin araç koleksiyona girer; marka filtresi var.

İlerleme oyuncunun kendi tarayıcısında (localStorage) tutulur. Genel sıralama tablosu için bir sunucu gerekir; bu sürümde yok.

## Çalıştırma

```
cd "araba bul"
python -m http.server 8080
```

Tarayıcıda `http://localhost:8080` adresini aç. Yayına almak için klasörü olduğu gibi bir statik barındırmaya (Netlify, Vercel, Cloudflare Pages, GitHub Pages) yükle. HTTPS altında "Ana ekrana ekle" ile uygulama gibi kurulur.

## Yayın

Site GitHub Pages'te yayınlanır: **https://y3irac.github.io/araba-bul/**. `main` dalına gönderilen her değişiklik bir iki dakika içinde yayına çıkar.

- `config.js` sitenin adresini ve reklam ayarlarını tutar.
- `gizlilik.html` gizlilik sayfası (ana sayfanın altından bağlantılı).
- `og.jpg` WhatsApp, X, Instagram gibi yerlerde link paylaşılınca çıkan 1200×630 görsel.
- `robots.txt`, `sitemap.xml` arama motorları için; `404.html` bulunamayan sayfaları oyuna yönlendirir.
- Yeni sürüm yayınlarken `sw.js` içindeki `V` adını artır ki oyuncuların tarayıcısı eski dosyaları bıraksın.

**Kendi alan adını bağlamak (ör. amblemsiz.com):** alan adını al, DNS'te `y3irac.github.io` adresine CNAME (kök alan için GitHub'ın dört A kaydı) tanımla, depoda Settings → Pages → Custom domain'e adı yaz ve "Enforce HTTPS"i aç. Sonra `config.js`, `index.html` (canonical ve og: satırları), `robots.txt`, `sitemap.xml` ve `404.html` içindeki adresi yenisiyle değiştir.

## Reklamlar

Sayfada `data-ad-slot` taşıyan dört alan var. `config.js` içinde `ads.mode` üç değer alır:

| mode | Ne olur |
| --- | --- |
| `off` | Alanlar gizli (şu anki ayar). Geniş ekranda sağ sütun da kapanır, oyun ortalanır |
| `preview` | Kesikli çerçeveli yer tutucular görünür, tasarım için |
| `adsense` | `client` ve `slots` doluysa gerçek AdSense reklamı yüklenir; ilk girişte çerez onayı sorulur, reddedilirse reklamlar kişiselleştirilmeden gösterilir |

| Slot | Boyut | Nerede |
| --- | --- | --- |
| `top` | 728×90 | Masaüstü/tablet, üst bant (oyun sırasında gizlenir) |
| `rail` | 300×600 | 1120px ve üstü ekranlarda sağ sütun, yapışkan |
| `home-bottom` | 320×100 (tablette 728×90) | Ana sayfanın sonu |
| `result` | 300×250 | Tur sonucu ekranı |

Soru sırasında ekranda reklam yok. AdSense başvurusu için sitenin kendi alan adında olması gerekir (`ads.txt` dosyası alan adının köküne konur; `github.io/araba-bul` altında bu mümkün değil).

## Dosyalar

| Dosya | İçerik |
| --- | --- |
| `index.html` | Uygulama kabuğu (`body.html` aynı içeriğin Claude önizleme sürümü) |
| `config.js` | Site adresi ve reklam ayarları |
| `styles.css` | Açık tema ve tüm ekranlar |
| `app.js` | Oyun motoru: kategoriler, seviyeler, Günün Turu, meydan okuma, görevler, garaj |
| `data.js` | 184 araçlık katalog ve fotoğraf hakları (`tools/build_data.py` üretir) |
| `img/` | 524 kare, 800×600 WebP: `-tail` stop, `-head` far, `-interior` kokpit. Amblem, model yazısı ve plakalar kapatıldı |
| `credits.json` | Her fotoğrafın yazarı, lisansı ve Wikimedia Commons sayfası |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: çevrimdışı çalışma ve ana ekran ikonu |
| `tools/kutuphane.json` | Wikidata'dan 40 markanın 4.735 modeli (ileride yeni araç seçmek için) |

## Yeni araba eklemek

1. Kareyi 4:3 kırp, logo ve plakayı kapat, `img/<arac-id>-tail.webp` (ya da `-head`, `-interior`; ikinci kare için `-tail-2`) olarak kaydet.
2. `credits.json` dosyasına fotoğrafın yazarını, lisansını ve kaynağını ekle.
3. `tools/build_data.py` içindeki `CARS` listesine aracı ekle (marka, model, nesil, kasa kodu, yıllar, makyaj yılı, ülke, grup, gövde, segment, zorluk).
4. `python tools/build_data.py` çalıştır; `data.js` yeniden oluşur.
5. `sw.js` içindeki `V` sürüm adını artır.

## Fotoğraflar

415 fotoğrafın tamamı Wikimedia Commons'tan, özgür lisanslı. Oyunda Garaj → Fotoğraf hakları bölümünde ve her cevaptan sonra fotoğrafın altında yazar ve lisans görünür. CC BY-SA lisanslı kareler kırpılıp değiştirildiği için aynı lisansla paylaşılmalı.
