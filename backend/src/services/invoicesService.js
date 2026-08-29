import { withTransaction } from '../db/index.js';
import * as accountsRepository from '../repositories/accountsRepository.js';
import * as repository from '../repositories/invoicesRepository.js';
import { HttpError } from '../utils/httpError.js';
import { addDays, isIsoDate, isoDate } from '../utils/date.js';

export function validateDates({ startDate, endDate, dueDate }) {
  if (!startDate || !endDate || !dueDate) throw new HttpError(400, 'Informe início, fim e vencimento da fatura.');
  if (![startDate, endDate, dueDate].every(isIsoDate)) throw new HttpError(400, 'Informe datas válidas para a fatura.');
  if (endDate < startDate) throw new HttpError(400, 'A data final deve ser posterior à data inicial.');
}

export function listInvoices() {
  return repository.listInvoices();
}

export async function listInvoiceExpenses(id) {
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw new HttpError(400, 'Fatura inválida.');
  if (!await repository.findInvoiceById(invoiceId)) throw new HttpError(404, 'Fatura não encontrada.');
  return repository.listInvoiceExpenses(invoiceId);
}

export async function createInvoice(input) {
  validateDates(input);
  const accountId = Number(input.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) throw new HttpError(400, 'Selecione uma conta válida.');
  if (!await accountsRepository.findAccountById(accountId)) throw new HttpError(404, 'Conta não encontrada.');
  if (await repository.findOpenInvoice(accountId)) throw new HttpError(409, 'Esta conta já possui uma fatura aberta.');
  return repository.createInvoice({ ...input, accountId });
}

export async function payAndOpenNext(invoiceId, input) {
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw new HttpError(400, 'Fatura inválida.');
  validateDates(input);
  return withTransaction(async (client) => {
    const current = await repository.findInvoiceById(invoiceId, client);
    if (!current) throw new HttpError(404, 'Fatura não encontrada.');
    if (current.status !== 'open') throw new HttpError(409, 'Esta fatura não está aberta.');
    const expectedStart = addDays(isoDate(current.endDate), 1);
    if (input.startDate !== expectedStart) {
      throw new HttpError(400, `A próxima fatura deve começar em ${expectedStart}, sem deixar dias sem fatura.`);
    }
    await repository.markInstallmentsPaid(invoiceId, client);
    await repository.markPaid(invoiceId, client);
    const next = await repository.createInvoice({
      accountId: current.accountId,
      startDate: input.startDate,
      endDate: input.endDate,
      dueDate: input.dueDate,
    }, client);
    const assignedInstallments = await repository.assignProjectedInstallments(
      current.accountId, next.id, input.startDate, input.endDate, client,
    );
    return { paidInvoiceId: Number(invoiceId), nextInvoice: next, assignedInstallments };
  });
}
