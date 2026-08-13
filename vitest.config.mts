import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.mts'],
    // Las pruebas de RLS abren transacciones reales contra Postgres —
    // correrlas en paralelo puede saturar el pool de conexiones (max: 10 en lib/db.ts).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
