/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Scenes and the entry point are Phaser-bound (need a browser) and are
      // covered by the future Playwright smoke test. Game logic belongs in
      // plain modules, which this floor applies to.
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/scenes/**',
        // DOM HUD is a thin view over AudioManager (covered by unit tests).
        'src/audio/audioHud.ts',
        'src/audio/gameAudio.ts',
        // Phaser HUD view — meter math is covered via src/ui/hud.ts.
        'src/ui/gameHud.ts',
      ],
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
