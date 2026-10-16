# Tekstil ürün maliyeti

Kumaş fiyatını TL/kg, bir ürünün kullandığı kumaş ağırlığını gram olarak girin. Kaşkorse, dikim, kesim, ambalaj ve özel giderleri ürün başına TL cinsinden ekleyin veya silin. Toplam otomatik hesaplanır. Bilgiler aynı tarayıcının localStorage alanında saklanır; sunucuya gönderilmez.

## Çalıştırma

Python 3 ve Node.js 18+ ile çalışır; uygulama için paket kurulumu gerekmez.

```sh
cd /workspace/maliyet
npm start
```

Sunucu 3000 portunda çalışır. Node.js 18+ ile birim testleri: `npm test`.

Gramaj g/m² değil, ürün başına kullanılan toplam gramdır. Kumaş maliyeti = TL/kg × gram / 1000. KDV, fire ve diğer giderler otomatik eklenmez; gerekirse ayrı gider satırı olarak girilir.

## İndirme ve paylaşma

- **Hesabı indir:** Ürün adı, tarih, kumaş fiyatı, gramaj, tüm giderler ve toplamı Türkçe ondalık biçimiyle CSV dosyasına kaydeder. Excel ve Numbers’da açılabilir.
- **PDF olarak kaydet:** Aynı hesabı A4 PDF olarak indirir. Türkçe karakterler ve TL simgesi desteklenir; uzun gider listeleri yeni sayfalara taşar. iPhone’da önizleme açılırsa Paylaş → Dosyalara Kaydet kullanılabilir.
- **Müşteriyle paylaş:** Destekleyen iPhone/Safari ve diğer tarayıcılarda sistemin paylaş menüsünü açar. Kullanıcı WhatsApp, Mail veya başka bir hedef seçerek PDF’yi gönderir. Dosya paylaşımı yoksa hesap özeti metin olarak paylaşılır. Paylaş menüsü olmayan tarayıcılarda PDF indirilir.

Yerel paylaşım HTTPS veya localhost gerektirir; düz HTTP üzerindeki uzak adreslerde kullanılamayabilir. Gönderilecek uygulama ve müşteri cihazın paylaş menüsünde seçilir. Paylaşımı iptal etmek hesabı değiştirmez.

PDF ve CSV tarayıcıda hazırlanır; sunucuya veri gönderilmez. PDF kitaplığı ve yazı tipi `vendor/` içindedir; harici CDN gerekmez. Kaynak ve lisans bilgileri için `vendor/README.md` dosyasına bakın.

## Tarayıcı testleri

Tarayıcı testleri için Node.js 20+ gerekir. İlk kurulum:

```sh
npm ci
npx playwright install chromium
```

```sh
npm test
npm run test:browser
```

Sistemde `/usr/bin/chromium` varsa testler onu kullanır. Başka bir kurulum için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` verilebilir. Tarayıcı testleri kendi geçici sunucusunu başlatır; indirme, PDF, mobil görünüm ve paylaşım API’sinin başarı/iptal/hata durumlarını sınar. iPhone paylaş menüsü otomasyonda taklit edilir; gerçek WhatsApp/Mail gönderimi cihazda elle doğrulanmalıdır.
