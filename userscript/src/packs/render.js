// Turns a theme (packs/themes.js) plus the page summary into CSS: the instant,
// deterministic base of every design. The model then adds site-specific touches.
// Output uses only library assets and plain colors and goes through validateCss
// like any other CSS before it touches the page.
import { THEMES } from './themes.js';
import { splitSelectorList } from '../validate.js';

const ICON_WORDS = [
  [/\b(home|start|index|main page)\b/i, 'home'],
  [/\b(search|find)\b/i, 'search'],
  [/\b(contact|mail|e-?mail|write us|inbox)\b/i, 'mail'],
  [/\b(shop|store|cart|basket|checkout|buy|products?|pricing|prices?|order)\b/i, 'cart'],
  [/\b(log ?in|sign ?in|sign ?up|register|account|profile|members?|my page|user)\b/i, 'user'],
  [/\b(about|team|company|who we are|info)\b/i, 'info'],
  [/\b(help|faq|support|questions?)\b/i, 'info'],
  [/\b(archives?|categories|category|browse|directory|folders?|collections?)\b/i, 'folder'],
  [/\b(download|install|get it)\b/i, 'download'],
  [/\b(docs?|documentation|guides?|manual|reference|learn|tutorials?|wiki)\b/i, 'file'],
  [/\b(blog|news|posts?|articles?|stories|journal|writing)\b/i, 'file'],
  [/\b(music|audio|songs?|podcasts?|radio)\b/i, 'music'],
  [/\b(photos?|gallery|images?|pictures?|pics)\b/i, 'image'],
  [/\b(videos?|watch|play|movies?|tv|streams?)\b/i, 'play'],
  [/\b(links?|webring|friends)\b/i, 'link'],
  [/\b(rss|feed|subscribe|newsletter)\b/i, 'rss'],
  [/\b(forums?|community|chat|discussions?|comments?|talk|guestbook)\b/i, 'chat'],
  [/\b(events?|calendar|schedule|dates?|upcoming)\b/i, 'calendar'],
  [/\b(settings|preferences|options|config|tools)\b/i, 'gear'],
  [/\b(new|latest|recent|newest)\b/i, 'new'],
  [/\b(popular|trending|hot|top|best)\b/i, 'hot'],
  [/\b(favou?rites?|starred|featured)\b/i, 'star'],
  [/\b(security|privacy|legal|terms|secure|password)\b/i, 'lock'],
  [/\b(world|international|languages?|global|countries|english|español|deutsch)\b/i, 'globe'],
  [/\b(print)\b/i, 'print'],
  [/\b(tags?|topics?|labels?)\b/i, 'tag'],
  [/\b(bookmarks?|saved|reading list|later)\b/i, 'bookmark'],
  [/\b(back|previous|prev|older)\b/i, 'arrow-left'],
  [/\b(next|more|continue|newer|all)\b/i, 'arrow-right'],
  [/\b(menu)\b/i, 'menu'],
  [/\b(history|time|clock|past|yesterday)\b/i, 'clock'],
  [/\b(love|like|heart|wishlist)\b/i, 'heart'],
  [/\b(ok|done|submit|save|apply|go|send|confirm)\b/i, 'check'],
  [/\b(close|cancel|delete|remove|clear|reset)\b/i, 'close'],
  [/\b(warning|alert|important|notice)\b/i, 'warning'],
];

export function iconForText(text, href = '', fallback = null) {
  const hay = `${text || ''} ${String(href || '').replace(/^https?:\/\/[^/]+/, '').replace(/[/._?=&#-]+/g, ' ')}`;
  for (const [re, icon] of ICON_WORDS) if (re.test(hay)) return icon;
  return fallback;
}

const each = (list, suffix) => splitSelectorList(list).map((s) => s + suffix).join(', ');
const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const decl = (prop, v) => (v == null || v === '' ? '' : `${prop}: ${v}; `);
const box = (t) => decl('background-color', t.bg) + decl('background-image', t.bgImage || (t.bg ? 'none' : null)) + decl('color', t.text) + decl('border', t.border) + decl('border-bottom', t.borderBottom) + decl('border-radius', t.radius) + decl('box-shadow', t.shadow) + decl('padding', t.padding) + decl('font-family', t.font && t.font.startsWith('var') ? t.font : null) + decl('font', t.font && !t.font.startsWith('var') ? t.font : null) + decl('font-size', t.size);

const ICON_SLOT = 'background-repeat: no-repeat; background-position: 4px center; background-size: 16px 16px; padding-left: 24px; ';

const NAV_LINK = {
  bevel: (T) => `display: inline-block; background-color: #c0c0c0; color: ${T.nav.text}; border: 2px outset #ffffff; padding: 2px 8px 2px 24px; margin: 2px; text-decoration: none; font-weight: bold; `,
  glossy: () => `display: inline-block; background-image: var(--grad-glossy-blue); color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #1a5a99; border-radius: 6px; box-shadow: var(--glossy-shadow); padding: 5px 12px 5px 26px; margin: 2px; text-decoration: none; font-weight: bold; `,
  pill: () => `display: inline-block; background-image: var(--grad-chrome); color: #101020; border: 1px solid #777777; border-radius: 999px; padding: 4px 14px 4px 26px; margin: 2px; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; `,
  'pill-dark': () => `display: inline-block; background-image: var(--grad-glossy-black); color: #ffffff; border: 1px solid #000000; border-radius: 999px; padding: 4px 14px 4px 26px; margin: 2px; text-decoration: none; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; `,
  plain: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: underline; padding: 2px 6px 2px 24px; margin: 1px; `,
  arrow: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: none; padding: 2px 6px 2px 24px; margin: 1px; font-weight: bold; `,
  bracket: (T) => `display: inline-block; color: ${T.nav.text}; text-decoration: none; padding: 2px 6px; margin: 1px; `,
  pixel: (T) => `display: inline-block; background-color: #ffffff; color: ${T.nav.text}; border: 2px solid #6b4c6b; border-radius: 0; box-shadow: 2px 2px 0 #ff8fc8; padding: 2px 8px 2px 24px; margin: 3px; text-decoration: none; `,
  aqua: () => `display: inline-block; background-image: var(--grad-aqua); color: #0b2a55; border: 1px solid #7fa6dc; border-radius: 999px; box-shadow: var(--glossy-shadow); padding: 4px 12px 4px 26px; margin: 2px; text-decoration: none; font-weight: bold; `,
};

const BUTTON = {
  bevel: `background-color: #c0c0c0; background-image: none; color: #000000; border: 2px outset #ffffff; border-radius: 0; box-shadow: none; text-shadow: none; font-family: var(--font-ms-sans); font-size: 12px; padding: 3px 12px; `,
  'glossy-blue': `background-image: var(--grad-glossy-blue); background-color: #3b8dd6; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #1a5a99; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 6px 16px; `,
  'glossy-green': `background-image: var(--grad-glossy-green); background-color: #8cc63f; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #5c8a1f; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 6px 16px; `,
  'glossy-orange': `background-image: var(--grad-glossy-orange); background-color: #f7941d; color: #ffffff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); border: 1px solid #b35f00; border-radius: 6px; box-shadow: var(--glossy-shadow); font-family: var(--font-arial); font-weight: bold; text-transform: uppercase; padding: 6px 16px; `,
  pill: `background-image: var(--grad-chrome); background-color: #c0c0c0; color: #101020; border: 1px solid #777777; border-radius: 999px; box-shadow: 0 0 8px rgba(0,229,255,.6); font-family: var(--font-verdana); font-weight: bold; text-transform: uppercase; padding: 5px 16px; `,
  'flat-earth': `background-color: #8a6d3b; background-image: none; color: #ffffff; border: 1px solid #5a6b4a; border-radius: 3px; box-shadow: none; font-family: var(--font-verdana); padding: 4px 12px; `,
  'flat-gray': `background-color: #eeeeee; background-image: none; color: #000000; border: 1px solid #999999; border-radius: 0; box-shadow: none; font-family: var(--font-arial); font-size: 11px; padding: 2px 8px; `,
  'flat-navy': `background-color: #003366; background-image: none; color: #ffffff; border: 1px solid #003366; border-radius: 0; box-shadow: none; font-family: var(--font-verdana); font-size: 11px; font-weight: bold; padding: 3px 10px; `,
  'flat-pink': `background-color: #ff69b4; background-image: none; color: #000000; border: 2px solid #ffffff; border-radius: 0; box-shadow: none; font-family: var(--font-arial); font-weight: bold; padding: 4px 12px; `,
  terminal: `background-color: #000000; background-image: none; color: #00ff41; border: 1px solid #00ff41; border-radius: 0; box-shadow: none; font-family: var(--font-courier); text-transform: uppercase; padding: 3px 10px; `,
  pixel: `background-color: #fff6a8; background-image: none; color: #6b4c6b; border: 2px solid #6b4c6b; border-radius: 0; box-shadow: 2px 2px 0 #ff8fc8; font-family: var(--font-verdana); font-weight: bold; padding: 3px 10px; `,
  aqua: `background-image: var(--grad-aqua); background-color: #5e95e0; color: #ffffff; text-shadow: 0 1px 1px rgba(0,0,0,.4); border: 1px solid #5e95e0; border-radius: 999px; box-shadow: var(--glossy-shadow); font-family: var(--font-lucida); font-weight: bold; padding: 5px 16px; `,
};
const BUTTON_HOVER = {
  bevel: 'border-style: inset; ',
  terminal: 'background-color: #00ff41; color: #000000; ',
  'flat-navy': 'background-color: #cc6600; border-color: #cc6600; ',
  'flat-pink': 'background-color: #00ccff; ',
  'flat-earth': 'background-color: #5a6b4a; ',
  'flat-gray': 'background-color: #ffffcc; ',
};

const INPUT = {
  inset: `background-color: #ffffff; color: #000000; border: 2px inset #ffffff; border-radius: 0; box-shadow: var(--win-shadow-in); font-family: var(--font-ms-sans); padding: 2px 4px; `,
  rounded: `background-color: #ffffff; color: #333333; border: 1px solid #aabbdd; border-radius: 6px; box-shadow: inset 0 1px 2px rgba(0,0,0,.12); padding: 4px 8px; `,
  'rounded-pink': `background-color: #ffffff; color: #6b4c6b; border: 2px dotted #ff8fc8; border-radius: 8px; box-shadow: none; padding: 3px 8px; `,
  flat: `background-color: #ffffff; color: #000000; border: 1px solid #999999; border-radius: 0; box-shadow: none; padding: 2px 4px; `,
  'flat-dark': `background-color: #111111; color: #eeeeee; border: 1px solid #555555; border-radius: 2px; box-shadow: none; padding: 3px 6px; `,
  dotted: `background-color: #ffffff; color: #333333; border: 1px dotted #8a6d3b; border-radius: 0; box-shadow: none; padding: 3px 6px; `,
  terminal: `background-color: #000000; color: #00ff41; border: 1px solid #008f11; border-radius: 0; box-shadow: none; font-family: var(--font-courier); caret-color: #00ff41; padding: 2px 6px; `,
};

const HR = {
  rainbow: 'border: 0; height: 4px; background-image: var(--grad-rainbow); ',
  soft: 'border: 0; height: 1px; background-color: #cfdcea; ',
  neon: 'border: 0; height: 2px; background-color: #00e5ff; box-shadow: 0 0 8px #00e5ff; ',
  groove: 'border: 0; border-top: 1px solid #808080; border-bottom: 1px solid #ffffff; height: 0; ',
  dotted: 'border: 0; border-top: 1px dotted #8a6d3b; height: 0; ',
  thin: 'border: 0; border-top: 1px solid #cccccc; height: 0; ',
  dashed: 'border: 0; border-top: 1px dashed #008f11; height: 0; ',
  orange: 'border: 0; height: 3px; background-color: #ff6600; ',
  hearts: 'border: 0; height: 14px; background-image: var(--bg-tile-hearts); background-repeat: repeat-x; ',
};

function tableCss(kind, S) {
  switch (kind) {
    case 'bevel':
      return [`${S.tables} { background-color: #ffffff; color: #000000; border: 2px inset #ffffff; border-collapse: separate; }`, `${S.tables} th { background-color: #000080; color: #ffffff; border: 1px solid #c0c0c0; }`, `${S.tables} td { border: 1px solid #c0c0c0; }`];
    case 'forum':
      return [`${S.tables} { background-color: #ffffff; color: #333333; border: 1px solid #a9b8c2; }`, `${S.tables} th { background-image: var(--grad-navy-header); background-color: #5c7099; color: #ffffff; border: 1px solid #3d4f6e; }`, `${S.tables} td { border: 1px solid #d3dce8; }`, `${S.tables} tr:nth-child(even) td { background-color: #e5edf5; }`];
    case 'dark':
      return [`${S.tables} { background-color: #111111; color: #dddddd; border: 1px solid #444444; }`, `${S.tables} th { background-color: #222222; color: #ffffff; border: 1px solid #444444; }`, `${S.tables} td { border: 1px solid #333333; }`];
    case 'terminal':
      return [`${S.tables} { background-color: #000000; color: #00ff41; border: 1px solid #00ff41; }`, `${S.tables} th, ${S.tables} td { border: 1px dashed #008f11; }`];
    case 'rounded':
      return [`${S.tables} { background-color: #ffffff; color: #333333; border: 1px solid #cfdcea; border-radius: 8px; }`, `${S.tables} th { background-color: #e8f1fa; color: #1f6fbf; border-bottom: 2px solid #cfdcea; }`, `${S.tables} td { border-bottom: 1px solid #eef3f8; }`];
    case 'lines':
      return [`${S.tables} { background-color: #ffffff; color: #000000; border: 1px solid #cccccc; }`, `${S.tables} th { background-color: #eeeeee; color: #000000; border: 1px solid #cccccc; }`, `${S.tables} td { border: 1px solid #dddddd; }`];
    default:
      return [`${S.tables} th { border-bottom: 1px solid #c9b99b; color: #5a6b4a; }`, `${S.tables} td { border-bottom: 1px dotted #c9b99b; }`];
  }
}

export function selectorsFromSummary(data = {}) {
  const landmarks = data.landmarks || [];
  const sel = (role, fallback) => {
    const ls = landmarks.filter((l) => l.role === role).map((l) => l.selector);
    return ls.length ? [...new Set(ls)].join(', ') : fallback;
  };
  const nav = sel('nav', 'nav, [role=navigation]');
  const buttons = [...new Set([...(data.buttons || []).map((b) => b.selector), 'button', 'input[type=submit]', 'input[type=button]', '[role=button]'])].join(', ');
  return {
    header: sel('header', 'header, [role=banner]'),
    nav,
    navLinks: each(nav, ' a'),
    main: sel('main', 'main, [role=main], #content, article'),
    sidebar: sel('sidebar', 'aside, [role=complementary]'),
    footer: sel('footer', 'footer, [role=contentinfo]'),
    search: sel('search', 'form[role=search]'),
    buttons,
    inputs: 'input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color]), select, textarea',
    headings: 'h1, h2, h3, h4, h5, h6',
    tables: 'table',
  };
}

export function renderPack(styleId, data = {}, { maxNavIcons = 16, maxNavLinks = 40 } = {}) {
  const T = THEMES[styleId];
  if (!T) return { css: '', applyClass: [], styleId, notes: ['unknown style'] };
  const S = selectorsFromSummary(data);
  const R = [];
  const applyClass = [];
  const push = (sel, body) => body.trim() && R.push(`${sel} { ${body.trim()} }`);

  // page
  push('body', decl('background-color', T.page.bg) + decl('background-image', T.page.bgImage || 'none') + decl('background-repeat', T.page.bgRepeat) + decl('background-attachment', T.page.bgImage ? 'fixed' : null) + decl('color', T.page.text) + decl('font-family', T.page.font) + decl('font-size', T.page.size) + decl('cursor', T.page.cursor));
  push('a', decl('color', T.link.color) + decl('text-decoration', T.link.decoration || 'underline') + decl('font-weight', T.link.weight));
  push('a:visited', decl('color', T.link.visited));
  push('a:hover', decl('color', T.link.hover) + decl('background-color', T.link.hoverBg));
  // headings
  const H = T.heading;
  let shadow = H.shadow;
  if (H.rainbow) shadow = '2px 2px 0 #ff00ff, 4px 4px 0 #00ffff, 6px 6px 0 #ffff00';
  push(S.headings, decl('font-family', H.font) + decl('color', H.color) + decl('text-shadow', shadow) + decl('text-transform', H.transform) + decl('letter-spacing', H.spacing) + decl('font-weight', H.weight) + decl('font-style', H.style) + 'background-image: none; ');
  if (H.sizeScale) push('h1', `font-size: ${Math.round(28 * H.sizeScale)}px; `) && push('h2', `font-size: ${Math.round(20 * H.sizeScale)}px; `) && push('h3', `font-size: ${Math.round(16 * H.sizeScale)}px; `);
  if (H.prefix) push(each(S.headings, '::before'), `content: "${esc(H.prefix)}"; `);
  // landmarks
  push(S.header, box(T.header));
  push(each(S.header, ' a') + ', ' + each(S.header, ' a:visited'), decl('color', T.header.text || 'inherit'));
  push(S.nav, box({ bg: T.nav.bg === 'transparent' ? null : T.nav.bg, text: T.nav.text, border: T.nav.border, padding: T.nav.dense ? '2px 4px' : '4px 6px', font: T.nav.font }));
  const linkStyle = NAV_LINK[T.nav.link] || NAV_LINK.plain;
  // Per nav: a normal menu (<= maxNavLinks links) gets the full button/icon
  // treatment; a huge sidebar or chip strip only gets colors, so the validator
  // never has to drop the padding that makes room for an icon.
  const navs = (data.landmarks || []).filter((l) => l.role === 'nav');
  const navEntries = navs.length ? navs.map((l) => ({ selector: l.selector, links: l.links || 0 })) : splitSelectorList(S.nav).map((sel) => ({ selector: sel, links: 0 }));
  const iconNavs = new Set();
  for (const n of navEntries) {
    const links = `${n.selector} a`;
    if (n.links > maxNavLinks) {
      push(`${links}, ${links}:visited`, decl('color', T.nav.text) + 'text-decoration: none; ' + decl('font-family', T.nav.font));
      continue;
    }
    push(`${links}, ${links}:visited`, linkStyle(T) + (T.nav.icon ? ICON_SLOT : ''));
    if (T.nav.link === 'bevel') push(`${links}:active`, 'border-style: inset; ');
    if (T.nav.link === 'bracket') {
      push(`${links}::before`, 'content: "["; color: #008f11; ');
      push(`${links}::after`, 'content: "]"; color: #008f11; ');
    }
    if (T.nav.icon) iconNavs.add(n.selector);
  }
  // nav icons matched to link text / href; links that already carry an icon
  // (svg/img) or have no text keep theirs
  if (T.nav.icon && iconNavs.size) {
    const seen = new Set();
    const iconRules = [];
    const noIcon = [];
    for (const l of data.navLinks || []) {
      if (!iconNavs.has(l.nav) || !l.href || seen.has(l.nav + '|' + l.href)) continue;
      seen.add(l.nav + '|' + l.href);
      const sel = `${l.nav} a[href="${esc(l.href)}"]`;
      if (l.hasIcon || !l.text) noIcon.push(sel);
      else if (iconRules.length < maxNavIcons) iconRules.push(`${sel} { background-image: var(--icon-${iconForText(l.text, l.href, T.nav.icon)}); }`);
    }
    for (const nav of iconNavs) R.push(`${nav} a { background-image: var(--icon-${T.nav.icon}); }`); // default first, specific rules after
    R.push(...iconRules);
    if (noIcon.length) R.push(`${noIcon.join(', ')} { background-image: none; padding-left: 8px; }`);
  }
  push(S.main, box({ ...T.main, bgImage: T.main.bgImage || 'none' }) + (T.main.narrow ? `max-width: ${T.main.narrow}; margin-left: auto; margin-right: auto; ` : ''));
  push(S.sidebar, box({ ...T.sidebar, bgImage: 'none' }));
  push(each(S.sidebar, ' > div') + ', ' + each(S.sidebar, ' > section') + ', ' + each(S.sidebar, ' > ul'), decl('background-color', T.sidebar.bg) + decl('color', T.sidebar.text) + decl('border', T.sidebar.border) + decl('border-radius', T.sidebar.radius) + 'box-shadow: none; ');
  push(each(S.sidebar, ' a') + ', ' + each(S.sidebar, ' a:visited'), decl('color', T.link.color));
  push(S.footer, box({ ...T.footer, padding: T.footer.padding || '10px 14px' }));
  push(each(S.footer, ' a') + ', ' + each(S.footer, ' a:visited'), decl('color', T.footer.text));
  // controls
  push(S.buttons, BUTTON[T.button] || BUTTON.bevel);
  if (BUTTON_HOVER[T.button]) push(each(S.buttons, ':hover'), BUTTON_HOVER[T.button]);
  // text-button groups get the full button style on their own selector too, so
  // they keep it even when the generic `button` rule loses its spacing on pages
  // full of icon-only buttons
  for (const b of (data.buttons || []).slice(0, 8)) {
    if (b.hasIcon || b.count > maxNavLinks || !b.text) continue;
    push(b.selector, BUTTON[T.button] || BUTTON.bevel);
    const icon = b.text.length <= 24 ? iconForText(b.text, '', null) : null;
    if (icon) push(b.selector, `background-image: var(--icon-${icon}); background-repeat: no-repeat; background-position: 6px center; background-size: 16px 16px; padding-left: 26px; `);
  }
  push(S.inputs, INPUT[T.input] || INPUT.flat);
  // media & tables
  const I = T.image;
  push('img', decl('border', I.border) + decl('border-radius', I.radius) + decl('box-shadow', I.shadow) + decl('padding', I.padding) + decl('background-color', I.bg) + decl('filter', I.filter));
  R.push(...tableCss(T.table, S));
  if (T.table === 'forum') applyClass.push({ selector: 'table', className: 'retro-table-rows' });
  // extras
  const X = T.extras || {};
  if (X.hr && HR[X.hr]) push('hr', HR[X.hr]);
  if (X.bullets) push(each(S.main, ' li'), `list-style: none; background-image: var(--icon-${X.bullets}); background-repeat: no-repeat; background-position: 0 3px; background-size: 12px 12px; padding-left: 16px; `);
  if (X.counter) push(each(S.footer, '::before'), 'content: "You are visitor number 0013370"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: max-content; max-width: 100%; margin: 0 auto 8px auto; background-color: #000000; color: #00ff00; font-family: var(--font-courier); font-weight: bold; font-size: 14px; letter-spacing: 2px; border: 2px inset #808080; padding: 2px 8px; text-shadow: 0 0 4px #00ff00; ');
  // banner spans the whole width even when main is a grid/flex container
  if (X.underConstruction) push(each(S.main, '::before'), 'content: "UNDER CONSTRUCTION"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: 100%; height: auto; align-self: start; box-sizing: border-box; background-image: var(--bg-tile-hazard); background-color: #ffcc00; color: #000000; font-family: var(--font-arial-black); font-weight: bold; font-size: 12px; letter-spacing: 2px; line-height: 1.4; text-align: center; padding: 3px; margin-bottom: 10px; text-shadow: 1px 1px 0 #ffcc00, -1px -1px 0 #ffcc00, 1px -1px 0 #ffcc00, -1px 1px 0 #ffcc00; ');
  if (X.marquee) {
    push(each(S.header, '::after'), `content: "${esc(X.marquee)}"; display: block; grid-column: 1 / -1; flex: 1 1 100%; width: 100%; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-indent: 100%; animation: retro-marquee-text 22s linear infinite; font-family: var(--font-verdana); font-weight: bold; font-size: 12px; color: #ffff00; background-color: #000000; padding: 2px 0; margin-top: 6px; `);
    R.push('@keyframes retro-marquee-text { from { text-indent: 100%; } to { text-indent: -150%; } }');
  }
  if (X.badge) push(each(S.header, '::after'), `content: "${esc(X.badge)}"; display: inline-block; background-image: var(--grad-glossy-orange); color: #ffffff; font-family: var(--font-trebuchet); font-weight: bold; font-size: 10px; padding: 2px 7px; border-radius: 8px; margin-left: 8px; vertical-align: middle; text-shadow: 0 -1px 0 rgba(0,0,0,.3); `);
  if (X.statusBar) push(each(S.footer, '::after'), 'content: "Done                                          My Computer"; display: block; white-space: pre; border: 1px inset #ffffff; background-color: #c0c0c0; color: #000000; padding: 2px 6px; margin-top: 6px; font-family: var(--font-ms-sans); font-size: 11px; ');
  if (X.scanlines) push('body::after', 'content: ""; position: fixed; inset: 0; pointer-events: none; background-image: var(--bg-tile-scanlines); z-index: 2147483000; ');
  if (X.cursorBlink) push('h1::after', 'content: "_"; animation: retro-blink 1s steps(2, start) infinite; ');
  if (X.skipIntro) push(each(S.header, '::after'), 'content: "skip intro ▸"; float: right; font-family: var(--font-arial); font-size: 11px; color: #ccff00; text-transform: lowercase; ');
  if (X.trafficLights) push(each(S.header, '::before'), 'content: ""; display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: #ff5f57; box-shadow: 18px 0 0 #febc2e, 36px 0 0 #28c840; margin-right: 44px; vertical-align: middle; ');
  if (X.categoryBars) push('h2', `background-color: ${T.nav.bg === 'transparent' ? '#eeeeee' : T.nav.bg}; color: ${T.heading.color}; padding: 2px 6px; border-left: 6px solid ${T.link.hover}; `);
  if (X.sparkleHeading) push('h1', 'background-image: var(--bg-tile-glitter); ');

  return { css: R.join('\n'), applyClass, styleId, selectors: S };
}

export function listPackStyles() {
  return Object.keys(THEMES);
}
