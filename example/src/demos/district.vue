<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p v-if="!tdtKey" class="note note--warn">需要天地图密钥。</p>
      <form class="input-row" @submit.prevent="query(keyword)">
        <input v-model.trim="keyword" class="input" placeholder="名称或 9 位区划码" aria-label="行政区" />
        <button class="btn btn--primary" type="submit" :disabled="!keyword || loading">
          {{ loading ? '查询中…' : '查询' }}
        </button>
      </form>
      <p class="hint">
        区划码是 9 位：国家码 <code>156</code> 加 6 位行政区划码，例如合肥市是 <code>156340100</code>。
      </p>
      <p v-if="error" class="note note--error">{{ error }}</p>
    </section>

    <section v-if="district" class="block">
      <h3>{{ district.name }}</h3>
      <dl class="kv">
        <dt>区划码</dt>
        <dd>{{ district.gb }}</dd>
        <dt>上级区划码</dt>
        <dd>{{ district.pgb }}</dd>
        <dt>中心点</dt>
        <dd>{{ district.center.lng.toFixed(4) }}, {{ district.center.lat.toFixed(4) }}</dd>
      </dl>
      <div v-if="district.pgb !== '156000000' && district.gb !== '156000000'" class="row">
        <button class="btn" type="button" @click="query(district.pgb)">查看上级</button>
      </div>
    </section>

    <section v-if="district" class="block">
      <h3>下级区划 <small>{{ children.length }} 个</small></h3>
      <ul v-if="children.length" class="list">
        <li v-for="child in children" :key="child.gb">
          <button type="button" class="list-row" @click="query(child.gb)">
            <span class="list-main"><b>{{ child.name }}</b></span>
            <span class="list-value">{{ child.gb }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="empty">没有下级区划。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI, tdtKey } from '@/config'

const mapEl = ref()
const keyword = ref('合肥市')
const district = ref(null)
const loading = ref(false)
const error = ref('')
const children = computed(() => district.value?.children ?? [])
let smap, boundary
let disposed = false

/** 边界是 WKT：MULTIPOLYGON(((lng lat,lng lat,...)),((...)))。把每个环转成 [lat, lng] 数组 */
function parseBoundary(wkt) {
  return [...wkt.matchAll(/\(([^()]+)\)/g)].map((ring) =>
    ring[1].split(',').map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number)
      return [lat, lng]
    }),
  )
}

async function query(value) {
  error.value = ''
  loading.value = true
  try {
    const result = await smap.service.getAdministrative({
      keyword: value,
      childLevel: 1, // 带一级下级区划
      extensions: true, // 带边界
    })
    // 请求还没回来页面就被切走了：地图已经销毁，不能再往上加东西
    if (disposed) return
    const found = result.data?.district?.[0]
    if (result.status !== 200 || !found) throw new Error(result.message || '没有找到这个行政区')

    district.value = found
    keyword.value = found.name

    boundary.clearLayers()
    if (found.boundary) {
      L.polygon(parseBoundary(found.boundary), {
        color: '#0e7490',
        weight: 2,
        fillOpacity: 0.08,
      }).addTo(boundary)
      smap.fitToLayer(boundary)
    } else {
      smap.setView([found.center.lat, found.center.lng])
    }
  } catch (e) {
    error.value = `查询失败：${e.message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion'],
    center: HEFEI,
    zoom: 9,
    minZoom: 3,
    maxZoom: 18,
    tdtKey,
  })
  smap.control.add('zoom')
  boundary = L.featureGroup().addTo(smap.instance)
  if (tdtKey) query(keyword.value)
})

onBeforeUnmount(() => {
  disposed = true
  smap?.destroy()
})
</script>
