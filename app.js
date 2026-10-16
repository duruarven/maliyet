const defaults = () => ({ product: '', price: '', grams: '', expenses: ['Kaşkorse', 'Dikim', 'Kesim', 'Ambalaj'].map(name => ({ name, amount: '' })) });
const key = 'maliyet-v1';
let state = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && Array.isArray(saved.expenses)) state = { product: String(saved.product || ''), price: saved.price || '', grams: saved.grams || '', expenses: saved.expenses.filter(x => x && typeof x.name === 'string').map(x => ({ name: x.name, amount: x.amount || '' })) };
} catch {}
const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
const byId = id => document.getElementById(id);
function update() {
  byId('export-status').textContent = '';
  const result = Cost.calculate(state.price, state.grams, state.expenses);
  byId('fabric').textContent = money(result.fabric);
  byId('total').textContent = money(result.total);
  const breakdown = byId('breakdown');
  breakdown.replaceChildren();
  [{ name: 'Kumaş', amount: result.fabric }, ...state.expenses].forEach(item => {
    const row = document.createElement('div'); row.className = 'breakdown-row';
    const label = document.createElement('span'); label.textContent = item.name || 'Diğer gider';
    const value = document.createElement('strong'); value.textContent = money(Cost.amount(item.amount));
    row.append(label, value); breakdown.append(row);
  });
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { byId('save-status').textContent = 'Tarayıcıda kayıt yapılamadı. Bilgiler yalnızca bu oturumda tutuluyor.'; }
}
function render() {
  ['product', 'price', 'grams'].forEach(id => {
    const input = byId(id);
    input.value = state[id];
    if (id !== 'product') input.setCustomValidity(input.validity.rangeUnderflow ? 'Negatif değer giremezsiniz.' : '');
  });
  byId('expenses').replaceChildren();
  state.expenses.forEach((item, index) => {
    const row = document.createElement('div'); row.className = 'expense';
    const name = document.createElement('input'); name.value = item.name; name.placeholder = 'Gider adı'; name.maxLength = 100; name.setAttribute('aria-label', `Gider ${index + 1} adı`);
    name.addEventListener('input', () => { item.name = name.value; update(); });
    const amount = document.createElement('input'); amount.type = 'number'; amount.min = '0'; amount.step = '0.01'; amount.inputMode = 'decimal'; amount.placeholder = '0,00 TL'; amount.value = item.amount; amount.setAttribute('aria-label', `Gider ${index + 1} tutarı (TL)`);
    amount.addEventListener('input', () => { amount.setCustomValidity(amount.validity.rangeUnderflow ? 'Negatif gider giremezsiniz.' : ''); item.amount = amount.value; update(); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `${item.name || 'Gider'} giderini sil`);
    remove.addEventListener('click', () => { state.expenses.splice(index, 1); render(); byId('add').focus(); });
    row.append(name, amount, remove); byId('expenses').append(row);
  });
  update();
}
['product', 'price', 'grams'].forEach(id => byId(id).addEventListener('input', event => {
  state[id] = event.target.value;
  if (id !== 'product') event.target.setCustomValidity(event.target.validity.rangeUnderflow ? 'Negatif değer giremezsiniz.' : '');
  update();
}));
byId('add').addEventListener('click', () => { state.expenses.push({ name: '', amount: '' }); render(); byId('expenses').lastElementChild.firstElementChild.focus(); });
byId('reset').addEventListener('click', () => { if (confirm('Tüm tutarlar ve eklediğiniz giderler sıfırlansın mı?')) { state = defaults(); render(); } });

function exportStatus(message) {
  byId('export-status').textContent = message;
}

function currentReport() {
  for (const input of document.querySelectorAll('input[type="number"]')) {
    if (!input.reportValidity()) {
      exportStatus('Kaydetmeden veya paylaşmadan önce işaretli tutarı düzeltin.');
      return null;
    }
  }
  const report = CostReport.create(state);
  if (!Number.isFinite(report.total)) {
    exportStatus('Tutarlar hesaplanamayacak kadar büyük. Daha küçük değerler girin.');
    return null;
  }
  return report;
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari needs the URL to stay available while it starts the download.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

byId('download-csv').addEventListener('click', () => {
  const report = currentReport();
  if (!report) return;
  try {
    downloadFile(new Blob([CostReport.toCsv(report)], { type: 'text/csv;charset=utf-8' }), CostReport.filename(report, 'csv'));
    exportStatus('CSV dosyası hazır. İndirilenler’den Excel veya Numbers ile açabilirsiniz.');
  } catch {
    exportStatus('Hesap indirilemedi. Lütfen yeniden deneyin.');
  }
});

byId('save-pdf').addEventListener('click', () => {
  const report = currentReport();
  if (!report) return;
  try {
    downloadFile(CostReport.toPdf(report), CostReport.filename(report, 'pdf'));
    exportStatus('PDF dosyası hazır. iPhone’da önizleme açılırsa Paylaş → Dosyalara Kaydet’i seçin.');
  } catch {
    exportStatus('PDF oluşturulamadı. Lütfen yeniden deneyin veya hesabı CSV olarak indirin.');
  }
});

const nativeShareAvailable = () => window.isSecureContext && typeof navigator.share === 'function';
if (!nativeShareAvailable()) {
  byId('share-hint').textContent = 'Bu tarayıcıda paylaş menüsü desteklenmiyor. PDF’yi kaydedip müşterinize gönderebilirsiniz.';
}

byId('share').addEventListener('click', async () => {
  const report = currentReport();
  if (!report) return;
  const buttons = ['download-csv', 'save-pdf', 'share'].map(byId);
  buttons.forEach(button => { button.disabled = true; });
  byId('share').setAttribute('aria-busy', 'true');
  try {
    if (!nativeShareAvailable()) {
      downloadFile(CostReport.toPdf(report), CostReport.filename(report, 'pdf'));
      exportStatus('Bu tarayıcıda paylaş menüsü desteklenmiyor. Hazırlanan PDF’yi indirip müşterinize gönderebilirsiniz.');
      return;
    }
    let sharedFile = false;
    let shareData = { title: `${report.product || 'Ürün'} · Maliyet hesabı`, text: CostReport.toText(report) };
    if (typeof navigator.canShare === 'function' && typeof File === 'function') {
      try {
        const file = new File([CostReport.toPdf(report)], CostReport.filename(report, 'pdf'), { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          shareData = { title: shareData.title, files: [file] };
          sharedFile = true;
        }
      } catch {
        // Some browsers expose share() but cannot inspect or share PDF files.
      }
    }
    // Keep share() in the click's activation: no fetching or asynchronous PDF work first.
    await navigator.share(shareData);
    exportStatus(sharedFile ? 'PDF paylaşım uygulamasına aktarıldı.' : 'Hesap özeti paylaşım uygulamasına aktarıldı. PDF için “PDF olarak kaydet”i kullanabilirsiniz.');
  } catch (error) {
    if (error?.name === 'AbortError') {
      exportStatus('Paylaşım iptal edildi.');
    } else {
      exportStatus('Paylaşım açılamadı. PDF olarak kaydedip dosyayı müşterinize gönderebilirsiniz.');
    }
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    byId('share').removeAttribute('aria-busy');
  }
});
render();
