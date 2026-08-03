const test = require('node:test');
const assert = require('node:assert/strict');

const { addMonths, generateSchedule, allocatePayment } = require('../lib/schedule');

test('addMonths preserves month-end dates without overflowing', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonths('2026-08-31', 1), '2026-09-30');
});

test('generateSchedule installments total exactly to the receivable', () => {
  const schedule = generateSchedule('2026-08-31', 12, 10000);

  assert.equal(schedule.length, 12);
  assert.equal(
    schedule.reduce((sum, row) => sum + Math.round(row.scheduled * 100), 0),
    1000000
  );
  assert.equal(schedule[11].scheduled, 833.37);
});

test('generateSchedule rejects invalid financial inputs', () => {
  assert.throws(() => generateSchedule('2026-08-31', 0, 10000), /positive integer/);
  assert.throws(() => generateSchedule('2026-08-31', 12.5, 10000), /positive integer/);
  assert.throws(() => generateSchedule('2026-08-31', 12, -1), /non-negative finite/);
  assert.throws(() => generateSchedule('2026-08-31', 12, Number.NaN), /non-negative finite/);
});

test('allocatePayment applies imported cash in cents and caps it at outstanding', () => {
  const schedule = generateSchedule('2026-08-31', 2, 100);
  assert.equal(allocatePayment(schedule, 60.01, 100), 60.01);
  assert.deepEqual(schedule.map(row => row.paid), [50, 10.01]);
  assert.equal(allocatePayment(schedule, 100, 39.99), 39.99);
  assert.deepEqual(schedule.map(row => row.paid), [50, 50]);
});
