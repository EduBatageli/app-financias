export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'credit' CHECK (kind IN ('credit', 'bank')),
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    color VARCHAR(20) NOT NULL DEFAULT '#b7ff34',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_invoice_period CHECK (end_date >= start_date)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_open_invoice_per_account
    ON invoices(account_id) WHERE status = 'open'`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    description VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
    purchase_date DATE NOT NULL,
    installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count BETWEEN 1 AND 60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS installments (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES invoices(id),
    installment_no INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    projected_date DATE NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(expense_id, installment_no)
  )`,
  `CREATE INDEX IF NOT EXISTS installments_projection_idx ON installments(projected_date)`,
  `CREATE INDEX IF NOT EXISTS installments_invoice_idx ON installments(invoice_id)`,
  `CREATE TABLE IF NOT EXISTS expense_documents (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    original_name VARCHAR(180) NOT NULL,
    storage_name VARCHAR(80) NOT NULL UNIQUE,
    mime_type VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    processing_status VARCHAR(20) NOT NULL DEFAULT 'stored'
      CHECK (processing_status IN ('stored', 'processing', 'processed', 'failed')),
    extracted_description VARCHAR(120),
    extracted_amount NUMERIC(14,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS expense_documents_invoice_idx ON expense_documents(invoice_id)`,
  `CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    invested_amount NUMERIC(14,2) NOT NULL CHECK (invested_amount >= 0),
    current_amount NUMERIC(14,2) NOT NULL CHECK (current_amount >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE investments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS investment_movements (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('contribution', 'withdrawal', 'valuation')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    previous_invested_amount NUMERIC(14,2) NOT NULL CHECK (previous_invested_amount >= 0),
    previous_current_amount NUMERIC(14,2) NOT NULL CHECK (previous_current_amount >= 0),
    resulting_invested_amount NUMERIC(14,2) NOT NULL CHECK (resulting_invested_amount >= 0),
    resulting_current_amount NUMERIC(14,2) NOT NULL CHECK (resulting_current_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS investment_movements_investment_idx
    ON investment_movements(investment_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    deadline DATE,
    color VARCHAR(20) NOT NULL DEFAULT '#b7ff34',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];
