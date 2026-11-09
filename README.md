# retro-web

A Tampermonkey userscript that redesigns **any website in a 2000s internet
aesthetic** — GeoCities, glossy Web 2.0, Y2K chrome, early blogs, Win98 dialogs,
phpBB forums… A small language model running **locally in your browser**
(WebLLM on WebGPU) acts as an open-ended designer: it writes site-specific CSS,
picks a sub-style that fits the site, then inspects the rendered result and fixes
its own layout mistakes. Icons the hand-made asset library lacks are generated once
by the Claude API and cached forever.

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the rules every change must
follow.

## How it works

```
page ──► summarize.js ──► style pack (hand-made theme for the chosen 2000s sub-style,
                           instant: fonts, textures, colors, bevel/glossy controls,
                           nav icons matched to link text, counter, marquee…)
                               │
                               ▼  (hybrid mode, in the background)
                         designer model (WebLLM, hidden frame or popup on a fixed origin)
                           adds 10–20 site-specific rules: cards, posts, badges, icons
                               │  streams CSS + /* icon-request */ + /* apply-class */
                               ▼
                         validate.js (layout guard rails) ──► apply.js (constructed sheets)
                               │
            icons/ (library → cache → Claude API → placeholder)
                               │
              repair/inspect.js ──► issue report ──► model patch ──► deterministic fallbacks
                               ▼
                   per-domain cache (GM storage) · control panel
```

**Modes** (panel → Advanced → Mode): *style pack + model touches* (default),
*style pack only* (instant, no GPU, works everywhere), *model writes everything*
(the original slow behaviour, for comparing models).

## Install (one click)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome, Edge or Brave.
   In `chrome://extensions` turn on **Developer mode** (recent Chrome needs it for
   userscripts to run).
2. Open this link; Tampermonkey shows an install dialog:

   **[https://raw.githubusercontent.com/galmukhaizim/2000sInternet/HEAD/userscript/dist/retro.user.js](https://raw.githubusercontent.com/galmukhaizim/2000sInternet/HEAD/userscript/dist/retro.user.js)**

3. Visit any site. The retro-web window appears bottom right and the first
   design starts automatically. The designer model (about 1 GB, downloaded once
   into your browser's cache from Hugging Face) runs inside a hidden frame
   served from this repo's GitHub Pages site, so nothing else needs to run.

The script auto-updates from this repo: every push rebuilds
`userscript/dist/retro.user.js` and Tampermonkey picks up new `@version`s.
GitHub Pages is published by `.github/workflows/pages.yml`; if the panel says
`model host unreachable`, enable Pages once in the repo settings
(**Settings → Pages → Source: GitHub Actions**) and re-run the workflow.

Optional: a Claude API key lets the model request icons the library lacks (see
below). Everything else works without it.

## Requirements

- Chrome / Edge / Brave with WebGPU (any recent version on a machine with a GPU).
  Firefox works for everything except the in-browser model unless WebGPU is enabled.
- For development: Node 20+. For the training pipeline: Python 3.10+.

## Development setup

```bash
npm install
npm run build          # -> userscript/dist/retro.user.js, retro.lib.js, host/
npm run host           # serves the model host page on http://localhost:4173/
```

Point the panel's **Advanced → Host URL** at `http://localhost:4173/` to use the
local host page instead of GitHub Pages while developing.

### Dev stub (load the local build on every page view)

1. In `chrome://extensions`, open Tampermonkey → **Details** → enable
   **Allow access to file URLs**.
2. In Tampermonkey's settings tab set **Config mode: Advanced**, then under
   **Externals** set *Update interval* to **Always** so `@require`d files are
   re-read on every page load instead of cached.
3. `npm run build` writes `userscript/dist/retro.dev.user.js` with the correct
   absolute `file://` path for this checkout. Open that file in the browser
   (`file:///…/userscript/dist/retro.dev.user.js`) and Tampermonkey offers to
   install it. Disable the published retro-web script while the dev stub is on.
4. Keep `npm run watch` running while developing; reload the page to pick up changes.

### Working from GitHub Codespaces or another remote dev box

A `file://` stub cannot reach a remote checkout. Let the dev server hand the
build to the browser instead:

1. In the Codespace: `npm install && npm run build && npm run host`.
2. In the **Ports** panel, set port **4173** to **Public** and copy its URL, e.g.
   `https://<codespace>-4173.app.github.dev`.
3. Open `https://<codespace>-4173.app.github.dev/retro.remote.user.js` in your
   browser and install the stub it offers (Externals *Update interval*: Always).
4. In the panel's **Advanced** section set **Host URL** to
   `https://<codespace>-4173.app.github.dev/` and save.

### What to expect

The style pack applies in well under a second and already carries the look:
background textures, era fonts, link colors, bevel or glossy buttons, inset
fields, nav icons chosen from the link text (Home → house, Contact → envelope,
Shop → cart …), bordered images, and per-style extras (visitor counter,
under-construction bar, marquee, scanlines, BETA badge, Aqua traffic lights).
The model then spends 15–30 s adding rules for the site's own elements (cards,
posts, badges, prices) and one repair round; the page is usable throughout.

Spacing is guarded by measurement, not guesswork. Before anything is applied
the script decides which elements may receive padding, margins or borders
(landmark containers, text nav links, text buttons, inputs) and records where
every element sits; afterwards it re-measures and automatically rolls back any
declaration that moved or resized an icon, a control, a pixel-positioned
element or anything inside a video player. Landmarks are verified by geometry
(a row of icon buttons is never a "nav"), broad selectors may only change
colors, backgrounds, borders and fonts, media players are never touched, and
the repair step never adds spacing. The **Report** lists what the guard rolled
back. App-like sites (YouTube, Gmail) therefore get a reskin rather than a new
layout. If a site still looks wrong, **Original** restores
it and **Enabled on this site** turns retro-web off there.

### Sites with a strict Content Security Policy

Some sites (GitHub, Google, many banks) send a CSP that forbids embedding
frames from other origins, so the hidden model frame cannot load there. The
panel then says *this site's security policy blocks the hidden model frame* and
asks you to press **Redesign**: that click lets the script open the model host
as a small popup window instead (CSP does not apply to popups), which closes by
itself when the design is done. Allow popups for the site if the browser blocks
it. The block is remembered per site, so later visits skip straight to the
popup prompt; cached designs still apply instantly without any model.

If you would rather have everything automatic on every site, Tampermonkey can
strip CSP headers for you: Tampermonkey → **Settings** (Config mode: Advanced)
→ **Security** → *Modify existing content security policy (CSP) headers* →
**Remove entirely**. This weakens a real protection against cross-site scripting
on every site you visit, so it is a trade-off to make knowingly; the popup
fallback does not need it.

### Claude API key (optional)

Open the panel → **Set key**, or use the Tampermonkey menu command
*retro-web: set Claude API key*. The key is stored with `GM_setValue` inside
Tampermonkey only, never on the page, never in the repo, and only ever sent to
`api.anthropic.com` via `GM_xmlhttpRequest` with the icon name and description.
Set it on a site you trust (e.g. `https://example.com`).

## Control panel

A small Win98-style window in the bottom-right corner:

- **Enabled on this site** — per-domain on/off (menu command too).
- **Style select / 🎲 / Redesign** — choose or randomise a sub-style and generate a new take.
- **Original** — remove the redesign for this page view.
- **Report** — show the last inspector issue report.
- **Clear site / Clear all** — drop the cached CSS for this domain or every domain.
- **Claude API: Set key / Clear key**.
- **Advanced** — model id, host URL, icon model, repair rounds, auto-design.

## Scripts

| command | what |
| --- | --- |
| `npm run build` | bundle userscript, library and host page into `userscript/dist/` |
| `npm run watch` | rebuild on change |
| `npm run host` | serve the model host page on port 4173 |
| `npm test` | vitest unit tests (validator, sanitizer, inspector, summarizer) |
| `npm run eval` | Playwright before/after screenshots + issue report (`eval/out/`) |

## Testing by phase

### Phase 1 — shell, build, panel

1. Install from the one-click link above (or build and install the dev stub).
2. Visit any site: the retro-web window appears bottom-right with status
   `v0.1.0 ready` (or a note such as `no WebGPU`). Drag it by the title bar,
   minimise it, toggle *Enabled on this site*, open *Advanced*.
3. Tampermonkey menu → *retro-web: set Claude API key* → the panel shows
   `key set`. Reload: still set. *Clear key* removes it. The key never appears in
   the page (check `document.body.innerHTML` in devtools — it is not there).
4. `npm run host` and open http://localhost:4173/ — the host page reports
   *open as a standalone page*. The userscript is excluded on that origin.

### Phase 2 — asset library, summarizer, validator

1. `npm test` — validator, summarizer and manifest/library consistency tests.
2. Reload any page with the dev stub installed. The asset library is now loaded
   on every page (it is inert: only custom properties and opt-in classes). In
   devtools run `getComputedStyle(document.documentElement).getPropertyValue('--icon-home')`
   to see a data URI, or add a class by hand:
   `document.querySelector('button').classList.add('retro-bevel-btn')`.
3. Tampermonkey menu → *retro-web: log page summary* prints the model-facing
   page summary to the console and shows it in the panel's report box. Check
   that landmarks, colors and selectors make sense on a few sites.
4. `userscript/dist/retro.lib.js` exposes `RetroWebLib.summarizePage`,
   `RetroWebLib.validateCss` and friends for harnesses.

### Phase 3 — in-browser designer model

1. With the published script the host page comes from GitHub Pages. For local
   development `npm run build` (also builds `userscript/dist/host/host.js`, ~6 MB,
   not committed) and `npm run host`, then set Host URL to http://localhost:4173/.
2. Visit a site with the dev stub installed. The panel shows
   `summarizing page…`, then `downloading model 1/N (first time only)` with a
   progress bar — the default `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` is about
   1 GB and is cached by the host origin, so later sites load it from cache in a
   few seconds — then `designing (Style name)… N rules` while rules stream in and
   are applied live, then `done`.
3. Reload: the design is applied instantly from the per-domain cache (status
   `cached design (style)`), no model frame is created.
4. Panel: pick a style and press **Redesign** (a new take with the same model),
   or 🎲 for a random style. **Original** removes the design for this view;
   **Clear site** forgets the cache; **Report** shows rule counts, dropped rules
   and directives for the last run.
5. If Chrome prompts for *local network access* when a public site embeds the
   localhost host frame, allow it. Sites with a strict `frame-src` CSP show
   `blocked by this site's CSP` and keep their cached design if any.
6. GPU-free protocol test: `node eval/run.mjs --mock` (phase 6) or serve
   `eval/mock-host/` on port 4173 — it streams canned Win98 CSS.

### Phase 4 — Claude icon generation

1. Panel → **Set key** (or the Tampermonkey menu command) on a trusted site.
   Status shows `key set`; the key only lives in Tampermonkey storage.
2. Redesign a page where the model asks for an icon the library lacks (the
   **Report** box lists `icon requests:` and `icons: name←source`). Sources:
   `library`, `library-alias` (fuzzy/synonym match, no API call), `cache`,
   `claude` (generated now), `fallback-library` / `placeholder` (API failed:
   the reason is in brackets, e.g. `[no-key]`, `[rate-limited]`, `[unsafe svg]`).
3. In devtools → Network you will see nothing: the request goes through
   `GM_xmlhttpRequest`, not the page. The Tampermonkey dashboard → Storage tab
   for the script shows `icon:<hash>` entries. Menu commands
   *list generated icons* / *clear generated icons* manage the shared cache.
4. Visit another site that requests the same icon: it resolves from `cache`
   without an API call.
5. Remove the key: requests fall back to the closest library icon or the
   placeholder; the design still completes.

### Phase 5 — inspector and self-correction loop

1. `npm test` covers every inspector check with synthetic geometry, the
   deterministic fallbacks and the loop itself.
2. Redesign a page: after the rules stream in, the status goes
   `inspecting layout…` → `repair round 1/3: N issue(s)…` → … → `done: … · issues 7→1`.
3. **Report** shows `REPAIR: 7 issue(s) found → 1 remaining after 3 round(s), 1
   deterministic fix(es)`, one line per round (`before→after issues, N patch
   rules`) and the remaining issues as `type: selector | measured detail`, e.g.
   `icon-off-center: button.search-btn > svg | offset x=+5px y=-3px from the center of button.search-btn`.
4. *Advanced → Repair rounds* = 0 skips the model rounds (inspector +
   deterministic fixes only); the cached design stores patch and fallback CSS
   separately so **Report** stays meaningful on cached visits.
5. The mock host (`eval/mock-host/`) answers repair prompts with a canned patch,
   so the whole loop can be exercised without a GPU.

### Phase 6 — eval harness

```bash
npm run build
node eval/run.mjs --fixtures --mock --label mock      # offline, no GPU: fixture pages + canned host
node eval/run.mjs --label qwen-coder-1.5b             # real model host on the sites in eval/sites.json
node eval/run.mjs --sites my-sites.json --style win98 --rounds 2 --limit 3
node eval/compare.mjs eval/out/qwen-coder-1.5b/summary.json eval/out/my-finetune/summary.json
```

Each run writes `eval/out/<label>/report.html` (before/after screenshots, issue
counts on the original page, after the design and after repair, round-by-round
numbers, remaining issues, links to the CSS) plus `summary.json` per run and
`result.json` / `record.json` / `design.css` per site. `eval/compare.mjs` prints
a per-site table of remaining issues for two runs, which is how model versions
are compared. The real-model run launches Chromium with WebGPU flags; it needs a
GPU (software WebGPU is far too slow for a 1.5B model). Set `ANTHROPIC_API_KEY`
in the environment to enable icon generation during eval: Node performs the
request and injects the key, the page only ever sees a sentinel.

### Phase 7 — training pipeline

See [`training/README.md`](training/README.md). Quick check that the plumbing
works without an API key or GPU:

```bash
npm run build
node userscript/scripts/prompts-cli.mjs | head -c 400
node userscript/scripts/validate-cli.mjs --html eval/fixtures/blog.html --css eval/out/mock/blog/design.css
node userscript/scripts/inspect-cli.mjs --html eval/fixtures/blog.html --css eval/out/mock/blog/design.css --block-images
python training/make_dataset.py --dry-run     # needs summaries from scrape_pages.py
```

The fine-tuned model is used by setting *HF model* in the panel's Advanced
section (a Hugging Face repo with MLC weights); the host loads it with the
prebuilt Qwen2 1.5B WebGPU library unless *Model lib* points to your own wasm.

## Status

- [x] Phase 1 — repo, build tooling, userscript shell, dev stub, panel skeleton
- [x] Phase 2 — asset library + manifest, page summarizer, validator
- [x] Phase 3 — in-browser model: design generation, streaming, per-domain cache
- [x] Phase 4 — Claude API icon generation, sanitizer, shared icon cache
- [x] Phase 5 — inspector + self-correction loop
- [x] Phase 6 — eval harness
- [x] Phase 7 — training pipeline
