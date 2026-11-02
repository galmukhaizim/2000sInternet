// Minimal Tampermonkey API shim for harnesses (Playwright eval, manual testing
// in a plain page). Injected BEFORE dist/retro.user.js.
//
// Storage is in-memory (optionally seeded from window.__retroSeed) so nothing
// leaks between pages. GM_xmlhttpRequest is routed through
// window.__retroNodeFetch when the harness exposes it (Node performs the HTTP
// request and injects the API key itself, so the key never enters the page);
// otherwise it falls back to page fetch().
(function () {
  const store = new Map(Object.entries((window.__retroSeed && window.__retroSeed.values) || {}));
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => {
    store.set(k, v);
  };
  window.GM_deleteValue = (k) => {
    store.delete(k);
  };
  window.GM_listValues = () => [...store.keys()];
  window.GM_registerMenuCommand = () => {};
  window.GM_addStyle = (css) => {
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    return s;
  };
  window.GM_xmlhttpRequest = (opts) => {
    const run = async () => {
      if (typeof window.__retroNodeFetch === 'function') {
        return window.__retroNodeFetch({ method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data || null });
      }
      const res = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.data || undefined });
      return { status: res.status, responseText: await res.text() };
    };
    const ctl = { aborted: false, abort() { ctl.aborted = true; } };
    const timer = opts.timeout ? setTimeout(() => { ctl.aborted = true; opts.ontimeout && opts.ontimeout(); }, opts.timeout) : null;
    run().then(
      (r) => {
        if (timer) clearTimeout(timer);
        if (ctl.aborted) return;
        opts.onload && opts.onload({ status: r.status, responseText: r.responseText, finalUrl: opts.url });
      },
      (e) => {
        if (timer) clearTimeout(timer);
        if (ctl.aborted) return;
        opts.onerror && opts.onerror({ error: String(e) });
      },
    );
    return ctl;
  };
  window.__retroGMStore = store; // harness-only inspection
})();
