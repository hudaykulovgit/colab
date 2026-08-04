const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'middleware.js'), 'utf8');
const start = source.indexOf('function loginPage');
const end = source.indexOf('export default', start);
const context = {};
vm.runInNewContext(source.slice(start, end), context);

test('login page uses the light palette and accessible form structure', () => {
  const html = context.loginPage(false);
  for (const color of ['#ea526f', '#f7f7ff', '#23b5d3', '#279af1']) {
    assert.match(html, new RegExp(color));
  }
  assert.doesNotMatch(html, /#070600/);
  assert.match(html, /<label for="password">/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /class="capabilities"/);
  assert.match(html, /src="\/assets\/finance-landing\.jpg"/);
  assert.match(html, />Contracts<\/strong>/);
  assert.match(html, />Payments<\/strong>/);
  assert.match(html, />Forecasting<\/strong>/);
  assert.doesNotMatch(html, /autofinance-3d-hero/);
  assert.doesNotMatch(html, /Password not recognized/);
});

test('login page renders a useful authentication error', () => {
  assert.match(context.loginPage(true), /Password not recognized/);
});

test('logout route expires the authentication cookie', () => {
  assert.match(source, /url\.pathname === '\/logout'/);
  assert.match(source, /Max-Age=0/);
  assert.match(source, /Location: '\/login'/);
});

test('landing illustration is public so it loads before authentication', () => {
  assert.match(source, /url\.pathname === '\/assets\/finance-landing\.jpg'/);
});
