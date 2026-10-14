const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, amount } = require('./cost');
test('kilogram fiyatını gramaja dönüştürür ve giderleri toplar', () => {
  assert.deepEqual(calculate(200, 250, [{amount: 5}, {amount: 20}, {amount: 8}, {amount: 2}]), {fabric: 50, total: 85});
});
test('gider ekleme ve çıkarma toplamı değiştirir', () => {
  const expenses = [{amount: 10}, {amount: 15}];
  assert.equal(calculate(100, 300, expenses).total, 55);
  expenses.pop();
  assert.equal(calculate(100, 300, expenses).total, 40);
});
test('boş, negatif ve geçersiz değerleri sıfır sayar; ondalık virgülü destekler', () => {
  assert.equal(amount('12,50'), 12.5);
  for (const value of ['', -1, 'abc', Infinity]) assert.equal(amount(value), 0);
});
