<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>选项</h3>
      <label class="check">
        <input v-model="restrict" type="checkbox" @change="apply(active)" />
        限制地图只能在该区域内拖动
      </label>
      <label class="check">
        <input v-model="outline" type="checkbox" @change="apply(active)" />
        显示边界线
      </label>
    </section>

    <section class="block">
      <h3>安徽省地市 <small>{{ cities.length }} 个</small></h3>
      <ul class="list">
        <li v-for="city in cities" :key="city.id">
          <button
            type="button"
            class="list-row"
            :class="{ 'is-active': active === city.id }"
            @click="apply(city.id)"
          >
            <span class="list-main"><b>{{ city.name }}</b></span>
            <span class="list-value">{{ city.id }}</span>
          </button>
        </li>
      </ul>
      <div class="row">
        <button class="btn" type="button" :disabled="!active" @click="clear">移除遮罩</button>
      </div>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import anhui from '@/data/anhui-cities.json'

const mapEl = ref()
const active = ref('340100')
const restrict = ref(false)
const outline = ref(true)
const cities = anhui.features.map((feature) => feature.properties)
let smap

function apply(id) {
  if (!id) return
  active.value = id
  const feature = anhui.features.find((item) => item.properties.id === id)

  // 传了 id 就由 smap.layer 管理：同一个 id 再次添加会先移除旧的
  smap.layer.addMask(feature, {
    id: 'mask',
    fillColor: '#1e2324',
    fillOpacity: 0.55,
    color: '#0e7490',
    outline: outline.value,
    restrict: restrict.value,
  })
}

function clear() {
  smap.layer.remove('mask')
  active.value = ''
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 9,
    minZoom: 6,
    maxZoom: 18,
  })
  smap.control.add('zoom')
  apply(active.value)
})

onBeforeUnmount(() => smap?.destroy())
</script>
