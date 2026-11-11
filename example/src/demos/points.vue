<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <h3>点的数量</h3>
      <div class="seg">
        <button
          v-for="n in sizes"
          :key="n"
          type="button"
          :class="{ 'is-active': size === n }"
          @click="render(n)"
        >
          {{ n.toLocaleString() }}
        </button>
      </div>
      <dl class="kv">
        <dt>创建并上图耗时</dt>
        <dd>{{ elapsed }} ms</dd>
        <dt>在线 / 离线</dt>
        <dd>{{ online.toLocaleString() }} / {{ (size - online).toLocaleString() }}</dd>
      </dl>
      <label class="check">
        <input v-model="clustered" type="checkbox" @change="render(size)" />
        缩小时聚合成气泡
      </label>
      <p class="hint">
        {{
          clustered
            ? '挤在一起的点合并成带数量的气泡，放大后散开；点击气泡会放大到它的范围。'
            : '所有点画在同一张 canvas 上，拖动和缩放时不会像一个点一个 DOM 标记那样卡顿。'
        }}
      </p>
    </section>

    <section class="block">
      <h3>选中的点</h3>
      <dl v-if="picked" class="kv">
        <dt>编号</dt>
        <dd>{{ picked.id }}</dd>
        <dt>状态</dt>
        <dd class="text">{{ picked.online ? '在线' : '离线' }}</dd>
        <dt>经度, 纬度</dt>
        <dd>{{ picked.lng.toFixed(6) }}, {{ picked.lat.toFixed(6) }}</dd>
      </dl>
      <p v-else class="empty">点击地图上的任意一个点。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'

const sizes = [1000, 10000, 50000]

const mapEl = ref()
const size = ref(10000)
const elapsed = ref(0)
const online = ref(0)
const picked = ref(null)
const clustered = ref(false)
let smap

/** 在合肥周边随机生成设备点位 */
function generate(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `M${String(i + 1).padStart(5, '0')}`,
    lat: HEFEI[0] + (Math.random() - 0.5) * 0.5,
    lng: HEFEI[1] + (Math.random() - 0.5) * 0.7,
    online: Math.random() > 0.15,
  }))
}

function render(n) {
  size.value = n
  picked.value = null
  const points = generate(n)
  online.value = points.filter((point) => point.online).length

  const options = {
    // 同一个 id 再次添加会替换旧图层，所以两种方式可以来回切
    id: 'devices',
    radius: 3,
    style: (point) => ({ fillColor: point.online ? '#0e7490' : '#d92d20', weight: 0 }),
    tooltip: (point) => point.id,
    onClick: (point) => (picked.value = point),
  }

  const started = performance.now()
  // 点可以是 [lat, lng]，也可以是任何带 lat / lng 的对象
  if (clustered.value) {
    smap.layer.addCluster(points, { ...options, radius: 5, disableClusteringAtZoom: 15 })
  } else {
    smap.layer.addPoints(points, options)
  }
  elapsed.value = Math.round(performance.now() - started)
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
  render(size.value)
})

onBeforeUnmount(() => smap?.destroy())
</script>
