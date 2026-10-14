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
  ['product', 'price', 'grams'].forEach(id => { byId(id).value = state[id]; });
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
render();
