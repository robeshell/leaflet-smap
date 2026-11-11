<template>
  <div class="demo">
    <div class="demo-map">
      <slot name="map" />
    </div>

    <aside class="inspector">
      <header class="inspector-head">
        <span class="inspector-eyebrow">{{ route.meta.group }}</span>
        <h1>{{ route.meta.title }}</h1>
        <p>{{ route.meta.desc }}</p>
      </header>

      <div class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': tab === t.id }"
          :aria-selected="tab === t.id"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-show="tab === 'panel'" class="inspector-body">
        <slot />
      </div>

      <div v-show="tab === 'code'" class="inspector-body inspector-body--code">
        <div class="code-bar">
          <span>script setup</span>
          <button class="btn btn--small" type="button" @click="copy">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <pre class="code"><code>{{ route.meta.code }}</code></pre>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { copyText } from '@/lib/copy'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const tabs = [
  { id: 'panel', label: '操作' },
  { id: 'code', label: '代码' },
]
const tab = ref('panel')
const copied = ref(false)

async function copy() {
  await copyText(route.meta.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
