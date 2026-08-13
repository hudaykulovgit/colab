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

test('login page provides Russian password entry with a language switcher', () => {
  const html = context.loginPage(false);
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /Вход в панель управления/);
  assert.match(html, /type="password" name="password"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /data-lang="ru"/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /autofinance-lang/);
  assert.match(html, /family=DM\+Sans/);
  assert.match(html, /Material\+Symbols\+Rounded/);
  assert.match(html, /linear-gradient\(90deg,var\(--coral\)/);
  assert.doesNotMatch(html, /finance-landing\.jpg|landing-art|autofinance-3d-hero/);
  assert.match(context.loginPage(true), /role="alert"/);
});

test('login route validates the submitted password before creating a session', () => {
  const middleware = source.slice(source.indexOf('export default'));
  assert.match(middleware, /await request\.formData\(\)/);
  assert.match(middleware, /form\.get\('password'\)/);
  assert.match(middleware, /submittedHash !== expectedHash/);
  assert.match(middleware, /status: 401/);
  assert.match(middleware, /Set-Cookie/);
});

test('logout route expires the authentication cookie', () => {
  assert.match(source, /url\.pathname === '\/logout'/);
  assert.match(source, /Max-Age=0/);
  assert.match(source, /Location: '\/login'/);
});

test('removed landing illustration is not exposed before authentication', () => {
  assert.doesNotMatch(source.slice(source.indexOf('export default')), /finance-landing\.jpg/);
});