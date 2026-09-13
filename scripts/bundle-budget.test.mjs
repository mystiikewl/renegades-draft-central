import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import test from 'node:test';

import react from '@vitejs/plugin-react-swc';
import { build } from 'vite';
import svgr from 'vite-plugin-svgr';

process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

test('production build keeps route pages out of the initial bundle', async () => {
  const result = await build({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    plugins: [react(), svgr()],
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    build: { write: false },
  });

  assert.ok(!Array.isArray(result), 'expected one production build output');
  const chunks = result.output.filter((item) => item.type === 'chunk');
  const entry = chunks.find((chunk) => chunk.isEntry);
  const lazyRoutes = chunks.filter((chunk) => chunk.isDynamicEntry);

  assert.ok(entry, 'expected a JavaScript entry chunk');
  assert.ok(lazyRoutes.length >= 10, `expected at least 10 lazy route chunks, received ${lazyRoutes.length}`);
  assert.ok(
    gzipSync(entry.code).length <= 170_000,
    `expected gzipped entry chunk <= 170000 bytes, received ${gzipSync(entry.code).length}`,
  );
});
