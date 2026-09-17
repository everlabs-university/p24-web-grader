import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const SUITE_DIRNAME = '.p24-web-grader';
const suiteRoot = dirname(fileURLToPath(import.meta.url));
const studentRoot = resolve(suiteRoot, '..');

export default defineConfig({
  root: studentRoot,
  cacheDir: resolve(suiteRoot, '.vite'),
  test: {
    environment: 'node',
    globals: false,
    include: [`${SUITE_DIRNAME}/labs/**/*.test.{js,mjs,ts}`],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    fileParallelism: false,
    passWithNoTests: false,
    watch: false,
  },
});
