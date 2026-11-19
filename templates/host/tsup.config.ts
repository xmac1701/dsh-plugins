import { defineConfig } from 'tsup'

// The DSH host imports this package from the profile (a linked checkout
// during local development), so every bare import must stay external:
// peer dependencies resolve to the running host's copy, and `dependencies`
// resolve to the copies pnpm installed next to this package.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  skipNodeModulesBundle: true,
  external: [/^@deepseek-ai\//],
})
