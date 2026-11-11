import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/** 「WFS / WMS」和「ESRI 图层」示例要访问的服务，地址写在 .env.local 里 */
function proxies(env) {
  const proxy = {}
  if (env.GEOSERVER_PROXY) {
    proxy['/api/geoserver'] = {
      target: env.GEOSERVER_PROXY,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    }
  }
  if (env.ARCGIS_PROXY) {
    proxy['/arcgis'] = { target: env.ARCGIS_PROXY, changeOrigin: true }
  }
  return proxy
}

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 直接引用库源码，改完即时生效
      'smap-leaflet/style.css': resolve(__dirname, '../packages/core/src/style/index.scss'),
      'smap-leaflet-vue': resolve(__dirname, '../packages/vue/src/index.ts'),
      'smap-leaflet': resolve(__dirname, '../packages/core/src/index.ts'),
    },
    // 库源码在 example 之外，它的依赖统一从这里的 node_modules 解析
    dedupe: ['leaflet', 'proj4', 'proj4leaflet', 'mitt', 'vue'],
  },
  plugins: [vue()],
  server: {
    port: 7999,
    fs: { allow: [resolve(__dirname, '..')] },
    // 不带 VITE_ 前缀的变量只在这里读取，不会进到页面代码里
    proxy: proxies(loadEnv(mode, __dirname, '')),
  },
}))
