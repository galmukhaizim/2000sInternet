// Dumps the prompts, manifest text and styles the userscript uses, as JSON, so
// the Python training pipeline shares one source of truth with the runtime.
//   node userscript/scripts/prompts-cli.mjs > prompts.json
import { loadLib } from './lib-loader.mjs';

const lib = loadLib();
process.stdout.write(
  JSON.stringify(
    {
      designSystemPrompt: lib.DESIGN_SYSTEM_PROMPT,
      repairSystemPrompt: lib.REPAIR_SYSTEM_PROMPT,
      manifestText: lib.manifestToPrompt(),
      manifest: lib.MANIFEST,
      styles: lib.STYLES,
      libraryClasses: lib.libraryClassNames(),
      libraryIcons: lib.libraryIconNames(),
      version: lib.VERSION,
    },
    null,
    1,
  ),
);
