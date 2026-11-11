<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">
        smap-leaflet 不内置 ArcGIS 支持，但 <code>smap.instance</code> 就是原生的
        <code>L.Map</code>，可以直接配合 esri-leaflet 使用。本地开发时默认地址走开发服务器代理，代理目标在 <code>.env.local</code>
        里配置；在线示例里请填你自己的、允许跨域访问的服务地址。
      </p>
    </section>

    <section class="block">
      <h3>ArcGIS 服务目录</h3>
      <label class="field">
        <span>REST 地址</span>
        <input v-model.trim="url" class="input" />
      </label>
      <div class="row">
        <button class="btn btn--primary" type="button" :disabled="loading" @click="load">
          {{ loading ? '加载中…' : '加载全部 MapServer' }}
        </button>
      </div>
      <p v-if="error" class="note note--error">加载失败：{{ error }}</p>
    </section>

    <section v-if="services.length" class="block">
      <h3>已加载 <small>{{ services.length }} 个</small></h3>
      <ul class="list">
        <li v-for="name in services" :key="name" class="list-row">
          <span class="list-main"><b>{{ name }}</b></span>
        </li>
      </ul>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { dynamicMapLayer } from 'esri-leaflet'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { BASE_TILES, tdtKey } from '@/config'

const mapEl = ref()
const url = ref('/arcgis/rest/services')
const services = ref([])
const loading = ref(false)
const error = ref('')
let smap, group

async function load() {
  error.value = ''
  loading.value = true
  group.clearLayers()
  services.value = []
  try {
    const response = await fetch(`${url.value}?f=json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const catalog = await response.json()
    for (const item of catalog.services ?? []) {
      if (item.type !== 'MapServer') continue
      dynamicMapLayer({ url: `${url.value}/${item.name}/MapServer`, f: 'image' }).addTo(group)
      services.value.push(item.name)
    }
    if (!services.value.length) error.value = '服务目录里没有 MapServer'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: BASE_TILES,
    center: [37.42403, 112.43175],
    zoom: 15,
    tdtKey,
  })
  smap.control.add('zoom')
  group = L.layerGroup().addTo(smap.instance)
})

onBeforeUnmount(() => smap?.destroy())
</script>
