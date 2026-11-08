// Defaults for everything configurable. User overrides live in GM storage under
// the `settings` key (see storage.js) and are merged over these at runtime.

export const VERSION = '0.3.0';

// Bump when the cached site record format or the library changes incompatibly.
export const CACHE_VERSION = 1;

export const DEFAULTS = {
  // --- model host (fixed origin iframe that runs WebLLM) ---
  // Published by .github/workflows/pages.yml. For local development run
  // `npm run host` and set http://localhost:4173/ in the panel's Advanced section.
  hostUrl: 'https://galmukhaizim.github.io/2000sInternet/host/',
  // Any id from WebLLM's prebuilt list (0.2.87). ~1.6 GB VRAM, code-tuned.
  modelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
  // Later: your fine-tuned model on Hugging Face, e.g.
  // { model: 'https://huggingface.co/<user>/<repo>', model_id: 'retro-designer-1.5B-q4f16_1-MLC',
  //   model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/Qwen2.5-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm' }
  customModel: null,
  // Panel-friendly form of the above: a Hugging Face repo URL holding MLC weights
  // (+ optional model_lib wasm URL). When set, it overrides modelId.
  customModelUrl: '',
  customModelLib: '',
  contextWindow: 8192,
  temperature: 0.7,
  topP: 0.9,

  // --- generation budgets (tokens) ---
  summaryTokenBudget: 1500,
  manifestTokenBudget: 700,
  maxDesignTokens: 1400,
  maxPatchTokens: 600,

  // --- behaviour ---
  autoDesign: true,        // design new sites automatically on first visit
  popupFallback: true,     // when a site's CSP blocks the hidden frame, run the model in a popup window
  style: 'random',         // sub-style id from training/styles.json or 'random'
  maxRepairRounds: 3,
  settleDelayMs: 600,      // wait for layout/fonts before inspecting

  // --- Claude icon generation ---
  iconModel: 'claude-haiku-5-5',
  anthropicVersion: '2023-06-01',
  anthropicEndpoint: 'https://api.anthropic.com/v1/messages',
  iconConcurrency: 3,
  iconTimeoutMs: 25000,
  iconMaxTokens: 1200,
};

export const STORAGE_KEYS = {
  apiKey: 'apiKey',
  settings: 'settings',
  sitePrefix: 'site:',
  iconPrefix: 'icon:',
};

export const PANEL_TAG = 'retro-web-panel';
export const PANEL_ID = 'retro-web-panel';
