import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import path from 'path';

/**
 * Vendor split (backlog P2 #6). Groups are chosen by "loads together":
 * everything in these chunks is already part of the entry graph, so the
 * split can't pull lazy-route-only code into the first load — it only
 * stabilises caching across deploys. Route-only deps (dnd-kit, form libs,
 * calendar…) stay inside their lazy route chunks.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
  if (id.includes('@tanstack')) return 'framework';
  if (id.includes('@supabase')) return 'supabase';
  if (
    id.includes('lucide-react') ||
    id.includes('sonner') ||
    id.includes('class-variance-authority') ||
    /[\\/]node_modules[\\/](clsx|tailwind-merge)[\\/]/.test(id)
  ) {
    return 'ui-core';
  }
  return undefined;
}

export default defineConfig({
  plugins: [react(), svgr()],
  server: { host: '::', port: 8080 },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
