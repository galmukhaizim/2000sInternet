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
    STYLES: () => STYLES,
    VERSION: () => VERSION,
    dataUriToSvg: () => dataUriToSvg,
    svgToDataUri: () => svgToDataUri
  });

  // userscript/src/config.js
  var VERSION = "0.1.0";

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
  return __toCommonJS(lib_exports);
})();
