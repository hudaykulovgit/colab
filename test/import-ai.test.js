const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const handler = require('../api/import-ai');
const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'import-ai.js'), 'utf8');

function invoke(req) {
  const response = { statusCode: 200, headers: {}, body: undefined };
  const res = {
    setHeader(name, value) { response.headers[name] = value; },
    status(code) { response.statusCode = code; return this; },
    json(body) { response.body = body; return response; },
  };
  return Promise.resolve(handler(req, res)).then(() => response);
}

test('AI importer uses Groq strict structured output with the supported model', () => {
  assert.match(source, /openai\/gpt-oss-120b/);
  assert.match(source, /strictJsonSchema:\s*true/);
  assert.match(source, /Output\.object/);
  assert.doesNotMatch(source, /meta-llama\/llama-4-scout/);
});

test('AI importer rejects oversized batches before calling a model', async () => {
  const response = await invoke({ method: 'POST', body: { rows: Array.from({ length: 151 }, () => ({})) } });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /150 or fewer/);
});

test('AI importer handles an empty sheet without calling a model', async () => {
  const response = await invoke({ method: 'POST', body: { rows: [] } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { imported: 0, issues: [] });
});
