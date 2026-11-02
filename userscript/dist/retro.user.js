// ==UserScript==
// @name         retro-web
// @namespace    https://github.com/galmukhaizim/2000sInternet
// @version      0.1.0
// @description  Redesigns any website in a 2000s internet aesthetic using a small language model running in your browser
// @author       galmukhaizim
// @match        *://*/*
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
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(() => {
  // userscript/src/config.js
  var VERSION = "0.1.0";
  var CACHE_VERSION = 1;
  var DEFAULTS = {
    // --- model host (fixed origin iframe that runs WebLLM) ---
    hostUrl: "http://localhost:4173/",
    // Any id from WebLLM's prebuilt list (0.2.87). ~1.6 GB VRAM, code-tuned.
    modelId: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    // Later: your fine-tuned model on Hugging Face, e.g.
    // { model: 'https://huggingface.co/<user>/<repo>', model_id: 'retro-designer-1.5B-q4f16_1-MLC',
    //   model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/Qwen2.5-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm' }
    customModel: null,
    contextWindow: 8192,
    temperature: 0.7,
    topP: 0.9,
    // --- generation budgets (tokens) ---
    summaryTokenBudget: 1500,
    manifestTokenBudget: 700,
    maxDesignTokens: 1400,
    maxPatchTokens: 600,
    // --- behaviour ---
    autoDesign: true,
    // design new sites automatically on first visit
    style: "random",
    // sub-style id from training/styles.json or 'random'
    maxRepairRounds: 3,
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
    const autoInput = el("input", { type: "checkbox" });
    autoInput.checked = !!settings.autoDesign;
    const iconModelInput = el("input", { type: "text", value: settings.iconModel });
    const saveBtn = el("button", {
      class: "b",
      text: "Save settings",
      onclick: () => handlers.onSettingsChange?.({
        modelId: modelInput.value.trim(),
        hostUrl: hostInput.value.trim(),
        maxRepairRounds: Math.max(0, Math.min(6, parseInt(roundsInput.value, 10) || 0)),
        autoDesign: autoInput.checked,
        iconModel: iconModelInput.value.trim()
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
            el("span", { text: "Model id" }),
            modelInput,
            el("span", { text: "Host URL" }),
            hostInput,
            el("span", { text: "Icon model" }),
            iconModelInput,
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
    for (const [role, sel, max] of LANDMARKS) {
      let cands = [];
      try {
        cands = [...doc.querySelectorAll(sel)];
      } catch {
        cands = [];
      }
      cands = cands.filter((e) => M.isVisible(e) && !picked.includes(e) && !e.closest("retro-web-panel"));
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
        if (links < 4 || tl > 400) continue;
        const score = links * 10 - tl / 20 - r.top / 10;
        if (!best || score > best.score) best = { e, score };
      }
      if (best) describe("nav", best.e);
    }
    if (M.layout && !have("header")) {
      const nav = landmarks.find((l) => l.role === "nav");
      const navEl = nav ? doc.querySelector(nav.selector) : null;
      const cand = navEl && navEl.parentElement && navEl.parentElement !== body && M.rect(navEl.parentElement).height < 220 ? navEl.parentElement : null;
      if (cand) describe("header", cand);
    }
    if (!have("main")) {
      let cur = body;
      for (let i = 0; i < 12; i++) {
        const kids = [...cur.children].filter((k) => M.isVisible(k) && !["script", "style", "retro-web-panel"].includes(k.localName));
        const next = kids.find((k) => (k.textContent || "").trim().length >= bodyText * 0.6);
        if (!next) break;
        cur = next;
      }
      if (cur !== body && cur.children.length >= 2 && !picked.includes(cur)) describe("main", cur);
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
    const classes = [...classFreq.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30).map(([name, v]) => ({ name, count: v.count, tag: [...v.tags.entries()].sort((a, b) => b[1] - a[1])[0][0] }));
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
    const navLinks = landmarks.filter((l) => l.role === "nav").map((l) => `${l.selector} a`);
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
      buttons: buttonGroups.map(([selector, count]) => ({ selector, count })),
      navLinkSelectors: navLinks,
      h1: h1 ? trunc(h1.textContent, 80) : null,
      h2: h2s.map((e) => trunc(e.textContent, 50))
    };
    return { text: renderSummary(data, tokenBudget), data };
  }
  function renderSummary(d, tokenBudget = 1500) {
    const limits = { classes: 30, ids: 15, landmarks: 10, icons: 6, buttons: 6, h2: 3, accents: 5 };
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
      if (d.buttons.length) L.push(`BUTTONS: ${d.buttons.slice(0, limits.buttons).map((b) => `${b.selector} (${b.count})`).join(", ")}`);
      if (d.navLinkSelectors.length) L.push(`NAV LINKS: ${d.navLinkSelectors.join(", ")}`);
      if (d.classes.length) L.push(`CLASSES: ${d.classes.slice(0, limits.classes).map((k) => `.${k.name} (${k.count} ${k.tag})`).join(", ")}`);
      if (d.ids.length) L.push(`IDS: ${d.ids.slice(0, limits.ids).map((i) => `#${i.id} (${i.tag})`).join(", ")}`);
      if (d.h1) L.push(`H1: "${d.h1}"`);
      if (d.h2.length) L.push(`H2: ${d.h2.slice(0, limits.h2).map((t) => `"${t}"`).join(", ")}`);
      return L.join("\n");
    };
    let text = build();
    const order = ["h2", "ids", "classes", "accents", "buttons", "icons", "landmarks"];
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
  function classifyTargets(doc, probes, limit = 60) {
    const info = { count: 0, landmark: false, interactive: false, textLength: 0, protected: false };
    if (!doc) return info;
    const seen = /* @__PURE__ */ new Set();
    for (const probe of probes) {
      let list;
      try {
        list = doc.querySelectorAll(probe);
      } catch {
        continue;
      }
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        info.count++;
        if (LANDMARK_TAGS.has(el.localName) || el.getAttribute("role") === "main") info.landmark = true;
        if (INTERACTIVE.has(el.localName) || el.getAttribute("role") === "button") info.interactive = true;
        if (el.querySelector && el.querySelector("a, button, input, select, textarea")) info.interactive = true;
        if (el.localName === "retro-web-panel") info.protected = true;
        info.textLength += (el.textContent || "").trim().length;
        if (seen.size >= limit) return info;
      }
    }
    return info;
  }
  function clampNumbers(prop, value) {
    let spec = null;
    for (const [re, s2] of CLAMPS) {
      if (re.test(prop)) {
        spec = s2;
        break;
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
          const num = parseFloat(m[0]);
          const unit = m[3].toLowerCase();
          const range = spec[unit];
          if (range && Number.isFinite(num)) {
            const clamped = Math.min(range[1], Math.max(range[0], num));
            out += clamped === num ? m[0] : String(+clamped.toFixed(3)) + m[3];
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
      const kind = hidingKind(prop, value);
      if (kind) {
        const t = ctx.targets();
        if (t.protected || t.landmark || t.interactive || t.count > 3 || t.textLength > 200) return drop("hides-content:" + kind);
      }
      if (prop === "position") {
        const v = value.toLowerCase();
        const t = ctx.targets();
        if (t.protected) return drop("protected");
        if (v === "fixed" && (t.count > 3 || t.landmark)) return drop("position-fixed-too-broad");
        if (v === "absolute" && (t.count > 25 || t.landmark)) return drop("position-absolute-too-broad");
      }
      if (prop === "pointer-events" && /none/i.test(value)) {
        const t = ctx.targets();
        if (t.count > 20 || t.landmark || t.interactive) return drop("pointer-events-too-broad");
      }
      if (prop === "overflow" || prop === "overflow-y") {
        const t = ctx.targets();
        if (t.landmark && /hidden|clip/i.test(value) && /html|body/.test(ctx.selector)) return drop("overflow-hidden-on-root");
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
    const { doc = null, mode = "design", forceImportant = true, maxRules = 400, maxDecls = 60, allowUnmatched = false } = options;
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
          targets: () => targetsCache || (targetsCache = classifyTargets(doc, probes.length ? probes : selectorParts.map(probeSelector)))
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
  function validateApplyClass(list, { doc, classNames = [], protect = DEFAULT_PROTECT, maxTargets = 200 } = {}) {
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
    _post(msg) {
      if (!this.frame || !this.frame.contentWindow) throw new ModelUnavailableError("host-unreachable", "model host frame missing");
      this.frame.contentWindow.postMessage({ ns: NS, ...msg }, this.hostOrigin || "*");
    }
    _onMessage(e) {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
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
    // Creates the hidden iframe and waits for the host's `ready`.
    connect() {
      if (this.ready) return this.ready;
      this.ready = new Promise((resolve, reject) => {
        const doc = this.doc;
        const win = doc.defaultView || window;
        const url = new URL(this.hostUrl);
        if (!/\.html$/.test(url.pathname) && !url.pathname.endsWith("/")) url.pathname += "/";
        url.searchParams.set("v", "1");
        const frame = doc.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("title", "retro-web model host");
        frame.setAttribute("data-retro-web", "host");
        frame.style.cssText = "position:fixed!important;width:1px!important;height:1px!important;left:-9999px!important;top:-9999px!important;border:0!important;opacity:0!important;pointer-events:none!important;";
        let blocked = false;
        const onCsp = (ev) => {
          const d = (ev.effectiveDirective || ev.violatedDirective || "").split(" ")[0];
          if (/^(frame-src|child-src|default-src)$/.test(d) && String(ev.blockedURI || "").startsWith(this.hostOrigin || "\0")) blocked = true;
        };
        doc.addEventListener("securitypolicyviolation", onCsp);
        win.addEventListener("message", this._listener);
        this.frame = frame;
        this._readyResolve = (info) => {
          clearInterval(hello);
          clearTimeout(timer);
          doc.removeEventListener("securitypolicyviolation", onCsp);
          resolve(info);
        };
        const hello = setInterval(() => {
          try {
            if (frame.contentWindow) this._post({ t: "hello" });
          } catch {
          }
        }, 400);
        const timer = setTimeout(() => {
          clearInterval(hello);
          doc.removeEventListener("securitypolicyviolation", onCsp);
          this.dispose();
          this.ready = null;
          reject(
            blocked ? new ModelUnavailableError("host-blocked", `this site's Content Security Policy blocks the model host frame (${this.hostOrigin})`) : new ModelUnavailableError("host-unreachable", `model host not reachable at ${this.hostUrl} \u2014 run \`npm run host\` or set the host URL in Advanced`)
          );
        }, this.handshakeTimeoutMs);
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
      this.frame = null;
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
          return "model host offline \u2014 run `npm run host`";
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
- Icons: decorate nav links and buttons with 16px icons: background-image: var(--icon-NAME); background-repeat: no-repeat; background-position: 4px center; padding-left: 24px;
- If the library lacks an icon you need, add a line: /* icon-request: name | short description */ and then use var(--icon-name).
- To attach a library component class write a line: /* apply-class: selector | class-name */
- Commit fully to the given STYLE. Write 25 to 50 rules and finish with a complete rule.`;
  function designMessages({ summaryText, manifestText, style }) {
    const user = [`STYLE: ${describeStyle(style)}`, "", manifestText, "", "PAGE SUMMARY:", summaryText, "", "Write the CSS now."].join("\n");
    return [
      { role: "system", content: DESIGN_SYSTEM_PROMPT },
      { role: "user", content: user }
    ];
  }

  // userscript/src/model/designer.js
  function mergeDirectives(into, d) {
    for (const r of d.iconRequests) if (!into.iconRequests.some((x) => x.name === r.name)) into.iconRequests.push(r);
    for (const a of d.applyClass) if (!into.applyClass.some((x) => x.selector === a.selector && x.className === a.className)) into.applyClass.push(a);
  }
  async function streamValidated({ client, messages, params, doc, mode, onChunk, signal }) {
    const streamer = new RuleStreamer();
    const result = { rawText: "", css: "", cssChunks: [], iconRequests: [], applyClass: [], dropped: [], errors: [], kept: 0, iconVars: /* @__PURE__ */ new Set(), usage: null, finish: null };
    const handle = (chunk) => {
      if (!chunk.trim()) return;
      const d = extractDirectives(chunk);
      mergeDirectives(result, d);
      const v = validateCss(d.css, { doc, mode });
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
  async function generateDesign({ client, doc, summaryText, style, settings, onChunk, signal }) {
    const manifestText = manifestToPrompt();
    const messages = designMessages({ summaryText, manifestText, style });
    const promptTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
    const params = { temperature: settings.temperature, topP: settings.topP, maxTokens: settings.maxDesignTokens, disableThinking: true };
    const result = await streamValidated({ client, messages, params, doc, mode: "design", onChunk, signal });
    result.promptTokens = promptTokens;
    result.style = style.id;
    return result;
  }

  // userscript/src/pipeline.js
  function createPipeline({ doc, hostname, slots, panel, setState: setState2, getSettings: getSettings2, hooks = {} }) {
    let client = null;
    let clientKey = null;
    let controller = null;
    let appliedClasses = [];
    let lastResult = null;
    function status(text, kind) {
      panel && panel.setStatus(text, kind);
    }
    function getClient(settings) {
      const key = [settings.hostUrl, settings.modelId, JSON.stringify(settings.customModel || null), settings.contextWindow].join("|");
      if (client && clientKey === key) return client;
      if (client) client.dispose();
      clientKey = key;
      client = new ModelClient({
        doc,
        hostUrl: settings.hostUrl,
        modelId: settings.modelId,
        customModel: settings.customModel,
        contextWindow: settings.contextWindow,
        onProgress: ({ text, progress }) => {
          setState2("loading-model", { text, progress });
          status(shortenProgress(text), "");
          panel && panel.setProgress(progress);
        }
      });
      return client;
    }
    function clearApplied() {
      removeClassDirectives(appliedClasses);
      appliedClasses = [];
    }
    function applyDirectives(list) {
      const { applied } = validateApplyClass(list, { doc, classNames: libraryClassNames() });
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
    async function runDesign({ styleId } = {}) {
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
        const summary = summarizePage(doc, { tokenBudget: settings.summaryTokenBudget });
        status(`loading designer model\u2026`);
        const c = getClient(settings);
        await c.load();
        if (signal.aborted) return null;
        panel && panel.setProgress(null);
        setState2("designing", { style: style.id });
        status(`designing (${style.name})\u2026`);
        let rules = 0;
        const pendingIcons = [];
        const design = await generateDesign({
          client: c,
          doc,
          summaryText: summary.text,
          style,
          settings,
          signal,
          onChunk: ({ css, applyClass, iconRequests: iconRequests2, result }) => {
            slots.design.set(css);
            if (applyClass.length) applyDirectives(applyClass);
            if (iconRequests2.length) pendingIcons.push(...iconRequests2);
            rules = result.kept;
            status(`designing (${style.name})\u2026 ${rules} rules`);
          }
        });
        if (signal.aborted) return null;
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
        if (hooks.repair) {
          setState2("repairing", { style: style.id });
          status("inspecting layout\u2026");
          const rep = await hooks.repair({ client: c, doc, design, style, settings, signal, slots, status, applyDirectives });
          if (rep) {
            patchCss = rep.patchCss || "";
            fallbackCss = rep.fallbackCss || "";
            report = rep.report || null;
            slots.patch.set(patchCss);
            slots.fallback.set(fallbackCss);
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
          style: style.id,
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
        const remaining = report && report.issues ? report.issues.length : 0;
        status(`done: ${style.name} \xB7 ${design.kept} rules \xB7 ${secs}s${remaining ? ` \xB7 ${remaining} issue(s) left` : ""}`, "ok");
        panel && panel.setReport(formatReport(record));
        setState2("done", { style: style.id, rules: design.kept });
        return record;
      } catch (e) {
        if (e && e.name === "AbortError") {
          status("cancelled");
          setState2("idle");
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
    if (record.applyClass && record.applyClass.length) L.push(`classes: ${record.applyClass.map((a) => `${a.selector}\u2192.${a.className}`).join(", ")}`);
    if (record.report && record.report.text) L.push("", "ISSUES:", record.report.text);
    else L.push("", "ISSUES: (none recorded)");
    return L.join("\n");
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
    if (document.getElementById(PANEL_ID)) return;
    const hostname = location.hostname;
    let settings = getSettings();
    const site = getSiteRecord(hostname) || {};
    const csp = createCspMonitor(document);
    const env = describeEnvironment(document);
    const slots = createSlots(document);
    slots.panel.set(PANEL_HOST_CSS);
    slots.library.set(LIBRARY_CSS);
    const hooks = {};
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
            pipeline.runDesign({});
          }
        },
        onStyleChange(style) {
          settings = saveSettings({ style });
        },
        onRedesign({ style }) {
          settings = saveSettings({ style });
          pipeline.runDesign({ styleId: style });
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
      const k = prompt("Paste your Claude API key (stored only in Tampermonkey storage):");
      if (k && k.trim()) {
        setApiKey(k.trim());
        panel.setKeyState(true);
        panel.setStatus("API key saved", "ok");
      }
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
    registerMenuCommand("retro-web: redesign this page", () => pipeline.runDesign({}));
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
