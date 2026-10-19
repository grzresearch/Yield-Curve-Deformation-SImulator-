import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Relative base: the same build works at https://<user>.github.io/<repo>/ and locally.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
