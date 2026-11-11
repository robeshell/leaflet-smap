<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p v-if="!tdtKey" class="note note--warn">需要天地图密钥。</p>
      <form class="input-row" @submit.prevent="search">
        <input v-model.trim="keyword" class="input" placeholder="地点名称，如 医院" aria-label="关键词" />
        <button class="btn btn--primary" type="submit" :disabled="!keyword || loading">
          {{ loading ? '搜索中…' : '搜索' }}
        </button>
      </form>
      <p class="hint">搜索范围是地图当前视野，移动或缩放后重新搜索结果会变。</p>
    </section>

    <section class="block">
      <h3>
        结果
        <small v-if="total !== null">共 {{ total }} 条，显示前 {{ pois.length }} 条</small>
      </h3>
      <p v-if="error" class="note note--error">搜索失败：{{ error }}</p>
      <ul v-else-if="pois.length" class="list">
        <li v-for="(poi, i) in pois" :key="poi.hotPointID || i">
          <button
            type="button"
            class="list-row"
            :class="{ 'is-active': active === i }"
            @click="focus(i)"
          >
            <span class="list-main">
              <b>{{ poi.name }}</b>
              <small>{{ poi.address || '没有地址信息' }}</small>
            </span>
          </button>
        </li>
      </ul>
      <p v-else-if="total === 0" class="empty">当前视野内没有找到「{{ searched }}」。</p>
      <p v-else class="empty">输入关键词后搜索。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { BASE_TILES, HEFEI, tdtKey } from '@/config'
import { pin } from '@/lib/pin'

const mapEl = ref()
const keyword = ref('医院')
const searched = ref('')
const pois = ref([])
const total = ref(null)
const active = ref(-1)
const loading = ref(false)
const error = ref('')
let smap, group
let markers = []

/** 天地图的坐标是 "经度,纬度" 字符串，WGS-84 */
const toLatLng = (poi) => poi.lonlat.split(',').map(Number).reverse()

async function search() {
  error.value = ''
  loading.value = true
  try {
    // tdtKey 在创建地图时传过，这里不用再传 tk
    const result = await smap.service.search({ keyword: keyword.value, count: 10 })
    // 没有结果时响应里没有 pois 字段
    pois.value = result.pois ?? []
    total.value = Number(result.count ?? 0)
    searched.value = keyword.value
    active.value = -1

    group.clearLayers()
    markers = pois.value.map((poi, i) =>
      pin(toLatLng(poi))
        .bindTooltip(poi.name)
        .on('click', () => focus(i))
        .addTo(group),
    )
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function focus(i) {
  active.value = i
  smap.instance.panTo(toLatLng(pois.value[i]))
  markers[i].openTooltip()
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: BASE_TILES,
    center: HEFEI,
    zoom: 13,
    minZoom: 3,
    maxZoom: 18,
    tdtKey,
  })
  smap.control.add('zoom')
  group = L.layerGroup().addTo(smap.instance)
})

onBeforeUnmount(() => smap?.destroy())
</script>
