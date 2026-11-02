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

  // userscript/src/assets/index.js
  var LIBRARY_CSS = library_default;
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
    const settings = getSettings();
    const site = getSiteRecord(hostname) || {};
    const csp = createCspMonitor(document);
    const env = describeEnvironment(document);
    const slots = createSlots(document);
    slots.panel.set(PANEL_HOST_CSS);
    slots.library.set(LIBRARY_CSS);
    const panel = createPanel({
      doc: document,
      styles: STYLES,
      settings,
      site,
      hasKey: hasApiKey(),
      handlers: {
        onToggleSite(enabled) {
          saveSiteRecord(hostname, { enabled });
          panel.setStatus(enabled ? "enabled \u2014 reload to apply" : "disabled for this site", enabled ? "ok" : "");
          setState(enabled ? "idle" : "disabled");
        },
        onStyleChange(style) {
          saveSettings({ style });
        },
        onRedesign() {
          panel.setStatus("design pipeline arrives in phase 3", "err");
        },
        onRestore() {
          slots.design.clear();
          slots.patch.clear();
          slots.fallback.clear();
          slots.icons.clear();
          panel.setStatus("original styles restored");
        },
        onClearSite() {
          clearSiteRecord(hostname);
          panel.setStatus("site cache cleared");
        },
        onClearAll() {
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
          saveSettings(patch);
          panel.setStatus("settings saved", "ok");
        }
      }
    });
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
    registerMenuCommand("retro-web: toggle on this site", () => {
      const rec = getSiteRecord(hostname) || {};
      const enabled = rec.enabled === false;
      saveSiteRecord(hostname, { enabled });
      panel.setEnabled(enabled);
      location.reload();
    });
    const notes = [];
    if (!slots.working()) notes.push("styles blocked by CSP");
    if (!env.webgpu) notes.push("no WebGPU");
    if (site.enabled === false) {
      panel.setStatus("disabled for this site");
      setState("disabled");
      return;
    }
    panel.setStatus(`v${VERSION} ready` + (notes.length ? " \xB7 " + notes.join(", ") : ""), notes.length ? "err" : "ok");
    setState("idle", { env, blocked: [...csp.blocked] });
  }
  try {
    main();
  } catch (e) {
    console.error("[retro-web] fatal", e);
    setState("error", { message: String(e && e.message) });
  }
})();
