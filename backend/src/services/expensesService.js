import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withTransaction } from '../db/index.js';
import * as repository from '../repositories/expensesRepository.js';
import * as invoicesRepository from '../repositories/invoicesRepository.js';
import { HttpError } from '../utils/httpError.js';
import { addMonths, isIsoDate, isoDate } from '../utils/date.js';
import { validatePdfUpload } from '../utils/pdf.js';

export { validatePdfUpload };

export function listExpenses() {
  return repository.listExpenses();
}

export function listProjections() {
  return repository.listProjections();
}

export function validateExpense(input) {
  const accountId = Number(input.accountId);
  const totalAmount = Number(input.totalAmount);
  const installments = Number(input.installments ?? 1);
  if (!Number.isInteger(accountId) || accountId <= 0) throw new HttpError(400, 'Selecione uma conta válida.');
  if (!input.description?.trim()) throw new HttpError(400, 'Informe uma descrição para o gasto.');
  if (!input.category?.trim()) throw new HttpError(400, 'Selecione uma categoria.');
  if (input.description.trim().length > 120) throw new HttpError(400, 'A descrição deve ter no máximo 120 caracteres.');
  if (input.category.trim().length > 60) throw new HttpError(400, 'A categoria deve ter no máximo 60 caracteres.');
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new HttpError(400, 'Informe um valor válido.');
  if (!Number.isInteger(installments) || installments < 1 || installments > 60) throw new HttpError(400, 'Informe entre 1 e 60 parcelas inteiras.');
  if (Math.round(totalAmount * 100) < installments) throw new HttpError(400, 'O valor deve permitir ao menos R$ 0,01 por parcela.');
  if (!isIsoDate(input.purchaseDate)) throw new HttpError(400, 'Informe uma data de compra válida.');
  return {
    accountId,
    description: input.description.trim(),
    category: input.category.trim(),
    totalAmount,
    purchaseDate: input.purchaseDate,
    installments,
  };
}

export function buildInstallmentSchedule(data, invoice) {
  const cents = Math.round(data.totalAmount * 100);
  const baseCents = Math.floor(cents / data.installments);
  const remainder = cents % data.installments;
  const invoiceStart = isoDate(invoice.startDate);
  const invoiceEnd = isoDate(invoice.endDate);

  return Array.from({ length: data.installments }, (_, index) => {
    const projectedDate = addMonths(data.purchaseDate, index);
    const paid = projectedDate < invoiceStart;
    const isCurrent = !paid && projectedDate <= invoiceEnd;
    return {
      invoiceId: isCurrent ? invoice.id : null,
      installmentNo: index + 1,
      totalInstallments: data.installments,
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
      projectedDate,
      paid,
    };
  });
}

async function createInstallments(expenseId, data, invoice, client) {
  for (const installment of buildInstallmentSchedule(data, invoice)) {
    await repository.createInstallment({ expenseId, ...installment }, client);
  }
}

export async function createExpense(input) {
  const data = validateExpense(input);

  return withTransaction(async (client) => {
    const invoice = await invoicesRepository.findOpenInvoice(data.accountId, client);
    if (!invoice) throw new HttpError(409, 'Crie uma fatura aberta para esta conta antes de lançar gastos.');
    const expense = await repository.createExpense(data, client);
    await createInstallments(expense.id, data, invoice, client);
    return expense;
  });
}

export async function createExpenseFromPdf(input, buffer, originalName) {
  const data = validateExpense(input);
  const validatedName = validatePdfUpload(buffer, originalName);
  const storageDirectory = path.resolve(process.env.PDF_STORAGE_DIR || 'storage/pdfs');
  const storageName = `${randomUUID()}.pdf`;
  const temporaryPath = path.join(storageDirectory, `.${storageName}.uploading`);
  const finalPath = path.join(storageDirectory, storageName);
  let movedToFinalPath = false;

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(temporaryPath, buffer, { flag: 'wx' });

  try {
    return await withTransaction(async (client) => {
      const invoice = await invoicesRepository.findOpenInvoice(data.accountId, client);
      if (!invoice) throw new HttpError(409, 'Crie uma fatura aberta para esta conta antes de importar um PDF.');
      const expense = await repository.createExpense(data, client);
      await createInstallments(expense.id, data, invoice, client);
      const document = await repository.createExpenseDocument({
        expenseId: expense.id,
        invoiceId: invoice.id,
        originalName: validatedName,
        storageName,
        sizeBytes: buffer.length,
        processingStatus: input.ocrProcessed === 'true' ? 'processed' : 'stored',
        extractedDescription: input.ocrDescription?.trim().slice(0, 120) || null,
        extractedAmount: Number.isFinite(Number(input.ocrAmount)) ? Number(input.ocrAmount) : null,
      }, client);
      await rename(temporaryPath, finalPath);
      movedToFinalPath = true;
      return { ...expense, document };
    });
  } catch (error) {
    await unlink(movedToFinalPath ? finalPath : temporaryPath).catch(() => {});
    throw error;
  }
}

export async function getExpenseDocument(id) {
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) throw new HttpError(400, 'Documento inválido.');
  const document = await repository.findExpenseDocumentById(documentId);
  if (!document) throw new HttpError(404, 'PDF não encontrado.');
  const storageDirectory = path.resolve(process.env.PDF_STORAGE_DIR || 'storage/pdfs');
  return { ...document, absolutePath: path.join(storageDirectory, document.storageName) };
}

export async function updateExpense(id, input) {
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId) || expenseId <= 0) throw new HttpError(400, 'Gasto inválido.');
  const data = validateExpense(input);

  return withTransaction(async (client) => {
    const existing = await repository.findExpenseForUpdate(expenseId, client);
    if (!existing) throw new HttpError(404, 'Gasto não encontrado.');
    if (existing.hasLockedInvoice) throw new HttpError(409, 'Não é possível editar um gasto de uma fatura já paga.');

    const invoice = await invoicesRepository.findOpenInvoice(data.accountId, client);
    if (!invoice) throw new HttpError(409, 'A conta selecionada precisa ter uma fatura aberta.');

    await repository.deleteInstallments(expenseId, client);
    const expense = await repository.updateExpense(expenseId, data, client);
    await createInstallments(expense.id, data, invoice, client);
    return expense;
  });
}
