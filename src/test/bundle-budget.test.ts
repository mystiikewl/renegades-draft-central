// @vitest-environment node
// (esbuild cannot run inside jsdom's patched globals; this file never touches the DOM)
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'vitest';
import { build } from 'vite';

import viteConfig from '../../vite.config';

process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

type ChunkInfo = {
  type: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  code: string;
  fileName: string;
  imports: string[];
};

test('production build keeps route pages out of the initial bundle', { timeout: 180_000 }, async () => {
  // Uses the real vite.config.ts (plugins, alias, manualChunks) so the budget
  // tracks what actually ships — only `write` is disabled.
  const result = (await build({
    ...viteConfig,
    configFile: false,
    logLevel: 'silent',
    build: { ...viteConfig.build, write: false },
  })) as unknown as { output: ChunkInfo[] };

  const chunks = result.output.filter((item) => item.type === 'chunk');
  const entry = chunks.find((chunk) => chunk.isEntry);
  const lazyRoutes = chunks.filter((chunk) => chunk.isDynamicEntry);

  assert.ok(entry, 'expected a JavaScript entry chunk');
  assert.ok(lazyRoutes.length >= 10, `expected at least 10 lazy route chunks, received ${lazyRoutes.length}`);

  // The initial payload is the entry plus every chunk it statically imports
  // (vendor splits ride along on first load).
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const initial = new Set<string>();
  const collect = (fileName: string) => {
    if (initial.has(fileName)) return;
    initial.add(fileName);
    byName.get(fileName)?.imports.forEach(collect);
  };
  collect(entry.fileName);

  const initialBytes = [...initial].reduce((sum, fileName) => sum + gzipSync(byName.get(fileName)!.code).length, 0);
  // Baseline first-load payload is ~223 kB gzip and is all shell-necessary:
  // react-vendor ~104 kB, @tanstack ~46 kB, supabase ~34 kB, ui-core ~20 kB,
  // app entry ~19 kB. The budget is a drift guard, not an aspiration — it
  // catches a heavy dep (recharts was ~90 kB gzip) leaking into the shell.
  assert.ok(
    initialBytes <= 245_000,
    `expected gzipped initial JS (entry + static vendor chunks) <= 245000 bytes, received ${initialBytes}`,
  );

  const vendorChunks = [...initial].filter((fileName) => /vendor|framework|supabase|ui-core/.test(fileName));
  assert.ok(
    vendorChunks.length >= 2,
    `expected the vendor split in the initial graph, received ${vendorChunks.join(', ') || 'none'}`,
  );
});
