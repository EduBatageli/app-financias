import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFieldsFromText, isPasswordError } from '../src/services/ocrService.js';

test('extrai valor rotulado e o emissor de uma conta', () => {
  const result = extractFieldsFromText(`
    ENEL DISTRIBUIÇÃO SÃO PAULO
    Conta de energia elétrica
    Vencimento 10/09/2026
    Valor total a pagar: R$ 284,73
  `, 'energia-agosto.pdf');

  assert.equal(result.description, 'ENEL DISTRIBUIÇÃO SÃO PAULO');
  assert.equal(result.totalAmount, 284.73);
  assert.equal(result.confidence, 'high');
});

test('prefere total a pagar quando há outros valores no documento', () => {
  const result = extractFieldsFromText(`
    SABESP
    Consumo do mês R$ 91,20
    Multa R$ 2,15
    Total a pagar R$ 93,35
  `, 'agua.pdf');

  assert.equal(result.totalAmount, 93.35);
});

test('usa o maior valor monetário apenas como fallback de baixa confiança', () => {
  const result = extractFieldsFromText('CLARO\nMensalidade R$ 79,90\nDesconto R$ 10,00', 'internet.pdf');

  assert.equal(result.totalAmount, 79.9);
  assert.equal(result.confidence, 'medium');
});

test('usa o nome do arquivo quando não encontra um emissor confiável', () => {
  const result = extractFieldsFromText('Fatura\nValor total a pagar R$ 45,00', 'condominio_agosto.pdf');

  assert.equal(result.description, 'condominio agosto');
  assert.equal(result.totalAmount, 45);
});

test('identifica os erros de senha emitidos pelo Poppler', () => {
  assert.equal(isPasswordError({ stderr: 'Command Line Error: Incorrect password' }), true);
  assert.equal(isPasswordError({ message: 'Password required to open encrypted file' }), true);
  assert.equal(isPasswordError({ stderr: 'Syntax Error: Invalid XRef entry' }), false);
});
