<template>
  <div class="shell">
    <aside class="nav" :class="{ 'is-open': navOpen }">
      <div class="nav-brand">
        <span class="nav-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round">
            <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" fill="currentColor" stroke-width="1.4" />
            <path d="m3.5 12 8.5 4.5 8.5-4.5" stroke-width="1.8" stroke-linecap="round" opacity=".72" />
            <path d="m3.5 16 8.5 4.5 8.5-4.5" stroke-width="1.8" stroke-linecap="round" opacity=".42" />
          </svg>
        </span>
        <span class="nav-name">
          <strong>smap-leaflet</strong>
          <span>v{{ version }} · 示例</span>
        </span>
      </div>
      <div class="nav-links">
        <a href="https://github.com/robeshell/leaflet-smap" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.4c-2.23.48-2.7-.95-2.7-.95-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z"
            />
          </svg>
          GitHub
        </a>
        <a href="https://www.npmjs.com/package/smap-leaflet" target="_blank" rel="noopener">npm</a>
        <a
          href="https://github.com/robeshell/leaflet-smap/blob/main/packages/core/README.md"
          target="_blank"
          rel="noopener"
        >
          文档
        </a>
      </div>
      <nav class="nav-scroll" aria-label="示例">
        <section v-for="group in groups" :key="group.title">
          <h2>{{ group.title }}</h2>
          <router-link
            v-for="item in group.items"
            :key="item.id"
            :to="item.path"
            class="nav-link"
            @click="navOpen = false"
          >
            {{ item.title }}
          </router-link>
        </section>
      </nav>
      <div class="nav-foot">
        <button class="nav-install" type="button" :title="install" @click="copyInstall">
          <span>安装 <b>{{ copied ? '已复制' : '点击复制' }}</b></span>
          <code>{{ install }}</code>
        </button>
        <form v-if="!tdtKey" class="nav-key" @submit.prevent="saveTdtKey(keyInput)">
          <label for="tdt-key">天地图密钥</label>
          <p>
            未配置，天地图底图和服务不可用。填入你的密钥即可体验，只保存在这个浏览器里。
            <a href="https://console.tianditu.gov.cn/api/key" target="_blank" rel="noopener">申请密钥</a>
          </p>
          <div class="nav-key-row">
            <input id="tdt-key" v-model.trim="keyInput" placeholder="粘贴密钥" autocomplete="off" />
            <button type="submit" :disabled="!keyInput">保存</button>
          </div>
        </form>
        <p v-else-if="tdtKeyFromBrowser" class="nav-key-set">
          <span>正在使用你填写的天地图密钥</span>
          <button type="button" @click="saveTdtKey('')">清除</button>
        </p>
      </div>
    </aside>

    <div v-if="navOpen" class="nav-scrim" @click="navOpen = false" />

    <main class="stage">
      <button class="nav-toggle btn" type="button" @click="navOpen = true">示例列表</button>
      <router-view :key="$route.path" />
    </main>
  </div>
</template>

<script setup>
import { copyText } from '@/lib/copy'
import { ref } from 'vue'
import groups from './demos'
import { saveTdtKey, tdtKey, tdtKeyFromBrowser } from './config'
import pkg from '../../packages/core/package.json'

const version = pkg.version
const install = 'npm i smap-leaflet'
const navOpen = ref(false)
const keyInput = ref('')
const copied = ref(false)

async function copyInstall() {
  await copyText(install)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
