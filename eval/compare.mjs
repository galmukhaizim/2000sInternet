// Compare two eval runs:  node eval/compare.mjs eval/out/A/summary.json eval/out/B/summary.json
import fs from 'node:fs';

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
if (!a || !b) {
  console.error('usage: node eval/compare.mjs <summaryA.json> <summaryB.json>');
  process.exit(1);
}
const byName = (s) => Object.fromEntries(s.sites.map((x) => [x.name, x]));
const A = byName(a);
const B = byName(b);
const names = [...new Set([...Object.keys(A), ...Object.keys(B)])];
const cell = (r) => (r && r.report ? `${r.report.initial}→${r.report.total}` : r && r.error ? 'fail' : '-');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('site', 24), pad(a.label, 16), pad(b.label, 16), 'Δ remaining');
let ta = 0;
let tb = 0;
for (const n of names) {
  const ra = A[n];
  const rb = B[n];
  const va = ra && ra.report ? ra.report.total : null;
  const vb = rb && rb.report ? rb.report.total : null;
  if (va != null) ta += va;
  if (vb != null) tb += vb;
  console.log(pad(n, 24), pad(cell(ra), 16), pad(cell(rb), 16), va != null && vb != null ? vb - va : '');
}
console.log(pad('TOTAL remaining', 24), pad(ta, 16), pad(tb, 16), tb - ta);
