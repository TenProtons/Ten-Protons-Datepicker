import { cpSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    range: 'src/modules/range.ts',
    multiple: 'src/modules/multiple.ts',
    wc: 'src/wc/index.ts',
    'locales/uk': 'src/locales/uk.ts',
  },
  // ESM only: the mode registry must be shared between entries, which needs code splitting.
  format: ['esm'],
  target: 'es2020',
  splitting: true,
  treeshake: true,
  minify: true,
  dts: true,
  clean: true,
  loader: { '.css': 'text' },
  onSuccess: async () => {
    cpSync('src/styles/core.css', 'dist/core.css');
    cpSync('src/styles/themes.css', 'dist/themes.css');
  },
});
