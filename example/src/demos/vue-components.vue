<template>
  <DemoPage>
    <template #map>
      <!-- 地图铺满父元素；插槽里的组件在地图创建后才渲染 -->
      <SMapView
        v-model:center="center"
        v-model:zoom="zoom"
        :tile-type="tileType"
        :options="{ minZoom: 3, maxZoom: 18 }"
        @ready="smap = $event"
      >
        <SMapControl type="zoom" />
        <SMapControl type="scale" />
        <SMapGeoJson
          :data="districts"
          :path-style="{ color: '#0e7490', weight: 1.5, fillOpacity: 0.06 }"
          :visible="show.districts"
          @click="(feature) => (picked = feature.properties.name)"
        />
        <SMapPoints
          :points="devices"
          :radius="3"
          :point-style="(d) => ({ fillColor: d.online ? '#0e7490' : '#d92d20', weight: 0 })"
          :tooltip="(d) => d.id"
          :visible="show.devices"
          @click="(d) => (picked = d.id)"
        />
        <SMapMask v-if="show.mask" :data="hefei" :fit="false" :mask-style="{ fillOpacity: 0.45 }" />
        <!-- 默认插槽的内容就是弹窗，里面可以用响应式数据 -->
        <SMapMarker v-model:lat-lng="station" draggable tooltip="拖动我，或点击看弹窗">
          <strong>调度中心</strong>
          <div>{{ station[1].toFixed(5) }}, {{ station[0].toFixed(5) }}</div>
        </SMapMarker>
        <SMapContextMenu :items="menu" />
      </SMapView>
    </template>

    <section class="block">
      <h3>视图 <small>v-model:center / v-model:zoom</small></h3>
      <dl class="kv">
        <dt>缩放级别</dt>
        <dd>{{ zoom }}</dd>
        <dt>中心点</dt>
        <dd>{{ center[1].toFixed(5) }}, {{ center[0].toFixed(5) }}</dd>
      </dl>
      <div class="row">
        <button class="btn" type="button" @click="zoom = Math.min(zoom + 1, 18)">放大一级</button>
        <button class="btn" type="button" @click="reset">回到合肥</button>
      </div>
    </section>

    <section class="block">
      <h3>底图 <small>:tile-type</small></h3>
      <div class="seg">
        <button
          v-for="item in tiles"
          :key="item.label"
          type="button"
          :class="{ 'is-active': tileType === item.type }"
          @click="tileType = item.type"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>图层组件 <small>:visible / v-if</small></h3>
      <label class="check"><input v-model="show.districts" type="checkbox" /> 区县边界</label>
      <label class="check">
        <input v-model="show.devices" type="checkbox" /> 设备点位
        <button class="btn btn--text" type="button" @click.prevent="regenerate">换一批数据</button>
      </label>
      <label class="check"><input v-model="show.mask" type="checkbox" /> 合肥市遮罩</label>
      <p class="hint">蓝色圆点是 <code>&lt;SMapMarker&gt;</code>，可以拖动；在地图上点右键试试。</p>
      <p v-if="picked" class="note">点击了：{{ picked }}</p>
    </section>

    <section class="block">
      <h3>
        测量 <small>useMeasure()</small>
        <button
          v-if="measure.results.value.length"
          class="btn btn--text btn--danger"
          type="button"
          @click="measure.clear()"
        >
          清除
        </button>
      </h3>
      <div class="seg">
        <button
          v-for="item in measureTypes"
          :key="item.type"
          type="button"
          :class="{ 'is-active': measure.active.value === item.type }"
          @click="measure.start(item.type)"
        >
          {{ item.label }}
        </button>
      </div>
      <ul v-if="measure.results.value.length" class="list">
        <li v-for="result in measure.results.value" :key="result.id" class="list-row">
          <span class="list-main"><b>{{ result.type === 'polyline' ? '距离' : '面积' }}</b></span>
          <span class="list-value">
            {{
              result.type === 'polyline' ? formatDistance(result.distance) : formatArea(result.area)
            }}
          </span>
          <button class="btn btn--text btn--danger" type="button" @click="measure.remove(result)">
            删除
          </button>
        </li>
      </ul>
    </section>
  </DemoPage>
</template>

<script setup>
import { reactive, ref, shallowRef } from 'vue'
import {
  SMapControl,
  SMapContextMenu,
  SMapGeoJson,
  SMapMarker,
  SMapMask,
  SMapPoints,
  SMapView,
  useMeasure,
} from 'smap-leaflet-vue'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import { formatArea, formatDistance } from '@/lib/format'
import districts from '@/data/hefei-districts.json'
import anhui from '@/data/anhui-cities.json'

const tiles = [
  { label: '高德矢量', type: 'GaoDe.Normal.Map' },
  { label: '高德影像', type: 'GaoDe.Satellite.Map' },
  { label: 'OSM', type: 'OSM.Normal.Map' },
]
const measureTypes = [
  { type: 'polyline', label: '测距' },
  { type: 'circle', label: '测圆' },
  { type: 'rectangle', label: '测矩形' },
]
const hefei = anhui.features.find((feature) => feature.properties.id === '340100')

// 地图实例放在 shallowRef 里：深层响应式代理会破坏 Leaflet 的内部状态
const smap = shallowRef(null)
const center = ref([...HEFEI])
const zoom = ref(10)
const tileType = ref(tiles[0].type)
const show = reactive({ districts: true, devices: true, mask: false })
const picked = ref('')
const devices = shallowRef(generate())
const station = ref([HEFEI[0] + 0.05, HEFEI[1] - 0.12])
// 右键菜单：传函数可以拿到点击位置
const menu = ({ latlng }) => [
  { text: '把调度中心移到这里', onClick: () => (station.value = [latlng.lat, latlng.lng]) },
  '-',
  { text: '放大', onClick: () => (zoom.value = Math.min(zoom.value + 1, 18)) },
]

// 面板和地图是兄弟节点，所以把 @ready 拿到的地图传进去；
// 写在 <SMapView> 插槽里的组件可以直接 useMeasure()，不用传
const measure = useMeasure({ smap, shapeOptions: { color: '#0e7490' } })

function generate() {
  return Array.from({ length: 2000 }, (_, i) => ({
    id: `M${String(i + 1).padStart(4, '0')}`,
    lat: HEFEI[0] + (Math.random() - 0.5) * 0.6,
    lng: HEFEI[1] + (Math.random() - 0.5) * 0.8,
    online: Math.random() > 0.15,
  }))
}

function regenerate() {
  // 换成新数组，图层组件就会重画
  devices.value = generate()
}

function reset() {
  center.value = [...HEFEI]
  zoom.value = 10
}
</script>
