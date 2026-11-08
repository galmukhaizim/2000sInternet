// retro-web model host. Runs on a fixed origin (http://localhost:4173 in dev)
// inside a hidden iframe created by the userscript, so WebLLM's weight cache is
// shared across every site. Talks to the parent window over postMessage.
//
// parent -> host : {ns, t:'hello'} | {ns, t:'load', modelId, customModel?, contextWindow?}
//                  {ns, t:'generate', id, messages, params} | {ns, t:'abort', id} | {ns, t:'unload'}
// host -> parent : {ns, t:'ready', version, webgpu, reason?} | {ns, t:'progress', text, progress}
//                  {ns, t:'loaded', modelId} | {ns, t:'delta', id, text} | {ns, t:'done', id, text, usage, finish}
//                  {ns, t:'error', id?, code, message}
//
// This page never receives the Claude API key and never talks to the Claude API.
import { CreateMLCEngine, prebuiltAppConfig, modelLibURLPrefix, modelVersion } from '@mlc-ai/web-llm';

const NS = 'retro-web';
const VERSION = '0.3.0';
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');

let engine = null;
let loadedModelId = null;
let loading = null;
let current = null; // { id, aborted }
const queue = [];

function log(msg) {
  if (logEl) logEl.textContent = (logEl.textContent + msg + '\n').slice(-6000);
}
function setStatus(s) {
  if (statusEl) statusEl.textContent = s;
}
// The userscript either embeds this page in a hidden iframe (parent) or, when
// the site's CSP forbids frames, opens it as a popup window (opener).
const peer = window.opener || (window.parent !== window ? window.parent : null);
const isPopup = !!window.opener;
function post(msg) {
  if (peer) peer.postMessage({ ns: NS, ...msg }, '*');
}
function errorCode(e) {
  const m = String((e && e.message) || e);
  if (/webgpu|gpu adapter|navigator\.gpu|requestAdapter/i.test(m)) return 'webgpu';
  if (/fetch|network|Failed to fetch|NetworkError|404|403/i.test(m)) return 'network';
  if (/out of memory|buffer size|exceeds|maxStorageBufferBindingSize/i.test(m)) return 'memory';
  if (/Cannot find model record|model_id/i.test(m)) return 'model-id';
  return 'engine';
}

async function describeWebGPU() {
  if (!navigator.gpu) return { webgpu: false, reason: 'navigator.gpu missing (enable WebGPU or use Chrome/Edge)' };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { webgpu: false, reason: 'no WebGPU adapter' };
    return { webgpu: true };
  } catch (e) {
    return { webgpu: false, reason: String(e && e.message) };
  }
}

function buildAppConfig(customModel) {
  const list = [...prebuiltAppConfig.model_list];
  if (customModel && customModel.model && customModel.model_id) {
    list.unshift({
      model: customModel.model,
      model_id: customModel.model_id,
      model_lib: customModel.model_lib || modelLibURLPrefix + modelVersion + '/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
      low_resource_required: false,
      overrides: customModel.overrides || { context_window_size: 4096 },
    });
  }
  return { ...prebuiltAppConfig, model_list: list, useIndexedDBCache: false };
}

async function load({ modelId, customModel, contextWindow }) {
  if (engine && loadedModelId === modelId) {
    post({ t: 'loaded', modelId });
    return;
  }
  if (loading) {
    await loading;
    if (loadedModelId === modelId) {
      post({ t: 'loaded', modelId });
      return;
    }
  }
  loading = (async () => {
    setStatus('loading ' + modelId);
    log('loading ' + modelId);
    const chatOpts = { context_window_size: Math.max(2048, Math.min(16384, Number(contextWindow) || 8192)) };
    const cfg = {
      appConfig: buildAppConfig(customModel),
      initProgressCallback: (r) => {
        setStatus(r.text);
        post({ t: 'progress', text: r.text, progress: r.progress });
      },
      logLevel: 'WARN',
    };
    if (engine) {
      try {
        await engine.unload();
      } catch {
        /* ignore */
      }
      engine = null;
      loadedModelId = null;
    }
    engine = await CreateMLCEngine(modelId, cfg, chatOpts);
    loadedModelId = modelId;
    setStatus('loaded ' + modelId);
    log('loaded ' + modelId);
    post({ t: 'loaded', modelId });
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
}

async function generate(msg) {
  const { id, messages, params = {} } = msg;
  if (!engine) {
    post({ t: 'error', id, code: 'not-loaded', message: 'model not loaded' });
    return;
  }
  current = { id, aborted: false };
  let text = '';
  let usage = null;
  let finish = null;
  let pending = '';
  let flushTimer = null;
  const flush = () => {
    flushTimer = null;
    if (pending) {
      post({ t: 'delta', id, text: pending });
      pending = '';
    }
  };
  try {
    await engine.resetChat();
    const request = {
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 0.9,
      max_tokens: params.maxTokens ?? 1200,
      repetition_penalty: params.repetitionPenalty ?? 1.05,
    };
    if (params.seed != null) request.seed = params.seed;
    if (params.disableThinking) request.extra_body = { enable_thinking: false };
    const chunks = await engine.chat.completions.create(request);
    for await (const chunk of chunks) {
      if (current.aborted) break;
      const choice = chunk.choices && chunk.choices[0];
      if (choice) {
        const delta = (choice.delta && choice.delta.content) || '';
        if (delta) {
          text += delta;
          pending += delta;
          if (!flushTimer) flushTimer = setTimeout(flush, 40);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
      if (chunk.usage) usage = chunk.usage;
    }
    if (flushTimer) clearTimeout(flushTimer);
    flush();
    post({ t: 'done', id, text, usage, finish: current.aborted ? 'abort' : finish });
  } catch (e) {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
    log('generate error: ' + (e && e.message));
    post({ t: 'error', id, code: errorCode(e), message: String((e && e.message) || e) });
  } finally {
    current = null;
    pump();
  }
}

function pump() {
  if (current || !queue.length) return;
  generate(queue.shift());
}

window.addEventListener('message', async (e) => {
  if (!peer || e.source !== peer) return;
  const m = e.data;
  if (!m || m.ns !== NS) return;
  try {
    switch (m.t) {
      case 'hello': {
        const gpu = await describeWebGPU();
        setStatus(gpu.webgpu ? 'connected, WebGPU ok' : 'connected, no WebGPU: ' + gpu.reason);
        post({ t: 'ready', version: VERSION, ...gpu, modelId: loadedModelId });
        break;
      }
      case 'load':
        await load(m);
        break;
      case 'generate':
        queue.push(m);
        pump();
        break;
      case 'abort':
        if (current && current.id === m.id) {
          current.aborted = true;
          try {
            await engine.interruptGenerate();
          } catch {
            /* ignore */
          }
        } else {
          const i = queue.findIndex((q) => q.id === m.id);
          if (i >= 0) queue.splice(i, 1);
        }
        break;
      case 'close':
        if (isPopup) {
          try {
            if (engine) await engine.unload();
          } catch {
            /* ignore */
          }
          window.close();
        }
        break;
      case 'unload':
        if (engine) {
          try {
            await engine.unload();
          } catch {
            /* ignore */
          }
        }
        engine = null;
        loadedModelId = null;
        break;
      default:
        break;
    }
  } catch (err) {
    log('error: ' + (err && err.message));
    post({ t: 'error', id: m.id, code: errorCode(err), message: String((err && err.message) || err) });
  }
});

setStatus(!peer ? 'open as a standalone page; nothing to do' : 'ready for handshake');
if (isPopup) {
  const note = document.getElementById('popup-note');
  if (note) note.hidden = false;
  document.title = 'retro-web model engine';
}
log('host ' + VERSION + ' loaded');
