<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">
        需要你自己的 GeoServer。默认地址走开发服务器的代理，代理目标在 <code>.env.local</code> 里配置（见
        <code>.env.example</code>），没配时会加载失败。
      </p>
    </section>

    <section class="block">
      <h3>WMS</h3>
      <label class="field"><span>服务地址</span><input v-model.trim="wms.url" class="input" /></label>
      <label class="field">
        <span>图层名</span>
        <input v-model.trim="wms.layer" class="input" placeholder="workspace:layer" />
      </label>
      <div class="row">
        <button class="btn btn--primary" type="button" :disabled="!wms.layer" @click="loadWMS">
          加载 WMS
        </button>
        <button v-if="wms.active" class="btn" type="button" @click="removeLayer(wms)">移除</button>
      </div>
      <p v-if="wms.active" class="note">已添加。WMS 是瓦片图层，图层名不存在时只会显示空白。</p>
    </section>

    <section class="block">
      <h3>WFS</h3>
      <label class="field"><span>服务地址</span><input v-model.trim="wfs.url" class="input" /></label>
      <label class="field">
        <span>图层名</span>
        <input v-model.trim="wfs.layer" class="input" placeholder="workspace:layer" />
      </label>
      <div class="row">
        <button
          class="btn btn--primary"
          type="button"
          :disabled="!wfs.layer || wfs.loading"
          @click="loadWFS"
        >
          {{ wfs.loading ? '加载中…' : '加载 WFS' }}
        </button>
        <button v-if="wfs.active" class="btn" type="button" @click="removeLayer(wfs)">移除</button>
      </div>
      <p v-if="wfs.error" class="note note--error">加载失败：{{ wfs.error }}</p>
      <p v-else-if="wfs.active" class="note">已加载 {{ wfs.count }} 个要素。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'

const mapEl = ref()
const wms = reactive({ url: '/api/geoserver/gis/wms', layer: '', active: false })
const wfs = reactive({
  url: '/api/geoserver/gis/ows',
  layer: '',
  active: false,
  loading: false,
  error: '',
  count: 0,
})
// Leaflet 图层不要放进响应式对象
const layers = new Map()
let smap

function removeLayer(state) {
  layers.get(state)?.remove()
  layers.delete(state)
  state.active = false
}

function loadWMS() {
  removeLayer(wms)
  // addWMS 创建并加到地图上；只想创建不添加用 createWMS
  layers.set(wms, smap.layer.addWMS({ url: wms.url, layer: wms.layer }))
  wms.active = true
}

async function loadWFS() {
  removeLayer(wfs)
  wfs.error = ''
  wfs.loading = true
  try {
    const layer = await smap.layer.addWFS({
      url: wfs.url,
      layer: wfs.layer,
      style: { color: '#b42318', weight: 2 },
      // url / layer / style / outputFormat 以外的字段会作为请求参数透传
      maxFeatures: 500,
    })
    layers.set(wfs, layer)
    wfs.count = layer.getLayers().length
    wfs.active = true
    if (wfs.count) smap.fitToLayer(layer)
  } catch (e) {
    wfs.error = e.message
  } finally {
    wfs.loading = false
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
})

onBeforeUnmount(() => smap?.destroy())
</script>
