// Transport between the userscript and the model host iframe (see host/host.js
// for the protocol). The host runs WebLLM on a fixed origin so weights download
// once. Nothing secret ever crosses this channel.

const NS = 'retro-web';

export class ModelUnavailableError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.code = code; // 'host-blocked' | 'host-unreachable' | 'popup-blocked' | 'popup-closed' | 'needs-gesture' | 'webgpu' | 'network' | 'memory' | 'model-id' | 'engine'
  }
}

export class ModelClient {
  constructor({ doc = document, hostUrl, modelId, customModel = null, contextWindow = 8192, onProgress = () => {}, handshakeTimeoutMs = 20000, loadTimeoutMs = 20 * 60 * 1000 }) {
    this.doc = doc;
    this.hostUrl = hostUrl;
    this.modelId = modelId;
    this.customModel = customModel;
    this.contextWindow = contextWindow;
    this.onProgress = onProgress;
    this.handshakeTimeoutMs = handshakeTimeoutMs;
    this.loadTimeoutMs = loadTimeoutMs;
    this.frame = null;
    this.popup = null;
    this.mode = null; // 'frame' | 'popup'
    this.ready = null;
    this.loaded = null;
    this.info = null;
    this.pending = new Map();
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

  // The window we talk to: the hidden frame, or the popup when the page's CSP blocks frames.
  get peer() {
    if (this.frame) return this.frame.contentWindow;
    if (this.popup && !this.popup.closed) return this.popup;
    return null;
  }

  _post(msg) {
    const peer = this.peer;
    if (!peer) throw new ModelUnavailableError('host-unreachable', 'model host window missing');
    peer.postMessage({ ns: NS, ...msg }, this.hostOrigin || '*');
  }

  _onMessage(e) {
    const peer = this.peer;
    if (!peer || e.source !== peer) return;
    const m = e.data;
    if (!m || m.ns !== NS) return;
    switch (m.t) {
      case 'ready':
        this.info = m;
        if (this._readyResolve) this._readyResolve(m);
        break;
      case 'progress':
        this.onProgress({ text: m.text, progress: m.progress });
        break;
      case 'loaded':
        if (this._loadedResolve) this._loadedResolve(m.modelId);
        break;
      case 'delta': {
        const p = this.pending.get(m.id);
        if (p) {
          p.text += m.text;
          p.onDelta(m.text, p.text);
        }
        break;
      }
      case 'done': {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          p.resolve({ text: m.text != null ? m.text : p.text, usage: m.usage, finish: m.finish });
        }
        break;
      }
      case 'error': {
        const err = new ModelUnavailableError(m.code || 'engine', m.message || 'model error');
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

  _hostUrl() {
    const url = new URL(this.hostUrl);
    if (!/\.html$/.test(url.pathname) && !url.pathname.endsWith('/')) url.pathname += '/';
    url.searchParams.set('v', '2');
    return url;
  }

  // Connects to the host and waits for its `ready`. mode 'frame' (default) uses a
  // hidden iframe; mode 'popup' opens a small window instead, which a page's CSP
  // cannot block but which needs a user gesture (click) to be allowed.
  connect({ mode = 'frame' } = {}) {
    if (this.ready) return this.ready;
    this.mode = mode;
    this.ready = new Promise((resolve, reject) => {
      const doc = this.doc;
      const win = doc.defaultView || window;
      const url = this._hostUrl();
      let settled = false;
      let hello = null;
      let timer = null;
      let onCsp = null;
      const finish = (err, info) => {
        if (settled) return;
        settled = true;
        clearInterval(hello);
        clearTimeout(timer);
        if (onCsp) doc.removeEventListener('securitypolicyviolation', onCsp);
        if (err) {
          this.dispose();
          reject(err);
        } else resolve(info);
      };
      this._readyResolve = (info) => finish(null, info);
      win.addEventListener('message', this._listener);

      if (mode === 'popup') {
        url.searchParams.set('popup', '1');
        const w = Math.min(520, win.screen ? win.screen.availWidth : 520);
        const features = `popup=yes,width=${w},height=320,left=${Math.max(0, (win.screen ? win.screen.availWidth : 1200) - w - 20)},top=40`;
        let popup = null;
        try {
          popup = win.open(url.href, 'retro-web-host', features);
        } catch {
          popup = null;
        }
        if (!popup) return finish(new ModelUnavailableError('popup-blocked', 'the browser blocked the model window — allow popups for this site, or press Redesign again'));
        this.popup = popup;
        hello = setInterval(() => {
          if (popup.closed) return finish(new ModelUnavailableError('popup-closed', 'the model window was closed'));
          try {
            this._post({ t: 'hello' });
          } catch {
            /* not yet */
          }
        }, 400);
        timer = setTimeout(() => finish(new ModelUnavailableError('host-unreachable', `model host not reachable at ${this.hostUrl}`)), this.handshakeTimeoutMs);
        return;
      }

      const frame = doc.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('title', 'retro-web model host');
      frame.setAttribute('data-retro-web', 'host');
      frame.style.cssText = 'position:fixed!important;width:1px!important;height:1px!important;left:-9999px!important;top:-9999px!important;border:0!important;opacity:0!important;pointer-events:none!important;';
      onCsp = (ev) => {
        const d = (ev.effectiveDirective || ev.violatedDirective || '').split(' ')[0];
        if (/^(frame-src|child-src|default-src)$/.test(d) && String(ev.blockedURI || '').startsWith(this.hostOrigin || '\u0000')) {
          // fail fast so a popup fallback can still use the user's click
          finish(new ModelUnavailableError('host-blocked', `this site's Content Security Policy blocks the model host frame (${this.hostOrigin})`));
        }
      };
      doc.addEventListener('securitypolicyviolation', onCsp);
      this.frame = frame;
      hello = setInterval(() => {
        try {
          if (frame.contentWindow) this._post({ t: 'hello' });
        } catch {
          /* not yet */
        }
      }, 400);
      timer = setTimeout(
        () => finish(new ModelUnavailableError('host-unreachable', `model host not reachable at ${this.hostUrl} (GitHub Pages not deployed yet, or for local dev run \`npm run host\` and set the Host URL in Advanced)`)),
        this.handshakeTimeoutMs,
      );
      frame.src = url.href;
      (doc.body || doc.documentElement).appendChild(frame);
    });
    return this.ready;
  }

  async load() {
    const info = await this.connect();
    if (!info.webgpu) throw new ModelUnavailableError('webgpu', 'WebGPU is not available in this browser: ' + (info.reason || 'unknown'));
    if (this.loaded) return this.loaded;
    this.loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ModelUnavailableError('engine', 'model load timed out')), this.loadTimeoutMs);
      this._loadedResolve = (id) => {
        clearTimeout(timer);
        resolve(id);
      };
      this._loadedReject = (err) => {
        clearTimeout(timer);
        this.loaded = null;
        reject(err);
      };
      this._post({ t: 'load', modelId: this.modelId, customModel: this.customModel, contextWindow: this.contextWindow });
    });
    return this.loaded;
  }

  // Streams a chat completion. onDelta(deltaText, fullText). Returns {text, usage, finish}.
  async generate({ messages, params = {}, onDelta = () => {}, signal } = {}) {
    await this.load();
    const id = 'g' + ++this.seq + '-' + Math.random().toString(36).slice(2, 8);
    return new Promise((resolve, reject) => {
      const entry = { text: '', onDelta, resolve, reject };
      this.pending.set(id, entry);
      if (signal) {
        const onAbort = () => {
          if (!this.pending.has(id)) return;
          try {
            this._post({ t: 'abort', id });
          } catch {
            /* ignore */
          }
          this.pending.delete(id);
          reject(new DOMException('aborted', 'AbortError'));
        };
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }
      try {
        this._post({ t: 'generate', id, messages, params });
      } catch (e) {
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  dispose() {
    try {
      (this.doc.defaultView || window).removeEventListener('message', this._listener);
    } catch {
      /* ignore */
    }
    if (this.frame) {
      try {
        this.frame.remove();
      } catch {
        /* ignore */
      }
    }
    if (this.popup) {
      // ask the host window to close itself, and also close it from here
      const popup = this.popup;
      try {
        if (!popup.closed) popup.postMessage({ ns: NS, t: 'close' }, this.hostOrigin || '*');
      } catch {
        /* ignore */
      }
      try {
        popup.close();
      } catch {
        /* ignore */
      }
    }
    this.frame = null;
    this.popup = null;
    this.mode = null;
    this.ready = null;
    this.loaded = null;
    for (const [, p] of this.pending) p.reject(new ModelUnavailableError('engine', 'client disposed'));
    this.pending.clear();
  }
}

export function describeModelError(err) {
  if (!err) return 'unknown error';
  if (err.name === 'AbortError') return 'cancelled';
  if (err instanceof ModelUnavailableError) {
    switch (err.code) {
      case 'host-blocked':
        return 'blocked by this site\'s CSP (model host frame)';
      case 'host-unreachable':
        return 'model host unreachable (check Host URL in Advanced; local dev: `npm run host`)';
      case 'popup-blocked':
      case 'popup-closed':
      case 'needs-gesture':
        return err.message;
      case 'webgpu':
        return 'WebGPU unavailable in this browser';
      case 'network':
        return 'could not download model weights';
      case 'memory':
        return 'not enough GPU memory for this model';
      case 'model-id':
        return 'unknown model id (check Advanced)';
      default:
        return err.message || 'model error';
    }
  }
  return String(err.message || err);
}
