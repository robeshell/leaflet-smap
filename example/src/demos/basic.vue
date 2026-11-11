<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>当前视图</h3>
      <dl class="kv">
        <dt>缩放级别</dt>
        <dd>{{ view.zoom }}</dd>
        <dt>中心纬度</dt>
        <dd>{{ view.lat }}</dd>
        <dt>中心经度</dt>
        <dd>{{ view.lng }}</dd>
      </dl>
      <div class="row">
        <button class="btn" type="button" @click="reset">回到合肥</button>
        <button class="btn" type="button" :disabled="locating" @click="locate">
          {{ locating ? '定位中…' : '定位到我的位置' }}
        </button>
      </div>
      <div class="row">
        <button class="btn" type="button" :disabled="exporting" @click="exportImage">
          {{ exporting ? '导出中…' : '导出为图片' }}
        </button>
      </div>
      <p v-if="exportError" class="note note--error">导出失败：{{ exportError }}</p>
      <p v-if="locateError" class="note note--error">定位失败：{{ locateError }}</p>
      <p v-else-if="accuracy" class="note">已定位，精度约 {{ accuracy }} 米。</p>
    </section>

    <section class="block">
      <h3>控件</h3>
      <label v-for="item in controlTypes" :key="item.type" class="check">
        <input v-model="controls[item.type]" type="checkbox" @change="toggle(item.type)" />
        {{ item.label }}
      </label>
    </section>

    <section class="block">
      <h3>事件 <small>smap.on(...)</small></h3>
      <ul v-if="events.length" class="list">
        <li v-for="(event, i) in events" :key="i" class="list-row">
          <span class="list-main"><span class="tag">{{ event.name }}</span></span>
          <span class="list-value">{{ event.detail }}</span>
        </li>
      </ul>
      <p v-else class="empty">还没有事件。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { SMap } from 'smap-leaflet'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import { fixed } from '@/lib/format'

const mapEl = ref()
let smap

const view = reactive({ zoom: '-', lat: '-', lng: '-' })
const events = ref([])
const locating = ref(false)
const locateError = ref('')
const accuracy = ref(0)
const exporting = ref(false)
const exportError = ref('')
const controls = reactive({ zoom: true, scale: true, attribution: false })
const controlTypes = [
  { type: 'zoom', label: '缩放按钮' },
  { type: 'scale', label: '比例尺' },
  { type: 'attribution', label: '水印' },
]

function syncView() {
  const center = smap.instance.getCenter()
  view.zoom = smap.instance.getZoom()
  view.lat = fixed(center.lat)
  view.lng = fixed(center.lng)
}

function toggle(type) {
  if (controls[type]) {
    smap.control.add(type, type === 'attribution' ? { content: 'smap-leaflet 示例' } : undefined)
  } else {
    smap.control.remove(type)
  }
}

function reset() {
  smap.clearLocation()
  accuracy.value = 0
  smap.setView(HEFEI, 12)
}

async function exportImage() {
  exportError.value = ''
  exporting.value = true
  try {
    // 包含底图、矢量图形，以及测量标签、聚合气泡；其他 HTML 元素（自定义标记、控件）不在图里
    await smap.downloadImage('map.png')
  } catch (e) {
    exportError.value = e.message
  } finally {
    exporting.value = false
  }
}

async function locate() {
  locateError.value = ''
  locating.value = true
  try {
    // 用浏览器定位，在地图上标出位置和精度圈并移动过去；用户拒绝授权时会 reject
    const result = await smap.locate({ timeout: 8000 })
    accuracy.value = Math.round(result.accuracy)
  } catch (e) {
    locateError.value = e.message
  } finally {
    locating.value = false
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })

  // loaded / tileLoaded 在下一个微任务触发，要在构造之后同步注册
  smap.on('loaded', () => events.value.push({ name: 'loaded', detail: '地图已创建' }))
  smap.on('tileLoaded', (layers) =>
    events.value.push({ name: 'tileLoaded', detail: `${layers.length} 个底图图层` }),
  )

  // Leaflet 原生事件直接在 smap.instance 上监听
  smap.instance.on('move', syncView)
  syncView()

  controlTypes.forEach((item) => toggle(item.type))
})

onBeforeUnmount(() => smap?.destroy())
</script>
