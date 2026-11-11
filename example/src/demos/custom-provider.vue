<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">
        注册之后，自定义底图和内置底图用法完全一样，类型名是
        <code>提供商.分组.类型</code>。这里注册的是 CARTO 的公开底图（需要能访问外网）。
      </p>
    </section>

    <section class="block">
      <h3>底图</h3>
      <div class="seg">
        <button
          v-for="item in options"
          :key="item.type"
          type="button"
          :class="{ 'is-active': active === item.type }"
          @click="select(item.type)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>已注册的类型 <small>getTileTypes()</small></h3>
      <ul class="list">
        <li v-for="type in registered" :key="type" class="list-row">
          <span class="list-main"><span class="tag">{{ type }}</span></span>
        </li>
      </ul>
      <p class="hint">当前共有 {{ total }} 个可用类型，其中 {{ registered.length }} 个来自这次注册。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap, getTileTypes, registerProvider } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'

// 要在创建使用它的地图之前注册；重复注册会覆盖
registerProvider('Carto', {
  layers: {
    Light: { Map: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' },
    Dark: { Map: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
  },
  subdomains: ['a', 'b', 'c', 'd'],
  // 瓦片的坐标系。国内商业底图通常要写 'gcj02'，写错会偏几百米
  coordType: 'wgs84',
})

const options = [
  { type: 'Carto.Light.Map', label: 'CARTO 浅色' },
  { type: 'Carto.Dark.Map', label: 'CARTO 深色' },
  { type: 'GaoDe.Normal.Map', label: '高德（内置）' },
]

const mapEl = ref()
const active = ref(options[0].type)
const types = getTileTypes()
const registered = types.filter((type) => type.startsWith('Carto.'))
const total = types.length
let smap

function select(type) {
  active.value = type
  smap.setTileLayer(type)
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: active.value,
    center: HEFEI,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
})

onBeforeUnmount(() => smap?.destroy())
</script>
