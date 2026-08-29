import { pool } from '../db/index.js';

export function listInvestments(db = pool) {
  return db.query(
    `SELECT id, name, type, invested_amount::float AS "investedAmount",
      current_amount::float AS "currentAmount", updated_at AS "updatedAt",
      created_at AS "createdAt"
     FROM investments ORDER BY created_at DESC`,
  ).then(({ rows }) => rows);
}

export function createInvestment(data, db = pool) {
  return db.query(
    `INSERT INTO investments (name, type, invested_amount, current_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, type, invested_amount::float AS "investedAmount",
       current_amount::float AS "currentAmount", updated_at AS "updatedAt"`,
    [data.name, data.type, data.investedAmount, data.currentAmount],
  ).then(({ rows }) => rows[0]);
}

export function updateInvestment(id, data, db = pool) {
  return db.query(
    `UPDATE investments SET name = $2, type = $3
     WHERE id = $1
     RETURNING id, name, type, invested_amount::float AS "investedAmount",
       current_amount::float AS "currentAmount", updated_at AS "updatedAt"`,
    [id, data.name, data.type],
  ).then(({ rows }) => rows[0]);
}

export function findInvestmentForUpdate(id, db = pool) {
  return db.query(
    `SELECT id, name, type, invested_amount::float AS "investedAmount",
      current_amount::float AS "currentAmount", updated_at AS "updatedAt"
     FROM investments WHERE id = $1 FOR UPDATE`,
    [id],
  ).then(({ rows }) => rows[0]);
}

export function updateInvestmentAmounts(id, investedAmount, currentAmount, db = pool) {
  return db.query(
    `UPDATE investments
     SET invested_amount = $2, current_amount = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, type, invested_amount::float AS "investedAmount",
       current_amount::float AS "currentAmount", updated_at AS "updatedAt"`,
    [id, investedAmount, currentAmount],
  ).then(({ rows }) => rows[0]);
}

export function createMovement(data, db = pool) {
  return db.query(
    `INSERT INTO investment_movements (
      investment_id, kind, amount, previous_invested_amount, previous_current_amount,
      resulting_invested_amount, resulting_current_amount
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.investmentId, data.kind, data.amount, data.previousInvestedAmount,
      data.previousCurrentAmount, data.resultingInvestedAmount, data.resultingCurrentAmount],
  );
}
