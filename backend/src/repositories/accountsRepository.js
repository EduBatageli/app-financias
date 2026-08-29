import { pool } from '../db/index.js';

export function listAccounts(db = pool) {
  return db.query(
    `SELECT id, name, kind, balance::float, credit_limit::float AS "creditLimit", color, active
     FROM accounts WHERE active = true ORDER BY created_at`,
  ).then(({ rows }) => rows);
}

export function createAccount(data, db = pool) {
  return db.query(
    `INSERT INTO accounts (name, kind, balance, credit_limit, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, kind, balance::float, credit_limit::float AS "creditLimit", color, active`,
    [data.name, data.kind, data.balance, data.creditLimit, data.color],
  ).then(({ rows }) => rows[0]);
}

export function updateAccount(id, data, db = pool) {
  return db.query(
    `UPDATE accounts SET name = $2, kind = $3, balance = $4, credit_limit = $5, color = $6
     WHERE id = $1 AND active = true
     RETURNING id, name, kind, balance::float, credit_limit::float AS "creditLimit", color, active`,
    [id, data.name, data.kind, data.balance, data.creditLimit, data.color],
  ).then(({ rows }) => rows[0]);
}

export function findAccountById(id, db = pool) {
  return db.query('SELECT * FROM accounts WHERE id = $1 AND active = true', [id])
    .then(({ rows }) => rows[0]);
}
