// Validates model CSS against a saved page (jsdom) exactly like the userscript.
//   node userscript/scripts/validate-cli.mjs --html page.html --css design.css
//   cat examples.jsonl | node userscript/scripts/validate-cli.mjs --jsonl -    # {html|html_path, css, mode?}
// Output: JSON per input: { css, kept, dropped, errors, iconRequests, applyClass, appliedClasses, ok }
import fs from 'node:fs';
import { loadLibWithDom, readJsonLines } from './lib-loader.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));

export async function validateExample({ html, css, mode = 'design' }) {
  const { lib, document } = await loadLibWithDom(html);
  const d = lib.extractDirectives(css);
  const v = lib.validateCss(d.css, { doc: document, mode });
  const ac = lib.validateApplyClass(d.applyClass, { doc: document, classNames: lib.libraryClassNames() });
  const stats = { kept: v.kept, dropped: v.dropped.length, errors: v.errors.length, iconVars: v.iconVars };
  // "ok" = usable as a training example: mostly valid, nothing dangerous dropped, enough rules
  const dangerous = v.dropped.filter((x) => /dangerous|external|blocked|hides-content|protected/.test(x.reason));
  const ok = v.kept >= 8 && dangerous.length === 0 && v.errors.length <= 2 && v.dropped.length <= Math.max(3, v.kept * 0.25);
  return { css: v.css, ...stats, droppedRules: v.dropped, parseErrors: v.errors, iconRequests: d.iconRequests, applyClass: ac.applied.map(({ selector, className, count }) => ({ selector, className, count })), droppedApplyClass: ac.dropped, ok };
}

async function main() {
  if (args.jsonl) {
    for (const ex of readJsonLines(args.jsonl)) {
      const html = ex.html || fs.readFileSync(ex.html_path, 'utf8');
      const r = await validateExample({ html, css: ex.css, mode: ex.mode });
      process.stdout.write(JSON.stringify({ id: ex.id, ...r }) + '\n');
    }
    return;
  }
  if (!args.html || !args.css) {
    console.error('usage: validate-cli --html page.html --css design.css | --jsonl file');
    process.exit(2);
  }
  const r = await validateExample({ html: fs.readFileSync(args.html, 'utf8'), css: fs.readFileSync(args.css, 'utf8'), mode: args.mode });
  process.stdout.write(JSON.stringify(r, null, 1) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
