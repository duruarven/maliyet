# PDF bağımlılıkları

Bu dosyalar yerel olarak sunulur; PDF oluşturma sırasında ağ isteği yapılmaz.

- `jspdf.umd.min.js`: [jsPDF 4.2.1](https://github.com/parallax/jsPDF), npm üzerindeki `jspdf@4.2.1` paketinin `dist/jspdf.umd.min.js` dosyası. MIT lisansı: `jspdf-LICENSE.txt`.
- `report-font.js`: DejaVu Sans 2.37 yazı tipinin base64 olarak saklanan Latin/Türkçe alt kümesi. Kaynak: Debian `fonts-dejavu-core` paketindeki `DejaVuSans.ttf`. Lisans: `DejaVu-LICENSE.txt`. PDF’ye gömülür; Türkçe harfleri ve ₺ simgesini kapsar.

Yazı tipi alt kümesi fontTools 4.61.1 ile hazırlandı:

```sh
pyftsubset DejaVuSans.ttf --output-file=report-font.ttf \
  --unicodes=U+0000-024F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2212,U+25A1 \
  --layout-features='*' --name-IDs='*' --name-languages='*' \
  --notdef-glyph --notdef-outline --recommended-glyphs
```

`report-font.js`, bu TTF dosyasının base64 içeriğini tarayıcıda `CostReportFont` adıyla, Node.js içinde `module.exports` üzerinden sunar.
