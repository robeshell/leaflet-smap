<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>绘制</h3>
      <div class="seg">
        <button
          v-for="item in types"
          :key="item.type"
          type="button"
          :class="{ 'is-active': drawing === item.type }"
          :disabled="editing"
          @click="draw(item.type)"
        >
          {{ item.label }}
        </button>
      </div>
      <p v-if="drawing" class="note">
        {{ hints[drawing] }}
        <button class="btn btn--text" type="button" @click="tool.cancel()">取消</button>
      </p>
    </section>

    <section class="block">
      <h3>编辑 <small>{{ count }} 个图形</small></h3>
      <div v-if="editing" class="row">
        <button class="btn btn--primary" type="button" @click="finishEdit(true)">保存修改</button>
        <button class="btn" type="button" :disabled="!canUndo" @click="tool.undo()">撤销一步</button>
        <button class="btn" type="button" @click="finishEdit(false)">放弃修改</button>
      </div>
      <div v-else class="row">
        <button class="btn" type="button" :disabled="!count" @click="startEdit">编辑图形</button>
        <button class="btn" type="button" @click="loadSample">载入示例数据</button>
        <button class="btn btn--danger" type="button" :disabled="!count" @click="tool.clear()">
          清空
        </button>
      </div>
      <p v-if="editing" class="note">拖动圆点调整形状，拖边上的小圆点可以加点，单击顶点删除。靠近其他图形的顶点或边会自动吸附；撤销也可以按 Ctrl/⌘ + Z。</p>
    </section>

    <section class="block">
      <h3>
        GeoJSON <small>tool.toGeoJSON()</small>
      </h3>
      <pre v-if="count" class="output">{{ geojson }}</pre>
      <p v-else class="empty">还没有图形。画一个，或载入示例数据。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'

const types = [
  { type: 'marker', label: '点' },
  { type: 'polyline', label: '线' },
  { type: 'polygon', label: '面' },
  { type: 'rectangle', label: '矩形' },
  { type: 'circle', label: '圆' },
]
const hints = {
  marker: '在地图上单击放置。',
  polyline: '单击添加节点，双击结束。',
  polygon: '单击添加顶点，点击第一个点闭合。',
  rectangle: '按住拖动，或单击两次。',
  circle: '按住拖动，或单击两次。',
}

// 圆在 GeoJSON 里是带 radius（米）的点
const SAMPLE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '示例区域' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [117.19, 31.84],
            [117.25, 31.85],
            [117.27, 31.81],
            [117.21, 31.8],
            [117.19, 31.84],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { radius: 1200 },
      geometry: { type: 'Point', coordinates: [117.3, 31.86] },
    },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [117.17, 31.8] } },
  ],
}

const mapEl = ref()
const drawing = ref('')
const editing = ref(false)
const canUndo = ref(false)
const data = shallowRef({ type: 'FeatureCollection', features: [] })
const count = computed(() => data.value.features.length)
const geojson = computed(() => JSON.stringify(data.value, null, 2))
let smap, tool

function draw(type) {
  tool.draw(type)
}

function startEdit() {
  tool.startEdit()
  editing.value = true
}

function finishEdit(save) {
  tool.finishEdit(save)
  editing.value = false
  canUndo.value = false
}

function loadSample() {
  tool.load(SAMPLE)
  smap.fitToLayer(tool.group)
}

onMounted(async () => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')

  // createDraw 返回 Promise
  tool = await smap.createDraw({
    shapeOptions: { color: '#0e7490' },
    // 绘制和编辑时吸附到已有图形的顶点和边，画相邻地块时边界能对齐
    snap: true,
  })

  tool.on('drawstart', ({ type }) => (drawing.value = type))
  tool.on('drawstop', () => (drawing.value = ''))
  // 画完、保存编辑、删除、载入之后都会触发，带上当前全部图形的 GeoJSON
  tool.on('change', (collection) => (data.value = collection))
  // 编辑时每一步（包括撤销）都会触发
  tool.on('editing', () => (canUndo.value = tool.canUndo))
})

onBeforeUnmount(() => smap?.destroy())
</script>
