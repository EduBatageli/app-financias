import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInstallmentSchedule, validateExpense, validatePdfUpload } from '../src/services/expensesService.js';

const augustInvoice = {
  id: 7,
  startDate: '2026-08-01',
  endDate: '2026-08-31',
};

test('gera parcelas desde a data da compra e posiciona a quinta na fatura atual', () => {
  const schedule = buildInstallmentSchedule({
    totalAmount: 1000,
    installments: 10,
    purchaseDate: '2026-04-15',
  }, augustInvoice);

  assert.deepEqual(schedule.slice(0, 5).map(({ installmentNo, projectedDate, paid, invoiceId }) => ({ installmentNo, projectedDate, paid, invoiceId })), [
    { installmentNo: 1, projectedDate: '2026-04-15', paid: true, invoiceId: null },
    { installmentNo: 2, projectedDate: '2026-05-15', paid: true, invoiceId: null },
    { installmentNo: 3, projectedDate: '2026-06-15', paid: true, invoiceId: null },
    { installmentNo: 4, projectedDate: '2026-07-15', paid: true, invoiceId: null },
    { installmentNo: 5, projectedDate: '2026-08-15', paid: false, invoiceId: 7 },
  ]);
  assert.equal(schedule[5].projectedDate, '2026-09-15');
  assert.equal(schedule[5].invoiceId, null);
});

test('preserva o dia da compra e ajusta meses mais curtos', () => {
  const schedule = buildInstallmentSchedule({
    totalAmount: 300,
    installments: 3,
    purchaseDate: '2026-01-31',
  }, { id: 1, startDate: '2026-01-01', endDate: '2026-01-31' });

  assert.deepEqual(schedule.map(({ projectedDate }) => projectedDate), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('distribui centavos sem alterar o valor total', () => {
  const schedule = buildInstallmentSchedule({
    totalAmount: 100,
    installments: 3,
    purchaseDate: '2026-08-10',
  }, augustInvoice);

  assert.deepEqual(schedule.map(({ amount }) => amount), [33.34, 33.33, 33.33]);
  assert.equal(schedule.reduce((total, item) => total + item.amount, 0), 100);
});

test('aceita um PDF real e normaliza o nome original', () => {
  const pdf = Buffer.from('%PDF-1.7\nconteudo de teste');
  assert.equal(validatePdfUpload(pdf, '../Conta de luz.PDF'), 'Conta de luz.PDF');
});

test('recusa arquivo que apenas usa a extensão PDF', () => {
  assert.throws(
    () => validatePdfUpload(Buffer.from('isto não é um pdf'), 'conta.pdf'),
    /não parece ser um PDF válido/,
  );
});

test('recusa quantidade de parcelas inválida antes de acessar o banco', () => {
  const expense = {
    accountId: 1,
    description: 'Compra',
    category: 'Outros',
    totalAmount: 10,
    purchaseDate: '2026-08-28',
  };

  assert.throws(() => validateExpense({ ...expense, installments: 1.5 }), /parcelas inteiras/);
  assert.throws(() => validateExpense({ ...expense, installments: 'abc' }), /parcelas inteiras/);
  assert.throws(() => validateExpense({ ...expense, installments: 61 }), /entre 1 e 60/);
});

test('recusa parcelas que produziriam valores de zero centavos', () => {
  assert.throws(() => validateExpense({
    accountId: 1,
    description: 'Compra pequena',
    category: 'Outros',
    totalAmount: 0.02,
    purchaseDate: '2026-08-28',
    installments: 3,
  }), /R\$ 0,01 por parcela/);
});
