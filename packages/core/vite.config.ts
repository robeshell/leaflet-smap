import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LeafletSMap',
      formats: ['es', 'cjs'],
      fileName: (format) => `leaflet-smap.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['leaflet', 'proj4', 'proj4leaflet'],
      output: {
        globals: {
          leaflet: 'L',
        },
      },
    },
    outDir: 'dist',
    sourcemap: true,
    // Vite 6+ names the extracted CSS after this; keep it matching the "style.css" export
    cssFileName: 'style',
  },
  plugins: [dts({ rollupTypes: true })],
})
