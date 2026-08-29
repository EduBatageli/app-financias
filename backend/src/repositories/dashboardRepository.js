import { pool } from '../db/index.js';

export async function getDashboard(db = pool) {
  const [summary, currentInvoice, recentExpenses, monthly] = await Promise.all([
    db.query(`SELECT
      COALESCE((SELECT SUM(balance) FROM accounts WHERE active), 0)::float AS "accountBalance",
      COALESCE((SELECT SUM(current_amount) FROM investments), 0)::float AS investments,
      COALESCE((SELECT SUM(current_amount) FROM goals), 0)::float AS "goalsSaved"`),
    db.query(`SELECT i.id, i.account_id AS "accountId", a.name AS "accountName",
      a.credit_limit::float AS "creditLimit", i.start_date AS "startDate",
      i.end_date AS "endDate", i.due_date AS "dueDate", i.status,
      COALESCE(SUM(ins.amount), 0)::float AS total,
      COALESCE((
        SELECT SUM(pending.amount)
        FROM installments pending
        JOIN expenses pending_expense ON pending_expense.id = pending.expense_id
        WHERE pending_expense.account_id = a.id AND NOT pending.paid
      ), 0)::float AS "outstandingTotal"
      FROM invoices i JOIN accounts a ON a.id = i.account_id
      LEFT JOIN installments ins ON ins.invoice_id = i.id
      WHERE i.status = 'open' GROUP BY i.id, a.id ORDER BY i.created_at DESC LIMIT 1`),
    db.query(`SELECT e.id, e.account_id AS "accountId", e.description, e.category, e.purchase_date AS "purchaseDate",
      a.name AS "accountName", e.total_amount::float AS "totalAmount",
      e.installments_count AS installments,
      COALESCE((SELECT MIN(ins.installment_no) FROM installments ins
        WHERE ins.expense_id = e.id AND NOT ins.paid), e.installments_count) AS "currentInstallment",
      (SELECT COUNT(*)::int FROM installments ins
        WHERE ins.expense_id = e.id AND ins.paid) AS "paidInstallments",
      (SELECT COUNT(*)::int FROM installments ins
        WHERE ins.expense_id = e.id AND NOT ins.paid) AS "remainingInstallments",
      (SELECT json_build_object(
        'id', doc.id, 'originalName', doc.original_name, 'sizeBytes', doc.size_bytes,
        'status', doc.processing_status
      ) FROM expense_documents doc WHERE doc.expense_id = e.id) AS document
      FROM expenses e JOIN accounts a ON a.id = e.account_id
      ORDER BY e.purchase_date DESC, e.id DESC LIMIT 5`),
    db.query(`SELECT date_trunc('month', projected_date)::date AS month, SUM(amount)::float AS total
      FROM installments WHERE projected_date >= CURRENT_DATE - interval '5 months'
      GROUP BY 1 ORDER BY 1 LIMIT 6`),
  ]);

  const totals = summary.rows[0];
  return {
    summary: { ...totals, netWorth: totals.accountBalance + totals.investments },
    currentInvoice: currentInvoice.rows[0] || null,
    recentExpenses: recentExpenses.rows,
    monthlySpending: monthly.rows,
  };
}
