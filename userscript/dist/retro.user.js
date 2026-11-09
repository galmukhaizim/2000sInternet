// ==UserScript==
// @name         retro-web
// @namespace    https://github.com/galmukhaizim/2000sInternet
// @version      0.5.0
// @description  Redesigns any website in a 2000s internet aesthetic using a small language model running in your browser
// @author       galmukhaizim
// @homepageURL  https://github.com/galmukhaizim/2000sInternet
// @supportURL   https://github.com/galmukhaizim/2000sInternet/issues
// @downloadURL  https://raw.githubusercontent.com/galmukhaizim/2000sInternet/HEAD/userscript/dist/retro.user.js
// @updateURL    https://raw.githubusercontent.com/galmukhaizim/2000sInternet/HEAD/userscript/dist/retro.user.js
// @match        *://*/*
// @exclude      https://galmukhaizim.github.io/2000sInternet/*
// @exclude      http://localhost:4173/*
// @exclude      http://127.0.0.1:4173/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      api.anthropic.com
// @connect      huggingface.co
// @connect      cdn-lfs.huggingface.co
// @connect      cdn-lfs-us-1.huggingface.co
// @connect      raw.githubusercontent.com
// @connect      galmukhaizim.github.io
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(() => {
  // userscript/src/config.js
  var VERSION = "0.5.0";
  var CACHE_VERSION = 2;
  var DEFAULTS = {
    // --- model host (fixed origin iframe that runs WebLLM) ---
    // Published by .github/workflows/pages.yml. For local development run
    // `npm run host` and set http://localhost:4173/ in the panel's Advanced section.
    hostUrl: "https://galmukhaizim.github.io/2000sInternet/host/",
    // Any id from WebLLM's prebuilt list (0.2.87). ~1.6 GB VRAM, code-tuned.
    modelId: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    // Later: your fine-tuned model on Hugging Face, e.g.
    // { model: 'https://huggingface.co/<user>/<repo>', model_id: 'retro-designer-1.5B-q4f16_1-MLC',
    //   model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/Qwen2.5-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm' }
    customModel: null,
    // Panel-friendly form of the above: a Hugging Face repo URL holding MLC weights
    // (+ optional model_lib wasm URL). When set, it overrides modelId.
    customModelUrl: "",
    customModelLib: "",
    contextWindow: 8192,
    temperature: 0.7,
    topP: 0.9,
    // --- generation budgets (tokens) ---
    summaryTokenBudget: 1e3,
    manifestTokenBudget: 700,
    maxDesignTokens: 700,
    maxPatchTokens: 400,
    // --- behaviour ---
    // 'hybrid': instant hand-made style pack, then the model adds site-specific
    // touches; 'pack': style pack only (no model, no GPU needed); 'model': the
    // model writes the whole design (slow, original behaviour).
    designMode: "hybrid",
    autoDesign: true,
    // design new sites automatically on first visit
    popupFallback: true,
    // when a site's CSP blocks the hidden frame, run the model in a popup window
    geometryGuard: true,
    // measure before/after and roll back spacing that moved or resized controls
    style: "random",
    // sub-style id from training/styles.json or 'random'
    maxRepairRounds: 1,
    settleDelayMs: 600,
    // wait for layout/fonts before inspecting
    // --- Claude icon generation ---
    iconModel: "claude-haiku-5-5",
    anthropicVersion: "2023-06-01",
    anthropicEndpoint: "https://api.anthropic.com/v1/messages",
    iconConcurrency: 3,
    iconTimeoutMs: 25e3,
    iconMaxTokens: 1200
  };
  var STORAGE_KEYS = {
    apiKey: "apiKey",
    settings: "settings",
    sitePrefix: "site:",
    iconPrefix: "icon:"
  };
  var PANEL_TAG = "retro-web-panel";
  var PANEL_ID = "retro-web-panel";

  // userscript/src/storage.js
  var hasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  var memory = /* @__PURE__ */ new Map();
  var LS_PREFIX = "__retro_web__:";
  function ls() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch {
      return null;
    }
  }
  function getValue(key, fallback) {
    if (hasGM) {
      const v = GM_getValue(key);
      return v === void 0 || v === null ? fallback : v;
    }
    const store = ls();
    if (store) {
      try {
        const raw = store.getItem(LS_PREFIX + key);
        if (raw != null) return JSON.parse(raw);
      } catch {
      }
    }
    return memory.has(key) ? memory.get(key) : fallback;
  }
  function setValue(key, value) {
    if (hasGM) {
      GM_setValue(key, value);
      return;
    }
    memory.set(key, value);
    const store = ls();
    if (store) {
      try {
        store.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch {
      }
    }
  }
  function deleteValue(key) {
    if (hasGM) {
      if (typeof GM_deleteValue === "function") GM_deleteValue(key);
      else GM_setValue(key, void 0);
      return;
    }
    memory.delete(key);
    const store = ls();
    if (store) {
      try {
        store.removeItem(LS_PREFIX + key);
      } catch {
      }
    }
  }
  function listKeys() {
    if (hasGM && typeof GM_listValues === "function") return GM_listValues();
    const keys = new Set(memory.keys());
    const store = ls();
    if (store) {
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(LS_PREFIX)) keys.add(k.slice(LS_PREFIX.length));
        }
      } catch {
      }
    }
    return [...keys];
  }
  function registerMenuCommand(label, fn) {
    if (typeof GM_registerMenuCommand === "function") {
      try {
        GM_registerMenuCommand(label, fn);
      } catch {
      }
    }
  }
  function getSettings() {
    const saved = getValue(STORAGE_KEYS.settings, {}) || {};
    return { ...DEFAULTS, ...saved };
  }
  function saveSettings(patch) {
    const saved = getValue(STORAGE_KEYS.settings, {}) || {};
    const next = { ...saved, ...patch };
    for (const k of Object.keys(next)) if (next[k] === void 0 || next[k] === DEFAULTS[k]) delete next[k];
    setValue(STORAGE_KEYS.settings, next);
    return getSettings();
  }
  function siteKey(hostname) {
    return STORAGE_KEYS.sitePrefix + String(hostname || "").toLowerCase();
  }
  function getSiteRecord(hostname) {
    const rec = getValue(siteKey(hostname), null);
    if (!rec || typeof rec !== "object") return null;
    if (rec.cacheVersion !== CACHE_VERSION) return { enabled: rec.enabled !== false };
    return rec;
  }
  function saveSiteRecord(hostname, patch) {
    const prev = getValue(siteKey(hostname), null) || {};
    const next = { ...prev, ...patch, cacheVersion: CACHE_VERSION, updatedAt: Date.now() };
    setValue(siteKey(hostname), next);
    return next;
  }
  function clearSiteRecord(hostname, { keepEnabled = true } = {}) {
    const prev = getSiteRecord(hostname);
    deleteValue(siteKey(hostname));
    if (keepEnabled && prev && prev.enabled === false) saveSiteRecord(hostname, { enabled: false });
  }
  function clearAllSiteRecords() {
    for (const k of listKeys()) if (k.startsWith(STORAGE_KEYS.sitePrefix)) deleteValue(k);
  }
  function hasApiKey() {
    const k = getValue(STORAGE_KEYS.apiKey, "");
    return typeof k === "string" && k.length > 0;
  }
  function setApiKey(key) {
    const k = String(key || "").trim();
    if (!k) {
      deleteValue(STORAGE_KEYS.apiKey);
      return false;
    }
    setValue(STORAGE_KEYS.apiKey, k);
    return true;
  }
  function clearApiKey() {
    deleteValue(STORAGE_KEYS.apiKey);
  }
  function readApiKey() {
    const k = getValue(STORAGE_KEYS.apiKey, "");
    return typeof k === "string" ? k : "";
  }

  // userscript/src/csp.js
  function createCspMonitor(doc = document) {
    const blocked = /* @__PURE__ */ new Set();
    const listener = (e) => {
      const d = (e.effectiveDirective || e.violatedDirective || "").split(" ")[0];
      if (d) blocked.add(d);
    };
    try {
      doc.addEventListener("securitypolicyviolation", listener);
    } catch {
    }
    return {
      blocked,
      has(directive) {
        return blocked.has(directive);
      },
      dispose() {
        try {
          doc.removeEventListener("securitypolicyviolation", listener);
        } catch {
        }
      }
    };
  }
  function canUseAdoptedStyleSheets(doc = document) {
    try {
      return "adoptedStyleSheets" in doc && typeof CSSStyleSheet === "function" && typeof CSSStyleSheet.prototype.replaceSync === "function";
    } catch {
      return false;
    }
  }
  function probeInlineStyle(doc = document) {
    try {
      const root = doc.head || doc.documentElement;
      const probe = doc.createElement("retro-web-probe");
      const style = doc.createElement("style");
      style.textContent = "retro-web-probe{position:absolute;left:-7777px}";
      root.appendChild(style);
      root.appendChild(probe);
      const ok = !!style.sheet && getComputedStyle(probe).left === "-7777px";
      style.remove();
      probe.remove();
      return ok;
    } catch {
      return false;
    }
  }
  function hasWebGPU() {
    try {
      return typeof navigator !== "undefined" && !!navigator.gpu;
    } catch {
      return false;
    }
  }
  function describeEnvironment(doc = document) {
    return {
      adoptedStyleSheets: canUseAdoptedStyleSheets(doc),
      inlineStyle: probeInlineStyle(doc),
      webgpu: hasWebGPU()
    };
  }

  // userscript/src/apply.js
  var StyleSlot = class {
    constructor(doc, name, { forceElement = false } = {}) {
      this.doc = doc;
      this.name = name;
      this.css = "";
      this.mode = "blocked";
      this.sheet = null;
      this.el = null;
      if (!forceElement && canUseAdoptedStyleSheets(doc)) {
        try {
          this.sheet = new CSSStyleSheet();
          doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, this.sheet];
          this.mode = "adopted";
        } catch {
          this.sheet = null;
        }
      }
      if (!this.sheet) {
        try {
          const el = doc.createElement("style");
          el.setAttribute("data-retro-web", name);
          (doc.head || doc.documentElement).appendChild(el);
          this.el = el;
          this.mode = "element";
        } catch {
          this.mode = "blocked";
        }
      }
    }
    set(css) {
      this.css = String(css || "");
      if (this.mode === "adopted") {
        try {
          this.sheet.replaceSync(this.css);
          return true;
        } catch (e) {
          console.warn("[retro-web] replaceSync failed for", this.name, e);
          return false;
        }
      }
      if (this.mode === "element") {
        this.el.textContent = this.css;
        if (this.css && !this.el.sheet) {
          this.mode = "blocked";
          return false;
        }
        return true;
      }
      return false;
    }
    append(css) {
      return this.set(this.css + "\n" + css);
    }
    clear() {
      return this.set("");
    }
    get ruleCount() {
      try {
        const sheet = this.mode === "adopted" ? this.sheet : this.el && this.el.sheet;
        return sheet ? sheet.cssRules.length : 0;
      } catch {
        return 0;
      }
    }
    get working() {
      return this.mode !== "blocked";
    }
    dispose() {
      try {
        if (this.mode === "adopted") {
          this.doc.adoptedStyleSheets = this.doc.adoptedStyleSheets.filter((s) => s !== this.sheet);
        } else if (this.el) {
          this.el.remove();
        }
      } catch {
      }
    }
  };
  var SLOT_ORDER = ["library", "icons", "design", "patch", "fallback", "panel"];
  function createSlots(doc = document) {
    const slots = {};
    for (const name of SLOT_ORDER) slots[name] = new StyleSlot(doc, name);
    slots.working = () => SLOT_ORDER.every((n) => slots[n].working);
    slots.disposeAll = () => SLOT_ORDER.forEach((n) => slots[n].dispose());
    return slots;
  }
  var RuleStreamer = class {
    constructor() {
      this.buffer = "";
      this.flushedUpTo = 0;
    }
    // Returns the newly completed chunk of CSS (may be empty).
    push(delta) {
      this.buffer += delta;
      let depth = 0;
      let inStr = null;
      let inComment = false;
      let lastComplete = this.flushedUpTo;
      for (let i = this.flushedUpTo; i < this.buffer.length; i++) {
        const c = this.buffer[i];
        const n = this.buffer[i + 1];
        if (inComment) {
          if (c === "*" && n === "/") {
            inComment = false;
            i++;
            if (depth === 0) lastComplete = i + 1;
          }
          continue;
        }
        if (inStr) {
          if (c === "\\") i++;
          else if (c === inStr) inStr = null;
          continue;
        }
        if (c === "/" && n === "*") {
          inComment = true;
          i++;
          continue;
        }
        if (c === '"' || c === "'") {
          inStr = c;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") {
          depth = Math.max(0, depth - 1);
          if (depth === 0) lastComplete = i + 1;
        }
      }
      if (lastComplete > this.flushedUpTo) {
        const chunk = this.buffer.slice(this.flushedUpTo, lastComplete);
        this.flushedUpTo = lastComplete;
        return chunk;
      }
      return "";
    }
    // Everything, including an unterminated tail (dropped by the validator if malformed).
    rest() {
      const chunk = this.buffer.slice(this.flushedUpTo);
      this.flushedUpTo = this.buffer.length;
      return chunk;
    }
  };

  // userscript/src/ui/panel.css
  var panel_default = ':host { all: initial; }\n* { box-sizing: border-box; }\n.win {\n  font: 11px Tahoma, "MS Sans Serif", Verdana, sans-serif;\n  color: #000;\n  background: #c0c0c0;\n  border: 2px outset #fff;\n  box-shadow: 1px 1px 0 #000, 2px 2px 6px rgba(0,0,0,.35);\n  width: 300px;\n  user-select: none;\n}\n.win.min .body { display: none; }\n.title {\n  display: flex; align-items: center; gap: 6px;\n  background: linear-gradient(90deg, #000080, #1084d0);\n  color: #fff; font-weight: bold; padding: 3px 4px; cursor: move;\n}\n.title .t { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.title .ico { width: 14px; height: 14px; background: #fff; border: 1px solid #000; display: inline-block; }\n.tb {\n  width: 16px; height: 14px; border: 1px outset #fff; background: #c0c0c0; color: #000;\n  font: bold 9px Tahoma, sans-serif; line-height: 10px; text-align: center; cursor: pointer; padding: 0;\n}\n.tb:active { border-style: inset; }\n.body { padding: 6px; display: grid; gap: 6px; }\n.row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }\n.row label { display: inline-flex; align-items: center; gap: 4px; }\n.status { font-size: 11px; min-height: 14px; }\n.status.err { color: #a00; }\n.status.ok { color: #060; }\n.bar { height: 8px; border: 1px inset #808080; background: #fff; display: none; }\n.bar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, #000080 0 6px, transparent 6px 8px); width: 0; }\n.bar.show { display: block; }\nbutton.b {\n  font: 11px Tahoma, "MS Sans Serif", sans-serif; color: #000; background: #c0c0c0;\n  border: 2px outset #fff; padding: 2px 8px; cursor: pointer; min-width: 52px;\n}\nbutton.b:active { border-style: inset; }\nbutton.b:disabled { color: #808080; cursor: default; }\nselect, input[type=text], input[type=password], input[type=number] {\n  font: 11px Tahoma, sans-serif; color: #000; background: #fff; border: 2px inset #fff; padding: 1px 3px;\n}\nselect { max-width: 150px; }\ninput[type=text], input[type=password] { width: 100%; }\ninput[type=number] { width: 52px; }\ndetails { border: 1px groove #fff; padding: 4px; }\nsummary { cursor: pointer; font-weight: bold; }\n.grid { display: grid; grid-template-columns: 70px 1fr; gap: 4px; align-items: center; margin-top: 4px; }\ntextarea.report {\n  width: 100%; height: 120px; font: 10px "Courier New", monospace; color: #000; background: #fff;\n  border: 2px inset #fff; resize: vertical; white-space: pre; user-select: text;\n}\n.hidden { display: none !important; }\n.key { color: #060; }\n.key.none { color: #a00; }\n.mini {\n  font: bold 11px Tahoma, sans-serif; color: #fff; background: linear-gradient(90deg, #000080, #1084d0);\n  border: 2px outset #fff; padding: 2px 8px; cursor: pointer; box-shadow: 1px 1px 0 #000;\n}\n.foot { font-size: 9px; color: #444; text-align: right; }\n';

  // userscript/src/ui/panel.js
  var PANEL_HOST_CSS = `
#${PANEL_ID}{position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;transform:none!important;filter:none!important;pointer-events:auto!important;contain:content;}
`;
  function createPanel({ doc = document, styles = [], settings, site, hasKey, handlers = {} }) {
    const host = doc.createElement(PANEL_TAG);
    host.id = PANEL_ID;
    const root = host.attachShadow({ mode: "closed" });
    if (canUseAdoptedStyleSheets(doc)) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(panel_default);
        root.adoptedStyleSheets = [sheet];
      } catch {
        const s = doc.createElement("style");
        s.textContent = panel_default;
        root.appendChild(s);
      }
    } else {
      const s = doc.createElement("style");
      s.textContent = panel_default;
      root.appendChild(s);
    }
    const el = (tag, attrs = {}, ...children) => {
      const n = doc.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
      }
      for (const c of children) if (c != null) n.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
      return n;
    };
    const status = el("div", { class: "status", text: "idle" });
    const bar = el("div", { class: "bar" }, el("i"));
    const enabled = el("input", { type: "checkbox" });
    enabled.checked = !site || site.enabled !== false;
    enabled.addEventListener("change", () => handlers.onToggleSite?.(enabled.checked));
    const styleSel = el("select");
    styleSel.appendChild(el("option", { value: "random", text: "\u{1F3B2} random style" }));
    for (const s of styles) styleSel.appendChild(el("option", { value: s.id, text: s.name }));
    styleSel.value = settings.style || "random";
    styleSel.addEventListener("change", () => handlers.onStyleChange?.(styleSel.value));
    const redesign = el("button", { class: "b", text: "Redesign", onclick: () => handlers.onRedesign?.({ style: styleSel.value }) });
    const randomBtn = el("button", {
      class: "b",
      text: "\u{1F3B2}",
      title: "Redesign with a random style",
      onclick: () => {
        styleSel.value = "random";
        handlers.onRedesign?.({ style: "random" });
      }
    });
    const restore = el("button", { class: "b", text: "Original", title: "Remove the redesign for this page view", onclick: () => handlers.onRestore?.() });
    const report = el("textarea", { class: "report hidden", readonly: true, spellcheck: "false" });
    const reportBtn = el("button", {
      class: "b",
      text: "Report",
      onclick: () => report.classList.toggle("hidden")
    });
    const clearSite = el("button", { class: "b", text: "Clear site", onclick: () => handlers.onClearSite?.() });
    const clearAll = el("button", { class: "b", text: "Clear all", onclick: () => handlers.onClearAll?.() });
    const keyState = el("span", { class: "key" + (hasKey ? "" : " none"), text: hasKey ? "key set" : "no key" });
    const keyInput = el("input", { type: "password", placeholder: "sk-ant-\u2026 (stored in Tampermonkey only)", class: "hidden", autocomplete: "off" });
    const keyBtn = el("button", {
      class: "b",
      text: "Set key",
      onclick: () => {
        if (keyInput.classList.contains("hidden")) {
          keyInput.classList.remove("hidden");
          keyInput.focus();
          return;
        }
        const v = keyInput.value;
        keyInput.value = "";
        keyInput.classList.add("hidden");
        if (v.trim()) handlers.onSetKey?.(v.trim());
      }
    });
    keyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") keyBtn.click();
      if (e.key === "Escape") {
        keyInput.value = "";
        keyInput.classList.add("hidden");
      }
      e.stopPropagation();
    });
    const keyClear = el("button", { class: "b", text: "Clear key", onclick: () => handlers.onClearKey?.() });
    const modelInput = el("input", { type: "text", value: settings.modelId });
    const hostInput = el("input", { type: "text", value: settings.hostUrl });
    const roundsInput = el("input", { type: "number", min: "0", max: "6", value: String(settings.maxRepairRounds) });
    const modeSel = el("select");
    for (const [v, label] of [["hybrid", "style pack + model touches"], ["pack", "style pack only (instant, no GPU)"], ["model", "model writes everything (slow)"]]) modeSel.appendChild(el("option", { value: v, text: label }));
    modeSel.value = settings.designMode || "hybrid";
    const autoInput = el("input", { type: "checkbox" });
    autoInput.checked = !!settings.autoDesign;
    const iconModelInput = el("input", { type: "text", value: settings.iconModel });
    const customUrlInput = el("input", { type: "text", value: settings.customModelUrl || "", placeholder: "https://huggingface.co/<user>/<repo> (optional)" });
    const customLibInput = el("input", { type: "text", value: settings.customModelLib || "", placeholder: "model_lib .wasm URL (optional)" });
    const saveBtn = el("button", {
      class: "b",
      text: "Save settings",
      onclick: () => handlers.onSettingsChange?.({
        modelId: modelInput.value.trim(),
        hostUrl: hostInput.value.trim(),
        maxRepairRounds: Math.max(0, Math.min(6, parseInt(roundsInput.value, 10) || 0)),
        designMode: modeSel.value,
        autoDesign: autoInput.checked,
        iconModel: iconModelInput.value.trim(),
        customModelUrl: customUrlInput.value.trim(),
        customModelLib: customLibInput.value.trim()
      })
    });
    const win = el(
      "div",
      { class: "win" },
      el(
        "div",
        { class: "title" },
        el("span", { class: "ico" }),
        el("span", { class: "t", text: "retro-web" }),
        el("button", { class: "tb", text: "_", title: "Minimize", onclick: () => setMinimized(true) }),
        el("button", { class: "tb", text: "\xD7", title: "Hide panel until reload", onclick: () => host.remove() })
      ),
      el(
        "div",
        { class: "body" },
        status,
        bar,
        el("div", { class: "row" }, el("label", {}, enabled, "Enabled on this site")),
        el("div", { class: "row" }, styleSel, randomBtn, redesign),
        el("div", { class: "row" }, restore, reportBtn, clearSite, clearAll),
        report,
        el("div", { class: "row" }, el("span", { text: "Claude API: " }), keyState, keyBtn, keyClear),
        keyInput,
        el(
          "details",
          {},
          el("summary", { text: "Advanced" }),
          el(
            "div",
            { class: "grid" },
            el("span", { text: "Mode" }),
            modeSel,
            el("span", { text: "Model id" }),
            modelInput,
            el("span", { text: "Host URL" }),
            hostInput,
            el("span", { text: "Icon model" }),
            iconModelInput,
            el("span", { text: "HF model" }),
            customUrlInput,
            el("span", { text: "Model lib" }),
            customLibInput,
            el("span", { text: "Repair rounds" }),
            roundsInput,
            el("span", { text: "Auto design" }),
            autoInput
          ),
          el("div", { class: "row", style: "margin-top:4px" }, saveBtn)
        ),
        el("div", { class: "foot", text: "retro-web \xB7 2000s mode" })
      )
    );
    const mini = el("button", { class: "mini hidden", text: "\u25B2 retro-web", onclick: () => setMinimized(false) });
    root.appendChild(win);
    root.appendChild(mini);
    function setMinimized(m) {
      win.classList.toggle("hidden", m);
      mini.classList.toggle("hidden", !m);
    }
    const title = win.querySelector(".title");
    let drag = null;
    title.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tb")) return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    doc.addEventListener("mousemove", (e) => {
      if (!drag) return;
      host.style.setProperty("left", Math.max(0, e.clientX - drag.dx) + "px", "important");
      host.style.setProperty("top", Math.max(0, e.clientY - drag.dy) + "px", "important");
      host.style.setProperty("right", "auto", "important");
      host.style.setProperty("bottom", "auto", "important");
    });
    doc.addEventListener("mouseup", () => drag = null);
    root.addEventListener("keydown", (e) => e.stopPropagation());
    (doc.documentElement || doc.body).appendChild(host);
    return {
      host,
      setStatus(text, kind = "") {
        status.textContent = text;
        status.className = "status" + (kind ? " " + kind : "");
      },
      setProgress(fraction) {
        if (fraction == null) {
          bar.classList.remove("show");
          return;
        }
        bar.classList.add("show");
        bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + "%";
      },
      setReport(text) {
        report.value = text || "(no issues)";
      },
      showReport() {
        report.classList.remove("hidden");
      },
      setKeyState(has) {
        keyState.textContent = has ? "key set" : "no key";
        keyState.className = "key" + (has ? "" : " none");
      },
      setEnabled(v) {
        enabled.checked = v;
      },
      setStyle(id) {
        styleSel.value = id || "random";
      },
      setBusy(b) {
        redesign.disabled = b;
        randomBtn.disabled = b;
      },
      // Opens the key field inside the closed shadow root (never window.prompt,
      // which a hostile page could override).
      promptKey() {
        setMinimized(false);
        keyInput.classList.remove("hidden");
        keyInput.focus();
      },
      minimize: () => setMinimized(true),
      destroy: () => host.remove()
    };
  }

  // training/styles.json
  var styles_default = [
    {
      id: "geocities",
      name: "GeoCities homepage (1998)",
      description: "Personal homepage energy: tiled background textures, centered tables, Comic Sans and Times, rainbow horizontal rules, visitor counter, under-construction badges, bright primary colors on busy backgrounds.",
      palette: ["#000080", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"],
      fonts: ["Comic Sans MS", "Times New Roman", "Arial"],
      motifs: ["tiled background", "centered layout", "hr rainbow", "hit counter", "under construction", "marquee"]
    },
    {
      id: "web20-glossy",
      name: "Web 2.0 glossy (2006)",
      description: "Startup-era gloss: big rounded corners, glossy gradient buttons with highlights, reflections, pastel blue/green/orange, Lucida Grande and Trebuchet, large friendly headings, beta badges, soft drop shadows.",
      palette: ["#3b8dd6", "#8cc63f", "#f7941d", "#ffffff", "#333333", "#e8f1fa"],
      fonts: ["Lucida Grande", "Trebuchet MS", "Verdana"],
      motifs: ["glossy gradient", "rounded corners", "reflection", "beta badge", "big headline"]
    },
    {
      id: "y2k-chrome",
      name: "Y2K chrome futurism (2000)",
      description: "Millennium futurism: silver and chrome metallic gradients, bevelled pills, cyan and magenta neon accents, starfield backgrounds, bold condensed sans, bubbly blobs, lens-flare energy.",
      palette: ["#c0c0c0", "#e6e6e6", "#00e5ff", "#ff2bd6", "#101020", "#ffffff"],
      fonts: ["Verdana", "Arial Black", "Impact"],
      motifs: ["chrome gradient", "starfield", "neon accent", "pill buttons", "bevel"]
    },
    {
      id: "win98",
      name: "Windows 98 desktop UI",
      description: "Classic desktop widgets: #c0c0c0 panels, outset and inset 2px borders, navy-to-blue title bars, MS Sans Serif and Tahoma at 11px, 1px black frames, grey status bars, square buttons, everything looks like a dialog window.",
      palette: ["#c0c0c0", "#000080", "#1084d0", "#ffffff", "#808080", "#000000"],
      fonts: ["Tahoma", "MS Sans Serif", "Arial"],
      motifs: ["window chrome", "title bar", "bevel button", "status bar", "inset field"]
    },
    {
      id: "early-blog",
      name: "Early blog (Blogger / Movable Type, 2002)",
      description: "Narrow centered column with a sidebar of links and archives, Georgia headings with Verdana body, muted earth tones or soft blues, dotted and dashed borders, small 'posted by' meta lines, lots of whitespace.",
      palette: ["#f4f1ea", "#5a6b4a", "#8a6d3b", "#333333", "#ffffff", "#c9b99b"],
      fonts: ["Georgia", "Verdana", "Trebuchet MS"],
      motifs: ["narrow column", "sidebar", "dotted border", "archive list", "meta line"]
    },
    {
      id: "portal-1999",
      name: "Portal directory (Yahoo / Excite, 1999)",
      description: "Dense link directory: tiny Arial text, table layouts, bold category headers, lots of blue underlined links, yellow highlight boxes, thin grey rules, minimal imagery, everything above the fold.",
      palette: ["#ffffff", "#0000ee", "#ffffcc", "#cccccc", "#000000", "#800080"],
      fonts: ["Arial", "Verdana", "Times New Roman"],
      motifs: ["dense links", "table layout", "category header", "highlight box", "thin rule"]
    },
    {
      id: "matrix-terminal",
      name: "Matrix terminal (2000)",
      description: "Hacker aesthetic: black background, bright green monospace text, dim green borders, scanline texture, ASCII-style box borders, blinking cursor accents, zero rounded corners.",
      palette: ["#000000", "#00ff41", "#008f11", "#003b00", "#ffffff", "#0d0208"],
      fonts: ["Courier New", "Lucida Console", "monospace"],
      motifs: ["scanlines", "monospace", "ascii border", "glow text", "black background"]
    },
    {
      id: "myspace-glitter",
      name: "MySpace profile (2005)",
      description: "Loud customised profile: tiled glitter or pattern backgrounds, clashing bright colors, Arial in odd sizes, boxes with 1px borders, bold section headers, sparkle text effects, 'Top 8' friend grid vibes.",
      palette: ["#ff69b4", "#000000", "#ffffff", "#9900ff", "#00ccff", "#ffcc00"],
      fonts: ["Arial", "Verdana", "Comic Sans MS"],
      motifs: ["glitter background", "clashing colors", "bordered boxes", "sparkle", "friend grid"]
    },
    {
      id: "corporate-2001",
      name: "Corporate site (2001)",
      description: "Early corporate web: navy and grey palette, Verdana 10px, gradient header bars, left-hand navigation with arrow bullets, boxed news items, thin 1px borders, conservative spacing, small stock-photo banner energy.",
      palette: ["#003366", "#6699cc", "#e6e6e6", "#ffffff", "#333333", "#cc6600"],
      fonts: ["Verdana", "Arial", "Tahoma"],
      motifs: ["gradient header", "left nav", "arrow bullets", "news box", "thin border"]
    },
    {
      id: "flash-agency",
      name: "Flash-era agency (2003)",
      description: "Flash intro energy: black or dark backgrounds with orange or lime accents, Impact and Arial Black headings, glossy pill navigation, big imagery, 'skip intro' drama, centered fixed-width stage.",
      palette: ["#111111", "#ff6600", "#ccff00", "#ffffff", "#333333", "#999999"],
      fonts: ["Impact", "Arial Black", "Arial"],
      motifs: ["dark stage", "accent color", "pill nav", "big heading", "fixed width"]
    },
    {
      id: "forum-phpbb",
      name: "Forum (phpBB / vBulletin, 2003)",
      description: "Bulletin board look: light blue and grey table rows, Verdana 11px, alternating row shading, bevelled buttons, category header bars with gradients, avatar boxes, bold link colors, cell padding everywhere.",
      palette: ["#e5edf5", "#5c7099", "#ffffff", "#d3dce8", "#006699", "#333333"],
      fonts: ["Verdana", "Arial", "Tahoma"],
      motifs: ["table rows", "alternating shading", "header bar", "bevel button", "avatar box"]
    },
    {
      id: "kawaii-pixel",
      name: "Kawaii pixel (2003)",
      description: "Cute pixel-art web: pastel pinks and mint, dotted or checker backgrounds, 1px pixel borders, tiny fonts, cute icon accents, rounded pastel boxes, sparkles and hearts.",
      palette: ["#ffd1e8", "#ff8fc8", "#b8f3e6", "#ffffff", "#6b4c6b", "#fff6a8"],
      fonts: ["Verdana", "Tahoma", "Comic Sans MS"],
      motifs: ["pastel", "dotted background", "pixel border", "hearts", "tiny text"]
    },
    {
      id: "aqua-osx",
      name: "Mac OS X Aqua (2001)",
      description: "Aqua interface: pinstripe backgrounds, blue gel buttons with highlights, brushed metal panels, Lucida Grande, soft shadows, translucent toolbars, rounded window corners.",
      palette: ["#e8e8e8", "#3d7fe0", "#ffffff", "#9fb8de", "#444444", "#cfcfcf"],
      fonts: ["Lucida Grande", "Verdana", "Helvetica"],
      motifs: ["pinstripes", "gel button", "brushed metal", "soft shadow", "rounded window"]
    }
  ];

  // userscript/src/model/styles.js
  var STYLES = styles_default;
  function getStyle(id) {
    return STYLES.find((s) => s.id === id) || null;
  }
  function pickStyle(id, rng = Math.random) {
    if (id && id !== "random") {
      const s = getStyle(id);
      if (s) return s;
    }
    return STYLES[Math.floor(rng() * STYLES.length)];
  }
  function describeStyle(s) {
    return `${s.name}: ${s.description} Palette: ${s.palette.join(", ")}. Fonts: ${s.fonts.join(", ")}. Motifs: ${s.motifs.join(", ")}.`;
  }

  // userscript/src/assets/library.css
  var library_default = `/* retro-web asset library \u2014 a TOOLKIT, not a theme.
   Only custom properties and opt-in utility classes. Nothing here restyles a
   page by itself. Asset file references are inlined as data URIs at build time.
   Every name below must appear in manifest.json (enforced by a unit test). */

:root {
  /* ---- icons (16x16 pixel art). Use: background-image: var(--icon-home) ---- */
  --icon-home: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M8 1 15 8h-2v7H3V8H1z'/%3E%3Cpath fill='%23cc3333' d='M8 2.6 12.6 7.2H3.4z'/%3E%3Cpath fill='%23fff' d='M4 8h8v6H4z'/%3E%3Cpath fill='%233366cc' d='M7 10h2v4H7z'/%3E%3Cpath fill='%2399ccff' d='M5 9h1v1H5zM10 9h1v1h-1z'/%3E%3C/svg%3E");
  --icon-mail: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 3h14v10H1z'/%3E%3Cpath fill='%23fff' d='M2 4h12v8H2z'/%3E%3Cpath fill='%23000' d='M2 4h1v1H2zM13 4h1v1h-1zM3 5h1v1H3zM12 5h1v1h-1zM4 6h1v1H4zM11 6h1v1h-1zM5 7h1v1H5zM10 7h1v1h-1zM6 8h1v1H6zM9 8h1v1H9zM7 9h2v1H7z'/%3E%3C/svg%3E");
  --icon-search: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M3 2h6v1h1v1h1v6H10v1H9v1H3v-1H2v-1H1V4h1V3h1zM10 10h1v1h1v1h1v1h1v1h1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1z'/%3E%3Cpath fill='%23fff' d='M3 3h5v1h1v1h1v4H9v1H8v1H3v-1H2v-1H2V5h1V4z'/%3E%3Cpath fill='%2399ccff' d='M4 4h2v1H4zM3 5h1v2H3z'/%3E%3Cpath fill='%23000' d='M9 9h2v1h1v1h1v1h1v1h1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1H9z'/%3E%3C/svg%3E");
  --icon-cart: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h3v1h1v1h10v1l-2 5H5v1h8v1H4v-1H3V4H2V3H1z'/%3E%3Cpath fill='%23ffcc00' d='M5 5h9l-1.5 4H5z'/%3E%3Cpath fill='%23000' d='M5 13h2v2H5zM11 13h2v2h-2z'/%3E%3Cpath fill='%23fff' d='M6 6h1v2H6zM8 6h1v2H8zM10 6h1v2h-1z'/%3E%3C/svg%3E");
  --icon-user: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h6v1h1v5h-1v1H5V7H4V2h1zM2 10h1V9h10v1h1v5H2z'/%3E%3Cpath fill='%23ffcc99' d='M5 2h6v5H5z'/%3E%3Cpath fill='%233366cc' d='M3 10h10v5H3z'/%3E%3Cpath fill='%23fff' d='M7 10h2v2H7z'/%3E%3Cpath fill='%23000' d='M6 4h1v1H6zM9 4h1v1H9z'/%3E%3C/svg%3E");
  --icon-folder: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h6v1h1v1h7v10H1z'/%3E%3Cpath fill='%23ffcc00' d='M2 3h5v1h1v1h6v8H2z'/%3E%3Cpath fill='%23ffe680' d='M2 5h12v1H2z'/%3E%3Cpath fill='%23cc9900' d='M2 12h12v1H2z'/%3E%3C/svg%3E");
  --icon-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M3 1h7v1h1v1h1v1h1v11H3z'/%3E%3Cpath fill='%23fff' d='M4 2h6v3h3v9H4z'/%3E%3Cpath fill='%23808080' d='M10 2h1v1h1v1h1v1h-3z'/%3E%3Cpath fill='%233366cc' d='M5 7h7v1H5zM5 9h7v1H5zM5 11h5v1H5z'/%3E%3C/svg%3E");
  --icon-star: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 1h2v1h1v2h1v1h4v2h-1v1h-1v1h-1v3h1v2h-1v1h-1v-1H9v-1H7v1H5v1H4v-1H3v-2h1V9H3V8H2V7H1V5h4V4h1V2h1z'/%3E%3Cpath fill='%23ffcc00' d='M7 2h2v2h1v1h1v1h3v1h-1v1h-1v1h-1v3h1v2H9v-1H7v1H4v-2h1V9H4V8H3V7H2V6h3V5h1V4h1z'/%3E%3Cpath fill='%23fff3b0' d='M7 3h1v2H7zM6 5h1v1H6z'/%3E%3C/svg%3E");
  --icon-heart: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M2 2h4v1h1v1h2V3h1V2h4v1h1v1h1v4h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4V9H3V8H2V7H1V3h1z'/%3E%3Cpath fill='%23cc3333' d='M2 3h4v1h1v1h2V4h1V3h4v1h1v3h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5V9H4V8H3V7H2z'/%3E%3Cpath fill='%23ff9999' d='M3 4h2v1H3zM3 5h1v1H3z'/%3E%3C/svg%3E");
  --icon-arrow-left: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 2h2v4h6v4H9v4H7v-1H6v-1H5v-1H4v-1H3V9H2V7h1V6h1V5h1V4h1V3h1z'/%3E%3Cpath fill='%233366cc' d='M7 3h1v4h6v2H8v4H7v-1H6v-1H5v-1H4V9H3V7h1V6h1V5h1V4h1z'/%3E%3Cpath fill='%2399ccff' d='M4 7h3v1H4z'/%3E%3C/svg%3E");
  --icon-arrow-right: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 2h2v1h1v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1H9v1H7v-4H1V6h6z'/%3E%3Cpath fill='%233366cc' d='M8 3h1v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1H9v1H8V9H2V7h6z'/%3E%3Cpath fill='%2399ccff' d='M9 7h3v1H9z'/%3E%3C/svg%3E");
  --icon-arrow-up: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 1h2v1h1v1h1v1h1v1h1v1h1v2h-4v6H6V8H2V6h1V5h1V4h1V3h1V2h1z'/%3E%3Cpath fill='%233366cc' d='M7 2h2v1h1v1h1v1h1v1h1v1H9v6H7V7H3V6h1V5h1V4h1V3h1z'/%3E%3Cpath fill='%2399ccff' d='M7 3h1v3H7z'/%3E%3C/svg%3E");
  --icon-arrow-down: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M6 1h4v6h4v2h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V9H2V7h4z'/%3E%3Cpath fill='%233366cc' d='M7 2h2v6h4v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V8h4z'/%3E%3Cpath fill='%2399ccff' d='M7 10h1v3H7z'/%3E%3C/svg%3E");
  --icon-info: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1V5h1V3h1V2h2z'/%3E%3Cpath fill='%233366cc' d='M5 2h6v1h2v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2z'/%3E%3Cpath fill='%23fff' d='M7 4h2v2H7zM6 7h3v4h1v1H6v-1h1V8H6z'/%3E%3C/svg%3E");
  --icon-warning: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 1h2v1h1v2h1v2h1v2h1v2h1v2h1v2h1v1H1v-1h1v-2h1v-2h1V8h1V6h1V4h1V2h1z'/%3E%3Cpath fill='%23ffcc00' d='M7 2h2v1h1v2h1v2h1v2h1v2h1v2h1v1H2v-1h1v-2h1V9h1V7h1V5h1V3h1z'/%3E%3Cpath fill='%23000' d='M7 5h2v5H7zM7 11h2v2H7z'/%3E%3C/svg%3E");
  --icon-gear: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M6 0h4v2h1v1h1l1-1 2 2-1 1v1h2v4h-2v1h1l1 1-2 2-1-1h-1v1h-1v2H6v-2H5v-1H4l-1 1-2-2 1-1V9h-1V5h2V4H3L2 3l2-2 1 1h1z'/%3E%3Cpath fill='%23808080' d='M7 1h2v2h2v1h1v1h1v2h1v2h-1v2h-1v1h-1v1H9v2H7v-2H5v-1H4v-1H3V9H2V7h1V5h1V4h1V3h2z'/%3E%3Cpath fill='%23c0c0c0' d='M7 2h1v2H7zM5 4h1v1H5zM4 6h1v1H4z'/%3E%3Cpath fill='%23000' d='M6 6h4v4H6z'/%3E%3Cpath fill='%23fff' d='M7 7h2v2H7z'/%3E%3C/svg%3E");
  --icon-music: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M6 1h8v1h1v4h-1v1h-1V5h-1V4h-1V3H8v8H7v1H6v1H5v1H2v-1H1v-3h1v-1h1V9h2V4h1V2h1z'/%3E%3Cpath fill='%233366cc' d='M7 2h6v1h1v2h-1V4h-2V3H9v1H8v8H7v1H6v1H5v1H3v-1H2v-2h1v-1h1V9h2V4h1z'/%3E%3Cpath fill='%2399ccff' d='M8 3h2v1H8z'/%3E%3C/svg%3E");
  --icon-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h14v12H1z'/%3E%3Cpath fill='%2399ccff' d='M2 3h12v10H2z'/%3E%3Cpath fill='%23ffcc00' d='M10 4h2v2h-2z'/%3E%3Cpath fill='%23339933' d='M2 10h2V9h1V8h1v1h1v1h1V9h1V8h1V7h1v1h1v1h1v1h1v3H2z'/%3E%3Cpath fill='%23226622' d='M2 12h12v1H2z'/%3E%3C/svg%3E");
  --icon-link: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 6h6v1h1V6h1V4h1V3h5v1h1v5h-1v1H9V9h1V8h1V7h1V5h-2v1H9v1H8v1H7v1H6v1H5V8H3v1H2V8H1z'/%3E%3Cpath fill='%233366cc' d='M2 7h3v1h1v1H5V8H3v1H2zM10 4h4v4h-1V7h-1V6h-1V5h-1z'/%3E%3Cpath fill='%23000' d='M1 9h1v3h1v1h5v-1h1V9h1v3H9v2H2v-1H1zM7 6h1v1H7z'/%3E%3Cpath fill='%233366cc' d='M2 10h1v2h5v-2h1v2H8v1H3v-1H2z'/%3E%3C/svg%3E");
  --icon-download: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M6 1h4v6h3v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4V9H3V8H2V7h4z'/%3E%3Cpath fill='%23339933' d='M7 2h2v6h2v1h-1v1h-1v1H9v1H7v-1H6v-1H5V9H4V8h3z'/%3E%3Cpath fill='%23000' d='M1 11h2v3h10v-3h2v4H1z'/%3E%3Cpath fill='%23808080' d='M2 12h1v2h10v-2h1v3H2z'/%3E%3C/svg%3E");
  --icon-rss: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 1h14v14H1z'/%3E%3Cpath fill='%23ff6600' d='M2 2h12v12H2z'/%3E%3Cpath fill='%23fff' d='M3 11h2v2H3zM3 7h1v1h1v1h1v1h1v1h1v2H8v-1H7v-1H6v-1H5V9H4V8H3zM3 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2h-2v-1h-1v-1h-1V9H8V8H7V7H6V6H5V5H4V4H3z'/%3E%3C/svg%3E");
  --icon-chat: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h14v9h-1v1H9v1H8v1H7v1H6v-1H5v-1H4v-1H2v-1H1z'/%3E%3Cpath fill='%23fff' d='M2 3h12v8H9v1H8v1H7v1H6v-1H5v-1H4v-1H2z'/%3E%3Cpath fill='%233366cc' d='M4 5h8v1H4zM4 7h6v1H4zM4 9h4v1H4z'/%3E%3C/svg%3E");
  --icon-lock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h6v1h1v1h1v4h1v8H2V7h1V3h1V2h1z'/%3E%3Cpath fill='%23c0c0c0' d='M5 2h6v1h1v4h-2V4h-1V3H7v1H6v3H4V3h1z'/%3E%3Cpath fill='%23ffcc00' d='M3 8h10v6H3z'/%3E%3Cpath fill='%23000' d='M7 9h2v2H8v2H7v-2z'/%3E%3C/svg%3E");
  --icon-globe: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1V5h1V3h1V2h2z'/%3E%3Cpath fill='%233366cc' d='M5 2h6v1h2v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2z'/%3E%3Cpath fill='%23339933' d='M4 4h3v1h1v2H7v1H6v1H5V8H4V6H3V5h1zM10 6h3v2h-1v1h-1v1h-1V9H9V7h1zM6 11h3v1h1v1H9v1H7v-1H6z'/%3E%3Cpath fill='%2399ccff' d='M9 3h2v1H9z'/%3E%3C/svg%3E");
  --icon-new: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 4h14v8H1z'/%3E%3Cpath fill='%23ffcc00' d='M2 5h12v6H2z'/%3E%3Ctext x='8' y='10.3' font-family='Arial,Helvetica,sans-serif' font-weight='bold' font-size='6' text-anchor='middle' fill='%23cc3333'%3ENEW%3C/text%3E%3C/svg%3E");
  --icon-hot: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 1h2v2h1v1h1v2h1v1h1v2h1v4h-1v1h-1v1h-2v1H6v-1H4v-1H3v-1H2V9h1V7h1V5h1v2h1V5h1V3h1z'/%3E%3Cpath fill='%23ff6600' d='M7 2h2v2h1v1h1v2h1v1h1v2h1v3h-1v1h-1v1h-2v1H6v-1H4v-1H3v-3h1V8h1V6h1v2h1V6h1V4h1z'/%3E%3Cpath fill='%23ffcc00' d='M7 8h2v1h1v1h1v3h-1v1H6v-1H5v-3h1V9h1z'/%3E%3Cpath fill='%23fff' d='M7 11h2v2H7z'/%3E%3C/svg%3E");
  --icon-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M12 2h3v2h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H6v1H5v1H4v-1H3v-1H2v-1H1V8h1V7h1v1h1v1h1V8h1V7h1V6h1V5h1V4h1V3h1z'/%3E%3Cpath fill='%23339933' d='M13 3h1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H6v1H5v1H4v-1H3v-1H2V9h1v1h1v1h1v-1h1V9h1V8h1V7h1V6h1V5h1V4h1z'/%3E%3C/svg%3E");
  --icon-close: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M2 2h3v1h1v1h1v1h2V4h1V3h1V2h3v3h-1v1h-1v1h-1v2h1v1h1v1h1v3h-3v-1h-1v-1h-1v-1H7v1H6v1H5v1H2v-3h1v-1h1v-1h1V7H4V6H3V5H2z'/%3E%3Cpath fill='%23cc3333' d='M3 3h1v1h1v1h1v1h1v1h2V6h1V5h1V4h1V3h1v1h-1v1h-1v1h-1v1H9v2h1v1h1v1h1v1h1v1h-1v-1h-1v-1h-1v-1H9v-1H7v1H6v1H5v1H4v1H3v-1h1v-1h1v-1h1V9h1V7H6V6H5V5H4V4H3z'/%3E%3C/svg%3E");
  --icon-menu: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h14v3H1zM1 7h14v3H1zM1 12h14v3H1z'/%3E%3Cpath fill='%233366cc' d='M2 3h12v1H2zM2 8h12v1H2zM2 13h12v1H2z'/%3E%3C/svg%3E");
  --icon-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 2h14v13H1z'/%3E%3Cpath fill='%23cc3333' d='M2 3h12v3H2z'/%3E%3Cpath fill='%23fff' d='M2 6h12v8H2z'/%3E%3Cpath fill='%23000' d='M4 1h2v3H4zM10 1h2v3h-2zM3 8h2v1H3zM6 8h2v1H6zM9 8h2v1H9zM3 10h2v1H3zM6 10h2v1H6zM9 10h2v1H9zM12 8h1v1h-1zM12 10h1v1h-1zM3 12h2v1H3zM6 12h2v1H6z'/%3E%3C/svg%3E");
  --icon-clock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1V5h1V3h1V2h2z'/%3E%3Cpath fill='%23fff' d='M5 2h6v1h2v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2z'/%3E%3Cpath fill='%23000' d='M7 4h2v4h3v2H7z'/%3E%3Cpath fill='%23cc3333' d='M8 8h1v1H8z'/%3E%3C/svg%3E");
  --icon-print: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M4 1h8v4h3v7h-3v3H4v-3H1V5h3z'/%3E%3Cpath fill='%23fff' d='M5 2h6v3H5zM5 11h6v3H5z'/%3E%3Cpath fill='%23c0c0c0' d='M2 6h12v5h-2V9H4v2H2z'/%3E%3Cpath fill='%23339933' d='M12 7h1v1h-1z'/%3E%3Cpath fill='%23000' d='M6 12h4v1H6z'/%3E%3C/svg%3E");
  --icon-tag: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 1h7v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3v-1H2V9H1z'/%3E%3Cpath fill='%23ffcc00' d='M2 2h5v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v-1H7v-1H6v-1H5v-1H4v-1H3V9H2z'/%3E%3Cpath fill='%23000' d='M4 4h2v2H4z'/%3E%3Cpath fill='%23fff' d='M4 4h1v1H4z'/%3E%3C/svg%3E");
  --icon-bookmark: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M3 1h10v14h-1v-1h-1v-1h-1v-1H9v-1H7v1H6v1H5v1H4v1H3z'/%3E%3Cpath fill='%23cc3333' d='M4 2h8v11h-1v-1h-1v-1H9v-1H7v1H6v1H5v1H4z'/%3E%3Cpath fill='%23ffcc00' d='M7 4h2v1h1v1H9v1H7V6H6V5h1z'/%3E%3C/svg%3E");
  --icon-play: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M3 1h2v1h2v1h2v1h2v1h2v1h2v1h1v2h-1v1h-2v1h-2v1H9v1H7v1H5v1H3z'/%3E%3Cpath fill='%23339933' d='M4 2h1v1h2v1h2v1h2v1h2v1h1v2h-1v1h-2v1H9v1H7v1H5v1H4z'/%3E%3Cpath fill='%2399ee99' d='M5 4h1v1h2v1H6V5H5z'/%3E%3C/svg%3E");
  --icon-placeholder: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 1h14v14H1z'/%3E%3Cpath fill='%23c0c0c0' d='M2 2h12v12H2z'/%3E%3Cpath fill='%23000' d='M6 4h4v1h1v3h-1v1H9v1H7V8h1V7h1V5H7v1H5V5h1zM7 11h2v2H7z'/%3E%3C/svg%3E");

  /* ---- tileable backgrounds. Use: background-image: var(--bg-starfield) ---- */
  --bg-starfield: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' shape-rendering='crispEdges'%3E%3Crect width='64' height='64' fill='%23000'/%3E%3Cg fill='%23fff'%3E%3Crect x='3' y='7' width='1' height='1'/%3E%3Crect x='17' y='2' width='1' height='1'/%3E%3Crect x='29' y='12' width='2' height='2'/%3E%3Crect x='45' y='5' width='1' height='1'/%3E%3Crect x='58' y='19' width='1' height='1'/%3E%3Crect x='9' y='28' width='1' height='1'/%3E%3Crect x='38' y='30' width='1' height='1'/%3E%3Crect x='51' y='41' width='2' height='2'/%3E%3Crect x='22' y='44' width='1' height='1'/%3E%3Crect x='5' y='52' width='1' height='1'/%3E%3Crect x='33' y='57' width='1' height='1'/%3E%3Crect x='60' y='60' width='1' height='1'/%3E%3Crect x='14' y='61' width='1' height='1'/%3E%3Crect x='47' y='24' width='1' height='1'/%3E%3C/g%3E%3Cg fill='%239cf'%3E%3Crect x='40' y='48' width='1' height='1'/%3E%3Crect x='26' y='20' width='1' height='1'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-gray: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Crect width='8' height='8' fill='%23c0c0c0'/%3E%3Crect width='4' height='4' fill='%23d4d4d4'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23d4d4d4'/%3E%3C/svg%3E");
  --bg-tile-hazard: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23ffcc00'/%3E%3Cpath fill='%23000' d='M0 8 8 0h4L0 12zM8 16l8-8v4l-4 4zM12 0h4L0 16v-4z'/%3E%3C/svg%3E");
  --bg-tile-dots: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23fff'/%3E%3Ccircle cx='4' cy='4' r='1.5' fill='%23ffb3d9'/%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%23b3ecff'/%3E%3C/svg%3E");
  --bg-tile-grid: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' shape-rendering='crispEdges'%3E%3Crect width='32' height='32' fill='%230a0a2a'/%3E%3Cpath stroke='%2300e5ff' stroke-opacity='.45' d='M.5 0v32M0 .5h32'/%3E%3C/svg%3E");
  --bg-tile-clouds: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='64' viewBox='0 0 96 64'%3E%3Crect width='96' height='64' fill='%238fc3f5'/%3E%3Cg fill='%23fff' fill-opacity='.9'%3E%3Cellipse cx='22' cy='20' rx='14' ry='7'/%3E%3Cellipse cx='32' cy='16' rx='10' ry='7'/%3E%3Cellipse cx='70' cy='46' rx='16' ry='7'/%3E%3Cellipse cx='80' cy='41' rx='9' ry='6'/%3E%3Cellipse cx='60' cy='48' rx='9' ry='5'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)'/%3E%3C/svg%3E");
  --bg-tile-pinstripe: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4' shape-rendering='crispEdges'%3E%3Crect width='4' height='4' fill='%23ececec'/%3E%3Crect width='4' height='1' fill='%23e0e0e0'/%3E%3C/svg%3E");
  --bg-tile-scanlines: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4' shape-rendering='crispEdges'%3E%3Crect width='4' height='2' fill='%23000' fill-opacity='.18'/%3E%3C/svg%3E");
  --bg-tile-glitter: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%23fff' fill-opacity='.85'%3E%3Cpath d='M5 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'/%3E%3Cpath d='M17 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'/%3E%3Crect x='12' y='4' width='1' height='1'/%3E%3Crect x='20' y='7' width='1' height='1'/%3E%3Crect x='3' y='18' width='1' height='1'/%3E%3Crect x='9' y='21' width='1' height='1'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-hearts: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%23ff8fc8'%3E%3Cpath d='M6 10 2.5 6.5a2 2 0 0 1 3.5-2 2 2 0 0 1 3.5 2z'/%3E%3Cpath d='M18 20l-3.5-3.5a2 2 0 0 1 3.5-2 2 2 0 0 1 3.5 2z'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-brushed-metal: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='8' viewBox='0 0 64 8' shape-rendering='crispEdges'%3E%3Crect width='64' height='8' fill='%23d6d6d6'/%3E%3Cg fill='%23c4c4c4'%3E%3Crect y='1' width='40' height='1'/%3E%3Crect x='22' y='3' width='42' height='1'/%3E%3Crect y='5' width='30' height='1'/%3E%3Crect x='35' y='7' width='29' height='1'/%3E%3C/g%3E%3Cg fill='%23e8e8e8'%3E%3Crect x='10' y='2' width='30' height='1'/%3E%3Crect y='6' width='50' height='1'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-stars-blue: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23000080'/%3E%3Cg fill='%23ffcc00'%3E%3Cpath d='M8 3l1 2 2 .3-1.5 1.4.4 2L8 7.7 6.1 8.7l.4-2L5 5.3l2-.3z'/%3E%3Cpath d='M24 19l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z'/%3E%3C/g%3E%3C/svg%3E");
  --bg-tile-plaid-blue: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Crect width='16' height='16' fill='%23e5edf5'/%3E%3Crect width='16' height='4' fill='%23d3dce8'/%3E%3Crect width='4' height='16' fill='%23d3dce8'/%3E%3Crect width='4' height='4' fill='%23c2cfe0'/%3E%3C/svg%3E");

  /* ---- gradients. Use: background-image: var(--grad-glossy-blue) ---- */
  --grad-glossy-blue: linear-gradient(180deg, #8fc4f5 0%, #3b8dd6 48%, #1f6fbf 52%, #4ea1ea 100%);
  --grad-glossy-green: linear-gradient(180deg, #c7ef7f 0%, #8cc63f 48%, #6ea52a 52%, #9ad64a 100%);
  --grad-glossy-orange: linear-gradient(180deg, #ffd27f 0%, #f7941d 48%, #d97a0a 52%, #ffa83a 100%);
  --grad-glossy-black: linear-gradient(180deg, #666 0%, #222 48%, #000 52%, #333 100%);
  --grad-chrome: linear-gradient(180deg, #fff 0%, #cfd3d8 30%, #8a9099 50%, #d9dde2 70%, #fff 100%);
  --grad-titlebar: linear-gradient(90deg, #000080, #1084d0);
  --grad-aqua: linear-gradient(180deg, #e6f0ff 0%, #a7c7f0 45%, #5e95e0 55%, #9fc1f2 100%);
  --grad-navy-header: linear-gradient(180deg, #4a6fa5 0%, #003366 100%);
  --grad-rainbow: linear-gradient(90deg, #f00, #ff7f00, #ff0, #0f0, #00f, #4b0082, #8f00ff);
  --grad-metal: linear-gradient(90deg, #bbb, #eee 40%, #999 60%, #ddd);

  /* ---- font stacks (system fonts of the era) ---- */
  --font-comic: "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive;
  --font-verdana: Verdana, Geneva, sans-serif;
  --font-tahoma: Tahoma, "Segoe UI", Geneva, sans-serif;
  --font-ms-sans: "MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif;
  --font-arial: Arial, Helvetica, sans-serif;
  --font-arial-black: "Arial Black", Impact, Arial, sans-serif;
  --font-impact: Impact, "Arial Narrow Bold", "Arial Black", sans-serif;
  --font-times: "Times New Roman", Times, serif;
  --font-georgia: Georgia, "Times New Roman", serif;
  --font-trebuchet: "Trebuchet MS", "Lucida Grande", Verdana, sans-serif;
  --font-lucida: "Lucida Grande", "Lucida Sans Unicode", Verdana, sans-serif;
  --font-courier: "Courier New", Courier, "Lucida Console", monospace;

  /* ---- cursors. Use: cursor: var(--cursor-arrow) ---- */
  --cursor-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M1 1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H9v1h1v1h1v1h1v1H9v-1H8v-1H7v-1H6v-1H5v1H4v1H3v1H2v1H1z'/%3E%3Cpath fill='%23fff' d='M2 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H7v1h1v1h1v1H8v-1H7v-1H6v-1H5v-1H4v1H3v1H2z'/%3E%3C/svg%3E") 1 1, auto;
  --cursor-hand: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M5 1h3v5h1V4h3v3h1V5h2v8h-1v2H6v-1H5v-1H4v-1H3v-1H2V9h1V8h2z'/%3E%3Cpath fill='%23fff' d='M6 2h1v6h2V5h1v3h2V6h1v8H7v-1H6v-1H5v-1H4v-1H3V9h2v1h1z'/%3E%3C/svg%3E") 6 1, pointer;
  --cursor-sparkle: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='M7 0h2v4h1v1h1v1h4v2h-4v1h-1v1H9v6H7v-6H6v-1H5V8H1V6h4V5h1V4h1z'/%3E%3Cpath fill='%23ff66aa' d='M7 1h2v4h1v1h1v1h3v1h-3v1h-1v1H9v5H7V10H6V9H5V8H2V7h3V6h1V5h1z'/%3E%3Cpath fill='%23fff' d='M7 2h1v3H7z'/%3E%3C/svg%3E") 8 8, auto;

  /* ---- recipe values (reusable single-property values) ---- */
  --bevel-out: 2px outset #ffffff;
  --bevel-in: 2px inset #ffffff;
  --win-gray: #c0c0c0;
  --win-navy: #000080;
  --win-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf;
  --win-shadow-in: inset 1px 1px #0a0a0a, inset -1px -1px #ffffff, inset 2px 2px #808080, inset -2px -2px #dfdfdf;
  --glossy-shadow: 0 1px 3px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.6);
  --text-glow: 0 0 4px currentColor, 0 0 8px currentColor;
  --rainbow-text: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f);
}

/* ---- components (opt-in utility classes; attach with the apply-class directive) ---- */

.retro-bevel-btn {
  background: var(--win-gray);
  color: #000;
  border: var(--bevel-out);
  box-shadow: var(--win-shadow);
  font: 11px var(--font-ms-sans);
  padding: 3px 12px;
  border-radius: 0;
  text-decoration: none;
  cursor: var(--cursor-hand);
}
.retro-bevel-btn:active { box-shadow: var(--win-shadow-in); }

.retro-bevel-inset {
  background: #fff;
  border: var(--bevel-in);
  box-shadow: var(--win-shadow-in);
  padding: 2px 4px;
  border-radius: 0;
}

.retro-window {
  background: var(--win-gray);
  border: var(--bevel-out);
  box-shadow: var(--win-shadow), 2px 2px 6px rgba(0,0,0,.35);
  padding: 3px;
  color: #000;
  font: 11px var(--font-ms-sans);
  border-radius: 0;
}

.retro-titlebar {
  background: var(--grad-titlebar);
  color: #fff;
  font: bold 11px var(--font-ms-sans);
  padding: 3px 6px;
  margin: 0 0 4px 0;
  display: block;
  letter-spacing: 0;
}

.retro-panel {
  background: #fff;
  border: 1px solid #000;
  box-shadow: 2px 2px 0 #000;
  padding: 8px;
}

.retro-glossy-btn {
  background-image: var(--grad-glossy-blue);
  color: #fff;
  text-shadow: 0 -1px 0 rgba(0,0,0,.4);
  border: 1px solid #1a5a99;
  border-radius: 6px;
  box-shadow: var(--glossy-shadow);
  padding: 6px 16px;
  font: bold 13px var(--font-lucida);
  text-decoration: none;
}

.retro-pill {
  border-radius: 999px;
  background-image: var(--grad-chrome);
  border: 1px solid #777;
  color: #000;
  padding: 4px 14px;
  text-decoration: none;
  font: bold 12px var(--font-verdana);
}

.retro-hr-rainbow {
  border: 0;
  height: 4px;
  background-image: var(--grad-rainbow);
  margin: 12px 0;
}

.retro-blink { animation: retro-blink 1s steps(2, start) infinite; }
@keyframes retro-blink { to { visibility: hidden; } }

.marquee-bar {
  overflow: hidden;
  white-space: nowrap;
  background: #000;
  color: #ff0;
  font: bold 12px var(--font-verdana);
  padding: 2px 0;
}
.marquee-bar > * {
  display: inline-block;
  padding-left: 100%;
  animation: retro-marquee 14s linear infinite;
  white-space: nowrap;
}
@keyframes retro-marquee { to { transform: translateX(-100%); } }

.hit-counter {
  display: inline-block;
  background: #000;
  color: #0f0;
  font: bold 14px var(--font-courier);
  letter-spacing: 2px;
  padding: 2px 6px;
  border: 2px inset #808080;
}
.hit-counter:empty::after { content: "0013370"; }

.under-construction {
  background-image: var(--bg-tile-hazard);
  color: #000;
  font: bold 12px var(--font-arial-black);
  text-align: center;
  padding: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.under-construction:empty::after { content: "\\1F6A7 Under construction \\1F6A7"; background: #ffcc00; padding: 0 6px; }

.retro-table-rows > * > tr:nth-child(even),
.retro-table-rows > tr:nth-child(even),
.retro-table-rows > :nth-child(even) {
  background-color: #e5edf5;
}

.retro-icon-left {
  background-repeat: no-repeat;
  background-position: 4px center;
  background-size: 16px 16px;
  padding-left: 24px;
}

.retro-badge-new {
  display: inline-block;
  width: 16px;
  height: 16px;
  background: var(--icon-new) no-repeat center / 16px 16px;
  vertical-align: middle;
}

.retro-scanlines { background-image: var(--bg-tile-scanlines); }

.retro-sparkle-text {
  background-image: var(--rainbow-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: bold;
}
`;

  // userscript/src/assets/manifest.json
  var manifest_default = {
    icons: [
      { name: "home", description: "house" },
      { name: "mail", description: "envelope" },
      { name: "search", description: "magnifying glass" },
      { name: "cart", description: "shopping cart" },
      { name: "user", description: "person avatar" },
      { name: "folder", description: "yellow folder" },
      { name: "file", description: "document page" },
      { name: "star", description: "yellow star" },
      { name: "heart", description: "red heart" },
      { name: "arrow-left", description: "blue arrow left" },
      { name: "arrow-right", description: "blue arrow right" },
      { name: "arrow-up", description: "blue arrow up" },
      { name: "arrow-down", description: "blue arrow down" },
      { name: "info", description: "blue info circle" },
      { name: "warning", description: "yellow warning triangle" },
      { name: "gear", description: "settings cog" },
      { name: "music", description: "music note" },
      { name: "image", description: "picture" },
      { name: "link", description: "chain link" },
      { name: "download", description: "download arrow to tray" },
      { name: "rss", description: "orange rss feed" },
      { name: "chat", description: "speech bubble" },
      { name: "lock", description: "padlock" },
      { name: "globe", description: "world globe" },
      { name: "new", description: "NEW badge" },
      { name: "hot", description: "flame" },
      { name: "check", description: "green checkmark" },
      { name: "close", description: "red x" },
      { name: "menu", description: "hamburger lines" },
      { name: "calendar", description: "calendar" },
      { name: "clock", description: "clock face" },
      { name: "print", description: "printer" },
      { name: "tag", description: "price tag" },
      { name: "bookmark", description: "ribbon bookmark" },
      { name: "play", description: "green play triangle" },
      { name: "placeholder", description: "gray question box (fallback)" }
    ],
    backgrounds: [
      { name: "starfield", description: "black with white stars" },
      { name: "tile-gray", description: "light gray checker" },
      { name: "tile-hazard", description: "hazard stripes" },
      { name: "tile-dots", description: "pastel polka dots on white" },
      { name: "tile-grid", description: "cyan grid on navy" },
      { name: "tile-clouds", description: "blue sky with clouds" },
      { name: "tile-noise", description: "gray noise" },
      { name: "tile-pinstripe", description: "Aqua pinstripes" },
      { name: "tile-scanlines", description: "dark scanlines" },
      { name: "tile-glitter", description: "white sparkles" },
      { name: "tile-hearts", description: "pink hearts" },
      { name: "tile-brushed-metal", description: "brushed metal streaks" },
      { name: "tile-stars-blue", description: "yellow stars on navy" },
      { name: "tile-plaid-blue", description: "blue plaid" }
    ],
    gradients: [
      { name: "glossy-blue", description: "Web 2.0 glossy blue" },
      { name: "glossy-green", description: "Web 2.0 glossy green" },
      { name: "glossy-orange", description: "Web 2.0 glossy orange" },
      { name: "glossy-black", description: "glossy black" },
      { name: "chrome", description: "silver chrome" },
      { name: "titlebar", description: "Win98 navy-to-blue" },
      { name: "aqua", description: "Mac OS X aqua gel" },
      { name: "navy-header", description: "corporate navy header" },
      { name: "rainbow", description: "horizontal rainbow" },
      { name: "metal", description: "horizontal metal sheen" }
    ],
    fonts: [
      { name: "comic", description: "Comic Sans MS" },
      { name: "verdana", description: "Verdana" },
      { name: "tahoma", description: "Tahoma" },
      { name: "ms-sans", description: "MS Sans Serif" },
      { name: "arial", description: "Arial" },
      { name: "arial-black", description: "Arial Black" },
      { name: "impact", description: "Impact" },
      { name: "times", description: "Times New Roman" },
      { name: "georgia", description: "Georgia" },
      { name: "trebuchet", description: "Trebuchet MS" },
      { name: "lucida", description: "Lucida Grande" },
      { name: "courier", description: "Courier New" }
    ],
    cursors: [
      { name: "arrow", description: "Win98 arrow" },
      { name: "hand", description: "pointing hand" },
      { name: "sparkle", description: "pink sparkle" }
    ],
    recipes: [
      { name: "bevel-out", description: "raised 3D border" },
      { name: "bevel-in", description: "sunken border" },
      { name: "win-gray", description: "#c0c0c0" },
      { name: "win-navy", description: "#000080" },
      { name: "win-shadow", description: "raised bevel box-shadow" },
      { name: "win-shadow-in", description: "sunken bevel box-shadow" },
      { name: "glossy-shadow", description: "glossy box-shadow" },
      { name: "text-glow", description: "neon text-shadow" },
      { name: "rainbow-text", description: "rainbow text gradient" }
    ],
    components: [
      { name: "retro-bevel-btn", description: "Win98 gray raised button" },
      { name: "retro-bevel-inset", description: "sunken white field" },
      { name: "retro-window", description: "gray dialog window box" },
      { name: "retro-titlebar", description: "navy window title bar" },
      { name: "retro-panel", description: "white box, black border" },
      { name: "retro-glossy-btn", description: "Web 2.0 glossy blue button" },
      { name: "retro-pill", description: "chrome pill button" },
      { name: "retro-hr-rainbow", description: "rainbow horizontal rule" },
      { name: "retro-blink", description: "blinking text" },
      { name: "marquee-bar", description: "scrolling marquee strip" },
      { name: "hit-counter", description: "green LCD visitor counter" },
      { name: "under-construction", description: "hazard stripe banner" },
      { name: "retro-table-rows", description: "alternating row shading" },
      { name: "retro-icon-left", description: "left icon slot; set background-image" },
      { name: "retro-badge-new", description: "inline 16px NEW badge" },
      { name: "retro-scanlines", description: "scanline overlay texture" },
      { name: "retro-sparkle-text", description: "rainbow gradient text" }
    ]
  };

  // userscript/src/assets/index.js
  var LIBRARY_CSS = library_default;
  var MANIFEST = manifest_default;
  function libraryIconNames() {
    return MANIFEST.icons.map((i) => i.name);
  }
  function libraryClassNames() {
    return MANIFEST.components.map((c) => c.name);
  }
  function manifestToPrompt() {
    const list = (items) => items.map((i) => `${i.name} (${i.description})`).join(", ");
    const names = (items) => items.map((i) => i.name).join(", ");
    return [
      "ASSET LIBRARY (already loaded; use by name):",
      `icons 16x16 pixel art, background-image:var(--icon-NAME): ${names(MANIFEST.icons)}.`,
      `tile backgrounds, background-image:var(--bg-NAME): ${list(MANIFEST.backgrounds)}.`,
      `gradients, background-image:var(--grad-NAME): ${names(MANIFEST.gradients)}.`,
      `font stacks, font-family:var(--font-NAME): ${names(MANIFEST.fonts)}.`,
      `cursors, cursor:var(--cursor-NAME): ${names(MANIFEST.cursors)}.`,
      `recipe values var(--NAME): ${list(MANIFEST.recipes)}.`,
      `component classes, attach with /* apply-class: SELECTOR | CLASS */: ${list(MANIFEST.components)}.`
    ].join("\n");
  }
  function manifestToPromptCompact() {
    const names = (items) => items.map((i) => i.name).join(", ");
    return [
      "ASSET LIBRARY (use by name):",
      `icons background-image:var(--icon-NAME): ${names(MANIFEST.icons)}.`,
      `backgrounds var(--bg-NAME): ${names(MANIFEST.backgrounds)}. gradients var(--grad-NAME): ${names(MANIFEST.gradients)}.`,
      `fonts var(--font-NAME): ${names(MANIFEST.fonts)}. recipes: ${names(MANIFEST.recipes)}.`,
      `component classes via /* apply-class: SELECTOR | CLASS */: ${names(MANIFEST.components)}.`
    ].join("\n");
  }
  function estimateTokens(text) {
    return Math.ceil(String(text || "").length / 4);
  }

  // userscript/src/summarize.js
  var MAX_ELEMENTS = 4e3;
  var RANDOM_TOKEN = /(^|[-_])[0-9a-f]{5,}($|[-_])|^(css|sc|jss|emotion|chakra|svelte)-[a-zA-Z0-9]+$|^_[a-zA-Z0-9_]+$|[0-9]{3,}|^[a-zA-Z0-9]{1,2}$|__[a-zA-Z0-9]{6,}$|^[a-z]{1,2}[0-9]{2,}$|^[A-Za-z0-9+/=]{12,}$/;
  var LANDMARKS = [
    ["header", "header, [role=banner], #header, .header, #masthead, .masthead, .site-header, .topbar, .top-bar", 1],
    ["nav", "nav, [role=navigation], #nav, .nav, .navbar, .menu, #menu, .main-nav, .navigation, .main-menu", 3],
    ["main", "main, [role=main], #main, #content, .content, .main, #primary, article, .post, .page-content", 1],
    ["sidebar", "aside, [role=complementary], #sidebar, .sidebar, .side, .widget-area, .rail", 2],
    ["footer", "footer, [role=contentinfo], #footer, .footer, .site-footer", 1],
    ["search", "form[role=search], input[type=search], .search-form, #search, .search", 1]
  ];
  function isStableToken(t) {
    return typeof t === "string" && t.length > 0 && t.length <= 40 && /^[a-zA-Z][\w-]*$/.test(t) && !RANDOM_TOKEN.test(t);
  }
  function cssEscape(s) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
    return String(s).replace(/([^\w-])/g, "\\$1");
  }
  function rgbToHex(color) {
    if (!color || typeof color !== "string") return null;
    const c = color.trim().toLowerCase();
    if (c === "transparent") return null;
    if (/^#[0-9a-f]{3,8}$/.test(c)) return c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
    const m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(c);
    if (!m) return null;
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a === 0) return null;
    const h = (n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, "0");
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  }
  function firstFont(ff) {
    if (!ff) return null;
    const f = ff.split(",")[0].trim().replace(/^["']|["']$/g, "");
    return f || null;
  }
  function trunc(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
  function createMeasure(doc, options = {}) {
    const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
    const rect = options.rect || ((el) => el.getBoundingClientRect());
    const style = options.style || ((el, pseudo) => win ? win.getComputedStyle(el, pseudo || null) : {});
    let layout = options.layoutAvailable;
    if (layout == null) {
      try {
        const r = rect(doc.documentElement);
        layout = r.width > 0 || r.height > 0;
      } catch {
        layout = false;
      }
    }
    const viewport = options.viewport || { width: win ? win.innerWidth : 1280, height: win ? win.innerHeight : 800 };
    return {
      rect,
      style,
      layout,
      viewport,
      isVisible(el) {
        if (!layout) return true;
        try {
          const s = style(el);
          if (s.display === "none" || s.visibility === "hidden") return false;
          const r = rect(el);
          return r.width > 0 && r.height > 0;
        } catch {
          return false;
        }
      }
    };
  }
  function uniqueSelector(el, doc, maxDepth = 4) {
    doc = doc || el.ownerDocument;
    const count = (sel) => {
      try {
        return doc.querySelectorAll(sel).length;
      } catch {
        return -1;
      }
    };
    const seg = (node, nth) => {
      let s = node.localName;
      if (/[A-Z]/.test(s)) s = cssEscape(s);
      const classes = [...node.classList || []].filter(isStableToken).slice(0, 2);
      s += classes.map((c) => "." + cssEscape(c)).join("");
      if (nth) {
        let n = 1;
        let p = node.previousElementSibling;
        while (p) {
          if (p.localName === node.localName) n++;
          p = p.previousElementSibling;
        }
        s += `:nth-of-type(${n})`;
      }
      return s;
    };
    const simplify = (arr) => {
      const out = [...arr];
      for (let k = 0; k < out.length; k++) {
        if (!out[k].includes(":nth-of-type(")) continue;
        const trial = [...out];
        trial[k] = out[k].replace(/:nth-of-type\(\d+\)/, "");
        if (count(trial.join(" > ")) === 1) out[k] = trial[k];
      }
      return out.join(" > ");
    };
    const parts = [];
    let cur = el;
    for (let depth = 0; depth <= maxDepth && cur && cur.nodeType === 1 && cur !== doc.documentElement; depth++) {
      if (cur.id && isStableToken(cur.id) && count("#" + cssEscape(cur.id)) === 1) {
        parts.unshift("#" + cssEscape(cur.id));
        const s2 = parts.join(" > ");
        if (count(s2) === 1) return simplify(parts);
        break;
      }
      parts.unshift(seg(cur, false));
      let s = parts.join(" > ");
      if (count(s) === 1) return simplify(parts);
      parts[0] = seg(cur, true);
      s = parts.join(" > ");
      if (count(s) === 1) return simplify(parts);
      cur = cur.parentElement;
    }
    if (cur === doc.documentElement || cur && cur.localName === "body") parts.unshift("body");
    return parts.join(" > ");
  }
  function patternSelector(el) {
    const own = (node) => {
      let s = node.localName;
      const classes = [...node.classList || []].filter(isStableToken).slice(0, 2);
      if (classes.length) return s + classes.map((c) => "." + cssEscape(c)).join("");
      if (node.id && isStableToken(node.id)) return "#" + cssEscape(node.id);
      return null;
    };
    const self = own(el);
    if (self) return self;
    let p = el.parentElement;
    for (let i = 0; i < 3 && p && p.localName !== "body"; i++, p = p.parentElement) {
      const ps = own(p);
      if (ps) return `${ps} ${el.localName}`;
    }
    return el.localName;
  }
  function guessPageType(doc, counts, text) {
    const has = (sel) => {
      try {
        return !!doc.querySelector(sel);
      } catch {
        return false;
      }
    };
    if (has("input[type=password]")) return "login or signup";
    if (counts.article >= 1 && counts.p >= 8) return "article";
    if (/[$€£]\s?\d|\badd to (cart|bag|basket)\b|\bcheckout\b/i.test(text) && counts.img >= 6) return "shop";
    if (counts.video >= 1 || has("audio")) return "media";
    if (counts.table >= 2 && counts.tr >= 20) return "data tables";
    if (counts.form >= 1 && counts.input >= 5) return "form";
    if (counts.a >= 80 && counts.p < 10) return "portal or directory";
    if (counts.h2 >= 6 && counts.a >= 30) return "listing or feed";
    if (counts.pre >= 3 || counts.code >= 10) return "documentation";
    if (counts.p >= 4) return "content page";
    return "generic";
  }
  function summarizePage(doc = document, options = {}) {
    const tokenBudget = options.tokenBudget || 1500;
    const M = createMeasure(doc, options);
    const body = doc.body || doc.documentElement;
    const all = [...doc.querySelectorAll("*")].filter((e) => !e.closest("retro-web-panel")).slice(0, MAX_ELEMENTS);
    const visible = all.filter((e) => M.isVisible(e));
    const counts = {};
    for (const e of visible) counts[e.localName] = (counts[e.localName] || 0) + 1;
    const n = (t) => counts[t] || 0;
    for (const t of ["a", "p", "img", "svg", "button", "input", "form", "table", "tr", "video", "article", "h1", "h2", "h3", "pre", "code", "ul", "li", "select", "textarea"]) counts[t] = n(t);
    const text = (body.innerText != null ? body.innerText : body.textContent || "").slice(0, 2e4);
    const pageType = guessPageType(doc, counts, text);
    const picked = [];
    const landmarks = [];
    const vh = M.viewport.height || 800;
    const vwAll = M.viewport.width || 1280;
    const scrollY = doc.defaultView ? doc.defaultView.scrollY || 0 : 0;
    const docH = Math.max(doc.documentElement.scrollHeight || 0, body.scrollHeight || 0, vh);
    const hasMedia = (el) => !!el.querySelector("video, audio, canvas, iframe, embed, object");
    const textLinks = (el) => [...el.querySelectorAll("a")].filter((a) => (a.textContent || "").trim().length >= 2 && !a.querySelector("svg, img")).length;
    const verify = (role, el) => {
      if (!M.layout) return true;
      const r = M.rect(el);
      const top = r.top + scrollY;
      const links = el.querySelectorAll("a").length;
      const buttons = el.querySelectorAll("button, [role=button]").length;
      const tl = textLinks(el);
      switch (role) {
        case "header":
          return top < 240 && r.height <= vh * 0.35 && r.width >= vwAll * 0.5 && !hasMedia(el);
        case "nav":
          return tl >= 3 && tl >= 0.6 * Math.max(1, links + buttons) && !hasMedia(el) && (r.height <= vh * 0.3 || r.width <= vwAll * 0.35);
        case "sidebar":
          return r.height >= 240 && r.width >= 140 && r.width <= vwAll * 0.4 && !hasMedia(el);
        case "main":
          return r.width >= vwAll * 0.4 && (el.textContent || "").trim().length >= bodyTextLen * 0.3;
        case "footer":
          return top + r.height >= docH * 0.6 && r.height <= vh * 0.5 && !hasMedia(el);
        case "search":
          return !!el.querySelector("input") && r.width <= vwAll * 0.8;
        default:
          return true;
      }
    };
    const bodyTextLen = (body.textContent || "").trim().length;
    for (const [role, sel, max] of LANDMARKS) {
      let cands = [];
      try {
        cands = [...doc.querySelectorAll(sel)];
      } catch {
        cands = [];
      }
      const NOT_CONTAINERS = /* @__PURE__ */ new Set(["button", "a", "input", "select", "textarea", "label", "span", "img", "svg", "i", "b", "em", "strong", "li", "td", "th", "option"]);
      cands = cands.filter((e) => !NOT_CONTAINERS.has(e.localName) && M.isVisible(e) && !picked.includes(e) && !e.closest("retro-web-panel") && verify(role, e));
      if (M.layout) {
        cands.sort((a, b) => {
          const ra = M.rect(a);
          const rb = M.rect(b);
          return rb.width * rb.height - ra.width * ra.height;
        });
      }
      const chosen = [];
      for (const c of cands) {
        if (chosen.some((p) => p.contains(c) || c.contains(p))) continue;
        chosen.push(c);
        if (chosen.length >= max) break;
      }
      for (const el of chosen) {
        picked.push(el);
        const st = M.style(el);
        const r = M.layout ? M.rect(el) : null;
        const links = el.querySelectorAll("a").length;
        const imgs = el.querySelectorAll("img, svg").length;
        const btns = el.querySelectorAll("button, [role=button], input[type=submit]").length;
        landmarks.push({
          role,
          selector: uniqueSelector(el, doc),
          tag: el.localName,
          rect: r ? { x: Math.round(r.left), y: Math.round(r.top + (doc.defaultView ? doc.defaultView.scrollY || 0 : 0)), w: Math.round(r.width), h: Math.round(r.height) } : null,
          display: st.display,
          flexDirection: st.display && st.display.includes("flex") ? st.flexDirection : void 0,
          links,
          images: imgs,
          buttons: btns,
          children: el.children.length,
          textLength: (el.textContent || "").trim().length,
          bg: rgbToHex(st.backgroundColor),
          color: rgbToHex(st.color)
        });
      }
    }
    const have = (role) => landmarks.some((l) => l.role === role);
    const bodyText = (body.textContent || "").trim().length;
    const describe = (role, el) => {
      picked.push(el);
      const st = M.style(el);
      const r = M.layout ? M.rect(el) : null;
      landmarks.push({
        role,
        selector: uniqueSelector(el, doc),
        tag: el.localName,
        rect: r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null,
        display: st.display,
        flexDirection: st.display && st.display.includes("flex") ? st.flexDirection : void 0,
        links: el.querySelectorAll("a").length,
        images: el.querySelectorAll("img, svg").length,
        buttons: el.querySelectorAll("button, [role=button], input[type=submit]").length,
        children: el.children.length,
        textLength: (el.textContent || "").trim().length,
        bg: rgbToHex(st.backgroundColor),
        color: rgbToHex(st.color),
        inferred: true
      });
    };
    if (M.layout && !have("nav")) {
      let best = null;
      for (const e of visible) {
        if (picked.some((p) => p.contains(e))) continue;
        const r = M.rect(e);
        if (r.top > 240 || r.height > 160 || r.width < 200) continue;
        const links = e.querySelectorAll("a").length;
        const tl = (e.textContent || "").trim().length;
        if (links < 4 || tl > 400 || !verify("nav", e)) continue;
        const score = links * 10 - tl / 20 - r.top / 10;
        if (!best || score > best.score) best = { e, score };
      }
      if (best) describe("nav", best.e);
    }
    if (M.layout && !have("header")) {
      const nav = landmarks.find((l) => l.role === "nav");
      const navEl = nav ? doc.querySelector(nav.selector) : null;
      const cand = navEl && navEl.parentElement && navEl.parentElement !== body && M.rect(navEl.parentElement).height < 220 ? navEl.parentElement : null;
      if (cand && verify("header", cand)) describe("header", cand);
    }
    if (!have("main")) {
      let cur = body;
      for (let i = 0; i < 12; i++) {
        const kids = [...cur.children].filter((k) => M.isVisible(k) && !["script", "style", "retro-web-panel"].includes(k.localName));
        const next = kids.find((k) => (k.textContent || "").trim().length >= bodyText * 0.6);
        if (!next) break;
        cur = next;
      }
      if (cur !== body && cur.children.length >= 2 && !picked.includes(cur) && verify("main", cur)) describe("main", cur);
    }
    landmarks.sort((a, b) => ["header", "nav", "main", "sidebar", "footer", "search"].indexOf(a.role) - ["header", "nav", "main", "sidebar", "footer", "search"].indexOf(b.role));
    const vw = M.viewport.width;
    let columns = null;
    if (M.layout) {
      let best = null;
      const containers = visible.filter((e) => e.children.length >= 2 && e.children.length <= 12 && !["ul", "ol", "tr", "table", "select", "svg"].includes(e.localName)).slice(0, 600);
      for (const c of containers) {
        const cr = M.rect(c);
        if (cr.width < vw * 0.5) continue;
        const kids = [...c.children].filter((k) => M.isVisible(k)).map((k) => ({ k, r: M.rect(k) })).filter((o) => o.r.width >= 120 && o.r.height >= 80);
        if (kids.length < 2) continue;
        const first = kids[0];
        const row = kids.filter((o) => Math.abs(o.r.top - first.r.top) < 60 && o.r.left >= first.r.left);
        const sorted = row.sort((a, b) => a.r.left - b.r.left);
        let ok = sorted.length >= 2;
        for (let i = 1; i < sorted.length && ok; i++) if (sorted[i].r.left < sorted[i - 1].r.right - 8) ok = false;
        if (ok && (!best || sorted.length > best.cols.length || sorted.length === best.cols.length && cr.height > best.height)) best = { el: c, cols: sorted, height: cr.height };
      }
      if (best) {
        columns = {
          container: uniqueSelector(best.el, doc),
          parts: best.cols.map((o) => ({ selector: patternSelector(o.k), width: Math.round(o.r.width) }))
        };
      }
    }
    const flexGrid = visible.filter((e) => {
      const d = M.style(e).display || "";
      return d.includes("flex") || d.includes("grid");
    }).length;
    const docHeight = M.layout ? Math.round(Math.max(doc.documentElement.scrollHeight || 0, body.scrollHeight || 0)) : null;
    const bodyWidth = M.layout ? Math.round(M.rect(body).width) : null;
    const classFreq = /* @__PURE__ */ new Map();
    const idList = [];
    for (const e of visible) {
      for (const c of e.classList || []) {
        if (!isStableToken(c)) continue;
        const k = c;
        const v = classFreq.get(k) || { count: 0, tags: /* @__PURE__ */ new Map() };
        v.count++;
        v.tags.set(e.localName, (v.tags.get(e.localName) || 0) + 1);
        classFreq.set(k, v);
      }
      if (e.id && isStableToken(e.id) && e.children.length >= 2 && idList.length < 40) idList.push({ id: e.id, tag: e.localName, children: e.children.length });
    }
    const scopingLimit = Math.max(40, Math.round(visible.length * 0.1));
    const classes = [...classFreq.entries()].filter(([, v]) => v.count <= scopingLimit).sort((a, b) => b[1].count - a[1].count).slice(0, 30).map(([name, v]) => ({ name, count: v.count, tag: [...v.tags.entries()].sort((a, b) => b[1] - a[1])[0][0] }));
    const ids = idList.sort((a, b) => b.children - a.children).slice(0, 15);
    const bodyStyle = M.style(body);
    const htmlStyle = M.style(doc.documentElement);
    const colors = {
      bg: rgbToHex(bodyStyle.backgroundColor) || rgbToHex(htmlStyle.backgroundColor) || "#ffffff",
      text: rgbToHex(bodyStyle.color) || "#000000",
      link: null,
      headingColor: null,
      buttonBg: null,
      buttonText: null,
      accents: []
    };
    const link = visible.find((e) => e.localName === "a" && (e.textContent || "").trim());
    if (link) colors.link = rgbToHex(M.style(link).color);
    const h = visible.find((e) => /^h[1-3]$/.test(e.localName));
    if (h) colors.headingColor = rgbToHex(M.style(h).color);
    const btn = visible.find((e) => e.localName === "button" || e.localName === "input" && e.type === "submit" || e.getAttribute("role") === "button");
    if (btn) {
      colors.buttonBg = rgbToHex(M.style(btn).backgroundColor);
      colors.buttonText = rgbToHex(M.style(btn).color);
    }
    const accentFreq = /* @__PURE__ */ new Map();
    for (const e of visible.slice(0, 1500)) {
      const bg = rgbToHex(M.style(e).backgroundColor);
      if (bg && bg !== colors.bg && bg !== "#ffffff" && bg !== "#000000") accentFreq.set(bg, (accentFreq.get(bg) || 0) + 1);
    }
    colors.accents = [...accentFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    const fonts = {
      body: firstFont(bodyStyle.fontFamily),
      bodySize: bodyStyle.fontSize || null,
      heading: h ? firstFont(M.style(h).fontFamily) : null
    };
    const smallImgs = [];
    const bigImgs = [];
    for (const e of visible) {
      if (e.localName !== "img" && e.localName !== "svg") continue;
      if (e.closest("svg") && e.localName !== "svg") continue;
      const r = M.layout ? M.rect(e) : { width: e.width || 0, height: e.height || 0 };
      const size = Math.max(r.width, r.height);
      if (!M.layout || size <= 48) smallImgs.push(e);
      else bigImgs.push({ el: e, w: Math.round(r.width), h: Math.round(r.height) });
    }
    const groupBy = (els, f) => {
      const m = /* @__PURE__ */ new Map();
      for (const e of els) {
        const k = f(e);
        if (k) m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const iconParents = groupBy(smallImgs, (e) => {
      const p = e.closest("a, button, [role=button], li, label, span, div");
      return p ? patternSelector(p) : null;
    }).slice(0, 6);
    const buttonEls = visible.filter((e) => e.localName === "button" || e.localName === "input" && ["submit", "button"].includes(e.type) || e.getAttribute("role") === "button" || e.localName === "a" && /\b(btn|button|cta)\b/i.test(e.className || ""));
    const buttonGroups = groupBy(buttonEls, (e) => patternSelector(e)).slice(0, 6);
    const buttonInfo = (sel) => {
      let el = null;
      try {
        el = buttonEls.find((e) => e.matches(sel));
      } catch {
        el = null;
      }
      if (!el) return { text: "", hasIcon: false };
      return { text: trunc(el.textContent || el.value || el.getAttribute("aria-label") || el.title || "", 30), hasIcon: !!el.querySelector('svg, img, [class*="icon"]') };
    };
    const navLinks = landmarks.filter((l) => l.role === "nav").map((l) => `${l.selector} a`);
    const navLinkList = [];
    for (const l of landmarks.filter((x) => x.role === "nav")) {
      let el = null;
      try {
        el = doc.querySelector(l.selector);
      } catch {
        el = null;
      }
      if (!el) continue;
      for (const a of [...el.querySelectorAll("a[href]")].slice(0, 16)) {
        const text2 = trunc(a.textContent || a.getAttribute("aria-label") || a.title || "", 30);
        const href = a.getAttribute("href");
        if (!href || href.length > 200 || /^(javascript|data):/i.test(href)) continue;
        navLinkList.push({ nav: l.selector, text: text2, href, hasIcon: !!a.querySelector('svg, img, [class*="icon"]') });
      }
    }
    const inputs = visible.filter((e) => ["input", "select", "textarea"].includes(e.localName) && !["hidden", "submit", "button", "checkbox", "radio"].includes(e.type));
    const h1 = visible.find((e) => e.localName === "h1");
    const h2s = visible.filter((e) => e.localName === "h2").slice(0, 3);
    const data = {
      title: trunc(doc.title, 80),
      lang: doc.documentElement.lang || null,
      pageType,
      viewport: M.viewport,
      docHeight,
      bodyWidth,
      counts: { links: counts.a, paragraphs: counts.p, images: counts.img, svgs: counts.svg, buttons: buttonEls.length, inputs: inputs.length, forms: counts.form, tables: counts.table, lists: counts.ul, headings: counts.h1 + counts.h2 + counts.h3 },
      landmarks,
      columns,
      flexGridContainers: flexGrid,
      classes,
      ids,
      colors,
      fonts,
      icons: { count: smallImgs.length, parents: iconParents.map(([selector, count]) => ({ selector, count })) },
      bigImages: bigImgs.slice(0, 5).map((o) => ({ selector: patternSelector(o.el), w: o.w, h: o.h })),
      buttons: buttonGroups.map(([selector, count]) => ({ selector, count, ...buttonInfo(selector) })),
      navLinkSelectors: navLinks,
      navLinks: navLinkList,
      h1: h1 ? trunc(h1.textContent, 80) : null,
      h2: h2s.map((e) => trunc(e.textContent, 50))
    };
    return { text: renderSummary(data, tokenBudget), data };
  }
  function renderSummary(d, tokenBudget = 1500) {
    const limits = { classes: 30, ids: 15, landmarks: 10, icons: 6, buttons: 6, h2: 3, accents: 5, navLinks: 12 };
    const build = () => {
      const L = [];
      L.push(`PAGE: "${d.title || "(untitled)"}" \xB7 type: ${d.pageType}${d.lang ? " \xB7 lang " + d.lang : ""}`);
      const lay = [];
      if (d.bodyWidth) lay.push(`body ${d.bodyWidth}px wide`);
      if (d.docHeight) lay.push(`${d.docHeight}px tall`);
      if (d.columns) lay.push(`${d.columns.parts.length} columns in ${d.columns.container}: ${d.columns.parts.map((p) => `${p.selector} ${p.width}px`).join(" + ")}`);
      else lay.push("single column");
      lay.push(`${d.flexGridContainers} flex/grid containers`);
      L.push("LAYOUT: " + lay.join(" \xB7 "));
      const c = d.counts;
      L.push(`ELEMENTS: ${c.links} links, ${c.paragraphs} paragraphs, ${c.headings} headings, ${c.images} images, ${c.svgs} svgs, ${c.buttons} buttons, ${c.inputs} inputs, ${c.forms} forms, ${c.tables} tables, ${c.lists} lists`);
      if (d.landmarks.length) {
        L.push("LANDMARKS:");
        for (const l of d.landmarks.slice(0, limits.landmarks)) {
          const bits = [];
          if (l.rect) bits.push(`${l.rect.w}x${l.rect.h} at (${l.rect.x},${l.rect.y})`);
          if (l.display) bits.push(l.display + (l.flexDirection ? " " + l.flexDirection : ""));
          bits.push(`${l.links} links`);
          if (l.images) bits.push(`${l.images} img`);
          if (l.buttons) bits.push(`${l.buttons} btn`);
          if (l.bg || l.color) bits.push(`bg ${l.bg || "none"} text ${l.color || "?"}`);
          L.push(`- ${l.role}: ${l.selector} | ${bits.join(", ")}`);
        }
      }
      const col = d.colors;
      const cols = [`bg ${col.bg}`, `text ${col.text}`];
      if (col.link) cols.push(`links ${col.link}`);
      if (col.headingColor && col.headingColor !== col.text) cols.push(`headings ${col.headingColor}`);
      if (col.buttonBg) cols.push(`buttons ${col.buttonBg}${col.buttonText ? "/" + col.buttonText : ""}`);
      if (col.accents.length) cols.push(`accents ${col.accents.slice(0, limits.accents).join(" ")}`);
      L.push("COLORS: " + cols.join(", "));
      L.push(`FONTS: body ${d.fonts.body || "?"} ${d.fonts.bodySize || ""}${d.fonts.heading && d.fonts.heading !== d.fonts.body ? ", headings " + d.fonts.heading : ""}`.trim());
      if (d.icons.count) L.push(`ICONS: ${d.icons.count} small images/svgs, inside: ${d.icons.parents.slice(0, limits.icons).map((p) => `${p.selector} (${p.count})`).join(", ")}`);
      if (d.bigImages.length) L.push(`IMAGES: ${d.bigImages.map((i) => `${i.selector} ${i.w}x${i.h}`).join(", ")}`);
      if (d.buttons.length) L.push(`BUTTONS: ${d.buttons.slice(0, limits.buttons).map((b) => `${b.selector} (${b.count}${b.text ? ' "' + b.text + '"' : ""})`).join(", ")}`);
      if (d.navLinkSelectors.length) L.push(`NAV LINKS: ${d.navLinkSelectors.join(", ")}${d.navLinks && d.navLinks.length ? " \u2014 " + d.navLinks.slice(0, limits.navLinks).map((l) => l.text).filter(Boolean).join(", ") : ""}`);
      if (d.classes.length) L.push(`CLASSES: ${d.classes.slice(0, limits.classes).map((k) => `.${k.name} (${k.count} ${k.tag})`).join(", ")}`);
      if (d.ids.length) L.push(`IDS: ${d.ids.slice(0, limits.ids).map((i) => `#${i.id} (${i.tag})`).join(", ")}`);
      if (d.h1) L.push(`H1: "${d.h1}"`);
      if (d.h2.length) L.push(`H2: ${d.h2.slice(0, limits.h2).map((t) => `"${t}"`).join(", ")}`);
      return L.join("\n");
    };
    let text = build();
    const order = ["h2", "ids", "classes", "navLinks", "accents", "buttons", "icons", "landmarks"];
    let guard = 0;
    while (estimateTokens(text) > tokenBudget && guard++ < 40) {
      let shrunk = false;
      for (const key of order) {
        if (limits[key] > 2) {
          limits[key] = Math.max(2, Math.floor(limits[key] * 0.6));
          shrunk = true;
          break;
        }
      }
      if (!shrunk) break;
      text = build();
    }
    const maxChars = tokenBudget * 4;
    if (text.length > maxChars) text = text.slice(0, maxChars - 1) + "\u2026";
    return text;
  }

  // userscript/src/validate.js
  var NESTED_AT = /* @__PURE__ */ new Set(["media", "supports", "container"]);
  var BLOCKED_AT = /* @__PURE__ */ new Set(["import", "charset", "namespace", "document", "-moz-document", "page", "property", "font-feature-values", "counter-style", "layer", "scope", "starting-style", "view-transition"]);
  var BLOCKED_PROPS = /* @__PURE__ */ new Set(["behavior", "-moz-binding", "-ms-behavior", "binding", "-ms-filter", "zoom", "all"]);
  var DANGEROUS_VALUE = /expression\s*\(|javascript:|vbscript:|-moz-binding|@import|<\/|\\0|progid:|\bimport\s*\(/i;
  var URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  var ALLOWED_URL = /^(data:image\/(svg\+xml|png|gif|jpeg|webp)[;,]|data:font\/|data:application\/(font|x-font|octet-stream)|#)/i;
  var STATE_PSEUDO = /:(hover|focus|focus-within|focus-visible|active|visited|link|target|checked|disabled|enabled|placeholder-shown|read-only|read-write|required|optional|valid|invalid|in-range|out-of-range|indeterminate|default|fullscreen|open|closed|autofill|user-invalid|any-link|local-link|popover-open)(?![\w-])/g;
  var PSEUDO_ELEMENT = /::?(before|after|marker|placeholder|selection|first-line|first-letter|backdrop|file-selector-button|cue|part\([^)]*\)|slotted\([^)]*\)|-webkit-[a-z-]+|-moz-[a-z-]+|-ms-[a-z-]+)/g;
  var INTERACTIVE = /* @__PURE__ */ new Set(["a", "button", "input", "select", "textarea", "label", "summary"]);
  var LANDMARK_TAGS = /* @__PURE__ */ new Set(["html", "body", "main", "nav", "header", "footer", "article", "form"]);
  var DEFAULT_PROTECT = /retro-web/i;
  var LAYOUT_PROPS = /^(display|position|top|right|bottom|left|inset(-.*)?|float|clear|(min-|max-)?(width|height|inline-size|block-size)|flex(-.*)?|grid(-.*)?|gap|row-gap|column-gap|align-.*|justify-.*|place-.*|order|overflow(-.*)?|transform(-.*)?|translate|rotate|scale|z-index|box-sizing|columns?|column-(count|width|span|fill)|white-space|visibility|object-fit|object-position|aspect-ratio|text-indent|writing-mode|direction|contain|container(-.*)?|vertical-align|table-layout|resize|appearance|line-clamp|-webkit-line-clamp)$/;
  var SPACING_PROPS = /^(margin(-.*)?|padding(-.*)?)$/;
  var MEDIA_TAGS = /* @__PURE__ */ new Set(["video", "audio", "canvas", "iframe", "embed", "object", "picture", "source", "track"]);
  var MEDIA_SAFE = /^(border(-.*)?|outline(-.*)?|box-shadow|filter|opacity|cursor|background(-.*)?)$/;
  var MEDIA_CONTAINER_RISKY = /^(display|position|(min-|max-)?(width|height|inline-size|block-size)|overflow(-.*)?|transform(-.*)?|flex(-.*)?|grid(-.*)?|aspect-ratio|visibility|float|columns?|contain)$/;
  var GENTLE_CLAMPS = {
    padding: { px: [0, 24], em: [0, 1.5], rem: [0, 1.5], "%": [0, 5], vw: [0, 2], vh: [0, 2] },
    margin: { px: [-8, 24], em: [-0.5, 1.5], rem: [-0.5, 1.5], "%": [-2, 5], vw: [-2, 2], vh: [-2, 2] },
    "font-size": { px: [11, 20], pt: [8, 15], em: [0.8, 1.3], rem: [0.8, 1.3], "%": [80, 130], vw: [0.8, 1.5], vh: [0.8, 1.5] },
    "line-height": { "": [1, 1.8], px: [12, 32], em: [1, 1.8], rem: [1, 1.8], "%": [100, 180] },
    border: { px: [0, 4], em: [0, 0.3], rem: [0, 0.3] }
  };
  var CLAMPS = [
    [/^font-size$/, { px: [8, 96], pt: [6, 72], em: [0.5, 6], rem: [0.5, 6], "%": [50, 600], vw: [0.5, 8], vh: [0.5, 8] }],
    [/^font$/, { px: [8, 96], pt: [6, 72], em: [0.5, 6], rem: [0.5, 6], "": [0.9, 3] }],
    [/^line-height$/, { "": [0.9, 3], px: [10, 120], em: [0.9, 3], rem: [0.9, 3], "%": [90, 300] }],
    [/^(letter|word)-spacing$/, { px: [-2, 24], em: [-0.1, 1.5], rem: [-0.1, 1.5] }],
    [/^margin(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/, { px: [-320, 320], em: [-20, 20], rem: [-20, 20], "%": [-50, 100], vw: [-50, 50], vh: [-50, 50] }],
    [/^padding(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/, { px: [0, 320], em: [0, 20], rem: [0, 20], "%": [0, 50], vw: [0, 40], vh: [0, 40] }],
    [/^(gap|row-gap|column-gap|grid-gap)$/, { px: [0, 200], em: [0, 12], rem: [0, 12] }],
    [/^(top|right|bottom|left|inset(-(block|inline)(-(start|end))?)?)$/, { px: [-320, 320], "%": [-100, 100], vw: [-100, 100], vh: [-100, 100], em: [-20, 20], rem: [-20, 20] }],
    [/^(border(-(top|right|bottom|left|block|inline))?(-width)?|outline(-width)?|column-rule(-width)?)$/, { px: [0, 40], em: [0, 3], rem: [0, 3] }],
    [/^border(-(top|bottom)-(left|right))?-radius$/, { px: [0, 1e3], em: [0, 60], rem: [0, 60], "%": [0, 100] }],
    [/^(min-|max-)?(width|height|inline-size|block-size)$|^flex-basis$/, { px: [0, 4e3], vw: [0, 100], vh: [0, 100], em: [0, 250], rem: [0, 250] }],
    [/^z-index$/, { "": [-1, 2147483e3] }],
    [/^opacity$/, { "": [0, 1], "%": [0, 100] }],
    [/^transform$/, { px: [-300, 300], "": [0.5, 3], "%": [-100, 100] }],
    [/^(animation|transition)(-duration|-delay)?$/, { s: [0.1, 60], ms: [100, 6e4] }],
    [/^(backdrop-)?filter$/, { px: [0, 3], "": [0.5, 2], "%": [50, 200] }],
    [/^text-indent$/, { px: [-10, 200], em: [-1, 10], rem: [-1, 10] }],
    [/^(box|text)-shadow$/, { px: [-30, 60], em: [-2, 4], rem: [-2, 4] }],
    [/^background-size$/, { px: [1, 2e3], "%": [1, 500] }],
    [/^outline-offset$/, { px: [-5, 20] }],
    [/^stroke-width$/, { px: [0, 10], "": [0, 10] }],
    [/^(column-count)$/, { "": [1, 4] }]
  ];
  function skipTo(src, i, end, stops) {
    let paren = 0;
    let str = null;
    for (let j = i; j < end; j++) {
      const c = src[j];
      if (str) {
        if (c === "\\") j++;
        else if (c === str || c === "\n") str = null;
        continue;
      }
      if (c === "/" && src[j + 1] === "*") {
        const k = src.indexOf("*/", j + 2);
        j = k < 0 ? end : k + 1;
        continue;
      }
      if (c === '"' || c === "'") {
        str = c;
        continue;
      }
      if (c === "(") paren++;
      else if (c === ")") paren = Math.max(0, paren - 1);
      else if (paren === 0 && stops.includes(c)) return { idx: j, ch: c };
    }
    return { idx: end, ch: "" };
  }
  function findBlockEnd(src, open, end) {
    let depth = 0;
    let str = null;
    for (let j = open; j < end; j++) {
      const c = src[j];
      if (str) {
        if (c === "\\") j++;
        else if (c === str || c === "\n") str = null;
        continue;
      }
      if (c === "/" && src[j + 1] === "*") {
        const k = src.indexOf("*/", j + 2);
        j = k < 0 ? end : k + 1;
        continue;
      }
      if (c === '"' || c === "'") str = c;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  }
  function stripComments(s) {
    return String(s).replace(/\/\*[\s\S]*?\*\//g, " ");
  }
  var ws = (s) => stripComments(s).replace(/\s+/g, " ").trim();
  function parseDeclarations(text, errors, where) {
    const decls = [];
    let i = 0;
    const end = text.length;
    while (i < end) {
      const { idx, ch } = skipTo(text, i, end, [";", "{", "}"]);
      if (ch === "{") {
        const close = findBlockEnd(text, idx, end);
        errors.push({ reason: "nested-block", where, text: ws(text.slice(i, idx)).slice(0, 80) });
        i = close < 0 ? end : close + 1;
        continue;
      }
      const chunk = ws(text.slice(i, idx));
      i = idx + 1;
      if (!chunk) continue;
      const colon = chunk.indexOf(":");
      if (colon <= 0) {
        errors.push({ reason: "malformed-declaration", where, text: chunk.slice(0, 80) });
        continue;
      }
      const prop = chunk.slice(0, colon).trim().toLowerCase();
      let value = chunk.slice(colon + 1).trim();
      let important = false;
      const im = /\s*!\s*important\s*$/i.exec(value);
      if (im) {
        important = true;
        value = value.slice(0, im.index).trim();
      }
      if (!/^(--[\w-]+|-?[a-z][a-z0-9-]*)$/.test(prop) || !value) {
        errors.push({ reason: "malformed-declaration", where, text: chunk.slice(0, 80) });
        continue;
      }
      decls.push({ prop, value, important });
    }
    return decls;
  }
  function parseRules(src, start, end, errors, depth = 0) {
    const nodes = [];
    let i = start;
    while (i < end) {
      const { idx, ch } = skipTo(src, i, end, ["{", ";", "}"]);
      const head = ws(src.slice(i, idx));
      if (ch === "") {
        if (head) errors.push({ reason: "dangling-text", text: head.slice(0, 80) });
        break;
      }
      if (ch === ";") {
        if (head.startsWith("@")) {
          const name = (/^@([\w-]+)/.exec(head) || [])[1] || "";
          nodes.push({ type: "at", name: name.toLowerCase(), prelude: head.slice(name.length + 1).trim(), statement: true });
        } else if (head) errors.push({ reason: "stray-declaration", text: head.slice(0, 80) });
        i = idx + 1;
        continue;
      }
      if (ch === "}") {
        if (head) errors.push({ reason: "stray-text", text: head.slice(0, 80) });
        i = idx + 1;
        continue;
      }
      const rawLines = stripComments(src.slice(i, idx)).split("\n").map((l) => l.trim()).filter(Boolean);
      let cut = -1;
      for (let k = 0; k < rawLines.length - 1; k++) if (/[:.!?]$/.test(rawLines[k]) && !/,$/.test(rawLines[k])) cut = k;
      const prelude = cut >= 0 ? ws(rawLines.slice(cut + 1).join(" ")) : head;
      const close = findBlockEnd(src, idx, end);
      if (close < 0) {
        errors.push({ reason: "unclosed-block", text: prelude.slice(0, 80) });
        break;
      }
      if (!prelude) {
        errors.push({ reason: "empty-selector" });
        i = close + 1;
        continue;
      }
      if (prelude.startsWith("@")) {
        const name = ((/^@([\w-]+)/.exec(prelude) || [])[1] || "").toLowerCase();
        const params = prelude.slice(name.length + 1).trim();
        if (NESTED_AT.has(name) && depth < 3) nodes.push({ type: "at", name, prelude: params, rules: parseRules(src, idx + 1, close, errors, depth + 1) });
        else if (name === "keyframes" || name.endsWith("-keyframes")) nodes.push({ type: "at", name, prelude: params, rules: parseRules(src, idx + 1, close, errors, depth + 1), keyframes: true });
        else nodes.push({ type: "at", name, prelude: params, declarations: parseDeclarations(src.slice(idx + 1, close), errors, "@" + name) });
      } else {
        nodes.push({ type: "rule", selector: prelude, declarations: parseDeclarations(src.slice(idx + 1, close), errors, prelude) });
      }
      i = close + 1;
    }
    return nodes;
  }
  function parseCss(text) {
    const errors = [];
    const src = String(text || "");
    const rules = parseRules(src, 0, src.length, errors);
    return { rules, errors };
  }
  var ICON_REQ = /\/\*\s*icon-request\s*:\s*([^|*]+?)\s*\|\s*([^*]*?)\s*\*\//gi;
  var APPLY_CLASS = /\/\*\s*apply-class\s*:\s*([^|*]+?)\s*\|\s*([^*|]*?)\s*\*\//gi;
  function normalizeIconName(name) {
    return String(name || "").toLowerCase().replace(/^--?icon-/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }
  function extractDirectives(text) {
    const iconRequests = [];
    const applyClass = [];
    const seen = /* @__PURE__ */ new Set();
    let css = String(text || "");
    css = css.replace(ICON_REQ, (_m, name, desc) => {
      const n = normalizeIconName(name);
      if (n && !seen.has("i:" + n)) {
        seen.add("i:" + n);
        iconRequests.push({ name: n, description: desc.replace(/\s+/g, " ").trim().slice(0, 160) });
      }
      return "";
    });
    css = css.replace(APPLY_CLASS, (_m, sel, cls) => {
      const selector = sel.trim();
      const className = cls.trim().replace(/^\./, "");
      if (selector && /^[\w-]+$/.test(className) && !seen.has("c:" + selector + "|" + className)) {
        seen.add("c:" + selector + "|" + className);
        applyClass.push({ selector, className });
      }
      return "";
    });
    css = css.replace(/```(?:css)?/gi, "");
    return { css, iconRequests, applyClass };
  }
  function splitSelectorList(sel) {
    const parts = [];
    let depth = 0;
    let str = null;
    let cur = "";
    for (let i = 0; i < sel.length; i++) {
      const c = sel[i];
      if (str) {
        cur += c;
        if (c === "\\") cur += sel[++i] || "";
        else if (c === str) str = null;
        continue;
      }
      if (c === '"' || c === "'") str = c;
      else if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
      if (c === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(Boolean);
  }
  function probeSelector(sel) {
    let p = sel.replace(PSEUDO_ELEMENT, "").replace(STATE_PSEUDO, "");
    p = p.replace(/:not\(\s*\)/g, "").trim();
    p = p.replace(/\s*>\s*$/, "").replace(/\s*[+~]\s*$/, "").trim();
    return p || "*";
  }
  function createMatcher(doc, protect) {
    const cache = /* @__PURE__ */ new Map();
    return function match(part) {
      if (cache.has(part)) return cache.get(part);
      let res;
      if (!doc) res = { status: "unknown", count: 1 };
      else if (protect.test(part)) res = { status: "protected", count: 0 };
      else {
        const probe = probeSelector(part);
        try {
          const list = doc.querySelectorAll(probe);
          res = { status: list.length ? "ok" : "nomatch", count: list.length, probe };
        } catch {
          res = { status: "invalid", count: 0, probe };
        }
      }
      cache.set(part, res);
      return res;
    };
  }
  function classifyTargets(doc, probes, limit = 60, isAllowed = null) {
    const info = { count: 0, landmark: false, interactive: false, textLength: 0, protected: false, media: false, mediaParent: false, flexGrid: false, root: false, sampled: 0, notAllowed: 0 };
    if (!doc) return info;
    const win = doc.defaultView;
    const seen = /* @__PURE__ */ new Set();
    let sampled = 0;
    for (const probe of probes) {
      let list;
      try {
        list = doc.querySelectorAll(probe);
      } catch {
        continue;
      }
      info.count += list.length;
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (++sampled > limit) break;
        if (LANDMARK_TAGS.has(el.localName) || el.getAttribute("role") === "main") info.landmark = true;
        if (el.localName === "html" || el.localName === "body") info.root = true;
        if (INTERACTIVE.has(el.localName) || el.getAttribute("role") === "button") info.interactive = true;
        if (el.querySelector && el.querySelector("a, button, input, select, textarea")) info.interactive = true;
        if (el.localName === "retro-web-panel") info.protected = true;
        if (MEDIA_TAGS.has(el.localName)) info.media = true;
        else if (el.children && [...el.children].some((c) => MEDIA_TAGS.has(c.localName))) info.mediaParent = true;
        info.sampled++;
        if (isAllowed && !isAllowed(el)) info.notAllowed++;
        if (!info.flexGrid && win && sampled <= 40) {
          try {
            const d = win.getComputedStyle(el).display || "";
            if (/flex|grid|table/.test(d) && !/inline-block/.test(d)) info.flexGrid = true;
          } catch {
          }
        }
        info.textLength += (el.textContent || "").trim().length;
      }
    }
    if (sampled <= limit) info.count = seen.size;
    return info;
  }
  function clampNumbers(prop, value, specOverride = null) {
    let spec = specOverride;
    if (!spec) {
      for (const [re, s2] of CLAMPS) {
        if (re.test(prop)) {
          spec = s2;
          break;
        }
      }
    }
    if (!spec) return value;
    let out = "";
    let i = 0;
    const s = value;
    const isDigitStart = (c) => /[0-9.]/.test(c);
    while (i < s.length) {
      const c = s[i];
      if (c === '"' || c === "'") {
        const j = s.indexOf(c, i + 1);
        const k = j < 0 ? s.length : j + 1;
        out += s.slice(i, k);
        i = k;
        continue;
      }
      const fn = /^(url|var|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|attr|counter|counters)\(/i.exec(s.slice(i));
      if (fn) {
        let depth = 0;
        let j = i;
        for (; j < s.length; j++) {
          if (s[j] === "(") depth++;
          else if (s[j] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        out += s.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (c === "#") {
        const m = /^#[0-9a-fA-F]{3,8}/.exec(s.slice(i));
        const len = m ? m[0].length : 1;
        out += s.slice(i, i + len);
        i += len;
        continue;
      }
      const prevOk = i === 0 || /[\s,(/]/.test(s[i - 1]) || s[i - 1] === "-" && (i === 1 || /[\s,(/]/.test(s[i - 2]));
      if ((isDigitStart(c) || c === "-" && isDigitStart(s[i + 1] || "")) && prevOk) {
        const m = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?([a-zA-Z%]*)/.exec(s.slice(i));
        if (m) {
          const num2 = parseFloat(m[0]);
          const unit = m[3].toLowerCase();
          const range = spec[unit];
          if (range && Number.isFinite(num2)) {
            const clamped = Math.min(range[1], Math.max(range[0], num2));
            out += clamped === num2 ? m[0] : String(+clamped.toFixed(3)) + m[3];
          } else out += m[0];
          i += m[0].length;
          continue;
        }
      }
      out += c;
      i++;
    }
    return out;
  }
  function hidingKind(prop, value) {
    const v = value.toLowerCase();
    if (prop === "display" && v === "none") return "display:none";
    if (prop === "visibility" && (v === "hidden" || v === "collapse")) return "visibility:hidden";
    if (prop === "opacity" && parseFloat(v) < 0.1) return "opacity";
    if (prop === "font-size" && /^0(px|em|rem|%|pt)?$/.test(v)) return "font-size:0";
    if (prop === "transform" && /scale\w*\(\s*0(\.0+)?\s*[,)]/.test(v)) return "scale(0)";
    if ((prop === "clip-path" || prop === "clip") && !/none|unset|initial|url\(/.test(v)) return "clip";
    if (prop === "text-indent" && parseFloat(v) <= -500) return "text-indent";
    if (/^(top|left|right|bottom)$/.test(prop) && parseFloat(v) <= -500) return "offscreen";
    if (/^(width|height|max-width|max-height)$/.test(prop) && /^0(px|em|rem|%)?$/.test(v)) return "zero-size";
    if (prop === "content" && v === "none") return "content:none";
    return null;
  }
  function urlsAllowed(value) {
    let ok = true;
    value.replace(URL_RE, (_m, _q, url) => {
      if (!ALLOWED_URL.test(url.trim())) ok = false;
      return _m;
    });
    return ok;
  }
  function validateDeclaration(d, ctx, out) {
    const { prop } = d;
    let value = d.value;
    const drop = (reason) => {
      out.dropped.push({ selector: ctx.selector, prop, reason });
      return null;
    };
    if (BLOCKED_PROPS.has(prop)) return drop("blocked-property");
    if (value.length > 600) return drop("value-too-long");
    if (DANGEROUS_VALUE.test(value)) return drop("dangerous-value");
    if (/[{}]/.test(value)) return drop("malformed-value");
    if (!urlsAllowed(value)) return drop("external-url");
    if (ctx.fontFace && prop === "src" && !/^\s*(url\(\s*['"]?data:|local\()/i.test(value)) return drop("external-font");
    if (prop === "content" && /</.test(value) && !/^["']/.test(value)) return drop("malformed-value");
    for (const m of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
      out.varsUsed.add(m[1]);
      if (m[1].startsWith("--icon-")) out.iconVars.add(m[1]);
    }
    if (!ctx.keyframes && !ctx.fontFace) {
      const kind = ctx.pseudo ? null : hidingKind(prop, value);
      if (kind) {
        const t = ctx.targets();
        if (t.protected || t.landmark || t.interactive || t.count > 3 || t.textLength > 200) return drop("hides-content:" + kind);
      }
      if (prop === "position") {
        const v = value.toLowerCase();
        const t = ctx.targets();
        if (t.protected) return drop("protected");
        if (v === "fixed" && (t.count > 3 || t.landmark && !ctx.pseudo)) return drop("position-fixed-too-broad");
        if (v === "absolute" && (t.count > 25 || t.landmark && !ctx.pseudo)) return drop("position-absolute-too-broad");
      }
      if (prop === "pointer-events" && /none/i.test(value) && !ctx.pseudo) {
        const t = ctx.targets();
        if (t.count > 20 || t.landmark || t.interactive) return drop("pointer-events-too-broad");
      }
      if (prop === "overflow" || prop === "overflow-y") {
        const t = ctx.targets();
        if (t.landmark && /hidden|clip/i.test(value) && /html|body/.test(ctx.selector)) return drop("overflow-hidden-on-root");
      }
    }
    if (!ctx.keyframes && !ctx.fontFace) {
      const isLayout = LAYOUT_PROPS.test(prop);
      const isSpacing = SPACING_PROPS.test(prop);
      const isBorderBox = /^(border|border-(top|right|bottom|left)|border(-(top|right|bottom|left))?-width)$/.test(prop);
      const t = isLayout || isSpacing || isBorderBox || /^(font-size|line-height|content)$/.test(prop) ? ctx.targets() : null;
      if (t) {
        if (t.media && !MEDIA_SAFE.test(prop)) return drop("media-element");
        if (prop === "content" && !/::?(before|after|marker)/.test(ctx.selector)) return drop("content-outside-pseudo");
        if (ctx.hasAllowList && !ctx.pseudo && (isLayout || isSpacing || isBorderBox) && t.sampled > 0 && t.notAllowed / t.sampled > 0.25) return drop("spacing-not-allowed");
        if (isLayout) {
          if (t.count > ctx.maxLayoutMatches) return drop("layout-too-broad");
          if (t.mediaParent && MEDIA_CONTAINER_RISKY.test(prop)) return drop("media-container");
          if (prop === "display" && !ctx.pseudo) {
            const v = value.trim().toLowerCase();
            if (t.root && v !== "block") return drop("display-on-root");
            if (t.flexGrid && !/^(flex|inline-flex|grid|inline-grid|contents|table.*)$/.test(v)) return drop("display-breaks-layout");
          }
        } else if (isSpacing) {
          if (t.count > ctx.maxSpacingMatches) return drop("spacing-too-broad");
          if (t.count > ctx.maxLayoutMatches) value = clampNumbers(prop, value, GENTLE_CLAMPS[prop.startsWith("margin") ? "margin" : "padding"]);
        } else if (t.count > ctx.maxSpacingMatches) {
          if (prop === "font-size") value = clampNumbers(prop, value, GENTLE_CLAMPS["font-size"]);
          else if (prop === "line-height") value = clampNumbers(prop, value, GENTLE_CLAMPS["line-height"]);
          else if (prop.startsWith("border")) value = clampNumbers(prop, value, GENTLE_CLAMPS.border);
        }
      }
    }
    value = clampNumbers(prop, value);
    if (prop === "z-index" && /^-?\d+$/.test(value) && parseInt(value, 10) > 2147483e3) value = "2147483000";
    return { prop, value, important: ctx.forceImportant && !ctx.keyframes && !ctx.fontFace ? true : d.important };
  }
  function serializeDecls(decls) {
    return decls.map((d) => `${d.prop}: ${d.value}${d.important ? " !important" : ""};`).join(" ");
  }
  function validateCss(text, options = {}) {
    const { doc = null, mode = "design", forceImportant = true, maxRules = 400, maxDecls = 60, allowUnmatched = false, maxLayoutMatches = 40, maxSpacingMatches = 150, spacingAllowed = null } = options;
    const protect = options.protect || DEFAULT_PROTECT;
    const parsed = parseCss(String(text || "").replace(/```[a-z]*/gi, ""));
    const out = { css: "", kept: 0, dropped: [], warnings: [], iconVars: /* @__PURE__ */ new Set(), varsUsed: /* @__PURE__ */ new Set(), errors: parsed.errors, mode };
    const match = createMatcher(doc, protect);
    let ruleCount = 0;
    const handleRules = (nodes, inKeyframes, indent) => {
      const lines = [];
      for (const node of nodes) {
        if (ruleCount >= maxRules) {
          out.warnings.push("rule limit reached");
          break;
        }
        if (node.type === "at") {
          const name = node.name;
          if (BLOCKED_AT.has(name) || node.statement) {
            out.dropped.push({ selector: "@" + name, reason: "blocked-at-rule" });
            continue;
          }
          if (node.keyframes) {
            if (!/^[\w-]+$/.test(node.prelude)) {
              out.dropped.push({ selector: "@" + name, reason: "bad-keyframes-name" });
              continue;
            }
            const body = handleRules(node.rules, true, indent + "  ");
            if (body.length) {
              lines.push(`${indent}@${name} ${node.prelude} {`, ...body, `${indent}}`);
              ruleCount++;
            }
            continue;
          }
          if (NESTED_AT.has(name)) {
            if (/url\(|expression|@import/i.test(node.prelude) || node.prelude.length > 200) {
              out.dropped.push({ selector: "@" + name, reason: "bad-at-prelude" });
              continue;
            }
            const body = handleRules(node.rules, inKeyframes, indent + "  ");
            if (body.length) lines.push(`${indent}@${name} ${node.prelude} {`, ...body, `${indent}}`);
            continue;
          }
          if (name === "font-face") {
            const ctx2 = { selector: "@font-face", fontFace: true, keyframes: false, forceImportant, targets: () => ({ count: 0 }) };
            const decls2 = node.declarations.map((d) => validateDeclaration(d, ctx2, out)).filter(Boolean);
            if (decls2.some((d) => d.prop === "src") && decls2.some((d) => d.prop === "font-family")) {
              lines.push(`${indent}@font-face { ${serializeDecls(decls2)} }`);
              ruleCount++;
            } else out.dropped.push({ selector: "@font-face", reason: "font-face-needs-data-src" });
            continue;
          }
          out.dropped.push({ selector: "@" + name, reason: "unknown-at-rule" });
          continue;
        }
        let selectorParts;
        let probes = [];
        if (inKeyframes) {
          if (!/^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/i.test(node.selector)) {
            out.dropped.push({ selector: node.selector, reason: "bad-keyframe-selector" });
            continue;
          }
          selectorParts = [node.selector];
        } else {
          const parts = splitSelectorList(node.selector);
          selectorParts = [];
          const reasons = /* @__PURE__ */ new Set();
          for (const p of parts) {
            if (p.length > 300) {
              reasons.add("selector-too-long");
              continue;
            }
            const m = match(p);
            if (m.status === "ok" || m.status === "unknown" || m.status === "nomatch" && allowUnmatched) {
              selectorParts.push(p);
              if (m.probe) probes.push(m.probe);
            } else reasons.add(m.status === "nomatch" ? "no-match" : m.status);
          }
          if (!selectorParts.length) {
            out.dropped.push({ selector: node.selector, reason: [...reasons].join(",") || "no-selector" });
            continue;
          }
        }
        const selector = selectorParts.join(", ");
        let targetsCache = null;
        const ctx = {
          selector,
          keyframes: inKeyframes,
          fontFace: false,
          forceImportant,
          maxLayoutMatches,
          maxSpacingMatches,
          // every part targets a generated pseudo-element (decorations, not content)
          pseudo: !inKeyframes && selectorParts.every((p) => /::?(before|after|marker)(?![\w-])/.test(p)),
          hasAllowList: typeof spacingAllowed === "function",
          targets: () => targetsCache || (targetsCache = classifyTargets(doc, probes.length ? probes : selectorParts.map(probeSelector), 400, typeof spacingAllowed === "function" ? spacingAllowed : null))
        };
        if (node.declarations.length > maxDecls) out.warnings.push(`truncated declarations for ${selector}`);
        const decls = node.declarations.slice(0, maxDecls).map((d) => validateDeclaration(d, ctx, out)).filter(Boolean);
        if (!decls.length) {
          out.dropped.push({ selector, reason: "no-valid-declarations" });
          continue;
        }
        lines.push(`${indent}${selector} { ${serializeDecls(decls)} }`);
        ruleCount++;
        out.kept++;
      }
      return lines;
    };
    out.css = handleRules(parsed.rules, false, "").join("\n");
    out.iconVars = [...out.iconVars];
    out.varsUsed = [...out.varsUsed];
    return out;
  }
  function validateApplyClass(list, { doc, classNames = [], protect = DEFAULT_PROTECT, maxTargets = 200, spacingAllowed = null } = {}) {
    const applied = [];
    const dropped = [];
    const known = new Set(classNames);
    for (const item of list || []) {
      const { selector, className } = item;
      if (!known.has(className)) {
        dropped.push({ ...item, reason: "unknown-class" });
        continue;
      }
      if (protect.test(selector) || /^(html|body)\b/.test(selector.trim())) {
        dropped.push({ ...item, reason: "protected" });
        continue;
      }
      if (!doc) {
        applied.push({ ...item, count: 0 });
        continue;
      }
      let els;
      try {
        els = [...doc.querySelectorAll(probeSelector(selector))];
      } catch {
        dropped.push({ ...item, reason: "invalid" });
        continue;
      }
      els = els.filter((e) => !e.closest("retro-web-panel") && !LANDMARK_TAGS.has(e.localName));
      if (typeof spacingAllowed === "function") {
        const before = els.length;
        els = els.filter((e) => spacingAllowed(e));
        if (!els.length && before) {
          dropped.push({ ...item, reason: "spacing-not-allowed" });
          continue;
        }
      }
      if (!els.length) {
        dropped.push({ ...item, reason: "no-match" });
        continue;
      }
      if (els.length > maxTargets) els = els.slice(0, maxTargets);
      applied.push({ ...item, count: els.length, elements: els });
    }
    return { applied, dropped };
  }
  function applyClassDirectives(applied) {
    for (const a of applied) for (const el of a.elements || []) el.classList.add(a.className);
  }
  function removeClassDirectives(applied) {
    for (const a of applied) for (const el of a.elements || []) el.classList.remove(a.className);
  }

  // userscript/src/model/engine.js
  var NS = "retro-web";
  var ModelUnavailableError = class extends Error {
    constructor(code, message) {
      super(message);
      this.name = "ModelUnavailableError";
      this.code = code;
    }
  };
  var ModelClient = class {
    constructor({ doc = document, hostUrl, modelId, customModel = null, contextWindow = 8192, onProgress = () => {
    }, handshakeTimeoutMs = 2e4, loadTimeoutMs = 20 * 60 * 1e3 }) {
      this.doc = doc;
      this.hostUrl = hostUrl;
      this.modelId = modelId;
      this.customModel = customModel;
      this.contextWindow = contextWindow;
      this.onProgress = onProgress;
      this.handshakeTimeoutMs = handshakeTimeoutMs;
      this.loadTimeoutMs = loadTimeoutMs;
      this.frame = null;
      this.popup = null;
      this.mode = null;
      this.ready = null;
      this.loaded = null;
      this.info = null;
      this.pending = /* @__PURE__ */ new Map();
      this.seq = 0;
      this._listener = (e) => this._onMessage(e);
    }
    get hostOrigin() {
      try {
        return new URL(this.hostUrl).origin;
      } catch {
        return null;
      }
    }
    // The window we talk to: the hidden frame, or the popup when the page's CSP blocks frames.
    get peer() {
      if (this.frame) return this.frame.contentWindow;
      if (this.popup && !this.popup.closed) return this.popup;
      return null;
    }
    _post(msg) {
      const peer = this.peer;
      if (!peer) throw new ModelUnavailableError("host-unreachable", "model host window missing");
      peer.postMessage({ ns: NS, ...msg }, this.hostOrigin || "*");
    }
    _onMessage(e) {
      const peer = this.peer;
      if (!peer || e.source !== peer) return;
      const m = e.data;
      if (!m || m.ns !== NS) return;
      switch (m.t) {
        case "ready":
          this.info = m;
          if (this._readyResolve) this._readyResolve(m);
          break;
        case "progress":
          this.onProgress({ text: m.text, progress: m.progress });
          break;
        case "loaded":
          if (this._loadedResolve) this._loadedResolve(m.modelId);
          break;
        case "delta": {
          const p = this.pending.get(m.id);
          if (p) {
            p.text += m.text;
            p.onDelta(m.text, p.text);
          }
          break;
        }
        case "done": {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            p.resolve({ text: m.text != null ? m.text : p.text, usage: m.usage, finish: m.finish });
          }
          break;
        }
        case "error": {
          const err = new ModelUnavailableError(m.code || "engine", m.message || "model error");
          if (m.id && this.pending.has(m.id)) {
            const p = this.pending.get(m.id);
            this.pending.delete(m.id);
            p.reject(err);
          } else if (this._loadedReject) this._loadedReject(err);
          break;
        }
        default:
          break;
      }
    }
    _hostUrl() {
      const url = new URL(this.hostUrl);
      if (!/\.html$/.test(url.pathname) && !url.pathname.endsWith("/")) url.pathname += "/";
      url.searchParams.set("v", "2");
      return url;
    }
    // Connects to the host and waits for its `ready`. mode 'frame' (default) uses a
    // hidden iframe; mode 'popup' opens a small window instead, which a page's CSP
    // cannot block but which needs a user gesture (click) to be allowed.
    connect({ mode = "frame" } = {}) {
      if (this.ready) return this.ready;
      this.mode = mode;
      this.ready = new Promise((resolve, reject) => {
        const doc = this.doc;
        const win = doc.defaultView || window;
        const url = this._hostUrl();
        let settled = false;
        let hello = null;
        let timer = null;
        let onCsp = null;
        const finish = (err, info) => {
          if (settled) return;
          settled = true;
          clearInterval(hello);
          clearTimeout(timer);
          if (onCsp) doc.removeEventListener("securitypolicyviolation", onCsp);
          if (err) {
            this.dispose();
            reject(err);
          } else resolve(info);
        };
        this._readyResolve = (info) => finish(null, info);
        win.addEventListener("message", this._listener);
        if (mode === "popup") {
          url.searchParams.set("popup", "1");
          const w = Math.min(520, win.screen ? win.screen.availWidth : 520);
          const features = `popup=yes,width=${w},height=320,left=${Math.max(0, (win.screen ? win.screen.availWidth : 1200) - w - 20)},top=40`;
          let popup = null;
          try {
            popup = win.open(url.href, "retro-web-host", features);
          } catch {
            popup = null;
          }
          if (!popup) return finish(new ModelUnavailableError("popup-blocked", "the browser blocked the model window \u2014 allow popups for this site, or press Redesign again"));
          this.popup = popup;
          hello = setInterval(() => {
            if (popup.closed) return finish(new ModelUnavailableError("popup-closed", "the model window was closed"));
            try {
              this._post({ t: "hello" });
            } catch {
            }
          }, 400);
          timer = setTimeout(() => finish(new ModelUnavailableError("host-unreachable", `model host not reachable at ${this.hostUrl}`)), this.handshakeTimeoutMs);
          return;
        }
        const frame = doc.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("title", "retro-web model host");
        frame.setAttribute("data-retro-web", "host");
        frame.style.cssText = "position:fixed!important;width:1px!important;height:1px!important;left:-9999px!important;top:-9999px!important;border:0!important;opacity:0!important;pointer-events:none!important;";
        onCsp = (ev) => {
          const d = (ev.effectiveDirective || ev.violatedDirective || "").split(" ")[0];
          if (/^(frame-src|child-src|default-src)$/.test(d) && String(ev.blockedURI || "").startsWith(this.hostOrigin || "\0")) {
            finish(new ModelUnavailableError("host-blocked", `this site's Content Security Policy blocks the model host frame (${this.hostOrigin})`));
          }
        };
        doc.addEventListener("securitypolicyviolation", onCsp);
        this.frame = frame;
        hello = setInterval(() => {
          try {
            if (frame.contentWindow) this._post({ t: "hello" });
          } catch {
          }
        }, 400);
        timer = setTimeout(
          () => finish(new ModelUnavailableError("host-unreachable", `model host not reachable at ${this.hostUrl} (GitHub Pages not deployed yet, or for local dev run \`npm run host\` and set the Host URL in Advanced)`)),
          this.handshakeTimeoutMs
        );
        frame.src = url.href;
        (doc.body || doc.documentElement).appendChild(frame);
      });
      return this.ready;
    }
    async load() {
      const info = await this.connect();
      if (!info.webgpu) throw new ModelUnavailableError("webgpu", "WebGPU is not available in this browser: " + (info.reason || "unknown"));
      if (this.loaded) return this.loaded;
      this.loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new ModelUnavailableError("engine", "model load timed out")), this.loadTimeoutMs);
        this._loadedResolve = (id) => {
          clearTimeout(timer);
          resolve(id);
        };
        this._loadedReject = (err) => {
          clearTimeout(timer);
          this.loaded = null;
          reject(err);
        };
        this._post({ t: "load", modelId: this.modelId, customModel: this.customModel, contextWindow: this.contextWindow });
      });
      return this.loaded;
    }
    // Streams a chat completion. onDelta(deltaText, fullText). Returns {text, usage, finish}.
    async generate({ messages, params = {}, onDelta = () => {
    }, signal } = {}) {
      await this.load();
      const id = "g" + ++this.seq + "-" + Math.random().toString(36).slice(2, 8);
      return new Promise((resolve, reject) => {
        const entry = { text: "", onDelta, resolve, reject };
        this.pending.set(id, entry);
        if (signal) {
          const onAbort = () => {
            if (!this.pending.has(id)) return;
            try {
              this._post({ t: "abort", id });
            } catch {
            }
            this.pending.delete(id);
            reject(new DOMException("aborted", "AbortError"));
          };
          if (signal.aborted) return onAbort();
          signal.addEventListener("abort", onAbort, { once: true });
        }
        try {
          this._post({ t: "generate", id, messages, params });
        } catch (e) {
          this.pending.delete(id);
          reject(e);
        }
      });
    }
    dispose() {
      try {
        (this.doc.defaultView || window).removeEventListener("message", this._listener);
      } catch {
      }
      if (this.frame) {
        try {
          this.frame.remove();
        } catch {
        }
      }
      if (this.popup) {
        const popup = this.popup;
        try {
          if (!popup.closed) popup.postMessage({ ns: NS, t: "close" }, this.hostOrigin || "*");
        } catch {
        }
        try {
          popup.close();
        } catch {
        }
      }
      this.frame = null;
      this.popup = null;
      this.mode = null;
      this.ready = null;
      this.loaded = null;
      for (const [, p] of this.pending) p.reject(new ModelUnavailableError("engine", "client disposed"));
      this.pending.clear();
    }
  };
  function describeModelError(err) {
    if (!err) return "unknown error";
    if (err.name === "AbortError") return "cancelled";
    if (err instanceof ModelUnavailableError) {
      switch (err.code) {
        case "host-blocked":
          return "blocked by this site's CSP (model host frame)";
        case "host-unreachable":
          return "model host unreachable (check Host URL in Advanced; local dev: `npm run host`)";
        case "popup-blocked":
        case "popup-closed":
        case "needs-gesture":
          return err.message;
        case "webgpu":
          return "WebGPU unavailable in this browser";
        case "network":
          return "could not download model weights";
        case "memory":
          return "not enough GPU memory for this model";
        case "model-id":
          return "unknown model id (check Advanced)";
        default:
          return err.message || "model error";
      }
    }
    return String(err.message || err);
  }

  // userscript/src/model/prompts.js
  var DESIGN_SYSTEM_PROMPT = `You are a web designer from the year 2000. You restyle an existing web page by writing CSS only.
Rules:
- Output ONLY CSS. No explanations, no markdown, no HTML.
- Use the selectors given in the PAGE summary (landmark selectors, classes, ids, tags). One rule per line: selector { property: value; property: value; }
- Never nest rules. No @import. No external url(). Only library assets via var(--icon-NAME), var(--bg-NAME), var(--grad-NAME), var(--font-NAME), var(--cursor-NAME) plus plain colors.
- Keep text readable: body text 12px or larger, strong contrast between text and background. Never hide content.
- Restyle everything visible: body background, fonts, headings, links, nav, header, main content, sidebar, footer, buttons, inputs, images, tables, forms.
- Keep the page working. On broad selectors (bare tags like div, span, a, li, img, or classes used everywhere) change only colors, backgrounds, borders, fonts and text decoration. Put layout changes (padding, margin, display, width) only on the specific landmark selectors, buttons, inputs and nav links from the summary. Never move or resize video players, iframes or their containers; a border or shadow is fine.
- Icons: decorate nav links and buttons with 16px icons: background-image: var(--icon-NAME); background-repeat: no-repeat; background-position: 4px center; padding-left: 24px;
- If the library lacks an icon you need, add a line: /* icon-request: name | short description */ and then use var(--icon-name).
- To attach a library component class write a line: /* apply-class: selector | class-name */
- Commit fully to the given STYLE. Write 25 to 50 rules and finish with a complete rule.`;
  var REPAIR_SYSTEM_PROMPT = `You are a careful CSS engineer fixing layout problems in a 2000s-style redesign.
You receive the CSS you wrote and an inspector REPORT of measured problems. Reply with a CSS PATCH only: rules to add or override that fix the listed issues.
Rules:
- Output ONLY CSS. No explanations, no markdown.
- Keep the visual style; change only what the issues need. Use the exact selectors from the report.
- Typical fixes: off-center icons -> display:inline-flex; align-items:center; gap:6px on the container; overflow -> max-width:100%; overflow-wrap:anywhere; low contrast -> change color or background; small text -> font-size:12px or larger; invisible elements -> display:block (or inline-block); visibility:visible; opacity:1; inconsistent spacing -> same margin for all siblings; touching the viewport edge -> add padding.
- Never use display:none. Never use external url(). No @import.
- At most 20 rules.`;
  var ENHANCE_INSTRUCTIONS = `A base design in this STYLE is ALREADY applied to body, links, headings, header, nav, main, sidebar, footer, buttons, inputs, images and tables. Do not restyle those again.
Add 10 to 20 extra rules ONLY for the site-specific elements named in the PAGE SUMMARY (cards, posts, meta lines, prices, badges, tags, menus, widgets, comments, thumbnails) so they match the style: use the palette, borders, textures and fonts of the style; give small elements icons with var(--icon-NAME); request missing icons with /* icon-request */.`;
  function designMessages({ summaryText, manifestText, style, enhance = false }) {
    const user = [`STYLE: ${describeStyle(style)}`, "", manifestText, "", "PAGE SUMMARY:", summaryText, "", enhance ? ENHANCE_INSTRUCTIONS : "", enhance ? "Write the extra CSS rules now." : "Write the CSS now."].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
    return [
      { role: "system", content: DESIGN_SYSTEM_PROMPT },
      { role: "user", content: user }
    ];
  }
  function repairMessages({ css, reportText, style }) {
    const user = [`STYLE: ${style ? style.name : "retro"}`, "", "CURRENT CSS:", css, "", "REPORT:", reportText, "", "Write the CSS patch now."].join("\n");
    return [
      { role: "system", content: REPAIR_SYSTEM_PROMPT },
      { role: "user", content: user }
    ];
  }

  // userscript/src/model/designer.js
  function mergeDirectives(into, d) {
    for (const r of d.iconRequests) if (!into.iconRequests.some((x) => x.name === r.name)) into.iconRequests.push(r);
    for (const a of d.applyClass) if (!into.applyClass.some((x) => x.selector === a.selector && x.className === a.className)) into.applyClass.push(a);
  }
  async function streamValidated({ client, messages, params, doc, mode, onChunk, signal, validateOptions = {} }) {
    const streamer = new RuleStreamer();
    const result = { rawText: "", css: "", cssChunks: [], iconRequests: [], applyClass: [], dropped: [], errors: [], kept: 0, iconVars: /* @__PURE__ */ new Set(), usage: null, finish: null };
    const handle = (chunk) => {
      if (!chunk.trim()) return;
      const d = extractDirectives(chunk);
      mergeDirectives(result, d);
      const v = validateCss(d.css, { doc, mode, ...validateOptions });
      result.dropped.push(...v.dropped);
      result.errors.push(...v.errors);
      result.kept += v.kept;
      for (const iv of v.iconVars) result.iconVars.add(iv);
      if (v.css) {
        result.cssChunks.push(v.css);
        result.css = result.cssChunks.join("\n");
      }
      if (onChunk) onChunk({ css: result.css, newCss: v.css, iconRequests: d.iconRequests, applyClass: d.applyClass, result });
    };
    const out = await client.generate({
      messages,
      params,
      signal,
      onDelta: (delta) => {
        const complete = streamer.push(delta);
        if (complete) handle(complete);
      }
    });
    result.rawText = out.text;
    result.usage = out.usage;
    result.finish = out.finish;
    const tail = streamer.rest();
    if (tail.trim()) handle(tail);
    result.iconVars = [...result.iconVars];
    return result;
  }
  async function generateDesign({ client, doc, summaryText, style, settings, onChunk, signal, enhance = false, validateOptions = {} }) {
    const manifestText = enhance ? manifestToPromptCompact() : manifestToPrompt();
    const messages = designMessages({ summaryText, manifestText, style, enhance });
    const promptTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
    const params = { temperature: settings.temperature, topP: settings.topP, maxTokens: settings.maxDesignTokens, disableThinking: true };
    const result = await streamValidated({ client, messages, params, doc, mode: "design", onChunk, signal, validateOptions });
    result.promptTokens = promptTokens;
    result.style = style.id;
    return result;
  }
  async function generatePatch({ client, doc, css, reportText, style, settings, onChunk, signal, validateOptions = {} }) {
    const messages = repairMessages({ css, reportText, style });
    const params = { temperature: Math.min(0.4, settings.temperature), topP: settings.topP, maxTokens: settings.maxPatchTokens, disableThinking: true };
    return streamValidated({ client, messages, params, doc, mode: "patch", onChunk, signal, validateOptions });
  }

  // userscript/src/repair/inspect.js
  var ISSUE_SEVERITY = {
    invisible: 3,
    "overflow-x": 3,
    "icon-missing": 2,
    "contrast-low": 2,
    "text-clipped": 2,
    overlap: 2,
    "icon-off-center": 2,
    "icon-overlaps-text": 2,
    "icon-duplicate": 1,
    "font-too-small": 1,
    "edge-touch": 1,
    "spacing-inconsistent": 1,
    "padding-collapsed": 1,
    "padding-excessive": 1
  };
  var SKIP_TAGS = /* @__PURE__ */ new Set(["script", "style", "noscript", "template", "head", "meta", "link", "title", "br", "wbr", "retro-web-panel", "iframe", "canvas", "video", "audio", "object", "embed"]);
  var ICON_CONTAINERS = "a, button, [role=button], label, li, summary, h1, h2, h3, h4, h5, h6, span, div";
  var IMPORTANT = "nav a, header a, button, [role=button], input[type=submit], h1, h2, h3, main p, article p, main a, input:not([type=hidden]), select, textarea, img";
  function createInspectorMeasure(doc, overrides = {}) {
    const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
    const rect = overrides.rect || ((el) => el.getBoundingClientRect());
    const style = overrides.style || ((el, pseudo) => win ? win.getComputedStyle(el, pseudo || null) : {});
    const scroll = overrides.scroll || ((el) => ({ scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, clientWidth: el.clientWidth, clientHeight: el.clientHeight }));
    const textRect = overrides.textRect || ((el) => {
      let best = null;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        try {
          const range = doc.createRange();
          range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          best = best ? union(best, r) : { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        } catch {
        }
      }
      return best;
    });
    const naturalSize = overrides.naturalSize || ((img) => ({ w: img.naturalWidth || 0, h: img.naturalHeight || 0, complete: img.complete !== false }));
    const viewport = overrides.viewport || { width: win ? win.innerWidth : 1280, height: win ? win.innerHeight : 800 };
    const propertyValue = overrides.propertyValue || ((name) => win ? win.getComputedStyle(doc.documentElement).getPropertyValue(name) : "");
    return { rect, style, scroll, textRect, naturalSize, viewport, propertyValue };
  }
  function union(a, b) {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.right, b.right);
    const bottom = Math.max(a.bottom, b.bottom);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  function hasOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length >= 2) return true;
    return false;
  }
  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  function parseColor(str) {
    if (!str || typeof str !== "string") return null;
    const s = str.trim().toLowerCase();
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const hex = /^#([0-9a-f]{3,8})$/.exec(s);
    if (hex) {
      let h = hex[1];
      if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a2 = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a: a2 };
    }
    const m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (!m) return null;
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  function blend(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function luminance({ r, g, b }) {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(c1);
    const l2 = luminance(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function toHex(c) {
    const h = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
    return "#" + h(c.r) + h(c.g) + h(c.b);
  }
  function effectiveBackground(el, M) {
    let cur = el;
    let acc = null;
    const layers = [];
    while (cur && cur.nodeType === 1) {
      const st = M.style(cur);
      const bg = parseColor(st.backgroundColor);
      const img = st.backgroundImage && st.backgroundImage !== "none";
      if (bg && bg.a > 0) layers.push(bg);
      if (bg && bg.a >= 1) break;
      if (img) return null;
      cur = cur.parentElement;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) result = blend(layers[i], result);
    void acc;
    return result;
  }
  function snapshotVisibility(doc, overrides = {}) {
    const M = createInspectorMeasure(doc, overrides);
    const map = /* @__PURE__ */ new Map();
    const els = [...doc.querySelectorAll(IMPORTANT)].filter((e) => !e.closest("retro-web-panel")).slice(0, 600);
    for (const el of els) map.set(el, visibilityOf(el, M).visible);
    return map;
  }
  function visibilityOf(el, M) {
    const st = M.style(el);
    if (st.display === "none") return { visible: false, why: "display:none" };
    if (st.visibility === "hidden" || st.visibility === "collapse") return { visible: false, why: "visibility:hidden" };
    if (num(st.opacity) < 0.1) return { visible: false, why: "opacity:" + st.opacity };
    const r = M.rect(el);
    if (r.width < 1 || r.height < 1) return { visible: false, why: `zero-size ${Math.round(r.width)}x${Math.round(r.height)}` };
    const docWidth = Math.max(M.viewport.width, 0);
    if (r.right <= 0 || r.left >= docWidth + 4e3 || r.bottom <= -4e3) return { visible: false, why: "off-screen" };
    if (num(st.fontSize) < 1 && hasOwnText(el)) return { visible: false, why: "font-size:0" };
    return { visible: true };
  }
  function inspectPage(doc, options = {}) {
    const t0 = Date.now();
    const M = createInspectorMeasure(doc, options.measure || {});
    const tol = options.tolerance == null ? 2 : options.tolerance;
    const maxIssues = options.maxIssues || 30;
    const issues = [];
    const add = (type, el, detail, values = {}) => {
      const selector = typeof el === "string" ? el : uniqueSelector(el, doc, 3);
      issues.push({ type, selector, detail, severity: ISSUE_SEVERITY[type] || 1, ...values });
    };
    const vw = M.viewport.width;
    const all = [...doc.querySelectorAll("body *")].filter((e) => !SKIP_TAGS.has(e.localName) && !e.closest("retro-web-panel") && !e.closest("svg svg, svg *")).slice(0, 2500);
    const styleCache = /* @__PURE__ */ new Map();
    const S = (el) => {
      let s = styleCache.get(el);
      if (!s) {
        s = M.style(el);
        styleCache.set(el, s);
      }
      return s;
    };
    const rectCache = /* @__PURE__ */ new Map();
    const R = (el) => {
      let r = rectCache.get(el);
      if (!r) {
        r = M.rect(el);
        rectCache.set(el, r);
      }
      return r;
    };
    const isVisible = (el) => {
      const s = S(el);
      if (s.display === "none" || s.visibility === "hidden" || num(s.opacity) < 0.1) return false;
      const r = R(el);
      return r.width > 0 && r.height > 0;
    };
    const visible = all.filter(isVisible);
    const textEls = visible.filter(hasOwnText).slice(0, 800);
    const scrollCache = /* @__PURE__ */ new Map();
    const inScroller = (el) => {
      let cur = el.parentElement;
      const path = [];
      let result = false;
      while (cur && cur !== doc.documentElement && cur !== doc.body) {
        if (scrollCache.has(cur)) {
          result = scrollCache.get(cur);
          break;
        }
        path.push(cur);
        const o = S(cur);
        if (/auto|scroll/.test(o.overflowX || o.overflow || "")) {
          result = true;
          break;
        }
        cur = cur.parentElement;
      }
      for (const p of path) scrollCache.set(p, result);
      return result;
    };
    const sc = M.scroll(doc.documentElement);
    if (sc.scrollWidth > sc.clientWidth + 2 && sc.clientWidth > 0) {
      add("overflow-x", "html", `page scrolls horizontally: content ${sc.scrollWidth}px, viewport ${sc.clientWidth}px`, { scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth });
      const offenders = visible.filter((e) => R(e).right > vw + 2 && R(e).width > 20 && !["html", "body"].includes(e.localName) && !inScroller(e)).sort((a, b) => R(b).right - R(a).right).slice(0, 3);
      for (const e of offenders) add("overflow-x", e, `extends to x=${Math.round(R(e).right)}px (viewport ${vw}px)`);
    }
    for (const el of textEls.slice(0, 400)) {
      const tr = M.textRect(el);
      if (!tr || inScroller(el)) continue;
      if (tr.left <= 1 && tr.width > 10) add("edge-touch", el, `text starts at x=${Math.round(tr.left)}px (no left padding)`);
      else if (tr.right >= vw - 1 && tr.width > 10) add("edge-touch", el, `text ends at x=${Math.round(tr.right)}px, viewport edge`);
    }
    const containersSeen = /* @__PURE__ */ new Set();
    for (const el of visible) {
      const parent = el.parentElement;
      if (!parent || containersSeen.has(parent) || parent.localName === "body" || parent.localName === "html") continue;
      containersSeen.add(parent);
      if (options.unevenParents && options.unevenParents.has(parent)) continue;
      const kids = [...parent.children].filter((k) => k.localName === el.localName && isVisible(k));
      if (kids.length < 3 || kids.length > 40) continue;
      const rects = kids.map(R);
      const vertical = rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 2);
      const horizontal = !vertical && rects.every((r, i) => i === 0 || r.left >= rects[i - 1].right - 2);
      if (!vertical && !horizontal) continue;
      let gaps = rects.slice(1).map((r, i) => Math.round(vertical ? r.top - rects[i].bottom : r.left - rects[i].right));
      const ps = S(parent);
      const isFlex = /flex|grid/.test(ps.display || "");
      if (isFlex && /space-|center|end/.test(ps.justifyContent || "")) continue;
      if (isFlex && gaps.length >= 2) {
        const sorted = [...gaps].sort((a, b) => b - a);
        if (sorted[0] > 3 * Math.max(4, sorted[1])) gaps = gaps.filter((g) => g !== sorted[0]);
      }
      if (gaps.length < 2) continue;
      const min = Math.min(...gaps);
      const max = Math.max(...gaps);
      if (max - min > 12 && max > 4) add("spacing-inconsistent", parent, `${vertical ? "vertical" : "horizontal"} gaps between ${kids.length} ${el.localName} children vary ${min}px..${max}px`, { gaps, axis: vertical ? "y" : "x" });
    }
    for (const el of textEls.slice(0, 500)) {
      const s = S(el);
      const r = R(el);
      const pl = num(s.paddingLeft);
      const pr = num(s.paddingRight);
      const pt = num(s.paddingTop);
      const pb = num(s.paddingBottom);
      const bg = parseColor(s.backgroundColor);
      const hasBox = bg && bg.a > 0 || num(s.borderLeftWidth) > 0 || s.backgroundImage && s.backgroundImage !== "none";
      if (hasBox && pl === 0 && pr === 0 && pt === 0 && pb === 0 && r.width > 24 && ["a", "button", "span", "div", "li", "td", "th", "label", "p", "h1", "h2", "h3", "nav", "header", "footer", "section"].includes(el.localName)) {
        add("padding-collapsed", el, `text touches its box edge (padding 0 on a ${bg && bg.a > 0 ? "filled" : "bordered"} box)`);
      } else if (r.width > 0 && pl + pr > Math.max(r.width * 0.6, vw * 0.25) && r.width > 100) {
        add("padding-excessive", el, `horizontal padding ${Math.round(pl + pr)}px on a ${Math.round(r.width)}px box`);
      }
    }
    const smallGraphic = (e) => {
      const r = R(e);
      return r.width <= 48 && r.height <= 48;
    };
    const graphics = all.filter((e) => (e.localName === "svg" || e.localName === "img") && smallGraphic(e)).slice(0, 300);
    for (const g of graphics) {
      const container = g.parentElement && g.parentElement.closest(ICON_CONTAINERS);
      if (!container || container === g || !isVisible(container)) continue;
      const gs = S(g);
      if (gs.display === "none" || gs.visibility === "hidden") continue;
      const gr = R(g);
      const cr = R(container);
      if (gr.width === 0 || gr.height === 0) {
        add("icon-missing", g, `zero-size icon inside ${patternSelector(container)}`);
        continue;
      }
      const gc = { x: gr.left + gr.width / 2, y: gr.top + gr.height / 2 };
      const tr = hasOwnText(container) ? M.textRect(container) : null;
      if (tr) {
        const dy = Math.round(gc.y - (tr.top + tr.height / 2));
        if (Math.abs(dy) > tol) add("icon-off-center", g, `icon center is ${dy > 0 ? "+" : ""}${dy}px below text center in ${patternSelector(container)}`, { dy });
      } else if (cr.width > 0 && cr.height > 0) {
        const dx = Math.round(gc.x - (cr.left + cr.width / 2));
        const dy = Math.round(gc.y - (cr.top + cr.height / 2));
        const onlyChild = container.children.length === 1 && !hasOwnText(container);
        if (onlyChild && (Math.abs(dx) > tol || Math.abs(dy) > tol)) add("icon-off-center", g, `offset x=${dx > 0 ? "+" : ""}${dx}px y=${dy > 0 ? "+" : ""}${dy}px from the center of ${patternSelector(container)}`, { dx, dy });
      }
    }
    const bgIconEls = [];
    const iconGroups = /* @__PURE__ */ new Map();
    const groupIcon = (type, el, detail) => {
      const k = type + "|" + patternSelector(el);
      const g = iconGroups.get(k) || { type, el, count: 0, detail };
      g.count++;
      iconGroups.set(k, g);
    };
    for (const el of visible.slice(0, 1500)) {
      const s = S(el);
      if (!s.backgroundImage || s.backgroundImage === "none" || !/no-repeat/.test(s.backgroundRepeat || "")) continue;
      const size = /(\d+(?:\.\d+)?)px/.exec(s.backgroundSize || "");
      const iconW = size ? Math.min(48, num(size[1])) : 16;
      if (iconW > 48) continue;
      bgIconEls.push(el);
      const r = R(el);
      const pos = (s.backgroundPosition || "0% 0%").split(/\s+/);
      const posX = pos[0] || "0%";
      const posY = pos[1] || "0%";
      const iconLeft = posX.endsWith("%") ? r.left + (r.width - iconW) * (num(posX) / 100) : /^(left|right|center)$/.test(posX) ? posX === "right" ? r.right - iconW : posX === "center" ? r.left + (r.width - iconW) / 2 : r.left : r.left + num(posX);
      const iconTop = posY.endsWith("%") ? r.top + (r.height - iconW) * (num(posY) / 100) : posY === "center" ? r.top + (r.height - iconW) / 2 : r.top + num(posY);
      if (!hasOwnText(el)) {
        const g2 = el.querySelector && el.querySelector("svg, img");
        if (g2 && isVisible(g2)) groupIcon("icon-duplicate", el, "background icon drawn behind an existing icon (svg/img)");
        continue;
      }
      const tr = M.textRect(el);
      if (!tr) continue;
      const overlap = Math.min(iconLeft + iconW, tr.right) - Math.max(iconLeft, tr.left);
      if (overlap > 2 && iconTop < tr.bottom && iconTop + iconW > tr.top) {
        groupIcon("icon-overlaps-text", el, `background icon overlaps the text by ${Math.round(overlap)}px (padding-left ${s.paddingLeft}, background-position ${pos.join(" ")})`);
        continue;
      }
      const dy = Math.round(iconTop + iconW / 2 - (tr.top + tr.height / 2));
      if (Math.abs(dy) > tol) add("icon-off-center", el, `background icon is ${dy > 0 ? "+" : ""}${dy}px from the text center (background-position ${pos.join(" ")})`, { dy, background: true });
      const g = el.querySelector && el.querySelector("svg, img");
      if (g && isVisible(g) && R(g).width <= 48) groupIcon("icon-duplicate", el, `background icon added to an element that already has its own icon (${g.localName})`);
    }
    for (const g of iconGroups.values()) {
      const sel = g.count > 1 ? patternSelector(g.el) : uniqueSelector(g.el, doc, 3);
      add(g.type, sel, g.detail + (g.count > 1 ? ` \xD7${g.count}` : ""), { count: g.count, background: true });
    }
    for (const v of options.iconVars || []) {
      const val = (M.propertyValue(v) || "").trim();
      if (!val) add("icon-missing", v, `variable ${v} is not defined; the icon will not render`);
    }
    for (const img of visible.filter((e) => e.localName === "img").slice(0, 200)) {
      const n = M.naturalSize(img);
      if (n.complete && n.w === 0 && n.h === 0 && img.getAttribute("src")) add("icon-missing", img, "broken image (natural size 0x0)");
    }
    for (const el of visible.filter((e) => e.classList && (e.classList.contains("retro-icon-left") || e.classList.contains("retro-badge-new"))).slice(0, 100)) {
      const s = S(el);
      if (!s.backgroundImage || s.backgroundImage === "none") add("icon-missing", el, "icon slot has no background-image");
    }
    for (const el of textEls.slice(0, 500)) {
      const s = S(el);
      const clipX = /hidden|clip|auto|scroll/.test(s.overflowX || s.overflow || "");
      const clipY = /hidden|clip|auto|scroll/.test(s.overflowY || s.overflow || "");
      if (!clipX && !clipY) continue;
      const sc2 = M.scroll(el);
      if (clipX && sc2.scrollWidth > sc2.clientWidth + 2) add("text-clipped", el, `content ${sc2.scrollWidth}px wide in a ${sc2.clientWidth}px box (overflow ${s.overflowX || s.overflow})`);
      else if (clipY && sc2.scrollHeight > sc2.clientHeight + 2 && !/auto|scroll/.test(s.overflowY || s.overflow || "")) add("text-clipped", el, `content ${sc2.scrollHeight}px tall in a ${sc2.clientHeight}px box (overflow hidden)`);
    }
    for (const el of textEls.slice(0, 500)) {
      const s = S(el);
      if (s.whiteSpace !== "nowrap") continue;
      const tr = M.textRect(el);
      const r = R(el);
      if (tr && tr.right > r.right + 2 && tr.right > vw) add("text-clipped", el, `nowrap text runs ${Math.round(tr.right - r.right)}px past its box`);
    }
    const seenPairs = /* @__PURE__ */ new Set();
    for (const el of visible.slice(0, 1500)) {
      const next = el.nextElementSibling;
      if (!next || !isVisible(next) || SKIP_TAGS.has(next.localName)) continue;
      const sa = S(el);
      const sb = S(next);
      if (/absolute|fixed/.test(sa.position) || /absolute|fixed/.test(sb.position)) continue;
      if (sa.float !== "none" || sb.float !== "none") continue;
      const a = R(el);
      const b = R(next);
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 4 && iy > 4 && (hasOwnText(el) || hasOwnText(next) || el.localName === "img" || next.localName === "img")) {
        const key = uniqueSelector(el, doc, 2);
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        add("overlap", el, `overlaps its next sibling ${patternSelector(next)} by ${Math.round(ix)}x${Math.round(iy)}px`);
      }
    }
    const contrastGroups = /* @__PURE__ */ new Map();
    const smallGroups = /* @__PURE__ */ new Map();
    for (const el of textEls) {
      const s = S(el);
      const fs = num(s.fontSize);
      if (fs > 0 && fs < 11 && !["sup", "sub", "small", "code", "kbd"].includes(el.localName)) {
        const k = patternSelector(el);
        const g = smallGroups.get(k) || { el, count: 0, size: fs };
        g.count++;
        g.size = Math.min(g.size, fs);
        smallGroups.set(k, g);
      }
      const fg = parseColor(s.color);
      if (!fg) continue;
      const bg = effectiveBackground(el, M);
      if (!bg) continue;
      const ratio = contrastRatio(fg.a < 1 ? blend(fg, bg) : fg, bg);
      const bold = num(s.fontWeight) >= 700 || s.fontWeight === "bold";
      const large = fs >= 24 || fs >= 18.66 && bold;
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        const k = patternSelector(el);
        const g = contrastGroups.get(k) || { el, count: 0, ratio, fg: toHex(fg), bg: toHex(bg), need };
        g.count++;
        if (ratio < g.ratio) {
          g.ratio = ratio;
          g.fg = toHex(fg);
          g.bg = toHex(bg);
        }
        contrastGroups.set(k, g);
      }
    }
    for (const [, g] of [...contrastGroups.entries()].sort((a, b) => a[1].ratio - b[1].ratio).slice(0, 8)) {
      add("contrast-low", patternSelector(g.el), `${g.ratio.toFixed(1)}:1 (${g.fg} on ${g.bg}), needs ${g.need}:1${g.count > 1 ? ` \xD7${g.count}` : ""}`, { ratio: +g.ratio.toFixed(2), fg: g.fg, bg: g.bg });
    }
    for (const [, g] of [...smallGroups.entries()].sort((a, b) => a[1].size - b[1].size).slice(0, 6)) {
      add("font-too-small", patternSelector(g.el), `${g.size}px (minimum 11px)${g.count > 1 ? ` \xD7${g.count}` : ""}`, { size: g.size });
    }
    if (options.baseline) {
      let n = 0;
      for (const [el, wasVisible] of options.baseline) {
        if (!wasVisible || !el.isConnected) continue;
        const v = visibilityOf(el, M);
        if (!v.visible) {
          if (n++ < 12) add("invisible", el, `was visible before the design, now ${v.why}`, { why: v.why });
        }
      }
      if (n > 12) add("invisible", "body", `${n} important elements hidden in total`);
    }
    let preexisting = 0;
    let list = issues;
    if (options.ignore && options.ignore.size) {
      list = issues.filter((i) => {
        const hit = options.ignore.has(i.type + "|" + i.selector);
        if (hit) preexisting++;
        return !hit;
      });
    }
    list.sort((a, b) => b.severity - a.severity);
    const limited = list.slice(0, maxIssues);
    const counts = {};
    for (const i of list) counts[i.type] = (counts[i.type] || 0) + 1;
    return { issues: limited, total: list.length, counts, preexisting, text: renderReport(limited, options.tokenBudget || 600), elapsedMs: Date.now() - t0 };
  }
  function issueKeys(report) {
    return new Set((report && report.issues ? report.issues : []).map((i) => i.type + "|" + i.selector));
  }
  function renderReport(issues, tokenBudget = 600) {
    if (!issues.length) return "no issues";
    const lines = issues.map((i) => `${i.type}: ${i.selector} | ${i.detail}`);
    let out = lines.join("\n");
    while (estimateTokens(out) > tokenBudget && lines.length > 3) {
      lines.pop();
      out = lines.join("\n") + `
(+${issues.length - lines.length} more)`;
    }
    return out;
  }

  // userscript/src/packs/themes.js
  var THEMES = {
    geocities: {
      page: { bg: "#000080", bgImage: "var(--bg-tile-stars-blue)", text: "#ffff00", font: "var(--font-comic)", size: "14px", cursor: "var(--cursor-sparkle)" },
      link: { color: "#00ffff", visited: "#ff00ff", hover: "#ffffff", hoverBg: "#ff00ff" },
      heading: { font: "var(--font-comic)", color: "#ff00ff", shadow: "2px 2px 0 #000000", rainbow: true },
      header: { bg: "#000000", bgImage: "var(--bg-starfield)", text: "#ffffff", border: "4px ridge #ffff00", padding: "10px 14px" },
      nav: { bg: "#c0c0c0", text: "#000080", border: "3px outset #ffffff", link: "bevel", icon: "star", font: "var(--font-comic)" },
      main: { bg: "#ffffff", text: "#000000", border: "4px ridge #c0c0c0", padding: "14px", bgImage: null },
      sidebar: { bg: "#ffffcc", text: "#000080", border: "3px dashed #ff00ff", padding: "10px" },
      footer: { bg: "#000000", text: "#00ff00", border: "2px solid #00ff00", font: "var(--font-courier)" },
      button: "bevel",
      input: "inset",
      image: { border: "3px ridge #ffff00" },
      table: "bevel",
      extras: { hr: "rainbow", counter: true, underConstruction: true, marquee: "\u2605 Welcome to my homepage!!! \u2605 Best viewed in Netscape Navigator 4.0 at 800x600 \u2605 Sign my guestbook! \u2605", bullets: "star" }
    },
    "web20-glossy": {
      page: { bg: "#e8f1fa", bgImage: "var(--grad-aqua)", bgRepeat: "repeat-x", text: "#333333", font: "var(--font-lucida)", size: "15px" },
      link: { color: "#1f6fbf", visited: "#1f6fbf", hover: "#f7941d" },
      heading: { font: "var(--font-trebuchet)", color: "#1f6fbf", shadow: "0 1px 0 #ffffff", weight: "bold" },
      header: { bg: "#ffffff", bgImage: null, text: "#333333", border: "0", radius: "12px", shadow: "0 2px 8px rgba(0,0,0,.15)", padding: "12px 18px" },
      nav: { bg: "transparent", text: "#1f6fbf", border: "0", link: "glossy", icon: "check" },
      main: { bg: "#ffffff", text: "#333333", border: "1px solid #cfdcea", radius: "12px", shadow: "0 2px 8px rgba(0,0,0,.12)", padding: "18px" },
      sidebar: { bg: "#f4f9ff", text: "#333333", border: "1px solid #cfdcea", radius: "12px", padding: "14px" },
      footer: { bg: "#3b8dd6", text: "#ffffff", border: "0", radius: "12px 12px 0 0" },
      button: "glossy-green",
      input: "rounded",
      image: { border: "0", radius: "8px", shadow: "0 2px 6px rgba(0,0,0,.2)" },
      table: "rounded",
      extras: { hr: "soft", badge: "BETA" }
    },
    "y2k-chrome": {
      page: { bg: "#0a0a2a", bgImage: "var(--bg-tile-grid)", text: "#e6e6e6", font: "var(--font-verdana)", size: "13px" },
      link: { color: "#00e5ff", visited: "#ff2bd6", hover: "#ffffff", hoverBg: "#ff2bd6" },
      heading: { font: "var(--font-arial-black)", color: "#ffffff", shadow: "0 0 8px #00e5ff, 0 0 16px #00e5ff", transform: "uppercase", spacing: "2px" },
      header: { bg: "#c0c0c0", bgImage: "var(--grad-chrome)", text: "#101020", border: "2px solid #ffffff", radius: "18px", padding: "10px 18px", shadow: "0 0 14px #00e5ff" },
      nav: { bg: "transparent", text: "#101020", border: "0", link: "pill", icon: "arrow-right" },
      main: { bg: "rgba(10,10,42,.85)", text: "#e6e6e6", border: "2px solid #00e5ff", radius: "14px", padding: "16px", shadow: "0 0 12px rgba(0,229,255,.5)" },
      sidebar: { bg: "rgba(255,43,214,.12)", text: "#e6e6e6", border: "2px solid #ff2bd6", radius: "14px", padding: "12px" },
      footer: { bg: "#c0c0c0", bgImage: "var(--grad-metal)", text: "#101020", border: "0" },
      button: "pill",
      input: "flat-dark",
      image: { border: "2px solid #e6e6e6", radius: "10px" },
      table: "dark",
      extras: { hr: "neon" }
    },
    win98: {
      page: { bg: "#c0c0c0", bgImage: null, text: "#000000", font: "var(--font-ms-sans)", size: "12px", cursor: "var(--cursor-arrow)" },
      link: { color: "#000080", visited: "#000080", hover: "#ffffff", hoverBg: "#000080" },
      heading: { font: "var(--font-tahoma)", color: "#000080", weight: "bold" },
      header: { bg: "#000080", bgImage: "var(--grad-titlebar)", text: "#ffffff", border: "2px outset #ffffff", padding: "4px 8px", font: "bold 12px var(--font-ms-sans)" },
      nav: { bg: "#c0c0c0", text: "#000000", border: "2px outset #ffffff", link: "bevel", icon: "folder", font: "var(--font-ms-sans)" },
      main: { bg: "#ffffff", text: "#000000", border: "2px inset #ffffff", padding: "12px" },
      sidebar: { bg: "#c0c0c0", text: "#000000", border: "2px outset #ffffff", padding: "8px" },
      footer: { bg: "#c0c0c0", text: "#000000", border: "2px inset #ffffff", font: "var(--font-ms-sans)", size: "11px" },
      button: "bevel",
      input: "inset",
      image: { border: "1px solid #000000", bg: "#ffffff" },
      table: "bevel",
      extras: { hr: "groove", statusBar: true }
    },
    "early-blog": {
      page: { bg: "#f4f1ea", bgImage: null, text: "#333333", font: "var(--font-verdana)", size: "13px" },
      link: { color: "#8a6d3b", visited: "#5a6b4a", hover: "#c9b99b", decoration: "underline" },
      heading: { font: "var(--font-georgia)", color: "#5a6b4a", weight: "normal", style: "italic" },
      header: { bg: "#5a6b4a", bgImage: null, text: "#f4f1ea", border: "0", borderBottom: "4px solid #c9b99b", padding: "18px 22px" },
      nav: { bg: "#f4f1ea", text: "#5a6b4a", border: "1px dotted #8a6d3b", link: "plain", icon: "file", font: "var(--font-georgia)" },
      main: { bg: "#ffffff", text: "#333333", border: "1px dotted #c9b99b", padding: "22px", narrow: "760px" },
      sidebar: { bg: "#f4f1ea", text: "#5a6b4a", border: "1px dashed #c9b99b", padding: "12px", size: "12px" },
      footer: { bg: "#f4f1ea", text: "#8a6d3b", border: "1px dotted #8a6d3b", size: "11px" },
      button: "flat-earth",
      input: "dotted",
      image: { border: "1px solid #c9b99b", bg: "#ffffff" },
      table: "plain",
      extras: { hr: "dotted", postedBy: true }
    },
    "portal-1999": {
      page: { bg: "#ffffff", bgImage: null, text: "#000000", font: "var(--font-arial)", size: "12px" },
      link: { color: "#0000ee", visited: "#800080", hover: "#ff0000", decoration: "underline" },
      heading: { font: "var(--font-arial)", color: "#000000", weight: "bold", sizeScale: 0.9 },
      header: { bg: "#ffffff", bgImage: null, text: "#000000", border: "0", borderBottom: "2px solid #cccccc", padding: "6px 10px" },
      nav: { bg: "#ffffcc", text: "#0000ee", border: "1px solid #cccccc", link: "plain", icon: "arrow-right", dense: true },
      main: { bg: "#ffffff", text: "#000000", border: "0", padding: "8px" },
      sidebar: { bg: "#ffffcc", text: "#000000", border: "1px solid #cccccc", padding: "6px", size: "11px" },
      footer: { bg: "#ffffff", text: "#808080", border: "1px solid #cccccc", size: "10px" },
      button: "flat-gray",
      input: "flat",
      image: { border: "1px solid #cccccc" },
      table: "lines",
      extras: { hr: "thin", categoryBars: true }
    },
    "matrix-terminal": {
      page: { bg: "#000000", bgImage: null, text: "#00ff41", font: "var(--font-courier)", size: "13px" },
      link: { color: "#00ff41", visited: "#008f11", hover: "#000000", hoverBg: "#00ff41", decoration: "none" },
      heading: { font: "var(--font-courier)", color: "#00ff41", shadow: "0 0 6px #00ff41", transform: "uppercase", prefix: "> " },
      header: { bg: "#000000", bgImage: null, text: "#00ff41", border: "1px solid #00ff41", padding: "8px 12px" },
      nav: { bg: "#000000", text: "#00ff41", border: "1px dashed #008f11", link: "bracket", icon: null, font: "var(--font-courier)" },
      main: { bg: "#000000", text: "#00ff41", border: "1px solid #008f11", padding: "12px" },
      sidebar: { bg: "#001a00", text: "#00ff41", border: "1px solid #003b00", padding: "10px" },
      footer: { bg: "#000000", text: "#008f11", border: "1px solid #003b00", font: "var(--font-courier)" },
      button: "terminal",
      input: "terminal",
      image: { border: "1px solid #00ff41", filter: "grayscale(1) sepia(1) hue-rotate(60deg) saturate(3)" },
      table: "terminal",
      extras: { hr: "dashed", scanlines: true, cursorBlink: true }
    },
    "myspace-glitter": {
      page: { bg: "#000000", bgImage: "var(--bg-tile-glitter)", text: "#ffffff", font: "var(--font-arial)", size: "13px" },
      link: { color: "#ff69b4", visited: "#9900ff", hover: "#00ccff", decoration: "underline" },
      heading: { font: "var(--font-arial-black)", color: "#ff69b4", rainbow: true, shadow: "1px 1px 0 #000000" },
      header: { bg: "#ff69b4", bgImage: "var(--bg-tile-hearts)", text: "#000000", border: "3px solid #ffffff", padding: "10px 14px" },
      nav: { bg: "#000000", text: "#ff69b4", border: "1px solid #ff69b4", link: "plain", icon: "heart", font: "var(--font-arial)" },
      main: { bg: "rgba(0,0,0,.8)", text: "#ffffff", border: "2px solid #ff69b4", padding: "12px" },
      sidebar: { bg: "#9900ff", text: "#ffffff", border: "2px solid #ffffff", padding: "10px" },
      footer: { bg: "#ff69b4", text: "#000000", border: "0", font: "var(--font-comic)" },
      button: "flat-pink",
      input: "flat-dark",
      image: { border: "3px solid #ff69b4" },
      table: "dark",
      extras: { hr: "rainbow", sparkleHeading: true, marquee: "\u2665 Thanks for the add! \u2665 Top 8 \u2665 Pics \u2665 Blog \u2665 Comments \u2665", counter: true }
    },
    "corporate-2001": {
      page: { bg: "#e6e6e6", bgImage: null, text: "#333333", font: "var(--font-verdana)", size: "11px" },
      link: { color: "#003366", visited: "#003366", hover: "#cc6600", decoration: "underline" },
      heading: { font: "var(--font-verdana)", color: "#003366", weight: "bold", sizeScale: 0.85 },
      header: { bg: "#003366", bgImage: "var(--grad-navy-header)", text: "#ffffff", border: "0", borderBottom: "3px solid #cc6600", padding: "10px 16px" },
      nav: { bg: "#ffffff", text: "#003366", border: "1px solid #6699cc", link: "arrow", icon: "arrow-right", font: "var(--font-verdana)" },
      main: { bg: "#ffffff", text: "#333333", border: "1px solid #cccccc", padding: "14px" },
      sidebar: { bg: "#f4f7fb", text: "#333333", border: "1px solid #6699cc", padding: "10px" },
      footer: { bg: "#003366", text: "#ffffff", border: "0", size: "10px" },
      button: "flat-navy",
      input: "flat",
      image: { border: "1px solid #6699cc" },
      table: "lines",
      extras: { hr: "thin", categoryBars: true }
    },
    "flash-agency": {
      page: { bg: "#111111", bgImage: null, text: "#dddddd", font: "var(--font-arial)", size: "13px" },
      link: { color: "#ff6600", visited: "#ff6600", hover: "#ccff00", decoration: "none" },
      heading: { font: "var(--font-impact)", color: "#ff6600", transform: "uppercase", spacing: "1px", weight: "normal" },
      header: { bg: "#000000", bgImage: "var(--grad-glossy-black)", text: "#ffffff", border: "0", borderBottom: "3px solid #ff6600", padding: "12px 20px" },
      nav: { bg: "transparent", text: "#ffffff", border: "0", link: "pill-dark", icon: "play" },
      main: { bg: "#1c1c1c", text: "#dddddd", border: "1px solid #333333", padding: "18px", narrow: "960px" },
      sidebar: { bg: "#222222", text: "#dddddd", border: "1px solid #ff6600", padding: "12px" },
      footer: { bg: "#000000", text: "#999999", border: "1px solid #333333", size: "11px" },
      button: "glossy-orange",
      input: "flat-dark",
      image: { border: "2px solid #ff6600" },
      table: "dark",
      extras: { hr: "orange", skipIntro: true }
    },
    "forum-phpbb": {
      page: { bg: "#e5edf5", bgImage: "var(--bg-tile-plaid-blue)", text: "#333333", font: "var(--font-verdana)", size: "11px" },
      link: { color: "#006699", visited: "#5c7099", hover: "#dd6900", decoration: "underline", weight: "bold" },
      heading: { font: "var(--font-trebuchet)", color: "#006699", weight: "bold", sizeScale: 0.9 },
      header: { bg: "#5c7099", bgImage: "var(--grad-navy-header)", text: "#ffffff", border: "1px solid #3d4f6e", padding: "8px 14px" },
      nav: { bg: "#d3dce8", text: "#006699", border: "1px solid #5c7099", link: "bevel", icon: "chat", font: "var(--font-verdana)" },
      main: { bg: "#ffffff", text: "#333333", border: "1px solid #a9b8c2", padding: "10px" },
      sidebar: { bg: "#d3dce8", text: "#333333", border: "1px solid #a9b8c2", padding: "8px" },
      footer: { bg: "#d3dce8", text: "#5c7099", border: "1px solid #a9b8c2", size: "10px" },
      button: "bevel",
      input: "inset",
      image: { border: "1px solid #a9b8c2", bg: "#ffffff" },
      table: "forum",
      extras: { hr: "thin", categoryBars: true, counter: true }
    },
    "kawaii-pixel": {
      page: { bg: "#ffd1e8", bgImage: "var(--bg-tile-dots)", text: "#6b4c6b", font: "var(--font-verdana)", size: "12px" },
      link: { color: "#ff8fc8", visited: "#b58fd6", hover: "#6b4c6b", decoration: "underline dotted" },
      heading: { font: "var(--font-comic)", color: "#ff8fc8", shadow: "1px 1px 0 #ffffff", prefix: "\u2665 " },
      header: { bg: "#ffffff", bgImage: "var(--bg-tile-hearts)", text: "#6b4c6b", border: "3px dotted #ff8fc8", radius: "14px", padding: "10px 14px" },
      nav: { bg: "#fff6a8", text: "#6b4c6b", border: "2px dotted #ff8fc8", link: "pixel", icon: "heart", font: "var(--font-verdana)" },
      main: { bg: "#ffffff", text: "#6b4c6b", border: "2px solid #ff8fc8", radius: "12px", padding: "14px", shadow: "4px 4px 0 #b8f3e6" },
      sidebar: { bg: "#b8f3e6", text: "#6b4c6b", border: "2px dotted #6b4c6b", radius: "12px", padding: "10px" },
      footer: { bg: "#ff8fc8", text: "#ffffff", border: "0", radius: "12px 12px 0 0", font: "var(--font-comic)" },
      button: "pixel",
      input: "rounded-pink",
      image: { border: "3px solid #ffffff", radius: "10px", shadow: "3px 3px 0 #ff8fc8" },
      table: "rounded",
      extras: { hr: "hearts", counter: true, marquee: "\u2665 \u2665 \u2665 welcome to my page \u2665 \u2665 \u2665 don't forget to sign my guestbook \u2665 \u2665 \u2665" }
    },
    "aqua-osx": {
      page: { bg: "#ececec", bgImage: "var(--bg-tile-pinstripe)", text: "#333333", font: "var(--font-lucida)", size: "13px" },
      link: { color: "#3d7fe0", visited: "#3d7fe0", hover: "#1f5fbf", decoration: "none" },
      heading: { font: "var(--font-lucida)", color: "#333333", weight: "bold", shadow: "0 1px 0 #ffffff" },
      header: { bg: "#d6d6d6", bgImage: "var(--bg-tile-brushed-metal)", text: "#222222", border: "1px solid #9a9a9a", radius: "8px 8px 0 0", padding: "10px 16px", shadow: "0 1px 3px rgba(0,0,0,.3)" },
      nav: { bg: "transparent", text: "#222222", border: "0", link: "aqua", icon: "globe" },
      main: { bg: "#ffffff", text: "#333333", border: "1px solid #cfcfcf", radius: "8px", padding: "16px", shadow: "0 3px 10px rgba(0,0,0,.2)" },
      sidebar: { bg: "#f3f6fb", text: "#333333", border: "1px solid #cfcfcf", radius: "8px", padding: "12px" },
      footer: { bg: "#d6d6d6", bgImage: "var(--bg-tile-brushed-metal)", text: "#444444", border: "1px solid #9a9a9a", size: "11px" },
      button: "aqua",
      input: "rounded",
      image: { border: "1px solid #cfcfcf", radius: "6px", shadow: "0 2px 5px rgba(0,0,0,.25)" },
      table: "rounded",
      extras: { hr: "soft", trafficLights: true }
    }
  };

  // userscript/src/packs/render.js
  var ICON_WORDS = [
    [/\b(home|start|index|main page)\b/i, "home"],
    [/\b(search|find)\b/i, "search"],
    [/\b(contact|mail|e-?mail|write us|inbox)\b/i, "mail"],
    [/\b(shop|store|cart|basket|checkout|buy|products?|pricing|prices?|order)\b/i, "cart"],
    [/\b(log ?in|sign ?in|sign ?up|register|account|profile|members?|my page|user)\b/i, "user"],
    [/\b(about|team|company|who we are|info)\b/i, "info"],
    [/\b(help|faq|support|questions?)\b/i, "info"],
    [/\b(archives?|categories|category|browse|directory|folders?|collections?)\b/i, "folder"],
    [/\b(download|install|get it)\b/i, "download"],
    [/\b(docs?|documentation|guides?|manual|reference|learn|tutorials?|wiki)\b/i, "file"],
    [/\b(blog|news|posts?|articles?|stories|journal|writing)\b/i, "file"],
    [/\b(music|audio|songs?|podcasts?|radio)\b/i, "music"],
    [/\b(photos?|gallery|images?|pictures?|pics)\b/i, "image"],
    [/\b(videos?|watch|play|movies?|tv|streams?)\b/i, "play"],
    [/\b(links?|webring|friends)\b/i, "link"],
    [/\b(rss|feed|subscribe|newsletter)\b/i, "rss"],
    [/\b(forums?|community|chat|discussions?|comments?|talk|guestbook)\b/i, "chat"],
    [/\b(events?|calendar|schedule|dates?|upcoming)\b/i, "calendar"],
    [/\b(settings|preferences|options|config|tools)\b/i, "gear"],
    [/\b(new|latest|recent|newest)\b/i, "new"],
    [/\b(popular|trending|hot|top|best)\b/i, "hot"],
    [/\b(favou?rites?|starred|featured)\b/i, "star"],
    [/\b(security|privacy|legal|terms|secure|password)\b/i, "lock"],
    [/\b(world|international|languages?|global|countries|english|español|deutsch)\b/i, "globe"],
    [/\b(print)\b/i, "print"],
    [/\b(tags?|topics?|labels?)\b/i, "tag"],
    [/\b(bookmarks?|saved|reading list|later)\b/i, "bookmark"],
    [/\b(back|previous|prev|older)\b/i, "arrow-left"],
    [/\b(next|more|continue|newer|all)\b/i, "arrow-right"],
    [/\b(menu)\b/i, "menu"],
    [/\b(history|time|clock|past|yesterday)\b/i, "clock"],
    [/\b(love|like|heart|wishlist)\b/i, "heart"],
    [/\b(ok|done|submit|save|apply|go|send|confirm)\b/i, "check"],
    [/\b(close|cancel|delete|remove|clear|reset)\b/i, "close"],
    [/\b(warning|alert|important|notice)\b/i, "warning"]
  ];
  function iconForText(text, href = "", fallback = null) {
    const hay = `${text || ""} ${String(href || "").replace(/^https?:\/\/[^/]+/, "").replace(/[/._?=&#-]+/g, " ")}`;
    for (const [re, icon] of ICON_WORDS) if (re.test(hay)) return icon;
    return fallback;
  }
  var each = (list, suffix) => splitSelectorList(list).map((s) => s + suffix).join(", ");
  var esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  var decl = (prop, v) => v == null || v === "" ? "" : `${prop}: ${v}; `;
  var box = (t) => decl("background-color", t.bg) + decl("background-image", t.bgImage || (t.bg ? "none" : null)) + decl("color", t.text) + decl("border", t.border) + decl("border-bottom", t.borderBottom) + decl("border-radius", t.radius) + decl("box-shadow", t.shadow) + decl("padding", t.padding) + decl("font-family", t.font && t.font.startsWith("var") ? t.font : null) + decl("font", t.font && !t.font.startsWith("var") ? t.font : null) + decl("font-size", t.size);
  var ICON_SLOT = "background-repeat: no-repeat; background-position: 4px center; background-size: 16px 16px; padding-left: 24px; ";
  var NAV_LINK = {
    bevel: (T) => `display: inline-block; background-color: #c0c0c0; color: ${T.nav.text}; border: 2px outset #ffffff; padding: 2px 8px 2px 24px; margin: 2px; text-decoration: none; font-weight: bold; `,
    glossy: () => `display: inline-block; background-image: var(--grad-glossy-blue); color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #1a5a99; border-radius: 6px; box-shadow: var(--glossy-shadow); padding: 5px 12px 5px 26px; margin: 2px; text-decoration: none; font-weight: bold; `,
    pill: () => `display: inline-block; background-image: var(--grad-chrome); color: #101020; border: 1px solid #777777; border-radius: 999px; padding: 4px 14px 4px 26px; margin: 2px; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; `,
    "pill-dark": () => `display: inline-block; background-image: var(--grad-glossy-black); color: #ffffff; border: 1px solid #000000; border-radius: 999px; padding: 4px 14px 4px 26px; margin: 2px; text-decoration: none; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; `,
    plain: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: underline; padding: 2px 6px 2px 24px; margin: 1px; `,
    arrow: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: none; padding: 2px 6px 2px 24px; margin: 1px; font-weight: bold; `,
    bracket: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: none; padding: 2px 6px; margin: 1px; `,
    pixel: (T) => `display: inline-block; background-color: #ffffff; color: ${T.nav.text}; border: 2px solid #6b4c6b; border-radius: 0; box-shadow: 2px 2px 0 #ff8fc8; padding: 2px 8px 2px 24px; margin: 3px; text-decoration: none; `,
    aqua: () => `display: inline-block; background-image: var(--grad-aqua); color: #0b2a55; border: 1px solid #7fa6dc; border-radius: 999px; box-shadow: var(--glossy-shadow); padding: 4px 12px 4px 26px; margin: 2px; text-decoration: none; font-weight: bold; `
  };
  var BUTTON = {
    bevel: `background-color: #c0c0c0; background-image: none; color: #000000; border: 2px outset #ffffff; border-radius: 0; box-shadow: none; text-shadow: none; font-family: var(--font-ms-sans); font-size: 12px; padding: 3px 12px; `,
    "glossy-blue": `background-image: var(--grad-glossy-blue); background-color: #3b8dd6; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #1a5a99; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 6px 16px; `,
    "glossy-green": `background-image: var(--grad-glossy-green); background-color: #8cc63f; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #5c8a1f; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 6px 16px; `,
    "glossy-orange": `background-image: var(--grad-glossy-orange); background-color: #f7941d; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #b35f00; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-arial); font-weight: bold; text-transform: uppercase; padding: 6px 16px; `,
    pill: `background-image: var(--grad-chrome); background-color: #c0c0c0; color: #101020; border: 1px solid #777777; border-radius: 999px; box-shadow: 0 0 8px rgba(0,229,255,.6); font-family: var(--font-verdana); font-weight: bold; text-transform: uppercase; padding: 5px 16px; `,
    "flat-earth": `background-color: #8a6d3b; background-image: none; color: #ffffff; border: 1px solid #5a6b4a; border-radius: 3px; box-shadow: none; font-family: var(--font-verdana); padding: 4px 12px; `,
    "flat-gray": `background-color: #eeeeee; background-image: none; color: #000000; border: 1px solid #999999; border-radius: 0; box-shadow: none; font-family: var(--font-arial); font-size: 11px; padding: 2px 8px; `,
    "flat-navy": `background-color: #003366; background-image: none; color: #ffffff; border: 1px solid #003366; border-radius: 0; box-shadow: none; font-family: var(--font-verdana); font-size: 11px; font-weight: bold; padding: 3px 10px; `,
    "flat-pink": `background-color: #ff69b4; background-image: none; color: #000000; border: 2px solid #ffffff; border-radius: 0; box-shadow: none; font-family: var(--font-arial); font-weight: bold; padding: 4px 12px; `,
    terminal: `background-color: #000000; background-image: none; color: #00ff41; border: 1px solid #00ff41; border-radius: 0; box-shadow: none; font-family: var(--font-courier); text-transform: uppercase; padding: 3px 10px; `,
    pixel: `background-color: #fff6a8; background-image: none; color: #6b4c6b; border: 2px solid #6b4c6b; border-radius: 0; box-shadow: 2px 2px 0 #ff8fc8; font-family: var(--font-verdana); font-weight: bold; padding: 3px 10px; `,
    aqua: `background-image: var(--grad-aqua); background-color: #5e95e0; color: #ffffff; text-shadow: 0 1px 1px rgba(0,0,0,.4); border: 1px solid #5e95e0; border-radius: 999px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 5px 16px; `
  };
  var BUTTON_HOVER = {
    bevel: "border-style: inset; ",
    terminal: "background-color: #00ff41; color: #000000; ",
    "flat-navy": "background-color: #cc6600; border-color: #cc6600; ",
    "flat-pink": "background-color: #00ccff; ",
    "flat-earth": "background-color: #5a6b4a; ",
    "flat-gray": "background-color: #ffffcc; "
  };
  var INPUT = {
    inset: `background-color: #ffffff; color: #000000; border: 2px inset #ffffff; border-radius: 0; box-shadow: var(--win-shadow-in); font-family: var(--font-ms-sans); padding: 2px 4px; `,
    rounded: `background-color: #ffffff; color: #333333; border: 1px solid #aabbdd; border-radius: 6px; box-shadow: inset 0 1px 2px rgba(0,0,0,.12); padding: 4px 8px; `,
    "rounded-pink": `background-color: #ffffff; color: #6b4c6b; border: 2px dotted #ff8fc8; border-radius: 8px; box-shadow: none; padding: 3px 8px; `,
    flat: `background-color: #ffffff; color: #000000; border: 1px solid #999999; border-radius: 0; box-shadow: none; padding: 2px 4px; `,
    "flat-dark": `background-color: #111111; color: #eeeeee; border: 1px solid #555555; border-radius: 2px; box-shadow: none; padding: 3px 6px; `,
    dotted: `background-color: #ffffff; color: #333333; border: 1px dotted #8a6d3b; border-radius: 0; box-shadow: none; padding: 3px 6px; `,
    terminal: `background-color: #000000; color: #00ff41; border: 1px solid #008f11; border-radius: 0; box-shadow: none; font-family: var(--font-courier); caret-color: #00ff41; padding: 2px 6px; `
  };
  var HR = {
    rainbow: "border: 0; height: 4px; background-image: var(--grad-rainbow); ",
    soft: "border: 0; height: 1px; background-color: #cfdcea; ",
    neon: "border: 0; height: 2px; background-color: #00e5ff; box-shadow: 0 0 8px #00e5ff; ",
    groove: "border: 0; border-top: 1px solid #808080; border-bottom: 1px solid #ffffff; height: 0; ",
    dotted: "border: 0; border-top: 1px dotted #8a6d3b; height: 0; ",
    thin: "border: 0; border-top: 1px solid #cccccc; height: 0; ",
    dashed: "border: 0; border-top: 1px dashed #008f11; height: 0; ",
    orange: "border: 0; height: 3px; background-color: #ff6600; ",
    hearts: "border: 0; height: 14px; background-image: var(--bg-tile-hearts); background-repeat: repeat-x; "
  };
  function tableCss(kind, S) {
    switch (kind) {
      case "bevel":
        return [`${S.tables} { background-color: #ffffff; color: #000000; border: 2px inset #ffffff; border-collapse: separate; }`, `${S.tables} th { background-color: #000080; color: #ffffff; border: 1px solid #c0c0c0; }`, `${S.tables} td { border: 1px solid #c0c0c0; }`];
      case "forum":
        return [`${S.tables} { background-color: #ffffff; color: #333333; border: 1px solid #a9b8c2; }`, `${S.tables} th { background-image: var(--grad-navy-header); background-color: #5c7099; color: #ffffff; border: 1px solid #3d4f6e; }`, `${S.tables} td { border: 1px solid #d3dce8; }`, `${S.tables} tr:nth-child(even) td { background-color: #e5edf5; }`];
      case "dark":
        return [`${S.tables} { background-color: #111111; color: #dddddd; border: 1px solid #444444; }`, `${S.tables} th { background-color: #222222; color: #ffffff; border: 1px solid #444444; }`, `${S.tables} td { border: 1px solid #333333; }`];
      case "terminal":
        return [`${S.tables} { background-color: #000000; color: #00ff41; border: 1px solid #00ff41; }`, `${S.tables} th, ${S.tables} td { border: 1px dashed #008f11; }`];
      case "rounded":
        return [`${S.tables} { background-color: #ffffff; color: #333333; border: 1px solid #cfdcea; border-radius: 8px; }`, `${S.tables} th { background-color: #e8f1fa; color: #1f6fbf; border-bottom: 2px solid #cfdcea; }`, `${S.tables} td { border-bottom: 1px solid #eef3f8; }`];
      case "lines":
        return [`${S.tables} { background-color: #ffffff; color: #000000; border: 1px solid #cccccc; }`, `${S.tables} th { background-color: #eeeeee; color: #000000; border: 1px solid #cccccc; }`, `${S.tables} td { border: 1px solid #dddddd; }`];
      default:
        return [`${S.tables} th { border-bottom: 1px solid #c9b99b; color: #5a6b4a; }`, `${S.tables} td { border-bottom: 1px dotted #c9b99b; }`];
    }
  }
  function selectorsFromSummary(data = {}) {
    const landmarks = data.landmarks || [];
    const sel = (role, fallback) => {
      const ls2 = landmarks.filter((l) => l.role === role).map((l) => l.selector);
      return ls2.length ? [...new Set(ls2)].join(", ") : fallback;
    };
    const nav = sel("nav", "nav, [role=navigation]");
    const buttons = [.../* @__PURE__ */ new Set([...(data.buttons || []).map((b) => b.selector), "button", "input[type=submit]", "input[type=button]", "[role=button]"])].join(", ");
    return {
      header: sel("header", "header, [role=banner]"),
      nav,
      navLinks: each(nav, " a"),
      main: sel("main", "main, [role=main], #content, article"),
      sidebar: sel("sidebar", "aside, [role=complementary]"),
      footer: sel("footer", "footer, [role=contentinfo]"),
      search: sel("search", "form[role=search]"),
      buttons,
      inputs: "input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color]), select, textarea",
      headings: "h1, h2, h3, h4, h5, h6",
      tables: "table"
    };
  }
  function renderPack(styleId, data = {}, { maxNavIcons = 16, maxNavLinks = 40 } = {}) {
    const T = THEMES[styleId];
    if (!T) return { css: "", applyClass: [], styleId, notes: ["unknown style"] };
    const S = selectorsFromSummary(data);
    const R = [];
    const applyClass = [];
    const push = (sel, body) => body.trim() && R.push(`${sel} { ${body.trim()} }`);
    push("body", decl("background-color", T.page.bg) + decl("background-image", T.page.bgImage || "none") + decl("background-repeat", T.page.bgRepeat) + decl("background-attachment", T.page.bgImage ? "fixed" : null) + decl("color", T.page.text) + decl("font-family", T.page.font) + decl("font-size", T.page.size) + decl("cursor", T.page.cursor));
    push("a", decl("color", T.link.color) + decl("text-decoration", T.link.decoration || "underline") + decl("font-weight", T.link.weight));
    push("a:visited", decl("color", T.link.visited));
    push("a:hover", decl("color", T.link.hover) + decl("background-color", T.link.hoverBg));
    const H = T.heading;
    let shadow = H.shadow;
    if (H.rainbow) shadow = "2px 2px 0 #ff00ff, 4px 4px 0 #00ffff, 6px 6px 0 #ffff00";
    push(S.headings, decl("font-family", H.font) + decl("color", H.color) + decl("text-shadow", shadow) + decl("text-transform", H.transform) + decl("letter-spacing", H.spacing) + decl("font-weight", H.weight) + decl("font-style", H.style) + "background-image: none; ");
    if (H.sizeScale) push("h1", `font-size: ${Math.round(28 * H.sizeScale)}px; `) && push("h2", `font-size: ${Math.round(20 * H.sizeScale)}px; `) && push("h3", `font-size: ${Math.round(16 * H.sizeScale)}px; `);
    if (H.prefix) push(each(S.headings, "::before"), `content: "${esc(H.prefix)}"; `);
    push(S.header, box(T.header));
    push(each(S.header, " a") + ", " + each(S.header, " a:visited"), decl("color", T.header.text || "inherit"));
    push(S.nav, box({ bg: T.nav.bg === "transparent" ? null : T.nav.bg, text: T.nav.text, border: T.nav.border, padding: T.nav.dense ? "2px 4px" : "4px 6px", font: T.nav.font }));
    const linkStyle = NAV_LINK[T.nav.link] || NAV_LINK.plain;
    const navs = (data.landmarks || []).filter((l) => l.role === "nav");
    const navEntries = navs.length ? navs.map((l) => ({ selector: l.selector, links: l.links || 0 })) : splitSelectorList(S.nav).map((sel) => ({ selector: sel, links: 0 }));
    const iconNavs = /* @__PURE__ */ new Set();
    for (const n of navEntries) {
      const links = `${n.selector} a`;
      if (n.links > maxNavLinks) {
        push(`${links}, ${links}:visited`, decl("color", T.nav.text) + "text-decoration: none; " + decl("font-family", T.nav.font));
        continue;
      }
      push(`${links}, ${links}:visited`, linkStyle(T) + (T.nav.icon ? ICON_SLOT : ""));
      if (T.nav.link === "bevel") push(`${links}:active`, "border-style: inset; ");
      if (T.nav.link === "bracket") {
        push(`${links}::before`, 'content: "["; color: #008f11; ');
        push(`${links}::after`, 'content: "]"; color: #008f11; ');
      }
      if (T.nav.icon) iconNavs.add(n.selector);
    }
    if (T.nav.icon && iconNavs.size) {
      const seen = /* @__PURE__ */ new Set();
      const iconRules = [];
      const noIcon = [];
      for (const l of data.navLinks || []) {
        if (!iconNavs.has(l.nav) || !l.href || seen.has(l.nav + "|" + l.href)) continue;
        seen.add(l.nav + "|" + l.href);
        const sel = `${l.nav} a[href="${esc(l.href)}"]`;
        if (l.hasIcon || !l.text) noIcon.push(sel);
        else if (iconRules.length < maxNavIcons) iconRules.push(`${sel} { background-image: var(--icon-${iconForText(l.text, l.href, T.nav.icon)}); }`);
      }
      for (const nav of iconNavs) R.push(`${nav} a { background-image: var(--icon-${T.nav.icon}); }`);
      R.push(...iconRules);
      if (noIcon.length) R.push(`${noIcon.join(", ")} { background-image: none; padding-left: 8px; }`);
    }
    push(S.main, box({ ...T.main, bgImage: T.main.bgImage || "none" }) + (T.main.narrow ? `max-width: ${T.main.narrow}; margin-left: auto; margin-right: auto; ` : ""));
    push(S.sidebar, box({ ...T.sidebar, bgImage: "none" }));
    push(each(S.sidebar, " > div") + ", " + each(S.sidebar, " > section") + ", " + each(S.sidebar, " > ul"), decl("background-color", T.sidebar.bg) + decl("color", T.sidebar.text) + decl("border", T.sidebar.border) + decl("border-radius", T.sidebar.radius) + "box-shadow: none; ");
    push(each(S.sidebar, " a") + ", " + each(S.sidebar, " a:visited"), decl("color", T.link.color));
    push(S.footer, box({ ...T.footer, padding: T.footer.padding || "10px 14px" }));
    push(each(S.footer, " a") + ", " + each(S.footer, " a:visited"), decl("color", T.footer.text));
    push(S.buttons, BUTTON[T.button] || BUTTON.bevel);
    if (BUTTON_HOVER[T.button]) push(each(S.buttons, ":hover"), BUTTON_HOVER[T.button]);
    for (const b of (data.buttons || []).slice(0, 8)) {
      if (b.hasIcon || b.count > maxNavLinks || !b.text) continue;
      push(b.selector, BUTTON[T.button] || BUTTON.bevel);
      const icon = b.text.length <= 24 ? iconForText(b.text, "", null) : null;
      if (icon) push(b.selector, `background-image: var(--icon-${icon}); background-repeat: no-repeat; background-position: 6px center; background-size: 16px 16px; padding-left: 26px; `);
    }
    push(S.inputs, INPUT[T.input] || INPUT.flat);
    const I = T.image;
    push("img", decl("border", I.border) + decl("border-radius", I.radius) + decl("box-shadow", I.shadow) + decl("padding", I.padding) + decl("background-color", I.bg) + decl("filter", I.filter));
    R.push(...tableCss(T.table, S));
    if (T.table === "forum") applyClass.push({ selector: "table", className: "retro-table-rows" });
    const X = T.extras || {};
    if (X.hr && HR[X.hr]) push("hr", HR[X.hr]);
    if (X.bullets) push(each(S.main, " li"), `list-style: none; background-image: var(--icon-${X.bullets}); background-repeat: no-repeat; background-position: 0 3px; background-size: 12px 12px; padding-left: 16px; `);
    if (X.counter) push(each(S.footer, "::before"), 'content: "You are visitor number 0013370"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: max-content; max-width: 100%; margin: 0 auto 8px auto; background-color: #000000; color: #00ff00; font-family: var(--font-courier); font-weight: bold; font-size: 14px; letter-spacing: 2px; border: 2px inset #808080; padding: 2px 8px; text-shadow: 0 0 4px #00ff00; ');
    if (X.underConstruction) push(each(S.main, "::before"), 'content: "UNDER CONSTRUCTION"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: 100%; height: auto; align-self: start; box-sizing: border-box; background-image: var(--bg-tile-hazard); background-color: #ffcc00; color: #000000; font-family: var(--font-arial-black); font-weight: bold; font-size: 12px; letter-spacing: 2px; line-height: 1.4; text-align: center; padding: 3px; margin-bottom: 10px; text-shadow: 1px 1px 0 #ffcc00, -1px -1px 0 #ffcc00, 1px -1px 0 #ffcc00, -1px 1px 0 #ffcc00; ');
    if (X.marquee) {
      push(each(S.header, "::after"), `content: "${esc(X.marquee)}"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: 100%; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-indent: 100%; animation: retro-marquee-text 22s linear infinite; font-family: var(--font-verdana); font-weight: bold; font-size: 12px; color: #ffff00; background-color: #000000; padding: 2px 0; margin-top: 6px; `);
      R.push("@keyframes retro-marquee-text { from { text-indent: 100%; } to { text-indent: -150%; } }");
    }
    if (X.badge) push(each(S.header, "::after"), `content: "${esc(X.badge)}"; display: inline-block; background-image: var(--grad-glossy-orange); color: #ffffff; font-family: var(--font-trebuchet); font-weight: bold; font-size: 10px; padding: 2px 7px; border-radius: 8px; margin-left: 8px; vertical-align: middle; text-shadow: 0 -1px 0 rgba(0,0,0,.3); `);
    if (X.statusBar) push(each(S.footer, "::after"), 'content: "Done                                          My Computer"; display: block; white-space: pre; border: 1px inset #ffffff; background-color: #c0c0c0; color: #000000; padding: 2px 6px; margin-top: 6px; font-family: var(--font-ms-sans); font-size: 11px; ');
    if (X.scanlines) push("body::after", 'content: ""; position: fixed; inset: 0; pointer-events: none; background-image: var(--bg-tile-scanlines); z-index: 2147483000; ');
    if (X.cursorBlink) push("h1::after", 'content: "_"; animation: retro-blink 1s steps(2, start) infinite; ');
    if (X.skipIntro) push(each(S.header, "::after"), 'content: "skip intro \u25B8"; float: right; font-family: var(--font-arial); font-size: 11px; color: #ccff00; text-transform: lowercase; ');
    if (X.trafficLights) push(each(S.header, "::before"), 'content: ""; display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: #ff5f57; box-shadow: 18px 0 0 #febc2e, 36px 0 0 #28c840; margin-right: 44px; vertical-align: middle; ');
    if (X.categoryBars) push("h2", `background-color: ${T.nav.bg === "transparent" ? "#eeeeee" : T.nav.bg}; color: ${T.heading.color}; padding: 2px 6px; border-left: 6px solid ${T.link.hover}; `);
    if (X.sparkleHeading) push("h1", "background-image: var(--bg-tile-glitter); ");
    return { css: R.join("\n"), applyClass, styleId, selectors: S };
  }

  // userscript/src/repair/geometry.js
  var MEDIA = "video, audio, canvas, iframe, embed, object";
  var BUTTONS = 'button, [role=button], input[type=submit], input[type=button], a[class*="btn"], a[class*="button"], a[class*="cta"]';
  var TEXT_INPUTS = "input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color]):not([type=image]), select, textarea";
  var SKIP = /* @__PURE__ */ new Set(["script", "style", "noscript", "template", "head", "meta", "link", "title", "br", "wbr", "retro-web-panel", "svg", "path", "g", "use", "defs", "symbol"]);
  var GEOMETRY_PROPS = /^(margin(-.*)?|padding(-.*)?|border|border-(top|right|bottom|left)|border(-(top|right|bottom|left))?-width|gap|row-gap|column-gap|(min-|max-)?(width|height)|display|position|top|left|right|bottom|inset(-.*)?|flex(-.*)?|transform|font-size|line-height|box-sizing|vertical-align|letter-spacing|text-indent|float|white-space|align-.*|justify-.*)$/;
  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.trim();
  }
  function visibleText(el) {
    return (el.textContent || el.value || "").replace(/\s+/g, " ").trim();
  }
  var SECTION_TAGS = /* @__PURE__ */ new Set(["html", "body", "main", "article", "section", "aside", "header", "footer", "nav"]);
  function mediaRoots(doc) {
    const roots = /* @__PURE__ */ new Set();
    for (const m of doc.querySelectorAll(MEDIA)) {
      const p = m.parentElement;
      if (!p || p === doc.body || SECTION_TAGS.has(p.localName)) continue;
      roots.add(p);
      const gp = p.parentElement;
      if (gp && gp !== doc.body && !SECTION_TAGS.has(gp.localName) && (gp.textContent || "").trim().length < 300) roots.add(gp);
    }
    return [...roots];
  }
  function buildAllowList(doc, data = {}, overrides = {}) {
    const M = createInspectorMeasure(doc, overrides);
    const allowed = /* @__PURE__ */ new Set();
    const roots = mediaRoots(doc);
    const inMedia = (el) => roots.some((r) => r.contains(el));
    const small = (el) => {
      const r = M.rect(el);
      return r.width <= 48 && r.height <= 48;
    };
    const positioned = (el) => /absolute|fixed|sticky/.test(M.style(el).position || "");
    const q = (sel) => {
      try {
        return [...doc.querySelectorAll(sel)];
      } catch {
        return [];
      }
    };
    if (doc.documentElement) allowed.add(doc.documentElement);
    if (doc.body) allowed.add(doc.body);
    const landmarks = [];
    for (const l of data.landmarks || []) {
      for (const el of q(l.selector)) {
        if (inMedia(el) || el.matches(MEDIA)) continue;
        allowed.add(el);
        landmarks.push({ role: l.role, el });
      }
    }
    for (const { role, el } of landmarks) {
      if (role !== "nav") continue;
      for (const a of el.querySelectorAll("a")) {
        if (visibleText(a).length >= 2 && !a.querySelector("svg, img") && !positioned(a)) allowed.add(a);
      }
    }
    for (const b of q(BUTTONS)) {
      if (inMedia(b) || positioned(b) || small(b)) continue;
      if (visibleText(b).length < 2 || b.querySelector("svg, img") && visibleText(b).length < 2) continue;
      allowed.add(b);
    }
    for (const i of q(TEXT_INPUTS)) if (!inMedia(i) && !positioned(i)) allowed.add(i);
    for (const hr of q("hr")) allowed.add(hr);
    for (const h of q("h1, h2, h3, h4, h5, h6")) if (visibleText(h).length >= 2 && !h.closest("nav") && !inMedia(h) && !positioned(h)) allowed.add(h);
    const mains = landmarks.filter((l) => l.role === "main").map((l) => l.el);
    for (const main2 of mains) for (const li of main2.querySelectorAll("li")) if (ownText(li).length >= 2 && !li.closest("nav") && !inMedia(li)) allowed.add(li);
    return { allowed, isAllowed: (el) => allowed.has(el), mediaRoots: roots, landmarks };
  }
  function snapshotGeometry(doc, overrides = {}, { limit = 3e3, isAllowed = () => false } = {}) {
    const M = createInspectorMeasure(doc, overrides);
    const roots = mediaRoots(doc);
    const inMedia = (el) => roots.some((r) => r.contains(el));
    const entries = /* @__PURE__ */ new Map();
    const parents = /* @__PURE__ */ new Map();
    const all = [...doc.querySelectorAll("body *")].filter((e) => !SKIP.has(e.localName) && !e.closest("retro-web-panel")).slice(0, limit);
    const gapsByParent = /* @__PURE__ */ new Map();
    for (const el of all) {
      const st = M.style(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = M.rect(el);
      if (r.width <= 0 || r.height <= 0) continue;
      const pos = st.position || "static";
      const e = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        small: r.width <= 48 && r.height <= 48,
        positioned: /absolute|fixed|sticky/.test(pos),
        inMedia: inMedia(el),
        allowed: isAllowed(el)
      };
      e.candidate = !e.allowed && (e.small || e.positioned || e.inMedia);
      entries.set(el, e);
      const p = el.parentElement;
      if (p) {
        if (e.candidate && !parents.has(p)) {
          const ps = M.style(p);
          parents.set(p, { padL: parseFloat(ps.paddingLeft) || 0, padT: parseFloat(ps.paddingTop) || 0, bL: parseFloat(ps.borderLeftWidth) || 0, bT: parseFloat(ps.borderTopWidth) || 0, left: M.rect(p).left, top: M.rect(p).top });
        }
        let g = gapsByParent.get(p);
        if (!g) {
          g = { tag: el.localName, rects: [], mixed: false };
          gapsByParent.set(p, g);
        }
        if (g.tag !== el.localName) g.mixed = true;
        g.rects.push(r);
      }
    }
    const unevenParents = /* @__PURE__ */ new Set();
    for (const [p, g] of gapsByParent) {
      if (g.mixed || g.rects.length < 3) continue;
      const rs = g.rects;
      const vertical = rs.every((r, i) => i === 0 || r.top >= rs[i - 1].bottom - 2);
      const horizontal = !vertical && rs.every((r, i) => i === 0 || r.left >= rs[i - 1].right - 2);
      if (!vertical && !horizontal) continue;
      const gaps = rs.slice(1).map((r, i) => vertical ? r.top - rs[i].bottom : r.left - rs[i].right);
      if (Math.max(...gaps) - Math.min(...gaps) > 12) unevenParents.add(p);
    }
    return { entries, parents, unevenParents, viewport: M.viewport };
  }
  function findGeometryViolations(snapshot, doc, overrides = {}, { sizeTolerance = 4, moveTolerance = 6, mediaTolerance = 2 } = {}) {
    const M = createInspectorMeasure(doc, overrides);
    const out = [];
    const parentNow = /* @__PURE__ */ new Map();
    for (const [el, b] of snapshot.entries) {
      if (!b.candidate || !el.isConnected) continue;
      const st = M.style(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = M.rect(el);
      if (r.width <= 0 && r.height <= 0) continue;
      const tol = b.inMedia ? mediaTolerance : sizeTolerance;
      const dw = r.width - b.width;
      const dh = r.height - b.height;
      let kind = null;
      if (Math.abs(dw) > tol || Math.abs(dh) > tol) kind = "resized";
      else {
        const p = el.parentElement;
        const pb = p && snapshot.parents.get(p);
        if (pb) {
          let pn = parentNow.get(p);
          if (!pn) {
            const ps = M.style(p);
            const pr = M.rect(p);
            pn = { padL: parseFloat(ps.paddingLeft) || 0, padT: parseFloat(ps.paddingTop) || 0, bL: parseFloat(ps.borderLeftWidth) || 0, bT: parseFloat(ps.borderTopWidth) || 0, left: pr.left, top: pr.top };
            parentNow.set(p, pn);
          }
          const expectX = pn.padL - pb.padL + (pn.bL - pb.bL);
          const expectY = pn.padT - pb.padT + (pn.bT - pb.bT);
          const relBeforeX = b.left + b.width / 2 - pb.left;
          const relBeforeY = b.top + b.height / 2 - pb.top;
          const relNowX = r.left + r.width / 2 - pn.left;
          const relNowY = r.top + r.height / 2 - pn.top;
          const dx = relNowX - relBeforeX - expectX;
          const dy = relNowY - relBeforeY - expectY;
          const mt = b.inMedia ? mediaTolerance : moveTolerance;
          if (Math.abs(dx) > mt || Math.abs(dy) > mt) kind = "moved";
          if (kind) out.push({ el, kind, dx: Math.round(dx), dy: Math.round(dy), dw: Math.round(dw), dh: Math.round(dh), inMedia: b.inMedia });
          continue;
        }
      }
      if (kind) out.push({ el, kind, dw: Math.round(dw), dh: Math.round(dh), inMedia: b.inMedia });
    }
    return out;
  }
  function serialize(nodes, indent = "") {
    const lines = [];
    for (const n of nodes) {
      if (n.type === "at") {
        if (n.statement) continue;
        if (n.rules) lines.push(`${indent}@${n.name} ${n.prelude} {`, ...serialize(n.rules, indent + "  "), `${indent}}`);
        else if (n.declarations && n.declarations.length) lines.push(`${indent}@${n.name} { ${n.declarations.map((d) => `${d.prop}: ${d.value}${d.important ? " !important" : ""};`).join(" ")} }`);
      } else if (n.declarations && n.declarations.length) {
        lines.push(`${indent}${n.selector} { ${n.declarations.map((d) => `${d.prop}: ${d.value}${d.important ? " !important" : ""};`).join(" ")} }`);
      }
    }
    return lines;
  }
  function rollbackGeometry(css, violations, doc, { isLandmark = () => false } = {}) {
    if (!css || !violations.length) return { css, removed: [] };
    const { rules } = parseCss(css);
    const removed = [];
    const targets = [];
    for (const v of violations) {
      targets.push(v.el);
      const p = v.el.parentElement;
      if (p && !isLandmark(p)) targets.push(p);
    }
    const visit = (nodes, inKeyframes) => {
      for (const n of nodes) {
        if (n.type === "at") {
          if (n.rules && !n.keyframes) visit(n.rules, false);
          continue;
        }
        if (inKeyframes || !n.declarations) continue;
        if (/::?(before|after|marker)/.test(n.selector)) continue;
        let hit = false;
        for (const part of n.selector.split(",")) {
          const probe = probeSelector(part.trim());
          try {
            if (targets.some((t) => t.matches(probe))) {
              hit = true;
              break;
            }
          } catch {
          }
        }
        if (!hit) continue;
        const before = n.declarations.length;
        const dropped = n.declarations.filter((d) => GEOMETRY_PROPS.test(d.prop)).map((d) => d.prop);
        n.declarations = n.declarations.filter((d) => !GEOMETRY_PROPS.test(d.prop));
        if (n.declarations.length !== before) removed.push({ selector: n.selector, props: [...new Set(dropped)] });
      }
    };
    visit(rules, false);
    return { css: serialize(rules).join("\n"), removed };
  }
  async function enforceGeometry({ doc, snapshot, slots, slotNames = ["design", "patch", "fallback"], measure, isLandmark, rounds = 3, settle: settle2 = () => Promise.resolve() }) {
    const removedAll = [];
    let violations = [];
    for (let i = 0; i < rounds; i++) {
      violations = findGeometryViolations(snapshot, doc, measure);
      if (!violations.length) break;
      let changed = false;
      for (const name of slotNames) {
        const slot = slots[name];
        if (!slot || !slot.css) continue;
        const r = rollbackGeometry(slot.css, violations, doc, { isLandmark });
        if (r.removed.length) {
          slot.set(r.css);
          removedAll.push(...r.removed.map((x) => ({ ...x, slot: name })));
          changed = true;
        }
      }
      if (!changed) break;
      await settle2();
    }
    return { removed: removedAll, remaining: violations.map((v) => ({ kind: v.kind, dx: v.dx, dy: v.dy, dw: v.dw, dh: v.dh, inMedia: v.inMedia })) };
  }

  // userscript/src/repair/fallbacks.js
  var BLOCKISH = /* @__PURE__ */ new Set(["div", "p", "section", "article", "nav", "header", "footer", "main", "aside", "ul", "ol", "form", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "figure", "fieldset"]);
  function displayFor(selector, doc) {
    let tag = null;
    try {
      const el = doc && doc.querySelector(selector);
      tag = el && el.localName;
    } catch {
    }
    if (!tag) return "block";
    if (tag === "li") return "list-item";
    if (tag === "table") return "table";
    if (tag === "tr") return "table-row";
    if (/^t[dh]$/.test(tag)) return "table-cell";
    if (BLOCKISH.has(tag)) return "block";
    return "inline-block";
  }
  function buildFallbackCss(issues, { doc } = {}) {
    const rules = [];
    const fixed = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (issue, css) => {
      if (seen.has(css)) return;
      seen.add(css);
      rules.push(css);
      fixed.push({ type: issue.type, selector: issue.selector });
    };
    let overflowRoot = false;
    for (const i of issues) {
      const sel = i.selector;
      switch (i.type) {
        case "icon-off-center":
          if (i.background) push(i, `${sel} { background-position: 4px center; background-size: 16px 16px; padding-left: 24px; }`);
          else {
            const container = sel.replace(/\s*>\s*(svg|img)(:nth-of-type\(\d+\))?$/, "");
            if (container !== sel) push(i, `${container} { display: inline-flex; align-items: center; justify-content: center; gap: 6px; line-height: normal; }`);
            push(i, `${sel} { display: inline-block; vertical-align: middle; margin: 0; flex: none; }`);
          }
          break;
        case "icon-overlaps-text":
          push(i, `${sel} { padding-left: 24px; background-position: 4px center; background-size: 16px 16px; }`);
          break;
        case "icon-duplicate":
          push(i, `${sel} { background-image: none; }`);
          break;
        case "icon-missing":
          if (sel.startsWith("--icon-")) push(i, `:root { ${sel}: var(--icon-placeholder); }`);
          else if (/zero-size/.test(i.detail)) push(i, `${sel} { display: inline-block; width: 16px; height: 16px; min-width: 16px; min-height: 16px; }`);
          else if (/broken image/.test(i.detail)) push(i, `${sel} { background-image: var(--icon-placeholder); background-repeat: no-repeat; background-position: center; background-size: 16px 16px; min-width: 16px; min-height: 16px; }`);
          else push(i, `${sel} { background-image: var(--icon-placeholder); background-repeat: no-repeat; background-position: 4px center; background-size: 16px 16px; }`);
          break;
        case "overflow-x":
          if (sel === "html") {
            if (!overflowRoot) push(i, `html, body { overflow-x: hidden; max-width: 100%; }`);
            overflowRoot = true;
          } else push(i, `${sel} { max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; }`);
          break;
        case "text-clipped":
          push(i, `${sel} { overflow: visible; white-space: normal; overflow-wrap: anywhere; height: auto; max-height: none; }`);
          break;
        case "overlap":
          push(i, `${sel} { position: relative; transform: none; margin-bottom: 8px; clear: both; }`);
          break;
        case "contrast-low": {
          const bg = parseColor(i.bg) || { r: 255, g: 255, b: 255, a: 1 };
          const black = contrastRatio({ r: 0, g: 0, b: 0 }, bg);
          const white = contrastRatio({ r: 255, g: 255, b: 255 }, bg);
          const color = black >= white ? "#000000" : "#ffffff";
          const extra = Math.max(black, white) < 4.5 ? ` background-color: ${color === "#000000" ? "#ffffff" : "#000000"};` : "";
          push(i, `${sel} { color: ${color}; text-shadow: none;${extra} }`);
          break;
        }
        case "font-too-small":
          push(i, `${sel} { font-size: 12px; }`);
          break;
        case "invisible":
          if (sel === "body") break;
          push(i, `${sel} { display: ${displayFor(sel, doc)}; visibility: visible; opacity: 1; width: auto; height: auto; min-width: 1em; min-height: 1em; position: static; clip-path: none; transform: none; font-size: 12px; }`);
          break;
        case "edge-touch":
          push(i, `${sel} { padding-left: 8px; padding-right: 8px; }`);
          break;
        case "spacing-inconsistent":
          break;
        case "padding-collapsed":
          push(i, `${sel} { padding: 4px 8px; }`);
          break;
        case "padding-excessive":
          push(i, `${sel} { padding-left: 16px; padding-right: 16px; }`);
          break;
        default:
          break;
      }
    }
    return { css: rules.join("\n"), fixed };
  }

  // userscript/src/repair/loop.js
  function settle(doc, ms) {
    const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
    return new Promise((resolve) => {
      const done = () => setTimeout(resolve, ms);
      if (win && typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(done);
      else done();
    });
  }
  function trimCssForReport(css, issues, maxTokens = 1400) {
    if (estimateTokens(css) <= maxTokens) return css;
    const { rules } = parseCss(css);
    const words = /* @__PURE__ */ new Set();
    for (const i of issues) for (const w of String(i.selector).split(/[\s>+~.#:()\[\],]+/)) if (w && w.length > 1) words.add(w.toLowerCase());
    const lines = css.split("\n").filter((l) => l.trim());
    const scored = lines.map((l, idx) => {
      const sel = l.split("{")[0].toLowerCase();
      let score = 0;
      for (const w of words) if (sel.includes(w)) score += 2;
      return { l, idx, score };
    });
    void rules;
    const keep = [];
    let tokens2 = 0;
    for (const s of [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx)) {
      const t = estimateTokens(s.l);
      if (tokens2 + t > maxTokens) continue;
      keep.push(s);
      tokens2 += t;
    }
    return keep.sort((a, b) => a.idx - b.idx).map((s) => s.l).join("\n");
  }
  async function runRepairLoop({ client, doc, designCss, style, settings, baseline, iconVars = [], slots, signal, status = () => {
  }, measure, inspect = inspectPage, patcher = generatePatch, settleMs = 250, validateOptions = {}, unevenParents = null, ignore = null }) {
    const maxRounds = Math.max(0, Number(settings.maxRepairRounds) || 0);
    const opts = { baseline, iconVars, measure, tolerance: settings.inspectTolerance, unevenParents, ignore };
    let patchCss = "";
    const rounds = [];
    let report = inspect(doc, opts);
    const initial = report;
    for (let round = 1; round <= maxRounds; round++) {
      if (!report.issues.length) break;
      if (signal && signal.aborted) break;
      status(`repair round ${round}/${maxRounds}: ${report.total} issue(s)\u2026`);
      const current = trimCssForReport([designCss, patchCss].filter(Boolean).join("\n"), report.issues);
      let patch;
      try {
        patch = await patcher({
          client,
          doc,
          css: current,
          reportText: report.text,
          style,
          settings,
          signal,
          validateOptions,
          onChunk: ({ css }) => slots && slots.patch.set([patchCss, css].filter(Boolean).join("\n"))
        });
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        rounds.push({ round, before: report.total, after: report.total, kept: 0, error: String(e && e.message) });
        break;
      }
      if (patch.css) patchCss = [patchCss, patch.css].filter(Boolean).join("\n");
      if (slots) slots.patch.set(patchCss);
      await settle(doc, settleMs);
      const next = inspect(doc, opts);
      rounds.push({ round, before: report.total, after: next.total, kept: patch.kept, dropped: patch.dropped.length });
      report = next;
      if (!patch.kept) break;
    }
    let fallbackCss = "";
    let fixed = [];
    if (report.issues.length) {
      const fb = buildFallbackCss(report.issues, { doc });
      let v = validateCss(fb.css, { doc, mode: "patch", ...validateOptions });
      const refused = v.dropped.filter((d) => /too-broad/.test(d.reason) && /^padding/.test(d.prop || ""));
      if (refused.length) {
        const extra = [...new Set(refused.map((d) => d.selector))].map((sel) => `${sel} { background-image: none; }`).join("\n");
        v = validateCss(fb.css + "\n" + extra, { doc, mode: "patch", ...validateOptions });
        fb.fixed.push(...refused.map((d) => ({ type: "icon-overlaps-text", selector: d.selector, note: "icon removed (too many elements for padding)" })));
      }
      fallbackCss = v.css;
      fixed = fb.fixed;
      if (slots) slots.fallback.set([slots.fallback.css, fallbackCss].filter(Boolean).join("\n"));
      if (fallbackCss) {
        await settle(doc, settleMs);
        report = inspect(doc, opts);
      }
    }
    return {
      patchCss,
      fallbackCss,
      report: { text: report.text, issues: report.issues.map(({ type, selector, detail }) => ({ type, selector, detail })), counts: report.counts, total: report.total, initial: initial.total, rounds, fixedByFallback: fixed },
      remaining: report.total
    };
  }

  // userscript/src/pipeline.js
  function createPipeline({ doc, hostname, slots, panel, setState: setState2, getSettings: getSettings2, hooks = {} }) {
    let client = null;
    let clientKey = null;
    let controller = null;
    let appliedClasses = [];
    let lastResult = null;
    let currentAllow = null;
    function status(text, kind) {
      panel && panel.setStatus(text, kind);
    }
    function resolveModel(settings) {
      let customModel = settings.customModel || null;
      if (!customModel && settings.customModelUrl) {
        const url = settings.customModelUrl.replace(/\/+$/, "");
        customModel = { model: url, model_id: url.split("/").pop(), model_lib: settings.customModelLib || void 0 };
      }
      return { customModel, modelId: customModel ? customModel.model_id : settings.modelId };
    }
    function getClient(settings) {
      const { customModel, modelId } = resolveModel(settings);
      const key = [settings.hostUrl, modelId, JSON.stringify(customModel), settings.contextWindow].join("|");
      if (client && clientKey === key) return client;
      if (client) client.dispose();
      clientKey = key;
      client = new ModelClient({
        doc,
        hostUrl: settings.hostUrl,
        modelId,
        customModel,
        contextWindow: settings.contextWindow,
        onProgress: ({ text, progress }) => {
          setState2("loading-model", { text, progress });
          status(shortenProgress(text), "");
          panel && panel.setProgress(progress);
        }
      });
      return client;
    }
    async function connectClient(c, settings, userGesture) {
      const rec = getSiteRecord(hostname) || {};
      const popupOk = settings.popupFallback !== false;
      const needGesture = () => new ModelUnavailableError("needs-gesture", "this site's security policy blocks the hidden model frame \u2014 press Redesign to run the model in a small popup window");
      if (rec.frameBlocked && popupOk) {
        if (!userGesture) throw needGesture();
        return c.connect({ mode: "popup" });
      }
      try {
        return await c.connect({ mode: "frame" });
      } catch (e) {
        if (!(e && e.code === "host-blocked" && popupOk)) throw e;
        saveSiteRecord(hostname, { frameBlocked: true });
        if (!userGesture) throw needGesture();
        status("frame blocked by this site \u2014 opening the model in a popup window\u2026");
        return c.connect({ mode: "popup" });
      }
    }
    function clearApplied() {
      removeClassDirectives(appliedClasses);
      appliedClasses = [];
    }
    function applyDirectives(list) {
      const { applied } = validateApplyClass(list, { doc, classNames: libraryClassNames(), spacingAllowed: currentAllow });
      applyClassDirectives(applied);
      appliedClasses.push(...applied);
      return applied.map((a) => ({ selector: a.selector, className: a.className, count: a.count }));
    }
    function placeholderIconCss(requests, defined) {
      const lib = new Set(libraryIconNames());
      const lines = [];
      for (const r of requests) if (!lib.has(r.name) && !defined.has("--icon-" + r.name)) lines.push(`--icon-${r.name}: var(--icon-placeholder);`);
      return lines.length ? `:root { ${lines.join(" ")} }` : "";
    }
    function applyCached(record) {
      if (!record || !record.css) return false;
      clearApplied();
      slots.icons.set(record.iconCss || "");
      slots.design.set(record.css);
      slots.patch.set(record.patchCss || "");
      slots.fallback.set(record.fallbackCss || "");
      applyDirectives(record.applyClass || []);
      lastResult = record;
      return true;
    }
    function restore() {
      stop();
      clearApplied();
      slots.icons.clear();
      slots.design.clear();
      slots.patch.clear();
      slots.fallback.clear();
    }
    function stop() {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }
    async function runDesign({ styleId, userGesture = false } = {}) {
      stop();
      const settings = getSettings2();
      const ctl = controller = new AbortController();
      const signal = ctl.signal;
      const style = pickStyle(styleId || settings.style);
      const t0 = Date.now();
      panel && panel.setBusy(true);
      panel && panel.setStyle(style.id);
      try {
        clearApplied();
        slots.design.clear();
        slots.patch.clear();
        slots.fallback.clear();
        slots.icons.clear();
        setState2("designing", { style: style.id });
        status(`summarizing page\u2026`);
        const baseline = snapshotVisibility(doc);
        const summary = summarizePage(doc, { tokenBudget: settings.summaryTokenBudget });
        const mode = settings.designMode || "hybrid";
        const allow = buildAllowList(doc, summary.data);
        const geo = snapshotGeometry(doc, {}, { isAllowed: allow.isAllowed });
        const validateOptions = { spacingAllowed: allow.isAllowed };
        currentAllow = allow.isAllowed;
        const preexisting = settings.inspect !== false ? issueKeys(inspectPage(doc, { maxIssues: 200, tokenBudget: 50 })) : /* @__PURE__ */ new Set();
        const landmarkEls = new Set(allow.landmarks.map((l) => l.el));
        const rollbacks = [];
        const settle2 = (ms = 60) => new Promise((r) => (doc.defaultView || window).requestAnimationFrame(() => setTimeout(r, ms)));
        const guard = async () => {
          if (settings.geometryGuard === false) return;
          await settle2(30);
          const g = await enforceGeometry({ doc, snapshot: geo, slots, isLandmark: (el) => landmarkEls.has(el), settle: () => settle2(30) });
          rollbacks.push(...g.removed);
          return g;
        };
        let packCss = "";
        let packRules = 0;
        let quickFallbackCss = "";
        if (mode !== "model") {
          const pack = renderPack(style.id, summary.data);
          const v = validateCss(pack.css, { doc, mode: "design", ...validateOptions });
          packCss = v.css;
          packRules = v.kept;
          slots.design.set(packCss);
          applyDirectives(pack.applyClass);
          await guard();
          packCss = slots.design.css;
          saveSiteRecord(hostname, {
            css: packCss,
            patchCss: "",
            fallbackCss: "",
            iconCss: "",
            applyClass: appliedClasses.map((a) => ({ selector: a.selector, className: a.className })),
            style: style.id,
            stage: "pack",
            stats: { kept: packRules, dropped: v.dropped.length, ms: Date.now() - t0 }
          });
          let quick = null;
          if (settings.inspect !== false) {
            await new Promise((r) => setTimeout(r, 80));
            try {
              quick = await runRepairLoop({ client: null, doc, designCss: packCss, style, settings: { ...settings, maxRepairRounds: 0 }, baseline, iconVars: [], slots, signal, status: () => {
              }, settleMs: 60, validateOptions, unevenParents: geo.unevenParents, ignore: preexisting });
              await guard();
              quickFallbackCss = slots.fallback.css || "";
              saveSiteRecord(hostname, { fallbackCss: quickFallbackCss, report: quick.report, geometryRollbacks: rollbacks.slice() });
            } catch (e) {
              console.warn("[retro-web] quick fix pass failed", e);
            }
          }
          status(`${style.name} applied (${packRules} rules)${mode === "pack" ? "" : " \xB7 adding site-specific touches with the model\u2026"}`, "ok");
          if (mode === "pack") {
            const record2 = getSiteRecord(hostname);
            panel && panel.setReport(formatReport(record2));
            setState2("done", { style: style.id, rules: packRules, stage: "pack" });
            return record2;
          }
        }
        const c = getClient(settings);
        try {
          await connectClient(c, settings, userGesture);
          await c.load();
        } catch (e) {
          if (!packCss || e && e.name === "AbortError") throw e;
          const why = describeModelError(e);
          status(`${style.name} applied \xB7 model skipped: ${why}`, e && e.code === "needs-gesture" ? "err" : "ok");
          const record2 = getSiteRecord(hostname);
          panel && panel.setReport(formatReport(record2) + "\n\nMODEL: " + why);
          setState2("done", { style: style.id, rules: packRules, stage: "pack", modelSkipped: why });
          return record2;
        }
        if (signal.aborted) return null;
        panel && panel.setProgress(null);
        setState2("designing", { style: style.id });
        status(packCss ? `${style.name} applied \xB7 model adding touches\u2026` : `designing (${style.name})\u2026`);
        let rules = 0;
        const pendingIcons = [];
        const join = (a, b) => [a, b].filter(Boolean).join("\n");
        const design = await generateDesign({
          client: c,
          doc,
          summaryText: summary.text,
          style,
          settings,
          signal,
          enhance: !!packCss,
          validateOptions,
          onChunk: ({ css, applyClass, iconRequests: iconRequests2, result }) => {
            slots.design.set(join(packCss, css));
            if (applyClass.length) applyDirectives(applyClass);
            if (iconRequests2.length) pendingIcons.push(...iconRequests2);
            rules = result.kept;
            status(packCss ? `${style.name} applied \xB7 model added ${rules} rules\u2026` : `designing (${style.name})\u2026 ${rules} rules`);
          }
        });
        if (signal.aborted) return null;
        slots.design.set(join(packCss, design.css));
        await guard();
        design.css = slots.design.css;
        design.kept += packRules;
        const iconRequests = design.iconRequests;
        const referenced = new Set(design.iconVars);
        for (const r of iconRequests) referenced.add("--icon-" + r.name);
        let iconCss = "";
        let iconReport = { resolved: [], failed: [] };
        if (hooks.resolveIcons && iconRequests.length) {
          status(`resolving ${iconRequests.length} icon request(s)\u2026`);
          try {
            iconReport = await hooks.resolveIcons(iconRequests, { signal, settings });
            iconCss = iconReport.css || "";
          } catch (e) {
            console.warn("[retro-web] icon resolution failed", e);
          }
        }
        const definedVars = new Set(iconCss.match(/--icon-[\w-]+(?=\s*:)/g) || []);
        const placeholders = placeholderIconCss(iconRequests, definedVars);
        slots.icons.set([iconCss, placeholders].filter(Boolean).join("\n"));
        let patchCss = "";
        let fallbackCss = "";
        let report = null;
        if (settings.inspect !== false) {
          setState2("repairing", { style: style.id });
          status("inspecting layout\u2026");
          await new Promise((r) => setTimeout(r, settings.settleDelayMs || 0));
          const repairFn = hooks.repair || runRepairLoop;
          const rep = await repairFn({ client: c, doc, designCss: design.css, style, settings, baseline, iconVars: [...referenced], slots, signal, status, validateOptions, unevenParents: geo.unevenParents, ignore: preexisting });
          if (rep) {
            slots.patch.set(rep.patchCss || "");
            slots.fallback.set([quickFallbackCss, rep.fallbackCss || ""].filter(Boolean).join("\n"));
            await guard();
            patchCss = slots.patch.css;
            fallbackCss = slots.fallback.css;
            report = rep.report || null;
          }
        }
        if (signal.aborted) return null;
        const record = saveSiteRecord(hostname, {
          css: design.css,
          patchCss,
          fallbackCss,
          iconCss: slots.icons.css,
          applyClass: appliedClasses.map((a) => ({ selector: a.selector, className: a.className })),
          iconRequests,
          iconResults: (iconReport.results || []).map((r) => ({ name: r.name, source: r.source, alias: r.alias, reason: r.reason })),
          style: style.id,
          stage: "full",
          geometryRollbacks: rollbacks,
          report,
          stats: {
            promptTokens: design.promptTokens,
            outputChars: design.rawText.length,
            kept: design.kept,
            dropped: design.dropped.length,
            errors: design.errors.length,
            usage: design.usage || null,
            ms: Date.now() - t0,
            iconsResolved: iconReport.resolved.length,
            iconsFailed: iconReport.failed.length
          }
        });
        lastResult = record;
        const secs = ((Date.now() - t0) / 1e3).toFixed(0);
        const remaining = report ? report.total : 0;
        status(`done: ${style.name} \xB7 ${design.kept} rules \xB7 ${secs}s${report ? ` \xB7 issues ${report.initial}\u2192${remaining}` : ""}`, "ok");
        record.stage = "full";
        panel && panel.setReport(formatReport(record));
        setState2("done", { style: style.id, rules: design.kept });
        return record;
      } catch (e) {
        if (e && e.name === "AbortError") {
          status("cancelled");
          setState2("idle");
          return null;
        }
        if (e && e.code === "needs-gesture") {
          status(e.message, "err");
          setState2("idle", { needsGesture: true });
          return null;
        }
        console.warn("[retro-web] design failed", e);
        status("error: " + describeModelError(e), "err");
        setState2("error", { message: describeModelError(e), code: e && e.code });
        return null;
      } finally {
        if (controller === ctl) controller = null;
        panel && panel.setBusy(false);
        panel && panel.setProgress(null);
        if (client && client.mode === "popup") {
          client.dispose();
          client = null;
          clientKey = null;
        }
      }
    }
    return { runDesign, applyCached, restore, stop, getLastResult: () => lastResult, getStyle };
  }
  function shortenProgress(text) {
    const t = String(text || "");
    const m = /\[(\d+)\/(\d+)\]/.exec(t);
    if (/Loading model from cache/i.test(t) && m) return `loading model from cache ${m[1]}/${m[2]}`;
    if (/Fetching param cache/i.test(t) && m) return `downloading model ${m[1]}/${m[2]} (first time only)`;
    if (/Loading GPU shader/i.test(t)) return "compiling GPU shaders\u2026";
    if (/Finish loading/i.test(t)) return "model ready";
    return t.length > 70 ? t.slice(0, 69) + "\u2026" : t;
  }
  function formatReport(record) {
    if (!record) return "(nothing yet)";
    const L = [];
    L.push(`style: ${record.style} \xB7 rules: ${record.stats ? record.stats.kept : "?"} \xB7 dropped: ${record.stats ? record.stats.dropped : "?"} \xB7 ${record.stats ? Math.round(record.stats.ms / 1e3) + "s" : ""}`);
    if (record.iconRequests && record.iconRequests.length) L.push(`icon requests: ${record.iconRequests.map((r) => r.name).join(", ")}`);
    if (record.iconResults && record.iconResults.length) L.push(`icons: ${record.iconResults.map((r) => `${r.name}\u2190${r.source}${r.alias ? "(" + r.alias + ")" : ""}${r.reason ? " [" + r.reason + "]" : ""}`).join(", ")}`);
    if (record.applyClass && record.applyClass.length) L.push(`classes: ${record.applyClass.map((a) => `${a.selector}\u2192.${a.className}`).join(", ")}`);
    if (record.geometryRollbacks && record.geometryRollbacks.length) {
      L.push("", `GEOMETRY GUARD: rolled back ${record.geometryRollbacks.length} declaration group(s) that moved or resized controls:`);
      for (const r of record.geometryRollbacks.slice(0, 12)) L.push(`- ${r.selector} (${r.props.join(", ")}) in ${r.slot}`);
    }
    const rep = record.report;
    if (rep) {
      const rounds = (rep.rounds || []).map((r) => `round ${r.round}: ${r.before}\u2192${r.after} issues, ${r.kept} patch rules${r.error ? " (error: " + r.error + ")" : ""}`);
      L.push("", `REPAIR: ${rep.initial} issue(s) found \u2192 ${rep.total} remaining after ${(rep.rounds || []).length} round(s)${rep.fixedByFallback && rep.fixedByFallback.length ? `, ${rep.fixedByFallback.length} deterministic fix(es)` : ""}`);
      L.push(...rounds);
      L.push("", "REMAINING ISSUES:", rep.text || "no issues");
    } else L.push("", "ISSUES: (not inspected)");
    return L.join("\n");
  }

  // userscript/src/util/svg-data-uri.js
  var ENCODE = /[%#<>?[\]\\^`{|}"]/g;
  function minifySvg(svg) {
    return String(svg).replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").replace(/\n/g, " ").trim();
  }
  function svgToDataUri(svg) {
    let s = minifySvg(svg);
    if (!/^<svg[\s>]/.test(s)) return null;
    if (!/xmlns=/.test(s)) s = s.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace(/"/g, "'");
    s = s.replace(ENCODE, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
    return "data:image/svg+xml," + s;
  }

  // userscript/src/icons/sanitize.js
  var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient", "stop", "title", "desc", "clippath", "mask", "use", "symbol", "pattern"]);
  var ALLOWED_ATTRS = /* @__PURE__ */ new Set([
    "id",
    "class",
    "viewbox",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-miterlimit",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "fill-rule",
    "clip-rule",
    "transform",
    "offset",
    "stop-color",
    "stop-opacity",
    "gradientunits",
    "gradienttransform",
    "spreadmethod",
    "clip-path",
    "mask",
    "shape-rendering",
    "preserveaspectratio",
    "xmlns",
    "xmlns:xlink",
    "href",
    "xlink:href",
    "patternunits",
    "patterntransform",
    "vector-effect",
    "paint-order",
    "display",
    "visibility",
    "overflow"
  ]);
  var URL_FUNC = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  var DANGEROUS = /javascript:|data:|vbscript:|expression\(|<script|&#|%3c/i;
  function sanitizeSvg(input, { maxLength = 2e4, defaultViewBox = "0 0 16 16" } = {}) {
    const removed = [];
    const errors = [];
    if (typeof input !== "string") return { svg: null, errors: ["not a string"], removed };
    let text = input.trim();
    text = text.replace(/```[a-z]*\s*/gi, "").replace(/<\?xml[^>]*\?>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    const start = text.indexOf("<svg");
    const end = text.lastIndexOf("</svg>");
    if (start < 0 || end < 0) return { svg: null, errors: ["no <svg> element"], removed };
    text = text.slice(start, end + 6);
    if (text.length > maxLength) return { svg: null, errors: ["svg too large"], removed };
    if (!/xmlns=/.test(text.slice(0, text.indexOf(">")))) text = text.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    let doc;
    try {
      doc = new DOMParser().parseFromString(text, "image/svg+xml");
    } catch (e) {
      return { svg: null, errors: ["parse failed: " + (e && e.message)], removed };
    }
    if (doc.getElementsByTagName("parsererror").length || !doc.documentElement || doc.documentElement.localName !== "svg") {
      return { svg: null, errors: ["malformed svg"], removed };
    }
    const root = doc.documentElement;
    const walk = (el) => {
      for (const child of [...el.childNodes]) {
        if (child.nodeType === 1) {
          const name = child.localName.toLowerCase();
          if (!ALLOWED_ELEMENTS.has(name) || child.namespaceURI && child.namespaceURI !== "http://www.w3.org/2000/svg") {
            removed.push("element:" + name);
            child.remove();
            continue;
          }
          walk(child);
        } else if (child.nodeType === 8 || child.nodeType === 7) {
          child.remove();
        } else if (child.nodeType === 3 && !/^(title|desc)$/i.test(el.localName) && child.nodeValue.trim()) {
          child.remove();
        }
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        let ok = ALLOWED_ATTRS.has(name);
        if (name.startsWith("on")) ok = false;
        if (ok && (name === "href" || name === "xlink:href") && !/^#[\w:-]+$/.test(value.trim())) ok = false;
        if (ok && DANGEROUS.test(value)) ok = false;
        if (ok && /url\(/i.test(value)) {
          let urlsOk = true;
          value.replace(URL_FUNC, (_m, _q, u) => {
            if (!/^#[\w:-]+$/.test(u.trim())) urlsOk = false;
            return _m;
          });
          if (!urlsOk) ok = false;
        }
        if (ok && value.length > 4e3) ok = false;
        if (!ok) {
          removed.push("attr:" + name);
          el.removeAttribute(attr.name);
        }
      }
    };
    walk(root);
    if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", defaultViewBox);
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!root.querySelector("path, rect, circle, ellipse, line, polyline, polygon, use")) errors.push("no shapes left");
    let svg;
    try {
      svg = new XMLSerializer().serializeToString(root);
    } catch (e) {
      return { svg: null, errors: ["serialize failed"], removed };
    }
    if (errors.length) return { svg: null, errors, removed };
    return { svg, errors, removed };
  }

  // userscript/src/icons/claude.js
  var ICON_SYSTEM_PROMPT = `You draw tiny pixel-art icons for a year-2000 website toolkit. Reply with exactly one <svg> element and nothing else: no prose, no markdown fences, no XML prolog, no comments.
Requirements:
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 SIZE SIZE" shape-rendering="crispEdges"> where SIZE is the requested size (16 or 32).
- Pixel-art look: axis-aligned <path> or <rect> shapes snapped to the integer grid, a 1px black outline (#000000), flat fills, a highlight pixel or two.
- Palette only: #000000 #ffffff #c0c0c0 #808080 #ffcc00 #3366cc #cc3333 #339933 #ff6600 #99ccff #ff66aa #ffcc99 #ffe680.
- No gradients, filters, text, images, scripts, styles, animations or external references. No <text>.
- Use only path, rect, circle, polygon, g elements. Keep it under 1200 characters.
- The subject must be recognisable at 16 pixels: bold silhouette, few details.`;
  function buildIconRequest({ name, description, size = 16, settings }) {
    const n = String(name || "").replace(/[^a-z0-9-]/gi, "-").slice(0, 40);
    const d = String(description || "").replace(/\s+/g, " ").slice(0, 160);
    return {
      url: settings.anthropicEndpoint,
      headers: {
        "anthropic-version": settings.anthropicVersion,
        "content-type": "application/json"
      },
      body: {
        model: settings.iconModel,
        max_tokens: settings.iconMaxTokens || 1200,
        system: ICON_SYSTEM_PROMPT,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: `Icon name: ${n}
Description: ${d || n}
Size: ${size === 32 ? 32 : 16}` }]
      }
    };
  }
  function extractSvgFromResponse(json) {
    if (!json || !Array.isArray(json.content)) return { svg: null, error: "bad response" };
    if (json.stop_reason === "refusal") return { svg: null, error: "refusal" };
    const text = json.content.filter((b) => b && b.type === "text").map((b) => b.text).join("\n");
    const start = text.indexOf("<svg");
    const end = text.lastIndexOf("</svg>");
    if (start < 0 || end < 0) return { svg: null, error: json.stop_reason === "max_tokens" ? "truncated" : "no svg in reply" };
    return { svg: text.slice(start, end + 6), error: null };
  }
  function requestIconSvg({ name, description, size = 16, settings, signal, timeoutMs }) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== "function") return resolve({ svg: null, error: "no GM_xmlhttpRequest" });
      if (!hasApiKey()) return resolve({ svg: null, error: "no-key" });
      const req = buildIconRequest({ name, description, size, settings });
      let done = false;
      const finish = (r) => {
        if (!done) {
          done = true;
          resolve(r);
        }
      };
      let handle = null;
      try {
        handle = GM_xmlhttpRequest({
          method: "POST",
          url: req.url,
          headers: { ...req.headers, "x-api-key": readApiKey() },
          data: JSON.stringify(req.body),
          timeout: timeoutMs || settings.iconTimeoutMs || 25e3,
          anonymous: true,
          onload: (res) => {
            let json = null;
            try {
              json = JSON.parse(res.responseText);
            } catch {
              return finish({ svg: null, error: "invalid json (" + res.status + ")" });
            }
            if (res.status < 200 || res.status >= 300) {
              const msg = json && json.error && json.error.message || "http " + res.status;
              return finish({ svg: null, error: res.status === 401 ? "invalid-key" : res.status === 429 ? "rate-limited" : msg, status: res.status });
            }
            finish(extractSvgFromResponse(json));
          },
          onerror: (e) => finish({ svg: null, error: "network error" + (e && e.error ? ": " + e.error : "") }),
          ontimeout: () => finish({ svg: null, error: "timeout" })
        });
      } catch (e) {
        return finish({ svg: null, error: "request failed: " + (e && e.message) });
      }
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            try {
              handle && handle.abort && handle.abort();
            } catch {
            }
            finish({ svg: null, error: "aborted" });
          },
          { once: true }
        );
      }
    });
  }

  // userscript/src/icons/cache.js
  function iconHash(name, description) {
    const s = `${String(name).toLowerCase().trim()}|${String(description || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  function createIconCache(storage = { getValue, setValue, deleteValue, listKeys }) {
    const prefix = STORAGE_KEYS.iconPrefix;
    return {
      key: (name, description) => prefix + iconHash(name, description),
      get(name, description) {
        const v = storage.getValue(prefix + iconHash(name, description), null);
        return v && v.uri ? v : null;
      },
      // Looser lookup by name only (any description) for reuse across sites.
      findByName(name) {
        const n = String(name).toLowerCase();
        for (const k of storage.listKeys()) {
          if (!k.startsWith(prefix)) continue;
          const v = storage.getValue(k, null);
          if (v && v.name === n && v.uri) return v;
        }
        return null;
      },
      put(name, description, entry) {
        const rec = { name: String(name).toLowerCase(), description: String(description || ""), createdAt: Date.now(), ...entry };
        storage.setValue(prefix + iconHash(name, description), rec);
        return rec;
      },
      list() {
        return storage.listKeys().filter((k) => k.startsWith(prefix)).map((k) => storage.getValue(k, null)).filter(Boolean);
      },
      clear() {
        for (const k of storage.listKeys()) if (k.startsWith(prefix)) storage.deleteValue(k);
      }
    };
  }

  // userscript/src/icons/index.js
  var STOP = /* @__PURE__ */ new Set(["a", "an", "the", "of", "with", "icon", "small", "for", "and", "in", "on", "to", "pixel", "style", "simple", "symbol", "sign", "button", "image"]);
  var SYNONYMS = {
    house: "home",
    homepage: "home",
    email: "mail",
    envelope: "mail",
    letter: "mail",
    inbox: "mail",
    magnifier: "search",
    magnifying: "search",
    find: "search",
    lookup: "search",
    basket: "cart",
    shopping: "cart",
    bag: "cart",
    checkout: "cart",
    buy: "cart",
    person: "user",
    avatar: "user",
    profile: "user",
    account: "user",
    login: "user",
    member: "user",
    directory: "folder",
    document: "file",
    page: "file",
    doc: "file",
    paper: "file",
    article: "file",
    favorite: "star",
    favourite: "star",
    rating: "star",
    like: "heart",
    love: "heart",
    settings: "gear",
    cog: "gear",
    config: "gear",
    preferences: "gear",
    tool: "gear",
    tools: "gear",
    note: "music",
    song: "music",
    audio: "music",
    photo: "image",
    picture: "image",
    gallery: "image",
    camera: "image",
    chain: "link",
    url: "link",
    save: "download",
    export: "download",
    feed: "rss",
    comment: "chat",
    comments: "chat",
    bubble: "chat",
    message: "chat",
    talk: "chat",
    forum: "chat",
    secure: "lock",
    password: "lock",
    private: "lock",
    world: "globe",
    web: "globe",
    earth: "globe",
    international: "globe",
    language: "globe",
    fire: "hot",
    flame: "hot",
    trending: "hot",
    tick: "check",
    done: "check",
    ok: "check",
    success: "check",
    remove: "close",
    delete: "close",
    x: "close",
    cancel: "close",
    hamburger: "menu",
    bars: "menu",
    navigation: "menu",
    date: "calendar",
    event: "calendar",
    schedule: "calendar",
    time: "clock",
    history: "clock",
    recent: "clock",
    printer: "print",
    label: "tag",
    price: "tag",
    sale: "tag",
    ribbon: "bookmark",
    saved: "bookmark",
    video: "play",
    watch: "play",
    next: "arrow-right",
    previous: "arrow-left",
    back: "arrow-left",
    forward: "arrow-right",
    up: "arrow-up",
    down: "arrow-down",
    top: "arrow-up",
    alert: "warning",
    error: "warning",
    danger: "warning",
    help: "info",
    question: "info",
    about: "info",
    new: "new",
    fresh: "new"
  };
  function tokens(text) {
    return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map((t) => SYNONYMS[t] || t);
  }
  function matchLibraryIcon(request, library = MANIFEST.icons) {
    const reqName = tokens(request.name);
    const reqAll = /* @__PURE__ */ new Set([...reqName, ...tokens(request.description)]);
    let best = null;
    for (const icon of library) {
      if (icon.name === "placeholder") continue;
      const iconTokens = /* @__PURE__ */ new Set([...tokens(icon.name), ...tokens(icon.description)]);
      let score = 0;
      if (icon.name === request.name) score += 2;
      if (reqName.includes(icon.name) || reqName.join("-") === icon.name) score += 1;
      for (const t of reqAll) if (iconTokens.has(t)) score += t === icon.name ? 0.6 : 0.3;
      if (!best || score > best.score) best = { icon, score };
    }
    return best && best.score > 0 ? best : null;
  }
  function createIconResolver({ settings, fetchSvg = requestIconSvg, cache = createIconCache(), library = MANIFEST.icons, hasKey = hasApiKey } = {}) {
    const inflight = /* @__PURE__ */ new Map();
    async function resolveOne(req, ctx) {
      const name = req.name;
      const varName = "--icon-" + name;
      const libNames = new Set(library.map((i) => i.name));
      if (libNames.has(name)) return { name, varName, source: "library", value: null };
      const fuzzy = matchLibraryIcon(req, library);
      if (fuzzy && fuzzy.score >= 1) return { name, varName, source: "library-alias", alias: fuzzy.icon.name, value: `var(--icon-${fuzzy.icon.name})` };
      const cached = cache.get(name, req.description) || cache.findByName(name);
      if (cached) return { name, varName, source: "cache", value: `url("${cached.uri}")` };
      if (hasKey()) {
        const key = name + "|" + req.description;
        if (!inflight.has(key)) {
          inflight.set(
            key,
            fetchSvg({ name, description: req.description, size: 16, settings, signal: ctx.signal }).finally(() => inflight.delete(key))
          );
        }
        const r = await inflight.get(key);
        if (r && r.svg) {
          const s = sanitizeSvg(r.svg);
          if (s.svg) {
            const uri = svgToDataUri(s.svg);
            if (uri) {
              cache.put(name, req.description, { svg: s.svg, uri, model: settings.iconModel });
              return { name, varName, source: "claude", value: `url("${uri}")`, removed: s.removed };
            }
          }
          return fallback(req, fuzzy, "unsafe svg: " + (s.errors.join("; ") || "rejected"));
        }
        return fallback(req, fuzzy, r && r.error || "no reply");
      }
      return fallback(req, fuzzy, "no-key");
    }
    function fallback(req, fuzzy, reason) {
      const name = req.name;
      const varName = "--icon-" + name;
      if (fuzzy && fuzzy.score >= 0.3) return { name, varName, source: "fallback-library", alias: fuzzy.icon.name, value: `var(--icon-${fuzzy.icon.name})`, reason };
      return { name, varName, source: "placeholder", value: "var(--icon-placeholder)", reason };
    }
    async function resolveIcons(requests, ctx = {}) {
      const list = (requests || []).filter((r) => r && r.name);
      const limit = Math.max(1, settings.iconConcurrency || 3);
      const results = new Array(list.length);
      let next = 0;
      const worker = async () => {
        while (next < list.length) {
          const i = next++;
          try {
            results[i] = await resolveOne(list[i], ctx);
          } catch (e) {
            results[i] = fallback(list[i], matchLibraryIcon(list[i], library), "error: " + (e && e.message));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
      const lines = results.filter((r) => r.value).map((r) => `${r.varName}: ${r.value};`);
      return {
        css: lines.length ? `:root { ${lines.join(" ")} }` : "",
        resolved: results.filter((r) => !r.reason),
        failed: results.filter((r) => r.reason),
        results
      };
    }
    return { resolveIcons, resolveOne, cache };
  }

  // userscript/src/index.js
  function setState(state, detail = {}) {
    try {
      document.documentElement.dataset.retroWebState = state;
      document.dispatchEvent(new CustomEvent("retro-web:status", { detail: { state, ...detail } }));
    } catch {
    }
  }
  function main() {
    if (window.top !== window) return;
    if (document.querySelector('meta[name="retro-web-host"]')) return;
    if (document.getElementById(PANEL_ID)) return;
    const hostname = location.hostname;
    let settings = getSettings();
    const site = getSiteRecord(hostname) || {};
    const csp = createCspMonitor(document);
    const env = describeEnvironment(document);
    const slots = createSlots(document);
    slots.panel.set(PANEL_HOST_CSS);
    slots.library.set(LIBRARY_CSS);
    const iconResolver = createIconResolver({ settings });
    const hooks = {
      resolveIcons: (requests, ctx) => createIconResolver({ settings: ctx.settings || settings }).resolveIcons(requests, ctx)
    };
    let pipeline = null;
    let panel = null;
    panel = createPanel({
      doc: document,
      styles: STYLES,
      settings,
      site,
      hasKey: hasApiKey(),
      handlers: {
        onToggleSite(enabled) {
          saveSiteRecord(hostname, { enabled });
          if (!enabled) {
            pipeline.restore();
            panel.setStatus("disabled for this site");
            setState("disabled");
          } else {
            panel.setStatus("enabled \u2014 redesigning", "ok");
            pipeline.runDesign({ userGesture: true });
          }
        },
        onStyleChange(style) {
          settings = saveSettings({ style });
        },
        onRedesign({ style }) {
          settings = saveSettings({ style });
          pipeline.runDesign({ styleId: style, userGesture: true });
        },
        onRestore() {
          pipeline.restore();
          panel.setStatus("original styles restored (cache kept)");
          setState("idle");
        },
        onClearSite() {
          pipeline.restore();
          clearSiteRecord(hostname);
          panel.setStatus("site cache cleared");
          panel.setReport("");
        },
        onClearAll() {
          pipeline.restore();
          clearAllSiteRecords();
          panel.setStatus("all site caches cleared");
        },
        onSetKey(key) {
          setApiKey(key);
          panel.setKeyState(hasApiKey());
          panel.setStatus("API key saved to Tampermonkey storage", "ok");
        },
        onClearKey() {
          clearApiKey();
          panel.setKeyState(false);
          panel.setStatus("API key removed");
        },
        onSettingsChange(patch) {
          settings = saveSettings(patch);
          panel.setStatus("settings saved", "ok");
        }
      }
    });
    pipeline = createPipeline({ doc: document, hostname, slots, panel, setState, getSettings: () => settings = getSettings(), hooks });
    registerMenuCommand("retro-web: set Claude API key", () => {
      panel.setStatus("paste the key below and press Enter (stored in Tampermonkey only)");
      panel.promptKey();
    });
    registerMenuCommand("retro-web: clear Claude API key", () => {
      clearApiKey();
      panel.setKeyState(false);
      panel.setStatus("API key removed");
    });
    registerMenuCommand("retro-web: log page summary", () => {
      const { text } = summarizePage(document, { tokenBudget: settings.summaryTokenBudget });
      console.log("[retro-web] page summary\n" + text);
      panel.setReport(text);
      panel.showReport();
    });
    registerMenuCommand("retro-web: redesign this page", () => pipeline.runDesign({ userGesture: true }));
    registerMenuCommand("retro-web: list generated icons", () => {
      const list = iconResolver.cache.list();
      console.log(`[retro-web] ${list.length} generated icon(s) in the shared cache`, list.map((i) => i.name));
      panel.setReport(list.length ? list.map((i) => `${i.name} \u2014 ${i.description} (${new Date(i.createdAt).toLocaleDateString()})`).join("\n") : "(no generated icons yet)");
      panel.showReport();
    });
    registerMenuCommand("retro-web: clear generated icons", () => {
      iconResolver.cache.clear();
      panel.setStatus("generated icon cache cleared");
    });
    registerMenuCommand("retro-web: toggle on this site", () => {
      const rec = getSiteRecord(hostname) || {};
      const enabled = rec.enabled === false;
      saveSiteRecord(hostname, { enabled });
      panel.setEnabled(enabled);
      location.reload();
    });
    const notes = [];
    if (!slots.working()) notes.push("styles blocked by CSP");
    if (!env.webgpu) notes.push("no WebGPU in page (host decides)");
    if (site.enabled === false) {
      panel.setStatus("disabled for this site");
      setState("disabled");
      return;
    }
    if (site.css) {
      pipeline.applyCached(site);
      panel.setReport(formatReport(site));
      panel.setStatus(`cached design (${site.style})` + (notes.length ? " \xB7 " + notes.join(", ") : ""), "ok");
      setState("done", { cached: true, style: site.style });
      return;
    }
    panel.setStatus(`v${VERSION} ready` + (notes.length ? " \xB7 " + notes.join(", ") : ""), notes.length ? "err" : "ok");
    setState("idle", { env, blocked: [...csp.blocked] });
    if (settings.autoDesign) {
      setTimeout(() => pipeline.runDesign({}), settings.settleDelayMs);
    }
  }
  try {
    main();
  } catch (e) {
    console.error("[retro-web] fatal", e);
    setState("error", { message: String(e && e.message) });
  }
})();
