import { defineConfig } from 'tsup'

// Two halves, one package: the Host half runs in Node under Cordis, the
// Client half is fetched by the page and registered with __ModuleLoader__.
// Every bare import stays external; the browser provides React through the
// module loader's require(), never through this bundle.
export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  skipNodeModulesBundle: true,
  external: [/^@deepseek-ai\//],
})
