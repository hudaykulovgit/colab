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

test('login page uses the Linear light design system and one-click login', () => {
  const html = context.loginPage(false);
  for (const color of ['#5e6ad2', '#828fff', '#5e69d1', '#ffffff', '#f5f6f6', '#f6f7f7', '#000000', '#62666d', '#8a8f98']) {
    assert.match(html, new RegExp(color));
  }
  assert.doesNotMatch(html, /#010102|#0f1011|#141516|#18191a|#23252a|#34343a/);
  assert.doesNotMatch(html, /type="password"|name="password"|autocomplete="current-password"/);
  assert.match(html, /<button class="login-button" id="login" type="submit">/);
  assert.match(html, /family=Roboto/);
  assert.match(html, /Material\+Symbols\+Rounded/);
  assert.match(html, /class="material-symbols-rounded"/);
  assert.match(html, /font-variation-settings:"FILL" 0,"wght" 400/);
  assert.match(html, /Your entire auto finance portfolio, in focus/);
  assert.match(html, /class="product-wrap"/);
  assert.match(html, /class="window-bar"/);
  assert.match(html, /Miraziz Mirjalolov/);
  assert.match(html, /Neon connected/);
  assert.doesNotMatch(html, /linear-gradient|radial-gradient/);
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
