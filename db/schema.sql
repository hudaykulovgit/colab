-- Autofinance portfolio schema
-- Only "source of truth" fields are stored. Derived/computed fields
-- (status, riskScore, outstanding, paidTotal, daysLate, simpleROI,
-- annualYield, monthlyPayment, markup, nextDueDate, lastPaymentDate,
-- dueScheduled, duePaid, overdue) are recomputed client-side by
-- recalculate() on every render, matching the existing app design.

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  source_sheet TEXT,
  source_title TEXT,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  borrower TEXT NOT NULL,
  lender TEXT,
  license_plate TEXT,
  vehicle_year INTEGER,
  mileage INTEGER,
  asset_price NUMERIC,
  contract_date DATE NOT NULL,
  first_due_date DATE NOT NULL,
  term_months INTEGER NOT NULL,
  principal NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  total_receivable NUMERIC NOT NULL,
  notes TEXT,
  payment_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_rows (
  id BIGSERIAL PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  due_date DATE NOT NULL,
  scheduled NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_schedule_rows_contract_id ON schedule_rows(contract_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rows_contract_seq ON schedule_rows(contract_id, sequence);
