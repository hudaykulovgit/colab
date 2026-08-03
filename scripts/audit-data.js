const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/const SEED_DATA = ([\s\S]*?);\s*\n\s*const STORAGE_KEY/);
if (!match) throw new Error('Could not find SEED_DATA in index.html');

const data = JSON.parse(match[1]);
const issues = [];
const cents = (value) => Math.round((Number(value) || 0) * 100);

for (const contract of data.contracts) {
  const schedule = Array.isArray(contract.schedule) ? contract.schedule : [];
  const scheduleCents = schedule.reduce((sum, row) => sum + cents(row.scheduled), 0);
  const paidCents = schedule.reduce((sum, row) => sum + cents(row.paid), 0);
  const expectedCents = cents(contract.totalReceivable);

  if (schedule.length !== Number(contract.termMonths)) {
    issues.push({ id: contract.id, check: 'term rows', expected: contract.termMonths, actual: schedule.length });
  }
  if (scheduleCents !== expectedCents) {
    issues.push({ id: contract.id, check: 'schedule total', expected: expectedCents / 100, actual: scheduleCents / 100, difference: (scheduleCents - expectedCents) / 100 });
  }
  if (paidCents !== cents(contract.paidTotal)) {
    issues.push({ id: contract.id, check: 'paid total', expected: cents(contract.paidTotal) / 100, actual: paidCents / 100 });
  }
  for (let index = 1; index < schedule.length; index += 1) {
    if (String(schedule[index].dueDate) <= String(schedule[index - 1].dueDate)) {
      issues.push({ id: contract.id, check: 'due-date order', expected: `after ${schedule[index - 1].dueDate}`, actual: schedule[index].dueDate });
    }
  }
}

console.log(`Audited ${data.contracts.length} seed contracts.`);
if (issues.length) {
  console.table(issues);
  console.log(`${issues.length} data-integrity issue(s) require source review; no financial records were changed.`);
} else {
  console.log('No data-integrity issues found.');
}

if (process.argv.includes('--strict') && issues.length) process.exitCode = 1;
