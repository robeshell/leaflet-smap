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
          <strong>leaflet-smap</strong>
          <span>v{{ version }} · 示例</span>
        </span>
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
        <p v-if="!tdtKey" class="nav-warn">
          未配置天地图密钥，天地图底图和服务不可用。见 <code>.env.example</code>。
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
import { tdtKey } from './config'
import pkg from '../../packages/core/package.json'

const version = pkg.version
const install = 'npm i leaflet-smap'
const navOpen = ref(false)
const copied = ref(false)

async function copyInstall() {
  await copyText(install)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
