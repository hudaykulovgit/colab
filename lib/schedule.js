function addMonths(isoDateStr, months) {
  const d = new Date(`${isoDateStr}T12:00:00Z`);
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(originalDay, daysInMonth));
  return d.toISOString().slice(0, 10);
}

function generateSchedule(firstDue, term, total) {
  if (!Number.isInteger(term) || term <= 0) {
    throw new Error('term must be a positive integer');
  }
  if (!Number.isFinite(total) || total < 0) {
    throw new Error('total must be a non-negative finite number');
  }

  // Calculate in cents so rounding cannot make the installments add up to
  // less (or more) than the contract total. Any remainder goes into the
  // final installment.
  const totalCents = Math.round(total * 100);
  const monthlyCents = Math.floor(totalCents / term);
  return Array.from({ length: term }, (_, i) => ({
    sequence: i + 1,
    dueDate: addMonths(firstDue, i),
    scheduled: (i === term - 1
      ? totalCents - monthlyCents * (term - 1)
      : monthlyCents) / 100,
    paid: 0,
  }));
}

function allocatePayment(schedule, amount, outstanding) {
  const rows = Array.isArray(schedule) ? schedule : [];
  let remainingCents = Math.min(
    Math.max(0, Math.round(Number(amount) * 100)),
    Math.max(0, Math.round(Number(outstanding) * 100))
  );
  const requestedCents = remainingCents;
  const ordered = [...rows].sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  for (const row of ordered) {
    if (remainingCents <= 0) break;
    const paidCents = Math.round((Number(row.paid) || 0) * 100);
    const gapCents = Math.max(0, Math.round((Number(row.scheduled) || 0) * 100) - paidCents);
    const appliedCents = Math.min(gapCents, remainingCents);
    row.paid = (paidCents + appliedCents) / 100;
    remainingCents -= appliedCents;
  }
  if (remainingCents > 0 && ordered.length) {
    const last = ordered[ordered.length - 1];
    last.paid = (Math.round((Number(last.paid) || 0) * 100) + remainingCents) / 100;
    remainingCents = 0;
  }
  return (requestedCents - remainingCents) / 100;
}

module.exports = { addMonths, generateSchedule, allocatePayment };
