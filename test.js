// node test.js
const assert = require('assert');
const { labelsFor, HINT_CHARS, lowerWithOffsets } = require('./content.js');

for (const n of [0, 1, 9, 10, 81, 82, 200]) {
  const l = labelsFor(n);
  assert.strictEqual(l.length, n, `count for ${n}`);
  assert.strictEqual(new Set(l).size, n, `unique for ${n}`);
  assert.ok(l.every((s) => [...s].every((c) => HINT_CHARS.includes(c))), `charset for ${n}`);
  assert.strictEqual(new Set(l.map((s) => s.length)).size <= 1, true, `uniform for ${n}`);
}

// no label is a prefix of another -> typing an exact label is unambiguous
const l = labelsFor(50);
assert.ok(!l.some((a) => l.some((b) => a !== b && b.startsWith(a))));

assert.deepStrictEqual(labelsFor(3), ['a', 's', 'd']);
assert.strictEqual(labelsFor(10)[9], 'sa');

const folded = lowerWithOffsets('\u0130a');
assert.strictEqual(folded.lower, 'i\u0307a');
assert.deepStrictEqual(folded.starts, [0, 0, 1]);
assert.deepStrictEqual(folded.ends, [1, 1, 2]);

console.log('ok');
