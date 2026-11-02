// Model host page script. Runs on a fixed origin (localhost:4173 in dev) so
// WebLLM's weight cache is shared across every site the userscript runs on.
// Phase 1: handshake only. Phase 3 adds the WebLLM engine.
const NS = 'retro-web';
const VERSION = '0.1.0';
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');

function log(msg) {
  if (logEl) logEl.textContent = (logEl.textContent + msg + '\n').slice(-4000);
}
function setStatus(s) {
  if (statusEl) statusEl.textContent = s;
}
function post(msg) {
  if (window.parent && window.parent !== window) window.parent.postMessage({ ns: NS, ...msg }, '*');
}

async function describeWebGPU() {
  if (!navigator.gpu) return { webgpu: false, reason: 'navigator.gpu missing' };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { webgpu: false, reason: 'no WebGPU adapter' };
    return { webgpu: true };
  } catch (e) {
    return { webgpu: false, reason: String(e && e.message) };
  }
}

window.addEventListener('message', async (e) => {
  if (e.source !== window.parent) return;
  const m = e.data;
  if (!m || m.ns !== NS) return;
  if (m.t === 'hello') {
    const gpu = await describeWebGPU();
    setStatus(gpu.webgpu ? 'connected, WebGPU ok' : 'connected, no WebGPU: ' + gpu.reason);
    post({ t: 'ready', version: VERSION, ...gpu });
    return;
  }
  if (m.t === 'load' || m.t === 'generate') {
    post({ t: 'error', id: m.id, message: 'model engine not available in this build (phase 3)' });
  }
});

setStatus(window.parent === window ? 'open as a standalone page; nothing to do' : 'ready for handshake');
log('host ' + VERSION + ' loaded');
