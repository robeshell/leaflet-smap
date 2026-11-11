<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>已登记的图层 <small>smap.layer.ids()</small></h3>
      <template v-if="layers.length">
        <label v-for="item in layers" :key="item.id" class="check">
          <input type="checkbox" :checked="item.visible" @change="toggle(item.id)" />
          <span style="flex: 1">{{ names[item.id] }}</span>
          <code>{{ item.id }}</code>
          <button class="btn btn--text btn--danger" type="button" @click.prevent="remove(item.id)">
            移除
          </button>
        </label>
      </template>
      <p v-else class="empty">没有图层了。</p>
      <div class="row">
        <button class="btn" type="button" @click="setup">重新添加全部</button>
        <button class="btn" type="button" :disabled="!layers.length" @click="clear">全部移除</button>
      </div>
    </section>

    <section class="block">
      <p class="hint">
        隐藏只是把图层从地图上拿下来，登记还在，可以随时再显示；移除则彻底忘掉。
        <code>smap.destroy()</code> 会清掉所有登记过的图层。
      </p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import { pin } from '@/lib/pin'
import districts from '@/data/hefei-districts.json'

const names = { districts: '区县边界', stations: '站点', devices: '设备点位' }

const mapEl = ref()
const layers = ref([])
let smap

/** 把登记表的状态同步到界面 */
function sync() {
  layers.value = smap.layer.ids().map((id) => ({ id, visible: smap.layer.isVisible(id) }))
}

function setup() {
  // 任何 Leaflet 图层都可以登记
  smap.layer.add(
    'districts',
    smap.layer.createGeoJsonLayer(districts, { color: '#0e7490', weight: 1.5, fillOpacity: 0.06 }),
  )
  smap.layer.add(
    'stations',
    L.layerGroup([
      pin([31.8, 117.29], { label: '合肥南站', tone: 'danger' }),
      pin([31.885, 117.315], { label: '合肥站', tone: 'danger' }),
    ]),
  )
  // addWFS / addWMS / addMask / addPoints 传 id 即可登记，不用再调 add
  smap.layer.addPoints(
    Array.from({ length: 400 }, () => [
      HEFEI[0] + (Math.random() - 0.5) * 0.3,
      HEFEI[1] + (Math.random() - 0.5) * 0.4,
    ]),
    { id: 'devices', radius: 3, style: { fillColor: '#565c5e', weight: 0 } },
  )
  sync()
}

function toggle(id) {
  smap.layer.toggle(id)
  sync()
}

function remove(id) {
  smap.layer.remove(id)
  sync()
}

function clear() {
  smap.layer.clear()
  sync()
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 10,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
  setup()

  // 地图上的图层开关：和右侧面板操作的是同一份登记表，两边互相同步
  smap.control.add('overlays', {
    position: 'topleft',
    title: '图层',
    items: Object.entries(names).map(([id, label]) => ({ id, label })),
  })
  // 用户在控件上切换后，把状态同步到右侧面板
  smap.layer.onChange(sync)
})

onBeforeUnmount(() => smap?.destroy())
</script>
