const { fetchAllContracts, upsertContract } = require('../lib/contracts');
const { addMonths, generateSchedule, allocatePayment } = require('../lib/schedule');

// Accepts a broad set of header spellings (English + common RU/UZ variants)
// since source spreadsheets aren't standardized.
const FIELD_ALIASES = {
  id: ['id', 'contract id', 'contract', 'ид', 'номер'],
  assetName: ['asset', 'asset name', 'model', 'car model', 'car', 'модель', 'авто', 'машина'],
  assetType: ['asset type', 'type', 'тип', 'тип актива'],
  borrower: ['borrower', 'customer', 'client', 'заемщик', 'заёмщик', 'клиент'],
  lender: ['lender', 'кредитор', 'владелец'],
  licensePlate: ['license plate', 'plate', 'госномер', 'номер авто'],
  vehicleYear: ['vehicle year', 'year', 'model year', 'год', 'год выпуска'],
  mileage: ['mileage', 'km', 'пробег'],
  assetPrice: ['asset price', 'price', 'цена', 'стоимость'],
  contractDate: ['contract date', 'дата договора', 'дата'],
  firstDueDate: ['first due date', 'first payment date', 'дата первого платежа'],
  termMonths: ['term', 'term months', 'duration', 'months', 'срок', 'срок мес'],
  principal: ['principal', 'loan amount', 'amount', 'сумма займа', 'основной долг'],
  interestRate: ['interest rate', 'rate', 'markup', 'наценка', 'процент'],
  notes: ['notes', 'note', 'comment', 'заметки', 'примечание'],
  paymentContractId: ['contract id', 'contract_id', 'contractid', 'договор', 'номер договора'],
  paymentDate: ['payment date', 'payment_date', 'date', 'дата платежа', 'дата'],
  paymentAmount: ['payment amount', 'payment_amount', 'paid', 'amount paid', 'сумма платежа', 'оплачено'],
  paymentMethod: ['payment method', 'method', 'способ оплаты', 'метод'],
  paymentNote: ['payment note', 'note', 'comment', 'примечание', 'комментарий'],
};

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase();
}

function findValue(row, field) {
  const aliases = FIELD_ALIASES[field];
  const normalized = {};
  for (const k of Object.keys(row)) normalized[normalizeKey(k)] = row[k];
  for (const alias of aliases) {
    if (normalized[alias] !== undefined && normalized[alias] !== '') return normalized[alias];
  }
  return undefined;
}

function toISODate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial date (days since 1899-12-30)
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body && (req.body.contractRows || req.body.rows);
    const paymentRows = Array.isArray(req.body && req.body.paymentRows) ? req.body.paymentRows : [];
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Expected contract rows and optional paymentRows parsed from Excel.' });
    }

    let imported = 0;
    const skipped = [];
    let seq = 0;

    for (const row of rows) {
      seq += 1;
      const assetName = findValue(row, 'assetName');
      const borrower = findValue(row, 'borrower');
      const principal = Number(findValue(row, 'principal'));
      const interestRate = Number(findValue(row, 'interestRate'));
      const termMonths = Number(findValue(row, 'termMonths'));
      const contractDate = toISODate(findValue(row, 'contractDate'));

      if (!assetName || !borrower || !principal || !termMonths || !contractDate) {
        skipped.push({ row: seq, reason: 'Missing required field (asset name, borrower, principal, term, or contract date)' });
        continue;
      }

      const firstDueDate = toISODate(findValue(row, 'firstDueDate')) || addMonths(contractDate, 1);
      const rate = Number.isFinite(interestRate) ? interestRate : 0;
      const total = +(principal * (1 + rate / 100)).toFixed(2);
      const idFromSheet = findValue(row, 'id');
      const id = idFromSheet ? String(idFromSheet) : `AF-IMP-${Date.now()}-${seq}`;

      const contract = {
        id,
        sourceSheet: row.__sheetName || 'Excel import',
        sourceTitle: row.__sheetName || 'Excel import',
        assetType: findValue(row, 'assetType') || 'Other',
        assetName: String(assetName),
        borrower: String(borrower),
        lender: findValue(row, 'lender') || null,
        licensePlate: findValue(row, 'licensePlate') || null,
        vehicleYear: Number(findValue(row, 'vehicleYear')) || null,
        mileage: Number(findValue(row, 'mileage')) || null,
        assetPrice: Number(findValue(row, 'assetPrice')) || null,
        contractDate,
        firstDueDate,
        termMonths,
        principal,
        interestRate: rate,
        totalReceivable: total,
        notes: findValue(row, 'notes') || null,
        paymentLog: [],
        schedule: generateSchedule(firstDueDate, termMonths, total),
      };

      try {
        await upsertContract(contract);
        imported += 1;
      } catch (err) {
        skipped.push({ row: seq, reason: err.message });
      }
    }

    let paymentsImported = 0;
    if (paymentRows.length) {
      const byId = new Map((await fetchAllContracts()).map(contract => [contract.id, contract]));
      for (let index = 0; index < paymentRows.length; index += 1) {
        const row = paymentRows[index];
        const contractId = findValue(row, 'paymentContractId') || findValue(row, 'id');
        const paymentDate = toISODate(findValue(row, 'paymentDate'));
        const amount = Number(findValue(row, 'paymentAmount'));
        const contract = contractId ? byId.get(String(contractId)) : null;
        if (!contract || !paymentDate || !Number.isFinite(amount) || amount <= 0) {
          skipped.push({ sheet: row.__sheetName || 'Payments', row: index + 1, reason: 'Payment requires a valid contract ID, date, and positive amount' });
          continue;
        }
        const paidTotal = (contract.schedule || []).reduce((total, item) => total + (Number(item.paid) || 0), 0);
        const outstanding = Math.max(0, Number(contract.totalReceivable) - paidTotal);
        const applied = allocatePayment(contract.schedule, amount, outstanding);
        if (applied <= 0) {
          skipped.push({ sheet: row.__sheetName || 'Payments', row: index + 1, reason: `Contract ${contract.id} has no outstanding balance` });
          continue;
        }
        contract.paymentLog = Array.isArray(contract.paymentLog) ? contract.paymentLog : [];
        contract.paymentLog.push({
          date: paymentDate,
          amount: applied,
          method: findValue(row, 'paymentMethod') || 'other',
          note: findValue(row, 'paymentNote') || `Imported from ${row.__sheetName || 'Payments'}`,
        });
        try {
          await upsertContract(contract);
          byId.set(contract.id, contract);
          paymentsImported += 1;
        } catch (err) {
          skipped.push({ sheet: row.__sheetName || 'Payments', row: index + 1, reason: err.message });
        }
      }
    }

    return res.status(200).json({ imported, paymentsImported, skippedCount: skipped.length, skipped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
