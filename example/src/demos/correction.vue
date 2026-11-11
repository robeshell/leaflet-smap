<template>
  <DemoPage>
    <template #map>
      <div class="map-split">
        <div>
          <div ref="leftEl" class="map" />
          <p class="map-caption"><b>天地图</b> · WGS-84</p>
        </div>
        <div>
          <div ref="rightEl" class="map" />
          <p class="map-caption"><b>{{ right.label }}</b> · GCJ-02</p>
        </div>
      </div>
    </template>

    <section class="block">
      <p v-if="!tdtKey" class="note note--warn">左侧天地图需要密钥。</p>
      <p class="hint">
        两张地图联动，标记是同一个 WGS-84 坐标。右侧底图的瓦片是 GCJ-02，库在渲染时把瓦片挪回正确位置，所以业务数据不用转换。点击任意一侧可以移动标记。
      </p>
    </section>

    <section class="block">
      <h3>右侧底图</h3>
      <div class="seg">
        <button
          v-for="item in rightOptions"
          :key="item.type"
          type="button"
          :class="{ 'is-active': right.type === item.type }"
          @click="setRight(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>标记坐标 <small>经度, 纬度</small></h3>
      <dl class="kv">
        <dt>WGS-84</dt>
        <dd>{{ coords.wgs84 }}</dd>
        <dt>GCJ-02</dt>
        <dd>{{ coords.gcj02 }}</dd>
        <dt>BD-09</dt>
        <dd>{{ coords.bd09 }}</dd>
        <dt>两者相差</dt>
        <dd>{{ coords.offset }}</dd>
      </dl>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import L from 'leaflet'
import { SMap, wgs84ToBd09, wgs84ToGcj02 } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { tdtKey } from '@/config'
import { pin } from '@/lib/pin'
import { fixed, formatDistance } from '@/lib/format'

// 天安门城楼，WGS-84
const TIANANMEN = [39.908722, 116.391256]

const rightOptions = [
  { type: 'GaoDe.Normal.Map', label: '高德' },
  { type: 'Tencent.Normal.Map', label: '腾讯' },
  { type: 'Geoq.Normal.Map', label: 'Geoq' },
]

const leftEl = ref()
const rightEl = ref()
const right = reactive({ ...rightOptions[0] })
const coords = reactive({ wgs84: '', gcj02: '', bd09: '', offset: '' })
let left, rightMap, markers

function setRight(item) {
  Object.assign(right, item)
  rightMap.setTileLayer(item.type)
}

function setPoint(latlng) {
  markers.forEach((marker) => marker.setLatLng(latlng))

  // 转换函数的参数顺序是 (lng, lat)，返回 { lng, lat }
  const gcj = wgs84ToGcj02(latlng.lng, latlng.lat)
  const bd = wgs84ToBd09(latlng.lng, latlng.lat)
  coords.wgs84 = `${fixed(latlng.lng)}, ${fixed(latlng.lat)}`
  coords.gcj02 = `${fixed(gcj.lng)}, ${fixed(gcj.lat)}`
  coords.bd09 = `${fixed(bd.lng)}, ${fixed(bd.lat)}`
  coords.offset = formatDistance(latlng.distanceTo([gcj.lat, gcj.lng]))
}

onMounted(() => {
  const options = { center: TIANANMEN, zoom: 17, minZoom: 4, maxZoom: 18 }
  left = new SMap(leftEl.value, {
    ...options,
    tileType: ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion'],
    tdtKey,
  })
  rightMap = new SMap(rightEl.value, { ...options, tileType: right.type })

  markers = [left, rightMap].map((smap) => pin(TIANANMEN, { tone: 'danger' }).addTo(smap.instance))
  setPoint(L.latLng(TIANANMEN))

  for (const [a, b] of [
    [left, rightMap],
    [rightMap, left],
  ]) {
    // 只响应用户正在操作的那一张，避免两张地图互相触发
    a.instance.on('move', () => {
      if (a.instance.getContainer().matches(':hover')) {
        b.instance.setView(a.instance.getCenter(), a.instance.getZoom(), { animate: false })
      }
    })
    a.instance.on('click', (e) => setPoint(e.latlng))
  }
})

onBeforeUnmount(() => {
  left?.destroy()
  rightMap?.destroy()
})
</script>
