# smap-leaflet-vue

[`smap-leaflet`](../core/README.md) 的 Vue 3 封装：用组件声明地图、图层和控件，用组合式函数做测量和绘制。

**[在线示例](https://robeshell.github.io/leaflet-smap/)** · [English overview](https://github.com/robeshell/leaflet-smap/blob/main/README.en.md)

## 安装

```bash
npm install smap-leaflet-vue smap-leaflet leaflet
```

三者都要装：本包只是一层封装，`smap-leaflet`（>= 2.6.0）、`leaflet`、`vue`（>= 3.3）是 peerDependency。样式来自核心库，在入口引入一次：

```ts
import 'smap-leaflet/style.css'
```

## 快速上手

```vue
<template>
  <div style="height: 600px">
    <SMapView v-model:center="center" v-model:zoom="zoom" tile-type="GaoDe.Normal.Map">
      <SMapControl type="zoom" />
      <SMapGeoJson :data="districts" :path-style="{ color: '#0e7490' }" fit />
    </SMapView>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { SMapView, SMapControl, SMapGeoJson } from 'smap-leaflet-vue'

const center = ref<[number, number]>([31.82, 117.23]) // [纬度, 经度]
const zoom = ref(12)
const districts = shallowRef(null) // 大块数据用 shallowRef
</script>
```

`<SMapView>` 铺满父元素，所以**父元素必须有高度**。

## `<SMapView>`

| 属性        | 类型                     | 说明                                                                     |
| :---------- | :----------------------- | :----------------------------------------------------------------------- |
| `tile-type` | `TileType \| TileType[]` | 底图。改变它会切换底图                                                   |
| `center`    | `[number, number]`       | 中心点 `[lat, lng]`，支持 `v-model:center`                               |
| `zoom`      | `number`                 | 缩放级别，支持 `v-model:zoom`                                            |
| `tdt-key`   | `string`                 | 天地图密钥                                                               |
| `options`   | `SMapOptions`            | 其余的地图选项（`minZoom`、`maxZoom`、`crs` 等）。**只在创建时读取一次** |

| 事件                            | 参数            | 说明                     |
| :------------------------------ | :-------------- | :----------------------- |
| `ready`                         | `SMap`          | 地图创建完成             |
| `update:center` / `update:zoom` |                 | 用户移动或缩放地图后     |
| `measure-created`               | `MeasureResult` | 任意测量工具完成一次测量 |
| `measure-removed`               | `{ id, type }`  | 一次测量被删除           |

- 默认插槽的内容在地图创建后才渲染，插槽参数里有 `smap`。
- 组件实例上暴露了 `smap`（模板引用：`viewRef.value.smap`）。
- 卸载时自动 `destroy()`，不需要手动清理。

## 图层和控件组件

都必须写在 `<SMapView>` 的插槽里，本身不渲染任何 DOM。卸载（`v-if`）时自动从地图上移除。

```vue
<SMapGeoJson
  :data="geojson"
  :path-style="{ color: 'red' }"
  :visible="show"
  fit
  @click="onFeature"
/>

<SMapPoints
  :points="devices"
  :radius="3"
  :point-style="(d) => ({ fillColor: d.online ? 'green' : 'red' })"
  :tooltip="(d) => d.name"
  @click="(device) => select(device)"
/>

<SMapCluster
  :points="devices"
  :cluster-radius="60"
  :disable-clustering-at-zoom="16"
  @click="select"
/>

<SMapMask :data="regionGeojson" :mask-style="{ fillOpacity: 0.5 }" />

<!-- 默认插槽的内容就是弹窗，可以用响应式数据和组件 -->
<SMapMarker
  v-model:lat-lng="position"
  draggable
  tooltip="拖动我"
  :context-menu="markerMenu"
  @click="onClick"
>
  <strong>{{ station.name }}</strong>
</SMapMarker>

<SMapContextMenu :items="[{ text: '放大', onClick: ({ map }) => map.zoomIn() }]" />

<SMapControl type="zoom" />
<SMapControl type="scale" :options="{ position: 'bottomright' }" />
<SMapControl
  type="layers"
  :options="{ options: [{ label: '矢量', tileType: 'GaoDe.Normal.Map' }] }"
/>
<SMapControl
  type="overlays"
  :options="{ title: '图层', items: [{ id: 'roads', label: '道路' }] }"
/>
```

| 组件              | 属性                                                                                                                | 事件                                                                          |
| :---------------- | :------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| `SMapGeoJson`     | `data`、`path-style`、`visible`（默认 true）、`fit`（数据变化后缩放到图层，默认 false）                             | `click(feature, event)`                                                       |
| `SMapPoints`      | `points`（`[lat, lng]` 或带 `lat` / `lng` 的对象）、`radius`、`point-style`、`tooltip`、`visible`                   | `click(point, event)`                                                         |
| `SMapMask`        | `data`、`mask-style`、`visible`、`fit`（默认 true）                                                                 |                                                                               |
| `SMapCluster`     | `points`、`radius`、`point-style`、`tooltip`、`cluster-radius`、`disable-clustering-at-zoom`、`visible`             | `click(point, event)`、`cluster-click(points, event)`（不监听则点击气泡放大） |
| `SMapMarker`      | `lat-lng`（支持 `v-model:lat-lng`）、`icon`、`draggable`、`tooltip`、`context-menu`、`visible`；默认插槽 = 弹窗内容 | `click(event)`、`update:lat-lng`（拖动结束）                                  |
| `SMapContextMenu` | `items`（数组，或按点击位置生成菜单的函数）                                                                         |                                                                               |
| `SMapControl`     | `type`（`zoom` / `scale` / `attribution` / `layers` / `overlays`）、`options`                                       |                                                                               |

**数据更新靠替换，不靠修改。** 组件只在 `data` / `points` 换成新对象时重画；往原数组里 `push` 不会触发。要更新就赋一个新数组：`devices.value = [...devices.value, item]`。

## 组合式函数

### `useMeasure(options?)`

```ts
const {
  results,
  active,
  editing,
  start,
  cancel,
  remove,
  clear,
  startEdit,
  finishEdit,
  undo,
  setOptions,
} = useMeasure({ areaUnit: 'mu', snap: true })

start('polyline') // 'polyline' | 'polygon' | 'circle' | 'rectangle'
active.value // 正在测量的类型，或 null
results.value // MeasureResult[]：{ id, type, distance?, area?, radius?, latlngs, layer }
remove(results.value[0])
clear()

startEdit() // 让用户拖动调整已有结果；拖动过程中 results 实时更新
undo() // 撤销上一步
finishEdit() // 保存；finishEdit(false) 放弃
setOptions({ areaUnit: 'ha' }) // 运行时切换单位等选项
```

`options` 是核心库的 `MeasureOptions`（默认 `showMarker: true`）加一个可选的 `smap`。

### `useDraw(options?)`

```ts
const {
  geojson,
  count,
  drawing,
  editing,
  canUndo,
  draw,
  cancel,
  startEdit,
  finishEdit,
  undo,
  load,
  clear,
  tool,
} = useDraw({ shapeOptions: { color: '#0e7490' }, snap: true }) // snap：吸附到已有图形

draw('polygon') // 'marker' | 'polyline' | 'polygon' | 'rectangle' | 'circle'
geojson.value // 当前全部图形，每次变化后更新
await load(savedGeojson) // 载入已有数据
startEdit()
undo() // 撤销上一步；canUndo.value 表示有没有可撤销的
finishEdit() // 保存；finishEdit(false) 放弃
```

### 在哪里调用

- **在 `<SMapView>` 插槽内的子组件里**：直接 `useMeasure()` / `useDraw()` / `useSMap()`，自动找到地图。
- **在地图旁边的组件里**（例如地图和操作面板是兄弟节点，这是最常见的情况）：把地图传进去。

```vue
<template>
  <SMapView @ready="smap = $event" />
  <button @click="measure.start('polyline')">测距</button>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import type { SMap } from 'smap-leaflet'
import { SMapView, useMeasure } from 'smap-leaflet-vue'

const smap = shallowRef<SMap | null>(null)
const measure = useMeasure({ smap }) // 也可以传 getter：() => viewRef.value?.smap
</script>
```

地图还没创建时调用 `start` / `draw` 会 reject（`The map is not ready yet`）。

### `useSMap()`

返回外层 `<SMapView>` 的 `SMap` 实例，用来调用核心库的任何 API。只能在插槽内的组件里用，否则抛错。

## 响应式与性能

Leaflet 的对象内部互相引用、成环，还大量依赖 `===` 比较，一旦被 Vue 的深层代理包住就会出错或变慢。本包在这方面做了防护，使用时不需要特别小心：

- 地图实例、测量 / 绘制工具、测量结果都做了 `markRaw`。即使你把它们放进 `ref()` 或 `reactive()`，Vue 也不会代理它们，不会递归进 Leaflet 的对象图。
- 传给组件的 `data` / `points` 会先取原始对象再交给 Leaflet。父组件用 `ref()` 存 GeoJSON 也没问题，Leaflet 拿到的不是代理。
- 没有对数据做深层监听（`deep: true`），不会在每次更新时遍历整份 GeoJSON。
- `v-model:center` / `v-model:zoom` 不会循环触发：组件发出的值再传回来时与地图当前状态一致，会被忽略。

仍然建议的两点：

- 大块数据（上千个要素或点）用 `shallowRef` 存。`ref()` 不会出错，但 Vue 会在你自己访问它时为每一层创建代理，白白占内存。
- 需要自己保存地图实例时用 `shallowRef`，语义更清楚。

## 没有封装的功能

定位、导出图片、天地图服务、WFS / WMS、图层登记表、自定义底图等没有对应的组件，通过地图实例直接调用核心库：

```ts
const smap = useSMap() // 或 @ready 拿到的实例
await smap.service.search({ keyword: '医院' })
await smap.locate()
```

完整 API 见[核心库文档](../core/README.md)。

## 开发

本包位于 monorepo 的 `packages/vue`，见[根目录 README](../../README.md)。版本变更见 [CHANGELOG.md](CHANGELOG.md)。
