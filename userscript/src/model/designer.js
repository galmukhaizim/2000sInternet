// Design generation: builds the prompt, streams the model output, extracts
// directives, validates each completed rule and reports progressively.
import { RuleStreamer } from '../apply.js';
import { validateCss, extractDirectives } from '../validate.js';
import { designMessages, repairMessages } from './prompts.js';
import { manifestToPrompt, manifestToPromptCompact, estimateTokens } from '../assets/index.js';

function mergeDirectives(into, d) {
  for (const r of d.iconRequests) if (!into.iconRequests.some((x) => x.name === r.name)) into.iconRequests.push(r);
  for (const a of d.applyClass) if (!into.applyClass.some((x) => x.selector === a.selector && x.className === a.className)) into.applyClass.push(a);
}

// Shared streaming + validation loop for designs and patches.
async function streamValidated({ client, messages, params, doc, mode, onChunk, signal, validateOptions = {} }) {
  const streamer = new RuleStreamer();
  const result = { rawText: '', css: '', cssChunks: [], iconRequests: [], applyClass: [], dropped: [], errors: [], kept: 0, iconVars: new Set(), usage: null, finish: null };
  const handle = (chunk) => {
    if (!chunk.trim()) return;
    const d = extractDirectives(chunk);
    mergeDirectives(result, d);
    const v = validateCss(d.css, { doc, mode, ...validateOptions });
    result.dropped.push(...v.dropped);
    result.errors.push(...v.errors);
    result.kept += v.kept;
    for (const iv of v.iconVars) result.iconVars.add(iv);
    if (v.css) {
      result.cssChunks.push(v.css);
      result.css = result.cssChunks.join('\n');
    }
    if (onChunk) onChunk({ css: result.css, newCss: v.css, iconRequests: d.iconRequests, applyClass: d.applyClass, result });
  };
  const out = await client.generate({
    messages,
    params,
    signal,
    onDelta: (delta) => {
      const complete = streamer.push(delta);
      if (complete) handle(complete);
    },
  });
  result.rawText = out.text;
  result.usage = out.usage;
  result.finish = out.finish;
  // Anything after the last complete rule (and the full text as fallback if the
  // streamer saw nothing, e.g. when deltas arrived in one piece).
  const tail = streamer.rest();
  if (tail.trim()) handle(tail);
  result.iconVars = [...result.iconVars];
  return result;
}

export async function generateDesign({ client, doc, summaryText, style, settings, onChunk, signal, enhance = false, validateOptions = {} }) {
  const manifestText = enhance ? manifestToPromptCompact() : manifestToPrompt();
  const messages = designMessages({ summaryText, manifestText, style, enhance });
  const promptTokens = estimateTokens(messages.map((m) => m.content).join('\n'));
  const params = { temperature: settings.temperature, topP: settings.topP, maxTokens: settings.maxDesignTokens, disableThinking: true };
  const result = await streamValidated({ client, messages, params, doc, mode: 'design', onChunk, signal, validateOptions });
  result.promptTokens = promptTokens;
  result.style = style.id;
  return result;
}

export async function generatePatch({ client, doc, css, reportText, style, settings, onChunk, signal, validateOptions = {} }) {
  const messages = repairMessages({ css, reportText, style });
  const params = { temperature: Math.min(0.4, settings.temperature), topP: settings.topP, maxTokens: settings.maxPatchTokens, disableThinking: true };
  return streamValidated({ client, messages, params, doc, mode: 'patch', onChunk, signal, validateOptions });
}
