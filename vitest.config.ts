/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Limit file parallelism to prevent browser resource exhaustion
    // Multiple test files launch Chromium simultaneously, causing timeouts
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,js}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        'src/schema/types.ts',
        // Browser-executed instrumentation scripts (tested via Playwright in browser context)
        // These files are thoroughly tested but execute in Chromium, not Node.js,
        // so they cannot contribute to V8 coverage metrics
        'src/instrumentation/**/*.js'
      ]
      // Note: Vitest v8 coverage provider doesn't support per-file thresholds
      // runner.ts coverage is intentionally lower (66%) than project standard (80%) due to:
      // - Non-deterministic behavioral simulation (integration-tested)
      // - Defensive error handling (silent failures)
      // - Main entry point (tested manually)
      // - Conditional script injection for disabled features
      // Critical paths (CLI, config, session, injection) have 95%+ coverage
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
