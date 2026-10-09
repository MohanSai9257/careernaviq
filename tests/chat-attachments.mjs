import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync('worker/chat.js', 'utf8');
const helpers = source.slice(
  source.indexOf('async function chatInput'),
  source.length,
);
const objects = new Map(),
  rows = [];
const database = {
  prepare(sql) {
    return {
      bind(...values) {
        this.values = values;
        return this;
      },
      async run() {},
      async all() {
        return { results: [] };
      },
    };
  },
  async batch(statements) {
    rows.push(...statements);
  },
};
const context = vm.createContext({
  crypto: globalThis.crypto,
  bucket: () => ({
    put: async (k, v) => objects.set(k, v),
    delete: async (k) => objects.delete(k),
  }),
  jsonInput: (r) => r.json(),
  Map,
  Error,
});
vm.runInContext(helpers, context);
const form = new FormData();
form.append('body', '');
form.append('files', new Blob(['PDF sample']), 'resume.pdf');
const input = await context.chatInput(
  new Request('https://test/api', { method: 'POST', body: form }),
);
assert.equal(input.files.length, 1);
assert.equal(input.body, '');
await context.saveChatFiles(database, {}, input, 'message', 'user@example.com');
assert.equal(objects.size, 1);
assert.equal(rows.length, 1);
assert.equal(rows[0].values[2], 'user@example.com');
const tooMany = new FormData();
for (let i = 0; i < 6; i++) tooMany.append('files', new Blob(['x']), 'a.txt');
await assert.rejects(
  () =>
    context.chatInput(
      new Request('https://test/api', { method: 'POST', body: tooMany }),
    ),
  /5 files/,
);
const json = await context.chatInput(
  new Request('https://test/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'hello' }),
  }),
);
assert.equal(json.body, 'hello');
assert.equal(json.files.length, 0);
console.log(
  'Chat attachment parsing, storage metadata, attachment-only messages, limits, and text compatibility passed.',
);
