import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccount } from '../src/services/accountsService.js';
import { validateDates } from '../src/services/invoicesService.js';
import { addDays, isIsoDate } from '../src/utils/date.js';

test('valida datas ISO reais', () => {
  assert.equal(isIsoDate('2024-02-29'), true);
  assert.equal(isIsoDate('2026-02-29'), false);
  assert.equal(isIsoDate('28/08/2026'), false);
  assert.equal(isIsoDate('2026-13-01'), false);
});

test('adiciona dias atravessando mês e ano', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('recusa períodos de fatura inválidos antes de acessar o banco', () => {
  assert.throws(() => validateDates({ startDate: '2026-02-30', endDate: '2026-03-10', dueDate: '2026-03-15' }), /datas válidas/);
  assert.throws(() => validateDates({ startDate: '2026-09-01', endDate: '2026-08-31', dueDate: '2026-09-10' }), /data final/);
});

test('recusa a primeira fatura inválida sem criar parcialmente a conta', async () => {
  await assert.rejects(() => createAccount({
    name: 'Conta de teste',
    kind: 'credit',
    balance: 0,
    creditLimit: 1000,
    color: '#b7ff34',
    invoice: { startDate: '2026-02-30', endDate: '2026-03-10', dueDate: '2026-03-15' },
  }), /datas válidas/);
});
