// Shared by the build (library assets) and the runtime (generated icons).
// Produces a compact, CSS-safe `data:image/svg+xml,...` URI without base64.

const ENCODE = /[%#<>?[\]\\^`{|}"]/g;

export function minifySvg(svg) {
  return String(svg)
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

export function svgToDataUri(svg) {
  let s = minifySvg(svg);
  if (!/^<svg[\s>]/.test(s)) return null;
  if (!/xmlns=/.test(s)) s = s.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace(/"/g, "'");
  s = s.replace(ENCODE, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  return 'data:image/svg+xml,' + s;
}

export function dataUriToSvg(uri) {
  if (typeof uri !== 'string') return null;
  const m = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/s.exec(uri.trim());
  if (!m) return null;
  const meta = m[1] || '';
  const body = m[2];
  try {
    if (/;base64/.test(meta)) {
      const bin = typeof atob === 'function' ? atob(body) : Buffer.from(body, 'base64').toString('binary');
      return decodeURIComponent(escape(bin));
    }
    return decodeURIComponent(body);
  } catch {
    return null;
  }
}
