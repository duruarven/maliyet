(function (root) {
  function amount(value) {
    const number = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }
  function calculate(price, grams, expenses) {
    const fabric = amount(price) * amount(grams) / 1000;
    return { fabric, total: fabric + expenses.reduce((sum, item) => sum + amount(item.amount), 0) };
  }
  if (typeof module !== 'undefined') module.exports = { amount, calculate };
  else root.Cost = { amount, calculate };
})(globalThis);
