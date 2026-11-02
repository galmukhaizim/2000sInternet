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
