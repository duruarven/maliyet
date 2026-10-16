(function (root) {
  const Cost = typeof module !== 'undefined' && module.exports ? require('./cost') : root.Cost;
  const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  const number = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(value);
  const singleLine = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  const displayDate = report => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.date));

  function create(state, date = new Date()) {
    state = state && typeof state === 'object' ? state : {};
    const expenses = (Array.isArray(state.expenses) ? state.expenses : []).filter(item => item && typeof item === 'object').map(item => Object.freeze({
      name: singleLine(item.name) || 'Diğer gider',
      amount: Cost.amount(item.amount),
    }));
    const price = Cost.amount(state.price);
    const grams = Cost.amount(state.grams);
    const result = Cost.calculate(price, grams, expenses);
    return Object.freeze({
      product: singleLine(state.product), price, grams,
      expenses: Object.freeze(expenses),
      fabric: result.fabric, total: result.total,
      expenseTotal: expenses.reduce((sum, item) => sum + item.amount, 0),
      date: new Date(date).toISOString(),
    });
  }

  function filename(report, extension) {
    if (!['csv', 'pdf', 'txt'].includes(extension)) throw new TypeError('Desteklenmeyen dosya türü');
    const stem = (report.product || 'urun').replace(/ı/g, 'i').normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .slice(0, 64).replace(/^-+|-+$/g, '') || 'urun';
    return `maliyet-${stem}-${report.date.slice(0, 10)}.${extension}`;
  }

  function toCsv(report) {
    const decimal = value => value.toFixed(2).replace('.', ',');
    const rows = [
      ['Kalem', 'Değer', 'Birim'],
      ['Ürün', report.product || 'Adsız ürün', ''],
      ['Tarih', displayDate(report), ''],
      ['Kumaş fiyatı', decimal(report.price), 'TL/kg'],
      ['Ürün başına kumaş', String(report.grams).replace('.', ','), 'gram'],
      ['Kumaş maliyeti', decimal(report.fabric), 'TL/ürün'],
      ...report.expenses.map(item => [item.name, decimal(item.amount), 'TL/ürün']),
      ['Ek giderler toplamı', decimal(report.expenseTotal), 'TL/ürün'],
      ['Toplam maliyet', decimal(report.total), 'TL/ürün'],
    ];
    const cell = value => {
      let text = String(value);
      // Quoting alone does not prevent Excel/Numbers from evaluating formulas.
      if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
  }

  function toText(report) {
    return [
      'MALİYET HESABI',
      `Ürün: ${report.product || 'Adsız ürün'}`,
      `Tarih: ${displayDate(report)}`,
      '',
      `Kumaş fiyatı: ${money(report.price)} / kg`,
      `Ürün başına kumaş: ${number(report.grams)} gram`,
      `Kumaş maliyeti: ${money(report.fabric)}`,
      ...report.expenses.map(item => `${item.name}: ${money(item.amount)}`),
      `Ek giderler toplamı: ${money(report.expenseTotal)}`,
      '',
      `TOPLAM MALİYET / ÜRÜN: ${money(report.total)}`,
      'Kumaş ve eklenen giderlerin toplamıdır. KDV ve fire otomatik eklenmez.',
    ].join('\n');
  }

  function toPdf(report) {
    if (!Number.isFinite(report.total)) throw new RangeError('Geçersiz toplam');
    const inNode = typeof module !== 'undefined' && module.exports;
    const { jsPDF } = inNode ? require('./vendor/jspdf.umd.min.js') : root.jspdf;
    const font = inNode ? require('./vendor/report-font.js') : root.CostReportFont;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
    pdf.addFileToVFS('ReportSans.ttf', font);
    pdf.addFont('ReportSans.ttf', 'ReportSans', 'normal');
    pdf.setFont('ReportSans');
    pdf.setProperties({ title: `${report.product || 'Ürün'} - Maliyet hesabı`, author: 'M / MALİYET' });

    const left = 18;
    const right = 192;
    const bottom = 274;
    let y = 20;
    const ink = () => pdf.setTextColor(37, 60, 52);
    function ensure(height) {
      if (y + height <= bottom) return;
      pdf.addPage();
      pdf.setFontSize(9);
      pdf.setTextColor(104, 128, 114);
      pdf.text('M / MALİYET · Maliyet hesabı', left, 18);
      y = 30;
    }
    function paragraph(text, size = 10) {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, right - left);
      for (const line of lines) {
        ensure(size * 0.48);
        pdf.setFontSize(size);
        ink();
        pdf.text(line, left, y);
        y += size * 0.48;
      }
    }
    function heading(text) {
      ensure(28);
      y += 6;
      paragraph(text, 13);
      y += 4;
    }
    function row(label, value, size = 10) {
      pdf.setFontSize(size);
      const labels = pdf.splitTextToSize(label, 108);
      const values = pdf.splitTextToSize(value, 60);
      for (let i = 0; i < Math.max(labels.length, values.length); i++) {
        ensure(size * 0.5);
        pdf.setFontSize(size);
        ink();
        if (labels[i]) pdf.text(labels[i], left, y);
        if (values[i]) pdf.text(values[i], right, y, { align: 'right' });
        y += size * 0.5;
      }
      y += 2;
    }

    paragraph('M / MALİYET', 10);
    y += 6;
    paragraph('Maliyet hesabı', 23);
    y += 3;
    paragraph(`Tarih: ${displayDate(report)}`, 9);
    y += 5;
    paragraph(report.product || 'Adsız ürün', 15);
    heading('Kumaş');
    row('Kumaş fiyatı', `${money(report.price)} / kg`);
    row('Ürün başına kumaş', `${number(report.grams)} gram`);
    row('Kumaş maliyeti / ürün', money(report.fabric));
    heading('Diğer giderler / ürün');
    if (!report.expenses.length) paragraph('Ek gider yok.');
    for (const item of report.expenses) row(item.name, money(item.amount));
    y += 3;
    row('Ek giderler toplamı', money(report.expenseTotal));
    heading('Toplam maliyet / ürün');
    row('TOPLAM', money(report.total), 15);
    y += 6;
    paragraph('Kumaş ve eklenen giderlerin toplamıdır. KDV, fire ve diğer giderler otomatik eklenmez.', 9);

    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setDrawColor(220, 226, 216);
      pdf.line(left, 280, right, 280);
      pdf.setTextColor(104, 128, 114);
      pdf.setFontSize(8);
      pdf.text('Ürün başına maliyet · TL', left, 286);
      pdf.text(`${page} / ${pages}`, right, 286, { align: 'right' });
    }
    return pdf.output('blob');
  }

  const api = { create, filename, toCsv, toText, toPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CostReport = api;
})(globalThis);
