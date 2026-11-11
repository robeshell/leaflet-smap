<template>
  <DemoPage>
    <template #map><div ref="mapEl" class="map" /></template>

    <section class="block">
      <p class="hint">根据访问者的 IP 判断所在城市，精度是城市级，不需要密钥，也不需要浏览器定位授权。</p>
      <div class="row">
        <button class="btn btn--primary" type="button" :disabled="loading" @click="locate">
          {{ loading ? '定位中…' : '定位' }}
        </button>
      </div>
      <p v-if="error" class="note note--error">定位失败：{{ error }}</p>
    </section>

    <section class="block">
      <h3>结果</h3>
      <dl v-if="info" class="kv">
        <dt>国家</dt>
        <dd class="text">{{ info.country || '-' }}</dd>
        <dt>省份</dt>
        <dd class="text">{{ info.province || '-' }}</dd>
        <dt>城市</dt>
        <dd class="text">{{ info.city || '-' }}</dd>
        <dt>区划码</dt>
        <dd>{{ info.gb || '-' }}</dd>
        <dt>经度, 纬度</dt>
        <dd>{{ info.lng || '-' }}, {{ info.lat || '-' }}</dd>
      </dl>
      <p v-else class="empty">还没有定位。</p>
    </section>
  </DemoPage>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SMap } from 'leaflet-smap'
import DemoPage from '@/components/DemoPage.vue'
import { HEFEI } from '@/config'
import { pin } from '@/lib/pin'

const mapEl = ref()
const info = ref(null)
const loading = ref(false)
const error = ref('')
let smap, marker

async function locate() {
  error.value = ''
  loading.value = true
  try {
    const result = await smap.service.getLocationByIp()
    if (!result.data) throw new Error(result.msg || '没有返回位置')
    info.value = result.data

    // lat / lng 是字符串；境外或内网 IP 可能没有坐标
    const lat = Number(result.data.lat)
    const lng = Number(result.data.lng)
    if (lat && lng) {
      marker?.remove()
      marker = pin([lat, lng], { label: result.data.city || result.data.province || '' }).addTo(
        smap.instance,
      )
      smap.setView([lat, lng], 10)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  smap = new SMap(mapEl.value, {
    tileType: 'GaoDe.Normal.Map',
    center: HEFEI,
    zoom: 5,
    minZoom: 3,
    maxZoom: 18,
  })
  smap.control.add('zoom')
})

onBeforeUnmount(() => smap?.destroy())
</script>
