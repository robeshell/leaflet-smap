<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p v-if="!tdtKey" class="note note--warn">需要天地图密钥。</p>
      <h3>地址 → 坐标 <small>geocode</small></h3>
      <form class="input-row" @submit.prevent="geocode">
        <input v-model.trim="address" class="input" placeholder="输入地址" aria-label="地址" />
        <button class="btn btn--primary" type="submit" :disabled="!address || busy === 'geocode'">
          {{ busy === 'geocode' ? '查询中…' : '定位' }}
        </button>
      </form>
      <p v-if="geoError" class="note note--error">{{ geoError }}</p>
      <dl v-else-if="location" class="kv">
        <dt>经度</dt>
        <dd>{{ location.lon }}</dd>
        <dt>纬度</dt>
        <dd>{{ location.lat }}</dd>
        <dt>匹配级别</dt>
        <dd class="text">{{ location.level || '-' }}</dd>
      </dl>
    </section>

    <section class="block">
      <h3>坐标 → 地址 <small>reverseGeocode</small></h3>
      <p v-if="revError" class="note note--error">{{ revError }}</p>
      <p v-else-if="busy === 'reverse'" class="hint">查询中…</p>
      <dl v-else-if="place" class="kv">
        <dt>地址</dt>
        <dd class="text">{{ place.formatted_address || '-' }}</dd>
        <dt>省 / 市 / 区县</dt>
        <dd class="text">{{ region }}</dd>
        <dt>最近道路</dt>
        <dd class="text">{{ place.addressComponent.road || '-' }}</dd>
        <dt>最近地点</dt>
        <dd class="text">{{ place.addressComponent.poi || '-' }}</dd>
        <dt>经度, 纬度</dt>
        <dd>{{ place.location.lon.toFixed(6) }}, {{ place.location.lat.toFixed(6) }}</dd>
      </dl>
      <p v-else class="empty">点击地图上任意位置。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI, tdtKey } from '@/config'
import { pin } from '@/lib/pin'

const mapEl = ref()
const address = ref('安徽省合肥市包河区合肥南站')
const location = ref(null)
const place = ref(null)
const busy = ref('')
const geoError = ref('')
const revError = ref('')
let smap, marker

const region = computed(() => {
  const c = place.value.addressComponent
  return [c.province, c.city, c.county].filter(Boolean).join(' / ') || '-'
})

function mark(latlng, tone) {
  marker?.remove()
  marker = pin(latlng, { tone }).addTo(smap.instance)
}

async function geocode() {
  geoError.value = ''
  busy.value = 'geocode'
  try {
    const result = await smap.service.geocode({ keyWord: address.value })
    // status 为 '0' 表示成功；lon / lat 是字符串
    if (result.status !== '0' || !result.location) throw new Error(result.msg || '没有匹配的地址')
    location.value = result.location
    const latlng = [Number(result.location.lat), Number(result.location.lon)]
    mark(latlng, 'brand')
    smap.setView(latlng, 16)
  } catch (e) {
    location.value = null
    geoError.value = `定位失败：${e.message}`
  } finally {
    busy.value = ''
  }
}

async function reverse(latlng) {
  revError.value = ''
  busy.value = 'reverse'
  mark(latlng, 'danger')
  try {
    const result = await smap.service.reverseGeocode({ lon: latlng.lng, lat: latlng.lat })
    if (result.status !== '0' || !result.result) throw new Error(result.msg || '没有结果')
    place.value = result.result
  } catch (e) {
    place.value = null
    revError.value = `查询失败：${e.message}`
  } finally {
    busy.value = ''
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion'],
    center: HEFEI,
    zoom: 13,
    minZoom: 3,
    maxZoom: 18,
    tdtKey,
  })
  smap.control.add('zoom')
  smap.instance.on('click', (e) => reverse(e.latlng))
})

onBeforeUnmount(() => smap?.destroy())
</script>
