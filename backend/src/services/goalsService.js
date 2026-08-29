import * as repository from '../repositories/goalsRepository.js';
import { HttpError } from '../utils/httpError.js';
import { isIsoDate } from '../utils/date.js';

export function listGoals() {
  return repository.listGoals();
}

export function createGoal(input) {
  const targetAmount = Number(input.targetAmount);
  const currentAmount = Number(input.currentAmount || 0);
  if (!input.name?.trim()) throw new HttpError(400, 'Informe um nome para a meta.');
  if (input.name.trim().length > 100) throw new HttpError(400, 'O nome da meta deve ter no máximo 100 caracteres.');
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new HttpError(400, 'Informe um valor objetivo válido.');
  if (!Number.isFinite(currentAmount) || currentAmount < 0) throw new HttpError(400, 'Informe um valor guardado válido.');
  if (input.deadline && !isIsoDate(input.deadline)) throw new HttpError(400, 'Informe um prazo válido para a meta.');
  const color = input.color || '#b7ff34';
  if (!/^#[\da-f]{6}$/iu.test(color)) throw new HttpError(400, 'Selecione uma cor válida.');
  return repository.createGoal({
    name: input.name.trim(), targetAmount, currentAmount,
    deadline: input.deadline || null, color,
  });
}

export async function addContribution(id, input) {
  const goalId = Number(id);
  if (!Number.isInteger(goalId) || goalId <= 0) throw new HttpError(400, 'Meta inválida.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Informe um valor de aporte válido.');
  const goal = await repository.addContribution(goalId, amount);
  if (!goal) throw new HttpError(404, 'Meta não encontrada.');
  return goal;
}
