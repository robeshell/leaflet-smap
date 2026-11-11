<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">在地图空白处或标记上点击右键。标记有自己的菜单，不会和地图的菜单叠在一起。</p>
    </section>

    <section class="block">
      <h3>标记 <small>剩余 {{ count }} 个</small></h3>
      <div class="row">
        <button class="btn" type="button" @click="scatter">重新生成</button>
      </div>
    </section>

    <section class="block">
      <h3>最近一次操作</h3>
      <p v-if="last" class="note">{{ last }}</p>
      <p v-else class="empty">还没有使用过右键菜单。</p>
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

const mapEl = ref()
const count = ref(0)
const last = ref('')
let smap, group

function scatter() {
  group.clearLayers()
  const bounds = smap.instance.getBounds().pad(-0.15)

  for (let i = 1; i <= 30; i++) {
    const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth())
    const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest())
    const marker = pin([lat, lng]).addTo(group)

    // 给单个图层绑定菜单；回调里的 layer 就是被右键的那个图层
    smap.contextMenu.bind(marker, [
      {
        text: `移动到标记 ${i}`,
        onClick: ({ layer }) => smap.instance.panTo(layer.getLatLng()),
      },
      '-',
      {
        text: '删除',
        danger: true,
        onClick: ({ layer }) => {
          group.removeLayer(layer)
          smap.contextMenu.unbind(layer)
          count.value = group.getLayers().length
          last.value = `删除了标记 ${i}`
        },
      },
    ])
  }
  count.value = group.getLayers().length
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
  group = L.featureGroup().addTo(smap.instance)

  // 地图自己的菜单。传函数可以按点击位置动态生成菜单项
  smap.contextMenu.setItems(({ latlng }) => [
    {
      text: '在此处居中',
      onClick: () => {
        smap.instance.panTo(latlng)
        last.value = '地图居中到点击位置'
      },
    },
    {
      text: '显示坐标',
      onClick: () => {
        last.value = `坐标 ${latlng.lng.toFixed(6)}, ${latlng.lat.toFixed(6)}`
      },
    },
    '-',
    { text: '放大', onClick: () => smap.instance.zoomIn() },
    {
      text: '缩小',
      disabled: smap.instance.getZoom() <= smap.instance.getMinZoom(),
      onClick: () => smap.instance.zoomOut(),
    },
  ])

  scatter()
})

onBeforeUnmount(() => smap?.destroy())
</script>
