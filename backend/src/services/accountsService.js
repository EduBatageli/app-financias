import * as repository from '../repositories/accountsRepository.js';
import * as invoicesRepository from '../repositories/invoicesRepository.js';
import { withTransaction } from '../db/index.js';
import { validateDates } from './invoicesService.js';
import { HttpError } from '../utils/httpError.js';

export function listAccounts() {
  return repository.listAccounts();
}

function validateAccount(input) {
  if (!input.name?.trim()) throw new HttpError(400, 'Informe o nome da conta.');
  if (input.name.trim().length > 80) throw new HttpError(400, 'O nome da conta deve ter no máximo 80 caracteres.');
  if (!['bank', 'credit'].includes(input.kind)) throw new HttpError(400, 'Selecione um tipo de conta válido.');
  const kind = input.kind;
  const balance = Number(input.balance || 0);
  const creditLimit = Number(input.creditLimit || 0);
  if (!Number.isFinite(balance)) throw new HttpError(400, 'Informe um saldo válido.');
  if (!Number.isFinite(creditLimit) || creditLimit < 0) throw new HttpError(400, 'Informe um limite válido.');
  const color = input.color || '#b7ff34';
  if (!/^#[\da-f]{6}$/iu.test(color)) throw new HttpError(400, 'Selecione uma cor válida.');
  return {
    name: input.name.trim(),
    kind,
    balance,
    creditLimit,
    color,
  };
}

export async function createAccount(input) {
  const accountData = validateAccount(input);
  if (!input.invoice) return repository.createAccount(accountData);

  validateDates(input.invoice);
  return withTransaction(async (client) => {
    const account = await repository.createAccount(accountData, client);
    await invoicesRepository.createInvoice({ ...input.invoice, accountId: account.id }, client);
    return account;
  });
}

export async function updateAccount(id, input) {
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) throw new HttpError(400, 'Conta inválida.');
  const account = await repository.updateAccount(accountId, validateAccount(input));
  if (!account) throw new HttpError(404, 'Conta não encontrada.');
  return account;
}
