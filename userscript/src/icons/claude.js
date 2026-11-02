// Icon generation through the Claude Messages API (raw HTTP over
// GM_xmlhttpRequest; no SDK can run inside a userscript sandbox).
//
// SECURITY: the request carries ONLY the icon name and description plus the
// fixed style system prompt below. Never page content, URLs, titles or user
// data. The API key is read from GM storage here and placed in a header only.
import { readApiKey, hasApiKey } from '../storage.js';

/* global GM_xmlhttpRequest */

export const ICON_SYSTEM_PROMPT = `You draw tiny pixel-art icons for a year-2000 website toolkit. Reply with exactly one <svg> element and nothing else: no prose, no markdown fences, no XML prolog, no comments.
Requirements:
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 SIZE SIZE" shape-rendering="crispEdges"> where SIZE is the requested size (16 or 32).
- Pixel-art look: axis-aligned <path> or <rect> shapes snapped to the integer grid, a 1px black outline (#000000), flat fills, a highlight pixel or two.
- Palette only: #000000 #ffffff #c0c0c0 #808080 #ffcc00 #3366cc #cc3333 #339933 #ff6600 #99ccff #ff66aa #ffcc99 #ffe680.
- No gradients, filters, text, images, scripts, styles, animations or external references. No <text>.
- Use only path, rect, circle, polygon, g elements. Keep it under 1200 characters.
- The subject must be recognisable at 16 pixels: bold silhouette, few details.`;

export function buildIconRequest({ name, description, size = 16, settings }) {
  const n = String(name || '').replace(/[^a-z0-9-]/gi, '-').slice(0, 40);
  const d = String(description || '').replace(/\s+/g, ' ').slice(0, 160);
  return {
    url: settings.anthropicEndpoint,
    headers: {
      'anthropic-version': settings.anthropicVersion,
      'content-type': 'application/json',
    },
    body: {
      model: settings.iconModel,
      max_tokens: settings.iconMaxTokens || 1200,
      system: ICON_SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `Icon name: ${n}\nDescription: ${d || n}\nSize: ${size === 32 ? 32 : 16}` }],
    },
  };
}

// Pulls the SVG text out of a Messages API response body.
export function extractSvgFromResponse(json) {
  if (!json || !Array.isArray(json.content)) return { svg: null, error: 'bad response' };
  if (json.stop_reason === 'refusal') return { svg: null, error: 'refusal' };
  const text = json.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  if (start < 0 || end < 0) return { svg: null, error: json.stop_reason === 'max_tokens' ? 'truncated' : 'no svg in reply' };
  return { svg: text.slice(start, end + 6), error: null };
}

// Resolves to { svg } or { error }. Never throws, never blocks the design.
export function requestIconSvg({ name, description, size = 16, settings, signal, timeoutMs }) {
  return new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest !== 'function') return resolve({ svg: null, error: 'no GM_xmlhttpRequest' });
    if (!hasApiKey()) return resolve({ svg: null, error: 'no-key' });
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
        method: 'POST',
        url: req.url,
        headers: { ...req.headers, 'x-api-key': readApiKey() },
        data: JSON.stringify(req.body),
        timeout: timeoutMs || settings.iconTimeoutMs || 25000,
        anonymous: true,
        onload: (res) => {
          let json = null;
          try {
            json = JSON.parse(res.responseText);
          } catch {
            return finish({ svg: null, error: 'invalid json (' + res.status + ')' });
          }
          if (res.status < 200 || res.status >= 300) {
            const msg = (json && json.error && json.error.message) || 'http ' + res.status;
            return finish({ svg: null, error: res.status === 401 ? 'invalid-key' : res.status === 429 ? 'rate-limited' : msg, status: res.status });
          }
          finish(extractSvgFromResponse(json));
        },
        onerror: (e) => finish({ svg: null, error: 'network error' + (e && e.error ? ': ' + e.error : '') }),
        ontimeout: () => finish({ svg: null, error: 'timeout' }),
      });
    } catch (e) {
      return finish({ svg: null, error: 'request failed: ' + (e && e.message) });
    }
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          try {
            handle && handle.abort && handle.abort();
          } catch {
            /* ignore */
          }
          finish({ svg: null, error: 'aborted' });
        },
        { once: true },
      );
    }
  });
}
