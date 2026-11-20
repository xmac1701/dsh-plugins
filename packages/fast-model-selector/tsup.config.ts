import { defineConfig } from 'tsup'

// Two halves, one package: the Host half runs in Node under Cordis, the
// Client half is fetched by the page and registered with __ModuleLoader__.
// The Client entry must stay a single classic-script file: `splitting: false`
// keeps relative helpers inlined, and nothing is imported at runtime except
// react/react-dom through the module loader's require().
export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  skipNodeModulesBundle: true,
  external: [/^@deepseek-ai\//],
})
