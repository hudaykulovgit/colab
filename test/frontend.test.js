const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>/);

function functionSource(name, nextName) {
  const start = inlineScript[1].indexOf(`function ${name}`);
  const end = inlineScript[1].indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} was not found`);
  assert.notEqual(end, -1, `${nextName} boundary was not found`);
  return inlineScript[1].slice(start, end);
}

test('dashboard inline JavaScript parses', () => {
  assert.ok(inlineScript, 'inline dashboard script was not found');
  assert.doesNotThrow(() => new vm.Script(inlineScript[1]));
});

test('dashboard uses Google Roboto and Material Symbols for interface icons', () => {
  assert.match(html, /family=Roboto/);
  assert.match(html, /Material\+Symbols\+Rounded/);
  assert.match(html, /const MATERIAL_ICONS =/);
  assert.match(html, /class="material-symbols-rounded"/);
  assert.match(html, /font-variation-settings: "FILL" 0, "wght" 400/);
  assert.doesNotMatch(functionSource('iconSvg', 'hydrateIcons'), /<svg/);
});

test('operational dates use today instead of the seed snapshot date', () => {
  assert.match(html, /const dataDate = new Date\(\)/);
  assert.match(html, /form\.contractDate\.value=currentDateISO/);
  assert.match(html, /getElementById\('paymentDate'\)\.value=currentDateISO/);
  assert.doesNotMatch(html, /form\.contractDate\.value=SEED_DATA\.asOf/);
  assert.doesNotMatch(html, /getElementById\('paymentDate'\)\.value=SEED_DATA\.asOf/);
});

test('dashboard uses the requested light visual system without pitch black', () => {
  for (const color of ['#ea526f', '#f7f7ff', '#23b5d3', '#279af1']) {
    assert.match(html, new RegExp(color));
  }
  assert.doesNotMatch(html, /#070600|--pitch-black/);
  assert.doesNotMatch(html, /hero-graphic|hero-car|hero-line|hero-chip|LIVE PORTFOLIO/);
});

test('current month is included and highlighted in both cash-flow charts', () => {
  assert.match(html, /renderCashflowChart\('cashflowChart', monthSeries\(-11, 0\), true\)/);
  assert.match(html, /renderCashflowChart\('forecastChart', monthSeries\(0,11\), false\)/);
  assert.match(html, /isCurrent: offset === 0/);
  assert.match(html, /legend_current: 'Текущий месяц'/);
});

test('finance owner identity is Miraziz Mirjalolov', () => {
  assert.match(html, /profile_name: 'Miraziz Mirjalolov'/);
  assert.match(html, /<div class="avatar">MM<\/div>/);
});

test('sidebar snapshot badge is removed and a logout control is visible', () => {
  assert.doesNotMatch(html, /id="sidebarSource"/);
  assert.doesNotMatch(html, /Загружен снимок Excel/);
  assert.match(html, /<form class="logout-form" method="post" action="\/logout">/);
  assert.match(html, /btn_logout: 'Выйти'/);
});

test('manual financial writes wait for Neon confirmation before updating the UI', () => {
  assert.match(html, /await saveContracts\(draft\); contracts\[index\]=draft/);
  assert.match(html, /await saveContracts\(draft\); contracts\.unshift\(draft\)/);
  assert.match(html, /res\.status !== 200/);
  assert.doesNotMatch(html, /Saved locally, but failed to sync/);
});

test('Excel uploads recognize a Payments sheet and send it to the Neon import API', () => {
  assert.match(html, /const paymentSheet=\/payment\|плат\[её\]ж\|оплат\/i/);
  assert.match(html, /JSON\.stringify\(\{rows,paymentRows\}\)/);
});

test('financial entry dialogs cannot disappear from backdrop clicks', () => {
  assert.doesNotMatch(html, /event\.target===dialog\)dialog\.close/);
  assert.match(html, /dialog\.addEventListener\('cancel'/);
  assert.match(html, /confirm_discard_changes/);
});

test('browser schedule generation balances to the cent', () => {
  const context = {
    parseISO: (value) => new Date(`${value}T12:00:00Z`),
    addMonths: (value, months) => {
      const date = new Date(value);
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + months);
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day, lastDay));
      return date;
    },
    isoDate: (value) => value.toISOString().slice(0, 10),
  };
  vm.runInNewContext(functionSource('generateSchedule', 'allocatePayment'), context);
  const schedule = context.generateSchedule('2026-08-31', 12, 10000);
  assert.equal(schedule.reduce((sum, row) => sum + Math.round(row.scheduled * 100), 0), 1000000);
  assert.equal(schedule[11].scheduled, 833.37);
});

test('payment allocation records cents and handles legacy schedule gaps', () => {
  const context = {};
  vm.runInNewContext(functionSource('allocatePayment', 'requestDialogClose'), context);
  const schedule = [
    { dueDate: '2026-01-01', scheduled: 100, paid: 99.99 },
    { dueDate: '2026-02-01', scheduled: 0, paid: 0 },
  ];
  assert.equal(context.allocatePayment(schedule, 0.02, 0.02), 0.02);
  assert.equal(schedule[0].paid, 100);
  assert.equal(schedule[1].paid, 0.01);
});
