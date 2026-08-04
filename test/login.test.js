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

test('login page uses the requested Autofinance palette and one-click login', () => {
  const html = context.loginPage(false);
  for (const color of ['#ea526f', '#f7f7ff', '#23b5d3', '#279af1', '#1d3342']) {
    assert.match(html, new RegExp(color));
  }
  assert.doesNotMatch(html, /#070600/);
  assert.doesNotMatch(html, /type="password"|name="password"|autocomplete="current-password"/);
  assert.match(html, /<button class="login-button" id="login" type="submit">/);
  assert.match(html, /family=Roboto/);
  assert.match(html, /Material\+Symbols\+Rounded/);
  assert.match(html, /class="material-symbols-rounded"/);
  assert.match(html, /font-variation-settings:"FILL" 0,"wght" 400/);
  assert.doesNotMatch(html, /Iowan Old Style|Baskerville|Georgia/);
  assert.match(html, /The next era of/);
  assert.match(html, /<em>Auto<\/em> Finance/);
  assert.match(html, /class="deck"/);
  assert.match(html, /class="mini-card quick"/);
  assert.match(html, /class="mini-card balance"/);
  assert.match(html, /class="mini-card forecast"/);
  assert.doesNotMatch(html, /finance-landing\.jpg|landing-art/);
  assert.doesNotMatch(html, /autofinance-3d-hero/);
  assert.doesNotMatch(html, /Password not recognized|workspace password/i);
});

test('login route creates a session without a password challenge', () => {
  assert.doesNotMatch(source.slice(source.indexOf('export default')), /form\.get\('password'\)/);
  assert.match(source, /Set-Cookie/);
});

test('logout route expires the authentication cookie', () => {
  assert.match(source, /url\.pathname === '\/logout'/);
  assert.match(source, /Max-Age=0/);
  assert.match(source, /Location: '\/login'/);
});

test('removed landing illustration is not exposed before authentication', () => {
  assert.doesNotMatch(source.slice(source.indexOf('export default')), /finance-landing\.jpg/);
});
