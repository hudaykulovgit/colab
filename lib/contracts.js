const { getSql } = require('./db');

// DB row (snake_case) -> frontend contract shape (camelCase).
// Derived fields (status, riskScore, outstanding, paidTotal, ...) are
// intentionally omitted: the frontend's recalculate() fills them in.
function rowToContract(row, scheduleRows) {
  return {
    id: row.id,
    sourceSheet: row.source_sheet,
    sourceTitle: row.source_title,
    assetType: row.asset_type,
    assetName: row.asset_name,
    borrower: row.borrower,
    lender: row.lender,
    licensePlate: row.license_plate,
    vehicleYear: row.vehicle_year,
    mileage: row.mileage,
    assetPrice: row.asset_price === null ? null : Number(row.asset_price),
    contractDate: isoDate(row.contract_date),
    firstDueDate: isoDate(row.first_due_date),
    termMonths: row.term_months,
    principal: Number(row.principal),
    interestRate: Number(row.interest_rate),
    totalReceivable: Number(row.total_receivable),
    notes: row.notes,
    paymentLog: row.payment_log || [],
    schedule: (scheduleRows || [])
      .sort((a, b) => a.sequence - b.sequence)
      .map((r) => ({
        sequence: r.sequence,
        dueDate: isoDate(r.due_date),
        scheduled: Number(r.scheduled),
        paid: Number(r.paid),
      })),
  };
}

function isoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

async function fetchAllContracts() {
  const sql = getSql();
  const contractRows = await sql`SELECT * FROM contracts ORDER BY created_at ASC`;
  const scheduleRows = await sql`SELECT * FROM schedule_rows ORDER BY contract_id, sequence`;
  const byContract = new Map();
  for (const row of scheduleRows) {
    if (!byContract.has(row.contract_id)) byContract.set(row.contract_id, []);
    byContract.get(row.contract_id).push(row);
  }
  return contractRows.map((row) => rowToContract(row, byContract.get(row.id)));
}

// Upserts one contract + fully replaces its schedule rows.
// Never deletes contracts that are absent from a given call -- callers
// upsert one contract (or a batch) at a time, so a partial payload
// can never wipe out unrelated records.
async function upsertContract(contract) {
  const sql = getSql();
  if (!contract.id) throw new Error('contract.id is required');
  if (!contract.assetName || !contract.borrower) throw new Error(`contract ${contract.id}: assetName and borrower are required`);
  if (!contract.contractDate || !contract.firstDueDate) throw new Error(`contract ${contract.id}: contractDate and firstDueDate are required`);

  await sql`
    INSERT INTO contracts (
      id, source_sheet, source_title, asset_type, asset_name, borrower, lender,
      license_plate, vehicle_year, mileage, asset_price, contract_date, first_due_date,
      term_months, principal, interest_rate, total_receivable, notes, payment_log, updated_at
    ) VALUES (
      ${contract.id}, ${contract.sourceSheet || null}, ${contract.sourceTitle || null},
      ${contract.assetType || 'Other'}, ${contract.assetName}, ${contract.borrower},
      ${contract.lender || null}, ${contract.licensePlate || null}, ${contract.vehicleYear || null},
      ${contract.mileage || null}, ${contract.assetPrice ?? null}, ${contract.contractDate},
      ${contract.firstDueDate}, ${contract.termMonths || 0}, ${contract.principal || 0},
      ${contract.interestRate || 0}, ${contract.totalReceivable || 0}, ${contract.notes || null},
      ${JSON.stringify(contract.paymentLog || [])}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      source_sheet = EXCLUDED.source_sheet, source_title = EXCLUDED.source_title,
      asset_type = EXCLUDED.asset_type, asset_name = EXCLUDED.asset_name,
      borrower = EXCLUDED.borrower, lender = EXCLUDED.lender,
      license_plate = EXCLUDED.license_plate, vehicle_year = EXCLUDED.vehicle_year,
      mileage = EXCLUDED.mileage, asset_price = EXCLUDED.asset_price,
      contract_date = EXCLUDED.contract_date, first_due_date = EXCLUDED.first_due_date,
      term_months = EXCLUDED.term_months, principal = EXCLUDED.principal,
      interest_rate = EXCLUDED.interest_rate, total_receivable = EXCLUDED.total_receivable,
      notes = EXCLUDED.notes, payment_log = EXCLUDED.payment_log, updated_at = now()
  `;

  const schedule = Array.isArray(contract.schedule) ? contract.schedule : [];
  await sql`DELETE FROM schedule_rows WHERE contract_id = ${contract.id}`;
  for (const row of schedule) {
    if (!row.dueDate) continue;
    await sql`
      INSERT INTO schedule_rows (contract_id, sequence, due_date, scheduled, paid)
      VALUES (${contract.id}, ${row.sequence}, ${row.dueDate}, ${row.scheduled || 0}, ${row.paid || 0})
    `;
  }
}

module.exports = { fetchAllContracts, upsertContract, rowToContract };
