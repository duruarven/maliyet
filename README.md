# Tekstil ürün maliyeti

Kumaş fiyatını TL/kg, bir ürünün kullandığı kumaş ağırlığını gram olarak girin. Kaşkorse, dikim, kesim, ambalaj ve özel giderleri ürün başına TL cinsinden ekleyin veya silin. Toplam otomatik hesaplanır. Bilgiler aynı tarayıcının localStorage alanında saklanır; sunucuya gönderilmez.

## Çalıştırma

Python 3 ve Node.js 18+ yeterlidir; paket kurulumu gerekmez.

```sh
cd /workspace/maliyet
npm start
```

Sunucu 3000 portunda çalışır. Testler: `npm test`.

Gramaj g/m² değil, ürün başına kullanılan toplam gramdır. Kumaş maliyeti = TL/kg × gram / 1000. KDV, fire ve diğer giderler otomatik eklenmez; gerekirse ayrı gider satırı olarak girilir.
