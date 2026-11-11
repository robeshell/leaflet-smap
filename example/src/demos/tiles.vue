<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>当前底图</h3>
      <dl class="kv">
        <template v-for="(type, i) in current.types" :key="type">
          <dt>图层 {{ i + 1 }}</dt>
          <dd>{{ type }}</dd>
        </template>
      </dl>
      <p v-if="error" class="note note--error">{{ error }}</p>
    </section>

    <section v-for="group in presets" :key="group.title" class="block">
      <h3>{{ group.title }} <small>{{ group.coord }}</small></h3>
      <p v-if="group.needsKey && !tdtKey" class="note note--warn">需要天地图密钥。</p>
      <ul class="list">
        <li v-for="item in group.items" :key="item.name">
          <button
            type="button"
            class="list-row"
            :class="{ 'is-active': current.name === item.name }"
            @click="apply(item)"
          >
            <span class="list-main">
              <b>{{ item.name }}</b>
              <small>{{ item.types.join(' + ') }}</small>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <section class="block">
      <p class="hint">
        百度底图使用独立的投影，需要在创建地图时传 <code>crs: L.CRS.Baidu</code>，不能在运行时和其他底图互相切换，这里没有列出。
      </p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI, tdtKey } from '@/config'
import { pin } from '@/lib/pin'

const presets = [
  {
    title: '高德',
    coord: 'GCJ-02',
    items: [
      { name: '高德 矢量', types: ['GaoDe.Normal.Map'] },
      { name: '高德 影像', types: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] },
      { name: '高德 简图', types: ['GaoDe.Brief.Map'] },
    ],
  },
  {
    title: '天地图',
    coord: 'WGS-84',
    needsKey: true,
    items: [
      { name: '天地图 矢量', types: ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion'] },
      { name: '天地图 影像', types: ['TianDiTu.Satellite.Map', 'TianDiTu.Satellite.Annotion'] },
      { name: '天地图 地形', types: ['TianDiTu.Terrain.Map', 'TianDiTu.Terrain.Annotion'] },
    ],
  },
  {
    title: '腾讯',
    coord: 'GCJ-02',
    items: [
      { name: '腾讯 矢量', types: ['Tencent.Normal.Map'] },
      { name: '腾讯 影像', types: ['Tencent.Satellite.Map'] },
    ],
  },
  {
    title: '其他',
    coord: '',
    items: [
      { name: 'OpenStreetMap', types: ['OSM.Normal.Map'] },
      { name: 'Geoq 午夜蓝', types: ['Geoq.Normal.PurplishBlue'] },
    ],
  },
]

const mapEl = ref()
const current = reactive({ ...presets[0].items[0] })
const error = ref('')
let smap

function apply(item) {
  error.value = ''
  try {
    // 传数组表示叠加：前面的在下，后面的在上
    smap.setTileLayer(item.types)
    Object.assign(current, item)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: current.types,
    center: HEFEI,
    zoom: 13,
    minZoom: 3,
    maxZoom: 18,
    tdtKey,
  })
  smap.control.add('zoom')

  // 地图上的切换控件；它会跟随 setTileLayer 的结果高亮当前项
  smap.control.add('layers', {
    position: 'topleft',
    options: [
      { label: '矢量', tileType: 'GaoDe.Normal.Map' },
      { label: '影像', tileType: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] },
    ],
  })
  // 控件切换底图后同步右侧面板
  smap.on('tileLoaded', () => {
    const types = smap.getTileType()
    const match = presets
      .flatMap((group) => group.items)
      .find((item) => item.types.join() === types.join())
    Object.assign(current, match ?? { name: '', types })
  })

  // 标记的坐标始终是 WGS-84，切换不同坐标系的底图时它应当停在同一个地物上
  pin(HEFEI, { label: '合肥市政府旧址附近' }).addTo(smap.instance)
})

onBeforeUnmount(() => smap?.destroy())
</script>
