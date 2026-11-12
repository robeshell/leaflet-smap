<h1 align="center">smap-leaflet</h1>
<p align="center">
  <strong>基于 Leaflet.js 二次封装的地图库</strong><br>
  TypeScript 编写 · 支持国内主流底图 · 坐标纠偏 · 测量工具 · 天地图服务 · WFS/WMS 图层
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/smap-leaflet"><img src="https://img.shields.io/npm/v/smap-leaflet" alt="npm" /></a>
  <img src="https://img.shields.io/badge/leaflet-%3E%3D1.8.0-green" alt="leaflet" />
  <img src="https://img.shields.io/badge/typescript-5-blue" alt="typescript" />
  <img src="https://img.shields.io/badge/build-vite%205-purple" alt="vite" />
</p>

<p align="center">
  <a href="https://robeshell.github.io/leaflet-smap/"><strong>在线示例</strong></a> ·
  <a href="https://github.com/robeshell/leaflet-smap">GitHub</a> ·
  <a href="https://github.com/robeshell/leaflet-smap/blob/main/README.en.md">English</a> ·
  <a href="https://github.com/robeshell/leaflet-smap/blob/main/packages/core/CHANGELOG.md">更新日志</a>
</p>

---

## 特性

- **多底图支持** — 天地图、高德、谷歌、百度、腾讯、Geoq、OSM、Mapbox，也可以注册自己的瓦片服务
- **坐标纠偏** — 自动处理 WGS-84 / GCJ-02 / BD-09 偏移
- **测量工具** — 测距、测面、测圆、测矩形
- **绘制与编辑** — 画点、线、面、矩形、圆，编辑后导出 / 载入 GeoJSON
- **天地图服务** — POI 搜索、地理编码、逆地理编码、行政区划查询、IP 定位
- **图层管理** — 按 id 登记图层，WFS / WMS、区域遮罩、海量点、点聚合
- **控件与交互** — 水印、缩放、比例尺、底图切换、图层开关、右键菜单、浏览器定位
- **导出** — 把当前地图导出为图片
- **多实例** — 支持同页面多个地图实例
- **TypeScript** — 完整类型定义
- **Tree-shakable** — ESM + CJS 双格式输出

## 安装

```bash
npm install smap-leaflet leaflet
```

> `leaflet` 为 peerDependency，需要手动安装

## 快速上手

```html
<div id="map" style="width: 100vw; height: 100vh;"></div>
```

```ts
import { SMap } from 'smap-leaflet'
import 'smap-leaflet/style.css'

const smap = new SMap('#map', {
  tileType: 'GaoDe.Normal.Map',
  center: [31.82, 117.23],
  zoom: 12,
  minZoom: 6,
  maxZoom: 18,
})

// 获取底层 Leaflet 实例
const map = smap.instance
```

## API

### `new SMap(container, options)`

创建地图实例。

| 参数        | 类型                    | 说明                                  |
| :---------- | :---------------------- | :------------------------------------ |
| `container` | `string \| HTMLElement` | 容器（`'#map'`、`'map'` 或 DOM 元素） |
| `options`   | `SMapOptions`           | 地图配置                              |

#### SMapOptions

| 属性           | 类型                 | 默认值 | 说明                              |
| :------------- | :------------------- | :----- | :-------------------------------- |
| `tileType`     | `string \| string[]` | —      | 底图类型，如 `'GaoDe.Normal.Map'` |
| `center`       | `[number, number]`   | —      | 中心坐标 `[lat, lng]`             |
| `zoom`         | `number`             | `12`   | 初始缩放                          |
| `minZoom`      | `number`             | —      | 最小缩放                          |
| `maxZoom`      | `number`             | —      | 最大缩放                          |
| `tdtKey`       | `string`             | —      | 天地图密钥，仅用于 `TianDiTu.*`   |
| `mapboxToken`  | `string`             | —      | Mapbox 令牌，仅用于 `Mapbox.*`    |
| `preferCanvas` | `boolean`            | `true` | 是否使用 Canvas 渲染              |

> 支持传入所有 [Leaflet MapOptions](https://leafletjs.cn/reference.html#map-option)

---

### 底图

#### `smap.setTileLayer(type)`

替换当前底图。

```ts
smap.setTileLayer('TianDiTu.Normal.Map')

// 多图层（底图 + 标注）
smap.setTileLayer(['TianDiTu.Satellite.Map', 'TianDiTu.Satellite.Annotion'])

smap.getTileType() // 当前底图的类型数组
```

类型不存在时会抛错，并保留当前底图不变。

#### `smap.addTileLayer(type)`

在现有底图上叠加图层（不移除已有图层）。

#### `smap.clearTileLayers()`

移除所有底图。

#### `smap.getTileLayers()`

获取当前底图图层数组。

#### 支持的底图类型

| 提供商     | 类型                                                                                                    |
| :--------- | :------------------------------------------------------------------------------------------------------ |
| **天地图** | `TianDiTu.Normal.Map/Annotion` · `TianDiTu.Satellite.Map/Annotion` · `TianDiTu.Terrain.Map/Annotion`    |
| **高德**   | `GaoDe.Normal.Map` · `GaoDe.Satellite.Map/Annotion` · `GaoDe.Brief.Map`                                 |
| **谷歌**   | `Google.Normal.Map` · `Google.Satellite.Map/Annotion`                                                   |
| **百度**   | `Baidu.Normal.Map` · `Baidu.Satellite.Map/Annotion` · `BaiduV3.Normal.Map`（需设置 `crs: L.CRS.Baidu`） |
| **Geoq**   | `Geoq.Normal.Map/PurplishBlue/Gray/Warm` · `Geoq.Theme.Hydro`                                           |
| **腾讯**   | `Tencent.Normal.Map` · `Tencent.Satellite.Map` · `Tencent.Terrain.Map`                                  |
| **OSM**    | `OSM.Normal.Map`                                                                                        |
| **Mapbox** | `Mapbox.Satellite.Map`（需 `mapboxToken`）                                                              |

---

### 测量工具

`getMeasure` 返回 Promise：

```ts
// 每种类型共用一个工具，首次调用时创建
const measure = await smap.getMeasure('polyline', { showMarker: true })

measure.enable() // 开始一次测量；画完自动结束，再量需再次 enable()
measure.disable() // 取消正在进行的绘制（已完成的图形保留）
measure.measuring // 是否正在绘制
measure.clearAll() // 清除该工具的全部结果
measure.destroy() // 销毁

smap.clearMeasures() // 销毁所有测量工具
```

| 类型          | 说明   |
| :------------ | :----- |
| `'polyline'`  | 测距   |
| `'polygon'`   | 测面   |
| `'circle'`    | 测圆   |
| `'rectangle'` | 测矩形 |

`smap.createMeasure(type, options)` 每次都会新建一个独立的工具，适合需要多套不同样式的场景；一般情况用 `getMeasure` 即可。

#### MeasureOptions

| 属性           | 类型                              | 说明                                   |
| :------------- | :-------------------------------- | :------------------------------------- |
| `showMarker`   | `boolean`                         | 是否在地图上显示结果标签               |
| `shapeOptions` | `L.PathOptions`                   | 图形样式；顶点和标签的颜色跟随 `color` |
| `icon`         | `L.DivIcon`                       | 顶点图标                               |
| `formatLabel`  | `(label: MeasureLabel) => string` | 自定义标签文字                         |

```ts
await smap.getMeasure('polyline', {
  showMarker: true,
  // label: { type, distance?, area?, radius?, center?, latlngs, partial }
  // partial 为 true 表示测距过程中各节点上的累计值，false 表示最终结果
  formatLabel: (label) =>
    label.partial ? `${label.distance.toFixed(0)} m` : `总长 ${label.distance.toFixed(0)} m`,
})
```

单位和编辑：

```ts
// 默认标签的单位：长度 'auto' | 'm' | 'km'，面积 'auto' | 'm2' | 'km2' | 'ha'（公顷）| 'mu'（亩）
const area = await smap.getMeasure('polygon', { showMarker: true, areaUnit: 'mu' })
area.setOptions({ areaUnit: 'ha' }) // 之后再改，地图上已有的标签会跟着换

// 调整已经量好的图形，数值和标签随拖动实时变化
area.startEdit()
area.finishEdit() // 保存；finishEdit(false) 放弃
area.undo() // 撤销上一步
area.on('updating', (result) => {}) // 拖动过程中持续触发
area.on('updated', (result) => {}) // 保存后触发；地图上对应 measure:updating / measure:updated

// 测量也可以吸附到之前量过的图形（以及 layers 指定的图层）
await smap.getMeasure('polyline', { showMarker: true, snap: true })
```

> 旧的 `valueFormatter` 选项仍然可用但已弃用：它在不同工具下收到的参数含义不一样（测距是距离、测圆是半径、测面是顶点数组）。

> 同一地图上可以同时存在多个测量工具，各自只响应自己发起的绘制。

#### 获取测量结果

```ts
measure.on('created', (result) => {
  result.type // 'polyline' | 'polygon' | 'circle' | 'rectangle'
  result.distance // 总长度（米），测距
  result.area // 面积（平方米），测面 / 测矩形 / 测圆
  result.perimeter // 周长（米），测面 / 测矩形 / 测圆
  result.radius // 半径（米），测圆
  result.latlngs // 顶点；测圆时为圆心
  result.layer // 画出来的 Leaflet 图层
})
measure.on('removed', ({ id }) => {})
measure.on('start', ({ type }) => {})
measure.on('stop', ({ type, completed }) => {}) // completed 为 false 表示被取消（含按 Esc）

measure.getResults() // 当前还在地图上的全部结果
measure.remove(result.id) // 删除某一次测量

// 不关心是哪个工具时，直接在地图上监听
smap.on('measure:created', (result) => {})
smap.on('measure:stop', ({ type, completed }) => {})
```

---

### 绘制与编辑

```ts
const draw = await smap.createDraw({ shapeOptions: { color: '#0e7490' } })

draw.draw('polygon') // 'marker' | 'polyline' | 'polygon' | 'rectangle' | 'circle'，画完自动结束
draw.cancel() // 放弃正在画的图形

draw.startEdit() // 进入编辑：拖动顶点、移动标记、调整圆的大小
draw.undo() // 撤销上一步（也可以按 Ctrl/⌘ + Z）；draw.canUndo 表示有没有可撤销的
draw.finishEdit() // 保存修改；finishEdit(false) 放弃修改

draw.toGeoJSON() // 导出全部图形（WGS-84）
draw.load(geojson) // 载入 GeoJSON 供显示和编辑；load(geojson, { replace: false }) 为追加
draw.remove(layer) // 删除一个图形
draw.clear() // 清空

draw.on('created', ({ layer, type }) => {})
draw.on('change', (featureCollection) => {}) // 画完、保存编辑、删除、载入后都会触发
```

圆在 GeoJSON 里表示为带 `properties.radius`（米）的点，`load` 时会还原成圆。其他事件：`drawstart`、`drawstop`、`edited`、`removed`。

#### 操作方式

| 形状      | 绘制                                                      |
| :-------- | :-------------------------------------------------------- |
| 点        | 单击放置                                                  |
| 线        | 单击逐个添加节点；双击、再次单击最后一个点或按 Enter 结束 |
| 面        | 单击逐个添加顶点；单击第一个点、双击或按 Enter 闭合       |
| 矩形 / 圆 | 按住拖动后松开；也可以单击两次（触屏用这种方式）          |

绘制中按 Backspace 撤销上一个点，按 Esc 取消。测量工具的操作方式相同。

编辑模式下：拖动顶点调整形状；拖动边中点的小圆点插入顶点；单击顶点删除；矩形拖四角缩放、拖中心移动；圆拖圆心移动、拖边上的点改半径；标记直接拖动。支持带洞的多边形和多部件图形。

开启吸附后，绘制和编辑时光标靠近已有图形的顶点或边会自动贴上去，画相邻地块时边界能对齐：

```ts
await smap.createDraw({ snap: true })
// 调整距离，或者同时吸附到别的图层
await smap.createDraw({ snap: { distance: 16, layers: () => [parcelLayer] } })
```

提示文字可以改写：

```ts
import { sketchText } from 'smap-leaflet'

sketchText.polyline.start = 'Click to start the line'
```

> 绘制和编辑是库自己实现的，不依赖 leaflet-draw，也不需要全局的 `L`。

---

### 图层管理 `smap.layer`

#### 按 id 管理

```ts
smap.layer.add('roads', anyLeafletLayer) // 登记并加到地图上；同 id 会替换旧图层
smap.layer.add('hidden', layer, { visible: false }) // 只登记，先不显示

smap.layer.toggle('roads') // 切换显示，返回切换后的状态
smap.layer.show('roads')
smap.layer.hide('roads') // 从地图上拿下来，但保留登记
smap.layer.remove('roads') // 移除并取消登记
smap.layer.get('roads')
smap.layer.ids()
smap.layer.clear()
```

`addWFS` / `addWMS` / `addMask` / `addPoints` 的选项里传 `id` 即可自动登记。`smap.destroy()` 会清掉所有登记过的图层。

#### 区域遮罩

```ts
// 压暗指定区域以外的部分；接受 Polygon / MultiPolygon 的 Feature、FeatureCollection 或 Geometry
smap.layer.addMask(geojson, {
  id: 'mask',
  fillColor: '#000',
  fillOpacity: 0.5,
  color: '#3388ff', // 边界线颜色；outline: false 不画边界
  fit: true, // 添加后缩放到该区域（默认）
  restrict: false, // 为 true 时限制地图只能在该区域内拖动，遮罩移除后自动解除
})
```

#### 海量点

```ts
// 所有点画在同一张 canvas 上，适合上万个点。点可以是 [lat, lng] 或带 lat / lng 的对象
smap.layer.addPoints(devices, {
  id: 'devices',
  radius: 3,
  style: (device) => ({ fillColor: device.online ? 'green' : 'red' }),
  tooltip: (device) => device.name,
  onClick: (device) => console.log(device),
})
```

#### WFS

```ts
// 请求 WFS 并直接加到地图上
const layer = await smap.layer.addWFS({
  url: 'http://example.com/geoserver/wfs',
  layer: 'workspace:layerName',
  style: { color: '#f00', weight: 2 },
})

// 或者分两步：先取 GeoJSON，再自行创建图层
const data = await smap.layer.loadWFS({
  url: 'http://example.com/geoserver/wfs',
  layer: 'workspace:layerName',
})
const geoJsonLayer = smap.layer.createGeoJsonLayer(data, { color: '#f00', weight: 2 })
geoJsonLayer.addTo(smap.instance)
```

> 除 `url` / `layer` / `style` / `outputFormat` 外的字段会作为 WFS 请求参数透传（如 `cql_filter`、`maxFeatures`）

#### WMS

```ts
// 创建并加到地图上
const wmsLayer = smap.layer.addWMS({
  url: 'http://example.com/geoserver/wms',
  layer: 'workspace:layerName',
  format: 'image/png',
  transparent: true,
})

// 只创建、不添加
const detached = smap.layer.createWMS({
  url: 'http://example.com/geoserver/wms',
  layer: 'workspace:layerName',
})
```

> `crs` 默认为 `L.CRS.EPSG4326`

---

#### 点聚合

```ts
// 点太密时，缩小后合并成带数量的气泡，放大后散开；点击气泡放大到它的范围
const cluster = smap.layer.addCluster(devices, {
  id: 'devices',
  clusterRadius: 60, // 多近（像素）算挤在一起，默认 60
  disableClusteringAtZoom: 16, // 到这个级别就不再聚合
  style: (d) => ({ fillColor: d.online ? 'green' : 'red' }), // 单个点的样式，同 addPoints
  tooltip: (d) => d.name,
  onClick: (d) => {},
  onClusterClick: (points) => {}, // 可选；不传则点击气泡放大
})
cluster.setPoints(newDevices) // 换数据
```

气泡颜色用 CSS 变量 `--smap-cluster` 改。

---

### 天地图服务 `smap.service`

需要天地图密钥，[申请地址](https://console.tianditu.gov.cn/api/key)。创建地图时传了 `tdtKey` 就不用再逐次传；单次调用也可以用 `tk` 覆盖。返回值都有类型定义。

```ts
const smap = new SMap('#map', { tdtKey: 'your-key' /* ... */ })

// POI 搜索：范围和级别取地图当前视野
const { pois } = await smap.service.search({ keyword: '合肥南站', count: 10 })
pois?.forEach((poi) => {
  const [lng, lat] = poi.lonlat.split(',').map(Number)
})

// 地理编码：地址 → 坐标（lon / lat 是字符串）
const { location } = await smap.service.geocode({ keyWord: '安徽省合肥市' })

// 逆地理编码：坐标 → 地址
const { result } = await smap.service.reverseGeocode({ lon: 117.23, lat: 31.82 })
result?.formatted_address

// 行政区划：名称或 9 位区划码；childLevel 取下级，extensions 带边界
const { data } = await smap.service.getAdministrative({
  keyword: '156340100',
  childLevel: 1,
})
data?.district[0].children

// IP 定位（无需密钥）
await smap.service.getLocationByIp()
```

> 行政区划查询使用天地图 v2 接口，区划码是 9 位（国家码 `156` + 6 位行政区划码）。旧的 v1 接口已不可用。

脱离地图单独使用：`new ServiceClient({ key: 'your-key' })`，此时 `search` 需要自己传 `level` 和 `mapBound`。

---

### 控件管理 `smap.control`

```ts
smap.control.add('attribution', { prefix: '© My App', content: '自定义水印' })
smap.control.add('zoom', { position: 'topright' })
smap.control.add('scale', { position: 'bottomleft' })

// 底图切换控件，自动高亮当前底图
smap.control.add('layers', {
  options: [
    { label: '矢量', tileType: 'GaoDe.Normal.Map' },
    { label: '影像', tileType: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] },
  ],
})

// 业务图层开关：列出 smap.layer 里登记的图层，和代码里的 show / hide 双向同步
smap.control.add('overlays', {
  title: '图层',
  items: [
    { id: 'roads', label: '道路' },
    { id: 'pipes', label: '管线' },
  ], // 不传则列出全部已登记的图层
})

smap.control.remove('zoom') // 移除单个
smap.control.removeAll() // 移除全部
```

> 同一类型重复 `add` 会替换之前的控件

---

### 右键菜单 `smap.contextMenu`

```ts
// 地图的右键菜单；'-' 是分隔线。传 null 取消
smap.contextMenu.setItems([
  { text: '在此处居中', onClick: ({ latlng, map }) => map.panTo(latlng) },
  '-',
  { text: '放大', onClick: ({ map }) => map.zoomIn() },
])

// 也可以传函数，按点击位置动态生成
smap.contextMenu.setItems(({ latlng }) => [{ text: `纬度 ${latlng.lat.toFixed(4)}` }])

// 给某个图层单独的菜单，它不会和地图菜单叠在一起
const unbind = smap.contextMenu.bind(marker, [
  { text: '删除', danger: true, onClick: ({ layer }) => layer.remove() },
])
```

---

### 定位

```ts
// 浏览器定位：标出位置和精度圈并移动过去。用户拒绝授权时会 reject
const { latlng, accuracy } = await smap.locate({ zoom: 16 })
smap.clearLocation()
```

---

### 导出图片

```ts
const blob = await smap.exportImage({ type: 'image/png', scale: 2 })
await smap.downloadImage('map.png') // 直接保存成文件
```

- 图里有：底图、矢量图形（线、面、圆、点图层），以及库自己的标签：测量标签、聚合气泡、绘制的标记。`labels: false` 可以不画标签。
- 图里没有：其他 HTML 元素，包括自定义图标的标记、弹窗、悬停提示、控件。结构简单的元素（带背景和一行文字的方块）可以用 `include: ['.my-label']` 指定画进去。
- 底图服务必须允许跨域读取瓦片，否则会失败。高德、天地图、腾讯、OSM 可以；谷歌不行。
- 导出前会等底图加载完（最多 `timeout` 毫秒，默认 8000）。

---

### 视图操作

```ts
smap.setView([31.82, 117.23], 14)
smap.fitToLayer(someLayer)
```

---

### 事件

```ts
smap.on('loaded', (map) => {
  /* 地图加载完成 */
})
smap.on('tileLoaded', (layers) => {
  /* 底图加载完成 */
})
smap.off('loaded', handler)
```

| 事件               | 参数                  | 触发时机                                            |
| :----------------- | :-------------------- | :-------------------------------------------------- |
| `loaded`           | `L.Map`               | 地图创建完成（构造后的下一个微任务）                |
| `tileLoaded`       | `L.TileLayer[]`       | 构造时带 `tileType`，或调用 `setTileLayer`          |
| `measure:created`  | `MeasureResult`       | 任意测量工具完成一次测量                            |
| `measure:removed`  | `{ id, type }`        | 一次测量被删除                                      |
| `measure:updating` | `MeasureResult`       | 一次测量正在被拖动调整                              |
| `measure:updated`  | `MeasureResult`       | 一次测量在编辑后保存                                |
| `measure:start`    | `{ type }`            | 测量工具开始绘制                                    |
| `measure:stop`     | `{ type, completed }` | 测量工具结束绘制；`completed` 为 `false` 表示被取消 |
| `measure:start`    | `{ type }`            | 测量工具开始绘制                                    |
| `measure:stop`     | `{ type, completed }` | 测量工具结束绘制，`completed` 为 `false` 表示被取消 |

> `loaded` 与首次 `tileLoaded` 会延迟到微任务中触发，需在 `new SMap(...)` 之后**同步**注册监听；`await` 之后再注册会错过。

---

### 坐标转换工具

```ts
import { wgs84ToGcj02, gcj02ToWgs84, gcj02ToBd09, bd09ToGcj02 } from 'smap-leaflet'

const { lng, lat } = wgs84ToGcj02(117.23, 31.82)
```

| 方法                     | 说明            |
| :----------------------- | :-------------- |
| `wgs84ToGcj02(lng, lat)` | WGS-84 → GCJ-02 |
| `gcj02ToWgs84(lng, lat)` | GCJ-02 → WGS-84 |
| `gcj02ToBd09(lng, lat)`  | GCJ-02 → BD-09  |
| `bd09ToGcj02(lng, lat)`  | BD-09 → GCJ-02  |
| `wgs84ToBd09(lng, lat)`  | WGS-84 → BD-09  |
| `bd09ToWgs84(lng, lat)`  | BD-09 → WGS-84  |

---

#### 转换 GeoJSON

地图上的数据必须是 WGS-84。第三方给的 GCJ-02 / BD-09 数据先转一遍：

```ts
import { transformGeoJSON, transformCoord } from 'smap-leaflet'

const wgs = transformGeoJSON(gcjData, 'gcj02', 'wgs84') // 返回深拷贝，不改动原数据
const { lng, lat } = transformCoord(117.23, 31.82, 'bd09', 'wgs84')
```

---

### 工具函数

```ts
import { getLocation, loadScript, loadStyle } from 'smap-leaflet'

// HTML5 定位
const pos = await getLocation({ enableHighAccuracy: true })

// 动态加载外部资源
await loadScript('https://example.com/lib.js')
await loadStyle('https://example.com/style.css')
```

---

### 销毁

```ts
smap.destroy()
```

会自动清理所有测量工具、控件、底图、事件监听和 DOM 观察器。

---

## 高级用法

### 注册自定义底图

```ts
import { registerProvider } from 'smap-leaflet'

registerProvider('Intranet', {
  layers: {
    Satellite: { Map: 'https://tiles{s}.example.com/{z}/{x}/{y}.png?token={key}' },
  },
  subdomains: ['1', '2', '3'],
  coordType: 'gcj02', // 瓦片的坐标系，非 WGS-84 时会自动纠偏；默认 'wgs84'
  key: 'xxx', // 替换 URL 里的 {key}
})

smap.setTileLayer('Intranet.Satellite.Map')
```

用内置的提供商名注册会覆盖内置定义（例如把天地图换成自己的代理地址）。`getTileTypes()` 返回当前全部可用类型。

### 子模块

直接使用子模块：

```ts
import { LayerManager, ControlManager, ServiceClient, createChinaTileLayer } from 'smap-leaflet'
```

---

## 配合 Vue 使用

Vue 3 项目可以直接用 [`smap-leaflet-vue`](../vue/README.md)，它把地图、图层、控件包装成组件，把测量和绘制包装成组合式函数。

## 开发

本包位于 monorepo 的 `packages/core`，在仓库根目录安装依赖和运行命令，见[根目录 README](../../README.md) 和 [CONTRIBUTING.md](../../CONTRIBUTING.md)。版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## 给 AI 助手

- [llms.txt](llms.txt)：API 速查，随包发布（`node_modules/smap-leaflet/llms.txt`）。在业务项目里让 AI 写地图代码时，把它加进上下文。
- [AGENTS.md](../../AGENTS.md)：在本仓库里改代码的 AI 需要遵守的约定和已知的坑。

## 产出

| 文件                    | 说明                |
| :---------------------- | :------------------ |
| `dist/smap-leaflet.mjs` | ESM 格式            |
| `dist/smap-leaflet.cjs` | CJS 格式            |
| `dist/style.css`        | 样式文件            |
| `dist/index.d.ts`       | TypeScript 类型定义 |

## 关于底图服务

本库只是把各家地图服务的瓦片地址整理到一起，不提供也不代理任何地图数据。使用某家底图前，请自行确认符合该服务的使用条款，并按要求申请密钥、保留版权标注。

## License

[ISC](LICENSE)
