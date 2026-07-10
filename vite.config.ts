/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  test: {
    coverage: {
      provider: 'v8',
      // Scenes and the entry point are Phaser-bound (need a browser) and are
      // covered by the future Playwright smoke test. Game logic belongs in
      // plain modules, which this floor applies to.
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/scenes/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'phaser', test: /[\\/]node_modules[\\/]phaser[\\/]/ },
          ],
        },
      },
    },
  },
});
