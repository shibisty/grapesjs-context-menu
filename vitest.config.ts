import { defineConfig } from 'vitest/config';

/**
 * Test config, separate from vite.config.ts (that one is tuned for the
 * library build). Tests run against a REAL grapesjs editor inside jsdom
 * (see test/helpers/editor.ts) rather than a hand-written fake: the plugin
 * is mostly glue around GrapesJS APIs (Components, Blocks, Layers, Canvas,
 * I18n), so a fake would mostly test itself.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    globals: false,
    restoreMocks: true,
    css: false,
  },
});
