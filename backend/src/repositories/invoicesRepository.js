import { pool } from '../db/index.js';

const invoiceSelect = `
  SELECT i.id, i.account_id AS "accountId", a.name AS "accountName",
    i.start_date AS "startDate", i.end_date AS "endDate", i.due_date AS "dueDate",
    i.status, i.paid_at AS "paidAt", COALESCE(SUM(ins.amount), 0)::float AS total,
    COUNT(ins.id)::int AS "expenseCount",
    a.credit_limit::float AS "creditLimit"
  FROM invoices i
  JOIN accounts a ON a.id = i.account_id
  LEFT JOIN installments ins ON ins.invoice_id = i.id`;

export function listInvoices(db = pool) {
  return db.query(`${invoiceSelect}
    GROUP BY i.id, a.id ORDER BY i.start_date DESC`)
    .then(({ rows }) => rows);
}

export function findOpenInvoice(accountId, db = pool) {
  return db.query(`${invoiceSelect}
    WHERE i.account_id = $1 AND i.status = 'open'
    GROUP BY i.id, a.id LIMIT 1`, [accountId]).then(({ rows }) => rows[0]);
}

export function findInvoiceById(id, db = pool) {
  return db.query(`${invoiceSelect} WHERE i.id = $1 GROUP BY i.id, a.id`, [id])
    .then(({ rows }) => rows[0]);
}

export function listInvoiceExpenses(invoiceId, db = pool) {
  return db.query(
    `SELECT e.id, e.account_id AS "accountId", e.description, e.category,
      e.total_amount::float AS "totalAmount", e.purchase_date AS "purchaseDate",
      e.installments_count AS installments, a.name AS "accountName",
      ins.installment_no AS "invoiceInstallment", ins.amount::float AS "invoiceAmount",
      ins.paid AS "invoicePaid",
      COALESCE((SELECT MIN(next_ins.installment_no) FROM installments next_ins
        WHERE next_ins.expense_id = e.id AND NOT next_ins.paid), e.installments_count) AS "currentInstallment",
      (SELECT COUNT(*)::int FROM installments paid_ins
        WHERE paid_ins.expense_id = e.id AND paid_ins.paid) AS "paidInstallments",
      (SELECT COUNT(*)::int FROM installments pending_ins
        WHERE pending_ins.expense_id = e.id AND NOT pending_ins.paid) AS "remainingInstallments",
      CASE WHEN doc.id IS NULL THEN NULL ELSE json_build_object(
        'id', doc.id, 'originalName', doc.original_name, 'sizeBytes', doc.size_bytes,
        'status', doc.processing_status
      ) END AS document
     FROM installments ins
     JOIN expenses e ON e.id = ins.expense_id
     JOIN accounts a ON a.id = e.account_id
     LEFT JOIN expense_documents doc ON doc.expense_id = e.id
     WHERE ins.invoice_id = $1
     ORDER BY e.purchase_date DESC, e.id DESC`,
    [invoiceId],
  ).then(({ rows }) => rows);
}

export function createInvoice(data, db = pool) {
  return db.query(
    `INSERT INTO invoices (account_id, start_date, end_date, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, account_id AS "accountId", start_date AS "startDate",
       end_date AS "endDate", due_date AS "dueDate", status`,
    [data.accountId, data.startDate, data.endDate, data.dueDate],
  ).then(({ rows }) => rows[0]);
}

export function markPaid(id, db = pool) {
  return db.query(
    `UPDATE invoices SET status = 'paid', paid_at = NOW()
     WHERE id = $1 AND status = 'open' RETURNING *`, [id],
  ).then(({ rows }) => rows[0]);
}

export function markInstallmentsPaid(invoiceId, db = pool) {
  return db.query(
    `UPDATE installments SET paid = true
     WHERE invoice_id = $1 AND NOT paid RETURNING id`,
    [invoiceId],
  ).then(({ rowCount }) => rowCount);
}

export function assignProjectedInstallments(accountId, invoiceId, startDate, endDate, db = pool) {
  return db.query(
    `UPDATE installments ins SET invoice_id = $2
     FROM expenses e
     WHERE ins.expense_id = e.id AND e.account_id = $1 AND ins.invoice_id IS NULL
       AND NOT ins.paid AND ins.projected_date BETWEEN $3 AND $4
     RETURNING ins.id`,
    [accountId, invoiceId, startDate, endDate],
  ).then(({ rowCount }) => rowCount);
}
