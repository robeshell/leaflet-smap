import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `leaflet-smap-vue.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      // 都由使用方提供，不打进产物
      external: ['vue', 'leaflet', 'leaflet-smap'],
    },
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
})
