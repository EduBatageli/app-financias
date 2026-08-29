import { pool } from '../db/index.js';

export function createExpense(data, db = pool) {
  return db.query(
    `INSERT INTO expenses (account_id, description, category, total_amount, purchase_date, installments_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, account_id AS "accountId", description, category,
       total_amount::float AS "totalAmount", purchase_date AS "purchaseDate",
       installments_count AS installments`,
    [data.accountId, data.description, data.category, data.totalAmount, data.purchaseDate, data.installments],
  ).then(({ rows }) => rows[0]);
}

export function createInstallment(data, db = pool) {
  return db.query(
    `INSERT INTO installments
      (expense_id, invoice_id, installment_no, total_installments, amount, projected_date, paid)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.expenseId, data.invoiceId, data.installmentNo, data.totalInstallments, data.amount, data.projectedDate, data.paid],
  ).then(({ rows }) => rows[0]);
}

export function createExpenseDocument(data, db = pool) {
  return db.query(
    `INSERT INTO expense_documents
      (expense_id, invoice_id, original_name, storage_name, mime_type, size_bytes,
       processing_status, extracted_description, extracted_amount)
     VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7, $8)
     RETURNING id, expense_id AS "expenseId", invoice_id AS "invoiceId",
       original_name AS "originalName", size_bytes AS "sizeBytes",
       processing_status AS status, created_at AS "createdAt"`,
    [data.expenseId, data.invoiceId, data.originalName, data.storageName, data.sizeBytes,
      data.processingStatus, data.extractedDescription, data.extractedAmount],
  ).then(({ rows }) => rows[0]);
}

export function findExpenseDocumentById(id, db = pool) {
  return db.query(
    `SELECT id, original_name AS "originalName", storage_name AS "storageName",
       mime_type AS "mimeType", size_bytes AS "sizeBytes"
     FROM expense_documents WHERE id = $1`,
    [id],
  ).then(({ rows }) => rows[0]);
}

export function findExpenseForUpdate(id, db = pool) {
  return db.query(
    `SELECT e.id, e.account_id AS "accountId", e.description, e.category,
      e.total_amount::float AS "totalAmount", e.purchase_date AS "purchaseDate",
      e.installments_count AS installments,
      EXISTS (
        SELECT 1 FROM installments ins
        JOIN invoices i ON i.id = ins.invoice_id
        WHERE ins.expense_id = e.id AND i.status <> 'open'
      ) AS "hasLockedInvoice"
     FROM expenses e WHERE e.id = $1 FOR UPDATE`,
    [id],
  ).then(({ rows }) => rows[0]);
}

export function updateExpense(id, data, db = pool) {
  return db.query(
    `UPDATE expenses SET account_id = $2, description = $3, category = $4,
      total_amount = $5, purchase_date = $6, installments_count = $7
     WHERE id = $1
     RETURNING id, account_id AS "accountId", description, category,
       total_amount::float AS "totalAmount", purchase_date AS "purchaseDate",
       installments_count AS installments`,
    [id, data.accountId, data.description, data.category, data.totalAmount, data.purchaseDate, data.installments],
  ).then(({ rows }) => rows[0]);
}

export function deleteInstallments(expenseId, db = pool) {
  return db.query('DELETE FROM installments WHERE expense_id = $1', [expenseId]);
}

export function listExpenses(limit = 50, db = pool) {
  return db.query(
    `SELECT e.id, e.account_id AS "accountId", e.description, e.category, e.total_amount::float AS "totalAmount",
      e.purchase_date AS "purchaseDate", e.installments_count AS installments,
      a.name AS "accountName",
      COALESCE(MIN(ins.installment_no) FILTER (WHERE NOT ins.paid), e.installments_count) AS "currentInstallment",
      COUNT(ins.id) FILTER (WHERE ins.paid)::int AS "paidInstallments",
      COUNT(ins.id) FILTER (WHERE NOT ins.paid)::int AS "remainingInstallments",
      COALESCE(json_agg(json_build_object(
        'number', ins.installment_no, 'total', ins.total_installments,
        'amount', ins.amount::float, 'projectedDate', ins.projected_date,
        'invoiceId', ins.invoice_id, 'paid', ins.paid
      ) ORDER BY ins.installment_no) FILTER (WHERE ins.id IS NOT NULL), '[]') AS "installmentsDetail",
      CASE WHEN doc.id IS NULL THEN NULL ELSE json_build_object(
        'id', doc.id, 'originalName', doc.original_name, 'sizeBytes', doc.size_bytes,
        'status', doc.processing_status
      ) END AS document
     FROM expenses e JOIN accounts a ON a.id = e.account_id
     LEFT JOIN installments ins ON ins.expense_id = e.id
     LEFT JOIN expense_documents doc ON doc.expense_id = e.id
     GROUP BY e.id, a.id, doc.id ORDER BY e.purchase_date DESC, e.id DESC LIMIT $1`,
    [limit],
  ).then(({ rows }) => rows);
}

export function listProjections(db = pool) {
  return db.query(
    `SELECT date_trunc('month', projected_date)::date AS month,
      SUM(amount)::float AS total, COUNT(*)::int AS installments
     FROM installments
     WHERE NOT paid AND projected_date >= date_trunc('month', CURRENT_DATE)::date
     GROUP BY 1 ORDER BY 1 LIMIT 12`,
  ).then(({ rows }) => rows);
}
