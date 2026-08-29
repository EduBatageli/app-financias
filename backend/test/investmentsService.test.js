import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvestmentMovement } from '../src/services/investmentsService.js';

test('aporte aumenta igualmente o capital aplicado e o valor atual', () => {
  const result = calculateInvestmentMovement({ investedAmount: 1000, currentAmount: 1100 }, 'contribution', 200);
  assert.deepEqual(result, { investedAmount: 1200, currentAmount: 1300 });
});

test('retirada parcial reduz o custo proporcionalmente e preserva a rentabilidade da posição restante', () => {
  const result = calculateInvestmentMovement({ investedAmount: 1000, currentAmount: 1200 }, 'withdrawal', 300);
  assert.deepEqual(result, { investedAmount: 750, currentAmount: 900 });
});

test('retirada total zera a posição', () => {
  const result = calculateInvestmentMovement({ investedAmount: 800, currentAmount: 1000 }, 'withdrawal', 1000);
  assert.deepEqual(result, { investedAmount: 0, currentAmount: 0 });
});

test('impede retirada maior que o saldo atual', () => {
  assert.throws(
    () => calculateInvestmentMovement({ investedAmount: 800, currentAmount: 1000 }, 'withdrawal', 1000.01),
    /não pode ser maior/,
  );
});
