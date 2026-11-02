import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '../src/icons/sanitize.js';
import { svgToDataUri, dataUriToSvg } from '../src/util/svg-data-uri.js';

const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#000" d="M1 1h14v14H1z"/><rect x="2" y="2" width="12" height="12" fill="#ffcc00"/></svg>';

describe('sanitizeSvg', () => {
  it('keeps a clean pixel icon intact', () => {
    const r = sanitizeSvg(GOOD);
    expect(r.svg).toContain('<path');
    expect(r.svg).toContain('fill="#ffcc00"');
    expect(r.removed).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it('strips markdown fences, prolog and comments around the svg', () => {
    const r = sanitizeSvg('```svg\n<?xml version="1.0"?>\n<!-- hi -->' + GOOD + '\n```');
    expect(r.svg.startsWith('<svg')).toBe(true);
    expect(r.svg).not.toContain('```');
  });
  it('removes script, foreignObject, image and event handlers', () => {
    const bad = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" onload="alert(1)"><script>alert(1)</script><foreignObject><div>x</div></foreignObject><image href="https://evil/x.png"/><rect width="4" height="4" onclick="x()" fill="#000"/><a href="javascript:alert(1)"><circle r="2"/></a></svg>';
    const r = sanitizeSvg(bad);
    expect(r.svg).not.toMatch(/script|foreignObject|image|onload|onclick|javascript|<a /i);
    expect(r.svg).toContain('<rect');
    expect(r.removed).toEqual(expect.arrayContaining(['attr:onload', 'element:script', 'element:foreignobject', 'element:image', 'attr:onclick', 'element:a']));
  });
  it('blocks external href and url() references but keeps local ones', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><use xlink:href="https://evil/x.svg#a"/><use href="#g"/><rect width="8" height="8" fill="url(https://evil/x.svg#g)"/><rect width="8" height="8" fill="url(#g)"/></svg>';
    const r = sanitizeSvg(svg);
    expect(r.svg).not.toContain('evil');
    expect(r.svg).toContain('href="#g"');
    expect(r.svg).toContain('fill="url(#g)"');
  });
  it('drops style attributes and unknown attributes', () => {
    const r = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="8" height="8" style="fill:url(https://x)" data-x="1" fill="#000"/></svg>');
    expect(r.svg).not.toContain('style=');
    expect(r.svg).not.toContain('data-x');
    expect(r.svg).toContain('fill="#000"');
  });
  it('rejects non-svg, malformed and oversized input', () => {
    expect(sanitizeSvg('hello').svg).toBeNull();
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>').svg).toBeNull();
    expect(sanitizeSvg(GOOD, { maxLength: 20 }).svg).toBeNull();
    expect(sanitizeSvg(12).svg).toBeNull();
  });
  it('rejects svgs with no shapes left after sanitizing', () => {
    const r = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text>hi</text></svg>');
    expect(r.svg).toBeNull();
    expect(r.errors).toContain('no shapes left');
  });
  it('adds xmlns and a default viewBox', () => {
    const r = sanitizeSvg('<svg><rect width="2" height="2"/></svg>');
    expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(r.svg).toContain('viewBox="0 0 16 16"');
  });
  it('round-trips through the data URI helpers', () => {
    const r = sanitizeSvg(GOOD);
    const uri = svgToDataUri(r.svg);
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain('"');
    expect(dataUriToSvg(uri)).toContain('<path');
  });
});
