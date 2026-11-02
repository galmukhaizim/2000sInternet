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
page ──► summarize.js ──► designer model (WebLLM, in a hidden iframe on a fixed origin)
                               │  streams CSS + /* icon-request */ + /* apply-class */
                               ▼
                         validate.js ──► apply.js (constructed stylesheets, !important)
                               │
            icons/ (library → cache → Claude API → placeholder)
                               │
              repair/inspect.js ──► issue report ──► model patch ──► validate ──► apply
                               │  (up to N rounds, then deterministic fallbacks)
                               ▼
                   per-domain cache (GM storage) · control panel
```

## Requirements

- Chrome / Edge / Brave (WebGPU) with [Tampermonkey](https://www.tampermonkey.net/).
  Firefox works for everything except the in-browser model unless WebGPU is enabled.
- Node 20+ to build.
- Python 3.10+ only for the training pipeline (`training/`).
- A Claude API key (optional — only for generating icons the library lacks).

## Setup

```bash
npm install
npm run build          # -> userscript/dist/retro.user.js, retro.lib.js, host/
npm run host           # serves the model host page on http://localhost:4173/
```

### Install the userscript in Tampermonkey (private repo → file:// workflow)

Tampermonkey cannot auto-update from a private GitHub repo, so the dev stub
`@require`s the local build straight from disk.

1. In `chrome://extensions`, open Tampermonkey → **Details** → enable
   **Allow access to file URLs**.
2. In Tampermonkey's settings tab set **Config mode: Advanced**, then under
   **Externals** set *Update interval* to **Always** so `@require`d files are
   re-read on every page load instead of cached.
3. `npm run build` writes `userscript/dist/retro.dev.user.js` with the correct
   absolute `file://` path for this checkout. Open that file in the browser
   (`file:///…/userscript/dist/retro.dev.user.js`) and Tampermonkey offers to
   install it. (Or edit the path in `userscript/dev/retro.dev.user.js` by hand.)
4. Keep `npm run watch` running while developing; reload the page to pick up changes.

To run the in-browser model you also need the **model host** running:
`npm run host` (http://localhost:4173/). The userscript embeds it as a hidden
iframe; the model weights (~1 GB, downloaded once from Hugging Face) are cached by
that origin and shared across every site. The host URL is configurable in the
panel's *Advanced* section, so you can also host `userscript/dist/host/` on any
static HTTPS origin (e.g. a Hugging Face static Space) and point the script there.

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

1. `npm install && npm run build`, install `userscript/dist/retro.dev.user.js`
   as described above.
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

## Status

- [x] Phase 1 — repo, build tooling, userscript shell, dev stub, panel skeleton
- [x] Phase 2 — asset library + manifest, page summarizer, validator
- [ ] Phase 3 — in-browser model: design generation, streaming, per-domain cache
- [ ] Phase 4 — Claude API icon generation, sanitizer, shared icon cache
- [ ] Phase 5 — inspector + self-correction loop
- [ ] Phase 6 — eval harness
- [ ] Phase 7 — training pipeline
