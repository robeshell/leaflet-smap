<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>开始测量</h3>
      <div class="seg">
        <button
          v-for="item in types"
          :key="item.type"
          type="button"
          :class="{ 'is-active': drawing === item.type }"
          @click="start(item.type)"
        >
          {{ item.label }}
        </button>
      </div>
      <p v-if="drawing" class="note">
        {{ hints[drawing] }}
        <button class="btn btn--text" type="button" @click="cancel">取消</button>
      </p>
      <p v-else class="hint">选一种工具，然后在地图上绘制。</p>
    </section>

    <section class="block">
      <h3>面积单位 <small>setOptions()</small></h3>
      <div class="seg">
        <button
          v-for="item in areaUnits"
          :key="item.value"
          type="button"
          :class="{ 'is-active': areaUnit === item.value }"
          @click="setAreaUnit(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>
        结果
        <button v-if="results.length" class="btn btn--text btn--danger" type="button" @click="clear">
          全部清除
        </button>
      </h3>
      <ul v-if="results.length" class="list">
        <li v-for="item in results" :key="item.id" class="list-row">
          <span class="list-main">
            <b>{{ labels[item.type] }}</b>
            <small>{{ item.detail }}</small>
          </span>
          <span class="list-value">{{ item.value }}</span>
          <button class="btn btn--text btn--danger" type="button" @click="remove(item)">删除</button>
        </li>
      </ul>
      <p v-else class="empty">还没有测量结果。</p>
      <div v-if="results.length" class="row">
        <template v-if="editing">
          <button class="btn btn--primary" type="button" @click="finishEdit(true)">保存修改</button>
          <button class="btn" type="button" @click="undo">撤销一步</button>
          <button class="btn" type="button" @click="finishEdit(false)">放弃修改</button>
        </template>
        <button v-else class="btn" type="button" @click="startEdit">调整图形</button>
      </div>
      <p v-if="editing" class="note">拖动圆点调整，数值会跟着变。撤销也可以按 Ctrl/⌘ + Z。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap, formatArea, formatLength } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'

const types = [
  { type: 'polyline', label: '测距' },
  { type: 'polygon', label: '测面' },
  { type: 'circle', label: '测圆' },
  { type: 'rectangle', label: '测矩形' },
]
const labels = Object.fromEntries(types.map((item) => [item.type, item.label]))
const hints = {
  polyline: '单击添加节点，双击结束。',
  polygon: '单击添加顶点，点击第一个点闭合。',
  circle: '按住拖动画圆，或单击两次。',
  rectangle: '按住拖动画矩形，或单击两次。',
}
const areaUnits = [
  { value: 'auto', label: '自动' },
  { value: 'ha', label: '公顷' },
  { value: 'mu', label: '亩' },
]

const mapEl = ref()
const drawing = ref('')
const editing = ref(false)
const areaUnit = ref('auto')
const results = ref([])
const tools = {}
let smap

async function start(type) {
  cancel()
  finishEdit(true)
  // getMeasure 按类型共用一个工具，首次调用时创建
  tools[type] = await smap.getMeasure(type, {
    showMarker: true,
    areaUnit: areaUnit.value,
    // 新的测量会吸附到之前量过的图形的顶点和边上
    snap: true,
    // 不传则使用库的默认蓝色；顶点、标签会跟着这个颜色走
    shapeOptions: { color: '#0e7490' },
  })
  tools[type].enable()
}

function cancel() {
  if (drawing.value) tools[drawing.value].disable()
}

function setAreaUnit(unit) {
  areaUnit.value = unit
  // 已经画在地图上的标签会立刻换成新单位
  Object.values(tools).forEach((tool) => tool.setOptions({ areaUnit: unit }))
  refresh()
}

function startEdit() {
  cancel()
  Object.values(tools).forEach((tool) => tool.startEdit())
  editing.value = true
}

function undo() {
  // 每种工具各有自己的撤销记录，找到有东西可撤的那个
  Object.values(tools).some((tool) => tool.undo())
}

function finishEdit(save) {
  Object.values(tools).forEach((tool) => tool.finishEdit(save))
  editing.value = false
  refresh()
}

function remove(item) {
  tools[item.type].remove(item.id)
}

function clear() {
  Object.values(tools).forEach((tool) => tool.clearAll())
}

function describe(result) {
  if (result.type === 'polyline') {
    return { value: formatLength(result.distance), detail: `${result.latlngs.length} 个节点` }
  }
  const value = formatArea(result.area, areaUnit.value)
  return result.type === 'circle'
    ? { value, detail: `半径 ${formatLength(result.radius)}` }
    : { value, detail: `${result.latlngs.length} 个顶点` }
}

/** 列表直接从工具的当前结果生成 */
function refresh() {
  results.value = Object.values(tools)
    .flatMap((tool) => tool.getResults())
    .map((result) => ({ id: result.id, type: result.type, ...describe(result) }))
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 13,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
  smap.control.add('scale')

  // 所有测量工具的事件都会汇总到地图上
  smap.on('measure:created', refresh)
  smap.on('measure:removed', refresh)
  smap.on('measure:updated', refresh)
  // 编辑时每拖一下都会触发，右侧列表跟着实时变
  smap.on('measure:updating', refresh)
  // 开始、结束（画完或取消）也有事件；completed 为 false 表示被取消
  smap.on('measure:start', ({ type }) => (drawing.value = type))
  smap.on('measure:stop', () => (drawing.value = ''))
})

onBeforeUnmount(() => smap?.destroy())
</script>
