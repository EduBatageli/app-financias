import * as repository from '../repositories/investmentsRepository.js';
import { withTransaction } from '../db/index.js';
import { HttpError } from '../utils/httpError.js';

export function listInvestments() {
  return repository.listInvestments();
}

export function createInvestment(input) {
  const investedAmount = Number(input.investedAmount);
  const currentAmount = Number(input.currentAmount ?? investedAmount);
  if (!input.name?.trim() || !input.type?.trim()) throw new HttpError(400, 'Informe nome e tipo do investimento.');
  if (input.name.trim().length > 100 || input.type.trim().length > 50) throw new HttpError(400, 'Nome ou tipo do investimento é muito longo.');
  if (!Number.isFinite(investedAmount) || !Number.isFinite(currentAmount) || investedAmount < 0 || currentAmount < 0) {
    throw new HttpError(400, 'Informe valores válidos para o investimento.');
  }
  return repository.createInvestment({
    name: input.name.trim(), type: input.type.trim(), investedAmount, currentAmount,
  });
}

function investmentId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Investimento inválido.');
  return id;
}

export async function updateInvestment(id, input) {
  const parsedId = investmentId(id);
  if (!input.name?.trim() || !input.type?.trim()) throw new HttpError(400, 'Informe nome e tipo do investimento.');
  if (input.name.trim().length > 100 || input.type.trim().length > 50) throw new HttpError(400, 'Nome ou tipo do investimento é muito longo.');
  const investment = await repository.updateInvestment(parsedId, {
    name: input.name.trim(),
    type: input.type.trim(),
  });
  if (!investment) throw new HttpError(404, 'Investimento não encontrado.');
  return investment;
}

function currency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateInvestmentMovement(investment, kind, amount) {
  if (kind === 'contribution') {
    return {
      investedAmount: currency(investment.investedAmount + amount),
      currentAmount: currency(investment.currentAmount + amount),
    };
  }
  if (amount > investment.currentAmount) throw new HttpError(400, 'A retirada não pode ser maior que o valor atual do investimento.');
  if (amount === investment.currentAmount) return { investedAmount: 0, currentAmount: 0 };

  const remainingShare = (investment.currentAmount - amount) / investment.currentAmount;
  return {
    investedAmount: currency(investment.investedAmount * remainingShare),
    currentAmount: currency(investment.currentAmount - amount),
  };
}

export async function moveInvestment(id, input) {
  const parsedId = investmentId(id);
  const kind = input.kind;
  const amount = Number(input.amount);
  if (!['contribution', 'withdrawal'].includes(kind)) throw new HttpError(400, 'Escolha entre aporte e retirada.');
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Informe um valor válido para a movimentação.');

  return withTransaction(async (db) => {
    const previous = await repository.findInvestmentForUpdate(parsedId, db);
    if (!previous) throw new HttpError(404, 'Investimento não encontrado.');
    const next = calculateInvestmentMovement(previous, kind, amount);
    const investment = await repository.updateInvestmentAmounts(parsedId, next.investedAmount, next.currentAmount, db);
    await repository.createMovement({
      investmentId: parsedId,
      kind,
      amount,
      previousInvestedAmount: previous.investedAmount,
      previousCurrentAmount: previous.currentAmount,
      resultingInvestedAmount: next.investedAmount,
      resultingCurrentAmount: next.currentAmount,
    }, db);
    return investment;
  });
}

export async function updateCurrentValue(id, input) {
  const parsedId = investmentId(id);
  const currentAmount = Number(input.currentAmount);
  if (!Number.isFinite(currentAmount) || currentAmount < 0) throw new HttpError(400, 'Informe um valor atual válido.');

  return withTransaction(async (db) => {
    const previous = await repository.findInvestmentForUpdate(parsedId, db);
    if (!previous) throw new HttpError(404, 'Investimento não encontrado.');
    const investment = await repository.updateInvestmentAmounts(parsedId, previous.investedAmount, currentAmount, db);
    await repository.createMovement({
      investmentId: parsedId,
      kind: 'valuation',
      amount: currentAmount,
      previousInvestedAmount: previous.investedAmount,
      previousCurrentAmount: previous.currentAmount,
      resultingInvestedAmount: previous.investedAmount,
      resultingCurrentAmount: currentAmount,
    }, db);
    return investment;
  });
}
