<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">
        地图上的数据必须是 WGS-84。第三方接口或高德、百度导出的数据通常不是，直接上图会偏几百米。用
        <code>transformGeoJSON</code> 先转一遍。
      </p>
    </section>

    <section class="block">
      <h3>数据的原始坐标系</h3>
      <div class="seg">
        <button
          v-for="item in systems"
          :key="item.value"
          type="button"
          :class="{ 'is-active': from === item.value }"
          @click="render(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>图例</h3>
      <ul class="list">
        <li class="list-row">
          <span class="swatch" style="background: #d92d20" />
          <span class="list-main"><b>未转换，直接上图</b><small>偏离实际位置</small></span>
          <span class="list-value">偏 {{ offset }}</span>
        </li>
        <li class="list-row">
          <span class="swatch" style="background: #0e7490" />
          <span class="list-main"><b>转换为 WGS-84 后上图</b><small>与底图上的广场重合</small></span>
        </li>
      </ul>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { SMap, transformGeoJSON } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { formatDistance } from '@/lib/format'

const systems = [
  { value: 'gcj02', label: 'GCJ-02（高德、腾讯）' },
  { value: 'bd09', label: 'BD-09（百度）' },
]

// 天安门广场的轮廓，WGS-84
const SQUARE_WGS84 = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [116.38995, 39.90545],
        [116.39255, 39.90545],
        [116.39255, 39.89985],
        [116.38995, 39.89985],
        [116.38995, 39.90545],
      ],
    ],
  },
}

const mapEl = ref()
const from = ref('gcj02')
const offset = ref('')
let smap, group

function render(system) {
  from.value = system
  group.clearLayers()

  // 模拟一份「别人给的」非 WGS-84 数据
  const foreign = transformGeoJSON(SQUARE_WGS84, 'wgs84', system)

  // 错误做法：不转换直接上图
  const wrong = L.geoJSON(foreign, {
    style: { color: '#d92d20', weight: 2, dashArray: '6 4', fillOpacity: 0.08 },
  }).addTo(group)

  // 正确做法：先转成 WGS-84。返回的是深拷贝，不会改动原数据
  const fixed = transformGeoJSON(foreign, system, 'wgs84')
  const right = L.geoJSON(fixed, {
    style: { color: '#0e7490', weight: 2, fillOpacity: 0.15 },
  }).addTo(group)

  offset.value = formatDistance(
    wrong.getBounds().getCenter().distanceTo(right.getBounds().getCenter()),
  )
  smap.fitToLayer(group)
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: [39.9027, 116.3912],
    zoom: 16,
    minZoom: 4,
    maxZoom: 18,
  })
  smap.control.add('zoom')
  group = L.featureGroup().addTo(smap.instance)
  render(from.value)
})

onBeforeUnmount(() => smap?.destroy())
</script>
