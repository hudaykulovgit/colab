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
  const monthly = total / term;
  return Array.from({ length: term }, (_, i) => ({
    sequence: i + 1,
    dueDate: addMonths(firstDue, i),
    scheduled: +(i === term - 1 ? total - monthly * (term - 1) : monthly).toFixed(2),
    paid: 0,
  }));
}

module.exports = { addMonths, generateSchedule };
