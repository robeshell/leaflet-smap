<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>合肥市区县 <small>{{ districts.length }} 个</small></h3>
      <ul class="list">
        <li v-for="item in districts" :key="item.id">
          <button
            type="button"
            class="list-row"
            :class="{ 'is-active': active === item.id }"
            @click="focus(item.id)"
          >
            <span class="list-main"><b>{{ item.name }}</b></span>
            <span class="list-value">{{ item.id }}</span>
          </button>
        </li>
      </ul>
      <div class="row">
        <button class="btn" type="button" @click="focus('')">查看全部</button>
      </div>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import data from '@/data/hefei-districts.json'

const BASE_STYLE = { color: '#0e7490', weight: 1.5, fillColor: '#0e7490', fillOpacity: 0.08 }
const ACTIVE_STYLE = { weight: 3, fillOpacity: 0.28 }

const mapEl = ref()
const active = ref('')
const districts = data.features.map((feature) => feature.properties)
let smap, layer

function focus(id) {
  active.value = id
  layer.eachLayer((item) => {
    const hit = item.feature.properties.id === id
    item.setStyle(hit ? ACTIVE_STYLE : BASE_STYLE)
    if (hit) {
      item.bringToFront()
      smap.fitToLayer(item)
    }
  })
  if (!id) smap.fitToLayer(layer)
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 9,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')

  // createGeoJsonLayer 返回原生的 L.GeoJSON，Leaflet 的方法都能用
  layer = smap.layer.createGeoJsonLayer(data, BASE_STYLE).addTo(smap.instance)
  layer.eachLayer((item) => {
    item.bindTooltip(item.feature.properties.name, { sticky: true })
    item.on('click', () => focus(item.feature.properties.id))
  })
  smap.fitToLayer(layer)
})

onBeforeUnmount(() => smap?.destroy())
</script>
