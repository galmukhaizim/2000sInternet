# retro-web — project guide for Claude sessions

A Tampermonkey userscript that redesigns any website in a 2000s internet aesthetic
(GeoCities, glossy Web 2.0, Y2K chrome, early-blog, Win98 UI …). A small language
model running locally in the browser (WebLLM / WebGPU) acts as an open-ended
designer: it writes site-specific CSS, picks a sub-style, then inspects the rendered
result and repairs its own layout mistakes. Icons the asset library lacks are
generated once by the Claude API and cached forever.

Read this file before changing anything. Ask the user before making major
architectural changes to the spec summarised here.

## Repository layout

```
CLAUDE.md                     this file
README.md                     setup, dev workflow, testing per phase
package.json                  single npm workspace (esbuild, vitest, jsdom, playwright, web-llm)
userscript/
  build.mjs                   esbuild bundler: src/ -> dist/retro.user.js, host/ -> dist/host/
  header.txt                  Tampermonkey metadata block (single source of truth)
  dev/retro.dev.user.js       stub that @requires dist/retro.user.js via file://
  src/
    index.js                  entry: orchestrates the pipeline on every page
    config.js                 defaults (model ids, budgets, host URL, limits)
    storage.js                GM_* wrappers (+ localStorage fallback for the eval harness)
    csp.js                    detects blocked styles / frames / workers / WebGPU
    apply.js                  constructed-stylesheet applier (progressive, CSP-safe)
    summarize.js              page -> compact text summary under a token budget
    validate.js               CSS parser + validator + clamps (design and patch mode)
    assets/
      library.css             TOOLKIT (not a theme): custom properties + utility classes
      manifest.json           name/type/description of every asset (goes in the prompt)
      icons/*.svg, backgrounds/*.svg, cursors/*.svg   hand-made inline assets
    packs/
      themes.js               one hand-made theme per sub-style (colors, fonts, textures, control styles, extras)
      render.js               theme + page summary -> instant base CSS (nav icons by link text, decorations)
    model/
      engine.js               transport to the model host iframe (postMessage protocol)
      designer.js             prompt building, streaming design generation, directive parsing
      prompts.js              system prompts for design + repair
      styles.js               re-exports training/styles.json
    icons/
      index.js                resolve icon-requests: library -> cache -> Claude API -> fallback
      claude.js               GM_xmlhttpRequest call to the Claude Messages API
      sanitize.js             SVG allowlist sanitizer
      cache.js                shared icon cache in GM storage
    repair/
      inspect.js              layout inspector -> structured issue report
      loop.js                 model-driven repair loop (N rounds)
      fallbacks.js            deterministic fixes for issues the model could not fix
    ui/panel.js               floating retro control panel (closed shadow root)
  host/
    index.html, host.js       the model host page (bundles WebLLM), served on a fixed origin
    serve.mjs                 tiny static server for local dev (http://localhost:4173)
  src/pipeline.js             orchestration: cache → summarize → model → validate → apply → icons → repair
eval/mock-host/               GPU-free fake host speaking the same protocol (streams canned CSS)
  scripts/                    node CLIs shared with training/eval (prompts-cli, validate-cli, inspect-cli, lib-loader)
  test/                       vitest unit tests (validator, sanitizer, inspector, summarizer)
eval/                         Playwright harness: before/after screenshots + issue report
training/                     Python pipeline (scrape, teacher dataset, repair dataset, LoRA, convert); data/ and checkpoints/ are git-ignored
```

## Architecture decisions (keep consistent)

0. **Hybrid design flow** (`settings.designMode`, default `hybrid`). The page
   summary feeds a hand-made **style pack** (`packs/`) that applies instantly and
   is cached at once; the model then adds 10–20 site-specific rules on top
   (`generateDesign({ enhance: true })`, compact manifest, ≤700 tokens) and runs
   one repair round. `pack` mode skips the model entirely (works with no GPU, on
   CSP-blocked sites, in the eval harness); `model` mode is the original
   model-writes-everything behaviour. Themes use only library assets and plain
   colors and must pass the validator unchanged (packs.test.js renders every
   theme on every fixture).
1. **Model host iframe.** WebLLM runs inside a hidden `<iframe>` whose `src` is a
   fixed origin (`settings.hostUrl`, default the GitHub Pages site
   `https://galmukhaizim.github.io/2000sInternet/host/`, or `http://localhost:4173/`
   for local development), NOT in the page context. Reason: the Cache API / IndexedDB that WebLLM uses for weights are
   origin-scoped, so running in-page would re-download ~1 GB per site; a fixed
   origin downloads once. It also sidesteps page CSP rules on `connect-src` and WASM.
   The userscript and host talk over `postMessage` (protocol in `model/engine.js`,
   mirrored in `host/host.js`). If the frame is blocked by `frame-src`, we fall back
   to opening the host as a popup window (`connect({ mode: 'popup' })`, needs a
   user gesture; the block is remembered per site as `frameBlocked`), otherwise
   cached CSS if present, else a notice. Never move the model into the page context
   without asking the user.
2. **CSS is applied through constructed stylesheets** (`document.adoptedStyleSheets`),
   which page CSP cannot block, with a `<style>` element fallback. Every declaration
   produced by the model is applied with `!important` so the redesign wins over site
   CSS; later patches win over earlier ones by source order.
3. **The model only writes CSS** plus two comment directives, one per line:
   - `/* icon-request: <name> | <description> */` — ask for an icon the library lacks;
     the resolver defines `--icon-<name>` so CSS may use `var(--icon-<name>)`.
   - `/* apply-class: <selector> | <library-class> */` — attach a library utility
     class to matching elements (the model cannot touch the DOM otherwise).
4. **Validation is mandatory** before any model CSS touches the page (full designs
   and repair patches). See `validate.js`: parse, reject malformed rules, drop
   selectors that match nothing, block `@import` and non-`data:` `url()`, clamp
   absurd values, refuse to hide the page. **Layout guard rails**: layout
   properties (display, position, size, flex/grid, overflow, transform, …) only on
   selectors matching ≤ `maxLayoutMatches` (40) elements; margin/padding only up to
   `maxSpacingMatches` (150) and gently clamped beyond 40; media elements
   (video/iframe/canvas…) accept cosmetics only and their containers cannot be
   resized/hidden; flex/grid containers cannot become block; `content` only on
   pseudo-elements. The summarizer hides framework scoping classes (stamped on
   >10% of elements) so the model never selects them.
5. **Library is a toolkit, not a theme.** `library.css` only defines custom
   properties (`--icon-*`, `--bg-*`, `--font-*`, `--cursor-*`, `--grad-*`, recipe
   vars) and opt-in utility classes (`.retro-*`, `.marquee-bar`, `.hit-counter`,
   `.under-construction`). Nothing in it restyles a page by itself. All assets are
   inline data URIs; no external hosting. `manifest.json` must list every asset
   (a unit test enforces this).
6. **Per-domain cache.** The final post-repair CSS (+ icon vars + directives) is
   stored under `site:<hostname>` in GM storage so repeat visits are instant.
7. **Icons from Claude** go through `icons/claude.js` only. Fast Haiku-class model,
   id in `config.js` (`claude-haiku-5-5` as of 2026-11). Send ONLY the icon name and
   description. Every SVG goes through `sanitize.js`. Cache by hash of
   name+description in GM storage under `icon:<hash>`.
8. **Repair loop** = inspect → model patch → validate → apply → re-inspect, up to
   `settings.maxRepairRounds` (default 1 since the hybrid flow). Leftover issues
   get deterministic fixes from `repair/fallbacks.js` and are logged in the panel
   report. A quick inspect+fallback pass (0 rounds) also runs right after the
   style pack. Inspector issue types: overflow-x, edge-touch,
   spacing-inconsistent, padding-collapsed/excessive, icon-off-center,
   icon-overlaps-text, icon-duplicate, icon-missing, text-clipped, overlap,
   contrast-low, font-too-small, invisible. When a padding fix is refused as too
   broad, the loop removes the background icon instead (never leave an icon
   under text).
9a. **Packs and big navs**: `renderPack` gives full button/icon treatment only to
   navs with ≤ 40 links (per nav); bigger navs (app sidebars, chip strips) get
   colors only. Links/buttons that already contain an svg/img never get a
   background icon (`navLinks[].hasIcon`, `buttons[].hasIcon`).
9. **Summarizer, validator and inspector are pure functions of a `document`**
   (plus an injectable `measure` adapter for the inspector) so they run unchanged
   in the userscript, in vitest/jsdom, and inside Playwright for eval/training.
10. **Shared sub-style list** lives in `training/styles.json`; the userscript
    imports it at build time. Do not duplicate it. Likewise the Python pipeline
    reads prompts/manifest from the built library via `prompts-cli.mjs` — never
    copy prompt text into Python.
11. **Custom models**: `settings.customModelUrl` (+ optional `customModelLib`)
    in the panel's Advanced section points the host at a Hugging Face MLC repo;
    `pipeline.resolveModel()` turns it into the WebLLM model record.

## Security rules (non-negotiable)

- **The Claude API key is never hardcoded or committed.** On first use the panel
  (or the `Set Claude API key` menu command) asks for it, stores it with
  `GM_setValue('apiKey')`, and reads it with `GM_getValue` at request time only.
  `GM_registerMenuCommand` exposes "Set/Clear Claude API key".
- The key must never reach the page context: no `unsafeWindow`, never written into
  `<script>` tags, DOM attributes, `localStorage` of the page, or console logs. It
  is only ever placed in the `headers` of a `GM_xmlhttpRequest`. The panel shows
  "key set" / "no key", never the key itself.
- Never send page content, URLs, titles, or any user data to the Claude API. The
  only payload is the icon name + description (and the fixed style system prompt).
- The model host iframe never receives the key and never talks to the Claude API.
- `.gitignore` excludes `.env*`, model weights, datasets, checkpoints, `node_modules`,
  eval output.

## Publishing (the repo IS the userscript)

- The repo is **public**. Users install from the raw URL of the committed bundle:
  `https://raw.githubusercontent.com/galmukhaizim/2000sInternet/HEAD/userscript/dist/retro.user.js`
  (`HEAD` = default branch, so renaming the branch is safe). The header's
  `@downloadURL`/`@updateURL` point there; Tampermonkey updates when `@version`
  in `userscript/header.txt` increases. **Bump `@version` (and `VERSION` in
  `config.js`, `host.js`, `package.json`) whenever a change should reach users.**
- `.github/workflows/pages.yml` builds on every push and deploys `userscript/dist`
  to GitHub Pages from the default branch: the model host lives at
  `https://galmukhaizim.github.io/2000sInternet/host/` and a second install link at
  `https://galmukhaizim.github.io/2000sInternet/retro.user.js`.
- Always commit a freshly built `dist/retro.user.js` with source changes (the raw
  URL serves the committed file, not a CI build).

## Userscript conventions

- Metadata header lives in `userscript/header.txt`; `build.mjs` prepends it.
  Required: `@match *://*/*`, `@noframes`, grants `GM_xmlhttpRequest GM_setValue
  GM_getValue GM_deleteValue GM_listValues GM_registerMenuCommand GM_addStyle`,
  `@connect api.anthropic.com` + model-weight hosts (`huggingface.co`,
  `cdn-lfs.huggingface.co`, `raw.githubusercontent.com`) + `localhost`.
- The dev stub (`userscript/dev/retro.dev.user.js`) carries the same header
  (minus update URLs) plus `@require file:///…/userscript/dist/retro.user.js`.
  Tampermonkey needs "Allow access to file URLs" for this. `serve.mjs` also
  serves `/retro.remote.user.js` for remote dev boxes (Codespaces).
- No external runtime dependencies in the userscript bundle (web-llm is bundled
  only into the host page). Keep `dist/retro.user.js` dependency-free.
- `dist/retro.user.js` and `dist/retro.lib.js` are committed so the file:// dev
  stub and the harnesses work from a fresh clone. `dist/host/host.js` (~6 MB,
  bundles WebLLM) is git-ignored: `npm run build` before `npm run host`.
  Rebuild (`npm run build`) before committing changes to `src/`.
- Page state for harnesses: `document.documentElement.dataset.retroWebState`
  (`idle | loading-model | designing | repairing | done | error | disabled`) and a
  `retro-web:status` CustomEvent on `document`. No globals on `window`.
- Panel UI lives in a **closed** shadow root on a custom element
  `<retro-web-panel>`; page CSS never reaches it, and model CSS is validated so it
  cannot hide it.
- All model-facing text (prompts, manifest) must stay small: a 1.5B model with a
  ~8k context. Summary ≤ ~1,500 tokens (configurable), manifest ≤ ~700 tokens.

## Testing conventions

- `npm test` runs vitest (jsdom environment) for validator, sanitizer, inspector,
  summarizer, and the manifest/library consistency check.
- Inspector tests inject geometry through the `measure` adapter — never rely on
  jsdom layout (it has none).
- `npm run eval` needs a real Chromium (Playwright) and, for model runs, WebGPU.
- Never commit model weights, datasets, API keys, or eval screenshots.

## Working agreements

- Commit after each phase with a clear message; rebuild `dist/` first.
- Explain how to test each phase in Tampermonkey (README "Testing by phase").
- Ask the user before deviating from the architecture above.
