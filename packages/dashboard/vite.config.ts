import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@cosmos/core': path.resolve(__dirname, '../core/src'),
      '@cosmos/space': path.resolve(__dirname, '../space/src'),
      '@cosmos/mykb': path.resolve(__dirname, '../mykb/src'),
      '@cosmos/rsis3': path.resolve(__dirname, '../rsis3/src'),
    },
  },
});
