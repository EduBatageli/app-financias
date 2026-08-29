import { pool } from '../db/index.js';

export function listGoals(db = pool) {
  return db.query(
    `SELECT id, name, target_amount::float AS "targetAmount",
      current_amount::float AS "currentAmount", deadline, color
     FROM goals ORDER BY created_at DESC`,
  ).then(({ rows }) => rows);
}

export function createGoal(data, db = pool) {
  return db.query(
    `INSERT INTO goals (name, target_amount, current_amount, deadline, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, target_amount::float AS "targetAmount",
       current_amount::float AS "currentAmount", deadline, color`,
    [data.name, data.targetAmount, data.currentAmount, data.deadline || null, data.color],
  ).then(({ rows }) => rows[0]);
}

export function addContribution(id, amount, db = pool) {
  return db.query(
    `UPDATE goals SET current_amount = LEAST(target_amount, current_amount + $2)
     WHERE id = $1 RETURNING id, name, target_amount::float AS "targetAmount",
       current_amount::float AS "currentAmount", deadline, color`,
    [id, amount],
  ).then(({ rows }) => rows[0]);
}
