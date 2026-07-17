const { upsertContract } = require('../lib/contracts');
const { addMonths, generateSchedule } = require('../lib/schedule');

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
    const rows = Array.isArray(req.body) ? req.body : req.body && req.body.rows;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Expected { rows: [...] } — parsed Excel rows as objects.' });
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
        sourceSheet: 'Excel import',
        sourceTitle: 'Excel import',
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

    return res.status(200).json({ imported, skippedCount: skipped.length, skipped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
