var RetroWebLib = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // userscript/src/lib.js
  var lib_exports = {};
  __export(lib_exports, {
    DESIGN_SYSTEM_PROMPT: () => DESIGN_SYSTEM_PROMPT,
    ICON_SYSTEM_PROMPT: () => ICON_SYSTEM_PROMPT,
    LIBRARY_CSS: () => LIBRARY_CSS,
    MANIFEST: () => MANIFEST,
    REPAIR_SYSTEM_PROMPT: () => REPAIR_SYSTEM_PROMPT,
    RuleStreamer: () => RuleStreamer,
    STYLES: () => STYLES,
    StyleSlot: () => StyleSlot,
    VERSION: () => VERSION,
    applyClassDirectives: () => applyClassDirectives,
    buildFallbackCss: () => buildFallbackCss,
    buildIconRequest: () => buildIconRequest,
    contrastRatio: () => contrastRatio,
    createIconCache: () => createIconCache,
    createIconResolver: () => createIconResolver,
    createInspectorMeasure: () => createInspectorMeasure,
    createMeasure: () => createMeasure,
    createSlots: () => createSlots,
    dataUriToSvg: () => dataUriToSvg,
    describeStyle: () => describeStyle,
    designMessages: () => designMessages,
    estimateTokens: () => estimateTokens,
    extractDirectives: () => extractDirectives,
    extractSvgFromResponse: () => extractSvgFromResponse,
    iconHash: () => iconHash,
    inspectPage: () => inspectPage,
    libraryClassNames: () => libraryClassNames,
    libraryIconNames: () => libraryIconNames,
    libraryVarNames: () => libraryVarNames,
    manifestToPrompt: () => manifestToPrompt,
    matchLibraryIcon: () => matchLibraryIcon,
    parseColor: () => parseColor,
    parseCss: () => parseCss,
    patternSelector: () => patternSelector,
    pickStyle: () => pickStyle,
    probeSelector: () => probeSelector,
    renderReport: () => renderReport,
    renderSummary: () => renderSummary,
    repairMessages: () => repairMessages,
    runRepairLoop: () => runRepairLoop,
    sanitizeSvg: () => sanitizeSvg,
    snapshotVisibility: () => snapshotVisibility,
    summarizePage: () => summarizePage,
    svgToDataUri: () => svgToDataUri,
    trimCssForReport: () => trimCssForReport,
    uniqueSelector: () => uniqueSelector,
    validateApplyClass: () => validateApplyClass,
    validateCss: () => validateCss
  });

  // userscript/src/config.js
  var VERSION = "0.3.0";
  var STORAGE_KEYS = {
    apiKey: "apiKey",
    settings: "settings",
    sitePrefix: "site:",
    iconPrefix: "icon:"
  };

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
  function dataUriToSvg(uri) {
    if (typeof uri !== "string") return null;
    const m = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/s.exec(uri.trim());
    if (!m) return null;
    const meta = m[1] || "";
    const body = m[2];
    try {
      if (/;base64/.test(meta)) {
        const bin = typeof atob === "function" ? atob(body) : Buffer.from(body, "base64").toString("binary");
        return decodeURIComponent(escape(bin));
      }
      return decodeURIComponent(body);
    } catch {
      return null;
    }
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
  var PREFIX = { icons: "--icon-", backgrounds: "--bg-", gradients: "--grad-", fonts: "--font-", cursors: "--cursor-", recipes: "--" };
  function libraryVarNames() {
    const names = /* @__PURE__ */ new Set();
    for (const [group, prefix] of Object.entries(PREFIX)) for (const a of MANIFEST[group] || []) names.add(prefix + a.name);
    return names;
  }
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
  function classifyTargets(doc, probes, limit = 60) {
    const info = { count: 0, landmark: false, interactive: false, textLength: 0, protected: false, media: false, mediaParent: false, flexGrid: false, root: false };
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
    if (!ctx.keyframes && !ctx.fontFace) {
      const isLayout = LAYOUT_PROPS.test(prop);
      const isSpacing = SPACING_PROPS.test(prop);
      const t = isLayout || isSpacing || /^(font-size|line-height|border(-(top|right|bottom|left))?(-width)?|content)$/.test(prop) ? ctx.targets() : null;
      if (t) {
        if (t.media && !MEDIA_SAFE.test(prop)) return drop("media-element");
        if (prop === "content" && !/::?(before|after|marker)/.test(ctx.selector)) return drop("content-outside-pseudo");
        if (isLayout) {
          if (t.count > ctx.maxLayoutMatches) return drop("layout-too-broad");
          if (t.mediaParent && MEDIA_CONTAINER_RISKY.test(prop)) return drop("media-container");
          if (prop === "display") {
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
    const { doc = null, mode = "design", forceImportant = true, maxRules = 400, maxDecls = 60, allowUnmatched = false, maxLayoutMatches = 40, maxSpacingMatches = 150 } = options;
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
          targets: () => targetsCache || (targetsCache = classifyTargets(doc, probes.length ? probes : selectorParts.map(probeSelector), 400))
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

  // userscript/src/csp.js
  function canUseAdoptedStyleSheets(doc = document) {
    try {
      return "adoptedStyleSheets" in doc && typeof CSSStyleSheet === "function" && typeof CSSStyleSheet.prototype.replaceSync === "function";
    } catch {
      return false;
    }
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
  function hasApiKey() {
    const k = getValue(STORAGE_KEYS.apiKey, "");
    return typeof k === "string" && k.length > 0;
  }
  function readApiKey() {
    const k = getValue(STORAGE_KEYS.apiKey, "");
    return typeof k === "string" ? k : "";
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
  function designMessages({ summaryText, manifestText, style }) {
    const user = [`STYLE: ${describeStyle(style)}`, "", manifestText, "", "PAGE SUMMARY:", summaryText, "", "Write the CSS now."].join("\n");
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

  // userscript/src/repair/inspect.js
  var ISSUE_SEVERITY = {
    invisible: 3,
    "overflow-x": 3,
    "icon-missing": 2,
    "contrast-low": 2,
    "text-clipped": 2,
    overlap: 2,
    "icon-off-center": 2,
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
    const sc = M.scroll(doc.documentElement);
    if (sc.scrollWidth > sc.clientWidth + 2 && sc.clientWidth > 0) {
      add("overflow-x", "html", `page scrolls horizontally: content ${sc.scrollWidth}px, viewport ${sc.clientWidth}px`, { scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth });
      const offenders = visible.filter((e) => R(e).right > vw + 2 && R(e).width > 20 && !["html", "body"].includes(e.localName)).sort((a, b) => R(b).right - R(a).right).slice(0, 3);
      for (const e of offenders) add("overflow-x", e, `extends to x=${Math.round(R(e).right)}px (viewport ${vw}px)`);
    }
    for (const el of textEls.slice(0, 400)) {
      const tr = M.textRect(el);
      if (!tr) continue;
      if (tr.left <= 1 && tr.width > 10) add("edge-touch", el, `text starts at x=${Math.round(tr.left)}px (no left padding)`);
      else if (tr.right >= vw - 1 && tr.width > 10) add("edge-touch", el, `text ends at x=${Math.round(tr.right)}px, viewport edge`);
    }
    const containersSeen = /* @__PURE__ */ new Set();
    for (const el of visible) {
      const parent = el.parentElement;
      if (!parent || containersSeen.has(parent) || parent.localName === "body" || parent.localName === "html") continue;
      containersSeen.add(parent);
      const kids = [...parent.children].filter((k) => k.localName === el.localName && isVisible(k));
      if (kids.length < 3 || kids.length > 40) continue;
      const rects = kids.map(R);
      const vertical = rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 2);
      const horizontal = !vertical && rects.every((r, i) => i === 0 || r.left >= rects[i - 1].right - 2);
      if (!vertical && !horizontal) continue;
      const gaps = rects.slice(1).map((r, i) => Math.round(vertical ? r.top - rects[i].bottom : r.left - rects[i].right));
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
    for (const el of textEls.slice(0, 500)) {
      const s = S(el);
      if (!s.backgroundImage || s.backgroundImage === "none" || !/no-repeat/.test(s.backgroundRepeat || "")) continue;
      const size = /(\d+(?:\.\d+)?)px/.exec(s.backgroundSize || "");
      const iconH = size ? Math.min(48, num(size[1])) : 16;
      if (iconH > 48) continue;
      const pos = (s.backgroundPosition || "0% 0%").split(/\s+/);
      const posY = pos[1] || "0%";
      const r = R(el);
      const padT = num(s.paddingTop);
      const padB = num(s.paddingBottom);
      let iconTop;
      if (posY.endsWith("%")) iconTop = r.top + (r.height - iconH) * (num(posY) / 100);
      else iconTop = r.top + num(posY);
      const tr = M.textRect(el);
      if (!tr) continue;
      const dy = Math.round(iconTop + iconH / 2 - (tr.top + tr.height / 2));
      void padT;
      void padB;
      if (Math.abs(dy) > tol) add("icon-off-center", el, `background icon is ${dy > 0 ? "+" : ""}${dy}px from the text center (background-position ${pos.join(" ")})`, { dy, background: true });
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
    issues.sort((a, b) => b.severity - a.severity);
    const limited = issues.slice(0, maxIssues);
    const counts = {};
    for (const i of issues) counts[i.type] = (counts[i.type] || 0) + 1;
    return { issues: limited, total: issues.length, counts, text: renderReport(limited, options.tokenBudget || 600), elapsedMs: Date.now() - t0 };
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
        case "spacing-inconsistent": {
          const axis = i.axis || "y";
          push(i, `${sel} > * { ${axis === "y" ? "margin-top: 8px; margin-bottom: 0;" : "margin-left: 6px; margin-right: 0;"} }`);
          break;
        }
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
  async function generatePatch({ client, doc, css, reportText, style, settings, onChunk, signal }) {
    const messages = repairMessages({ css, reportText, style });
    const params = { temperature: Math.min(0.4, settings.temperature), topP: settings.topP, maxTokens: settings.maxPatchTokens, disableThinking: true };
    return streamValidated({ client, messages, params, doc, mode: "patch", onChunk, signal });
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
  }, measure, inspect = inspectPage, patcher = generatePatch, settleMs = 250 }) {
    const maxRounds = Math.max(0, Number(settings.maxRepairRounds) || 0);
    const opts = { baseline, iconVars, measure, tolerance: settings.inspectTolerance };
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
      const v = validateCss(fb.css, { doc, mode: "patch" });
      fallbackCss = v.css;
      fixed = fb.fixed;
      if (slots) slots.fallback.set(fallbackCss);
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
  return __toCommonJS(lib_exports);
})();
