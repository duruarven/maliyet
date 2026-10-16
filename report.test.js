const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('./report');

const date = new Date('2026-10-15T12:30:00.000Z');
const state = () => ({
  product: 'Çağrı Örme', price: '200', grams: '250',
  expenses: [
    { name: 'Kaşkorse', amount: '5' },
    { name: 'Dikim', amount: '20' },
    { name: 'Kesim', amount: '8' },
    { name: 'Ambalaj', amount: '2' }
  ]
});

// Parse quoted cells so assertions also cover semicolons, quotes and line breaks.
function csvRows(csv) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = csv.charCodeAt(0) === 0xfeff ? 1 : 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ';') {
      row.push(cell); cell = '';
    } else if (!quoted && (char === '\r' || char === '\n')) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  assert.equal(quoted, false, 'CSV must close quoted cells');
  return rows;
}

test('rapor, hesapla aynı tutarları ve değişmez bir anlık görüntüyü içerir', () => {
  const source = state();
  const report = Report.create(source, date);
  assert.equal(report.product, 'Çağrı Örme');
  assert.equal(report.price, 200);
  assert.equal(report.grams, 250);
  assert.equal(report.fabric, 50);
  assert.equal(report.expenseTotal, 35);
  assert.equal(report.total, 85);
  assert.equal(report.date, date.toISOString());
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.expenses));
  assert.ok(report.expenses.every(Object.isFrozen));
  source.product = 'Değişti';
  source.expenses[0].name = 'Değişti';
  source.expenses[0].amount = 999;
  assert.equal(report.product, 'Çağrı Örme');
  assert.equal(report.expenses[0].name, 'Kaşkorse');
  assert.equal(report.expenses[0].amount, 5);
  assert.equal(report.total, 85);
});

test('boş veya bozuk kayıtlar ve ondalık virgüller güvenle normalleştirilir', () => {
  for (const source of [undefined, null, {}, { expenses: null }, { expenses: [null, false, {}] }]) {
    const report = Report.create(source, date);
    assert.ok(Number.isFinite(report.total));
    assert.equal(report.total, 0);
    assert.ok(Array.isArray(report.expenses));
  }
  const report = Report.create({ price: '100,50', grams: '200', expenses: [{ name: 'Dikim', amount: '2,50' }, { name: 'Hatalı', amount: -4 }] }, date);
  assert.equal(report.fabric, 20.1);
  assert.equal(report.expenseTotal, 2.5);
  assert.equal(report.total, 22.6);
});

test('Türkçe metin çıktısı ürün, girdiler, giderler ve toplamları içerir', () => {
  const text = Report.toText(Report.create(state(), date));
  for (const expected of ['Çağrı Örme', 'Kaşkorse', 'Dikim', 'Kesim', 'Ambalaj', '200', '250', '50,00', '85,00']) {
    assert.ok(text.includes(expected), `missing text: ${expected}`);
  }
});

test('CSV, Excel için BOM kullanır; Türkçe, noktalı virgül ve tırnakları korur, satırları normalleştirir', () => {
  const source = state();
  source.product = 'Çağrı; "Örme"\nYeni ürün';
  source.expenses[0].name = 'İşçilik; "özel"\r\nŞube';
  const csv = Report.toCsv(Report.create(source, date));
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes(';'));
  const cells = csvRows(csv).flat();
  assert.ok(cells.includes('Çağrı; "Örme" Yeni ürün'));
  assert.ok(cells.includes('İşçilik; "özel" Şube'));
  assert.ok(cells.includes('85,00'));
  assert.ok(cells.includes('50,00'));
});

test('CSV ürün ve gider adlarındaki formül enjeksiyonunu engeller', () => {
  for (const hostile of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '  =1+1', '\t=1+1', '\r\n=1+1']) {
    const report = Report.create({ product: hostile, expenses: [{ name: hostile, amount: 1 }] }, date);
    const cells = csvRows(Report.toCsv(report)).flat();
    assert.ok(!cells.some(cell => /^[\s\u0000-\u001f]*[=+@-]/u.test(cell)), `unsafe formula cell for ${JSON.stringify(hostile)}`);
    assert.ok(cells.some(cell => cell.includes(hostile.trim())), 'user text remains readable');
  }
});

test('dosya adları Türkçe ürün adını taşır, yol ve denetim karakterlerini içermez', () => {
  const report = Report.create({ product: '../../Çağrı Örme\\:*?<>|\u0000' }, date);
  for (const extension of ['pdf', 'csv']) {
    const filename = Report.filename(report, extension);
    assert.match(filename, /^[a-zA-Z0-9_.-]+$/);
    assert.match(filename, new RegExp(`\\.${extension}$`));
    assert.ok(filename.toLowerCase().includes('cagri'));
    assert.ok(!filename.includes('..'));
    assert.ok(filename.length < 200);
  }
  assert.ok(Report.filename(Report.create({}, date), 'pdf').length > 4);
});

test('PDF eşzamanlı Blob olarak oluşur ve gerçek PDF belgesi içerir', async () => {
  const pdf = Report.toPdf(Report.create(state(), date));
  assert.ok(pdf instanceof Blob, 'iPhone paylaşımı için Promise yerine doğrudan Blob gerekir');
  assert.equal(pdf.type, 'application/pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.ok(bytes.length > 1000);
  assert.ok(new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF'));
});

test('uzun ürün ve gider adlarını içeren PDF birden çok sayfaya bölünür', async () => {
  const report = Report.create({
    product: 'Çağrı Örme uzun ürün açıklaması '.repeat(18),
    price: 200,
    grams: 250,
    expenses: Array.from({ length: 80 }, (_, index) => ({
      name: `Gider ${index + 1}: ${'İşçilik, kesim ve özel ambalaj açıklaması '.repeat(4)}`,
      amount: index + 1
    }))
  }, date);
  const pdf = Report.toPdf(report);
  const body = new TextDecoder('latin1').decode(await pdf.arrayBuffer());
  const pages = body.match(/\/Type\s*\/Page\b/g) || [];
  assert.ok(pages.length > 1, 'long reports require multiple pages instead of clipping');
  assert.ok(pages.length < 100, 'pagination should not create runaway empty pages');
});
