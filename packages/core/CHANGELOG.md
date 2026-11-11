# 更新日志

本文件记录每个版本的重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [2.6.0] - 2026-11-11

首个发布到公共 npm 的版本。此前的 2.x 以 `@attach/leaflet-smap` 的名字发布在内部仓库。

### 变更

- 包名改为 `smap-leaflet`。从 `@attach/leaflet-smap` 迁移只需要替换导入路径，API 不变。

### 移除

- 内置底图 `SmartMeter.Satellite.Map`。它指向一个不对外的瓦片服务。仍然需要的项目可以自己注册：

  ```ts
  import { registerProvider } from 'smap-leaflet'

  registerProvider('SmartMeter', {
    layers: { Satellite: { Map: '你的瓦片地址/{z}/{x}/{y}.png' } },
    subdomains: ['1', '2', '3', '4'],
    coordType: 'gcj02',
  })
  ```

## [2.5.0] - 2026-11-11

### 新增

- 编辑撤销：`draw.undo()` / `draw.canUndo`、`measure.undo()`，编辑时也可以按 Ctrl/⌘ + Z。一次拖动、插入或删除顶点算一步。
- 吸附：`snap` 选项（绘制工具和测量工具都有）。绘制和编辑时贴到已有图形的顶点和边上，可调距离、可吸附到其他图层。默认关闭。
- 编辑中的实时事件：绘制工具的 `editing`，测量工具的 `updating`（地图上是 `measure:updating`）。
- 测面、测矩形、测圆的结果增加 `perimeter`（周长）。
- 导出图片现在包含测量标签、聚合气泡和绘制的标记；`labels: false` 关闭，`include` 可以指定更多简单元素。

### 修复

- 页面不在前台时（后台标签页）导出图片，得到的图缺少底图和矢量图形。

## [2.4.0] - 2026-11-11

### 变更

- **绘制和编辑改为自己实现，移除 leaflet-draw 依赖。** 对外 API 不变，交互有以下变化：
  - 矩形和圆除了按住拖动，也可以单击两次完成（触屏设备用这种方式）。
  - 线和面：再次单击最后一个点、双击或按 Enter 结束；面还可以单击第一个点闭合。按 Backspace 撤销上一个点。
  - 编辑：拖边中点插入顶点、单击顶点删除；矩形新增四角缩放和整体移动；支持带洞的多边形和多部件图形。
  - 一张地图同一时刻只进行一次绘制，开始新的会取消正在进行的。
- 不再往全局写入 `L`，也不再读取它。
- 地图上不再触发 `draw:created`、`draw:drawstop` 等 leaflet-draw 的事件。请使用工具自己的事件（`created`、`stop` 等）。
- `createMeasure` / `getMeasure` / `createDraw` 仍返回 Promise，但已不需要加载任何东西。

### 新增

- 测量结果可编辑：`measure.startEdit()` / `finishEdit(save)`，数值和标签随拖动实时更新；保存后触发 `updated`（地图上是 `measure:updated`）。
- 测量单位：`lengthUnit`、`areaUnit` 选项，面积支持公顷和亩；`measure.setOptions()` 可在运行时切换。
- 点聚合：`smap.layer.addCluster()` / `createCluster()`。
- 业务图层开关控件：`smap.control.add('overlays', { items })`；`smap.layer.onChange()` 可监听登记表变化。
- 导出图片：`smap.exportImage()` / `downloadImage()`，包含底图和矢量图形。
- 导出 `formatLength`、`formatArea`。
- `sketchText`：绘制时跟随鼠标的提示文字，可改写。
- `geodesicArea`、`pathLength`：球面面积和路径长度。

### 弃用

- `loadLeafletDraw()`、`BaseMeasureTool.preload()`、`DrawTool.preload()`：已无事可做，保留为空操作。

### 移除

- 依赖 `leaflet-draw`。如果业务代码自己用到了它，需要自行安装。

## [2.3.0] - 2026-11-11

### 新增

- 测量工具新增 `start`、`stop` 事件和 `measuring` 属性；地图上对应 `measure:start`、`measure:stop`。`stop` 在画完或取消（含按 Esc）时触发，带 `completed` 标志。不必再监听 leaflet-draw 的内部事件。
- `smap.getMeasure(type, options)`：每种类型共用一个测量工具，首次调用时创建。
- `formatLabel` 选项：统一接收 `{ type, distance?, area?, radius?, latlngs, partial }`。
- 导出 `BaseMeasureTool` 和 `loadLeafletDraw`。

### 弃用

- `valueFormatter` 选项。它在不同工具下收到的参数含义不同（测距是距离、测圆是半径、测面是顶点数组），请改用 `formatLabel`。旧选项的行为保持不变。

### 修复

- 调用工具自己的 `destroy()` 后，它仍留在地图的工具列表里，`clearMeasures()` 会再销毁一次。
- 测距画到一半取消时，残留一条空的内部记录。
- 地图上有矢量图层且仍在动画中时销毁地图，控制台会报 `Cannot read properties of undefined (reading 'clearRect')`。

### 内部

- 测量和绘制工具共用一套绘制会话（`core/draw-kit.ts`），leaflet-draw 的加载从测量工具基类里拆出来。
- 测量工具不再各自创建一个从不显示的 `L.Control.Draw`；测面和测矩形共用实现。
- `BaseMeasureTool` 的受保护接口有变化（`measure` / `anchor` / `defaultText` 等取代了 `setupDrawControl` / `createDrawer` / `onCreated`）。自己继承过它的代码需要调整；只使用 `createMeasure` 的不受影响。

## [2.2.0] - 2026-11-11

### 变更

- 重做测量和绘制工具的默认外观：
  - 线和面的默认颜色由红色（测量）/ Leaflet 蓝（绘制）统一为 `#1f6feb`，线宽 3。
  - 测量结果改为标签样式：途经点是白底小标签，最终结果是强调色标签，删除由「删除」文字改为 × 按钮。
  - 顶点手柄由方块改为圆点；绘制时的操作提示改为深色圆角气泡。
  - 编辑模式下图形保留自己的颜色，不再变成粉色。
- 顶点、标签、提示的颜色跟随 `shapeOptions.color`，也可以用 CSS 变量 `--smap-accent` 覆盖。

想保留旧的配色，创建工具时传 `shapeOptions: { color: '#f40', weight: 4 }`。

## [2.1.1] - 2026-11-11

### 修复

- GeoJSON 图层和点图层各自创建一张 canvas：图层移除后 canvas 不回收，反复添加会越积越多；多张 canvas 叠放时只有最上面一张能响应鼠标，下层图形点不到。现在所有矢量图层共用一张 canvas。

### 变更

- 仓库改为 monorepo，本包移到 `packages/core`，包名和用法不变。

## [2.1.0] - 2026-11-11

### 新增

- 绘制与编辑：`smap.createDraw()`，支持点、线、面、矩形、圆，编辑后导出 / 载入 GeoJSON。
- 图层登记表：`smap.layer.add / get / show / hide / toggle / remove / ids / clear`；`addWFS`、`addWMS` 等可通过 `id` 选项自动登记。
- 区域遮罩：`smap.layer.addMask()` / `createMask()`。
- 海量点：`smap.layer.addPoints()` / `createPointLayer()`，canvas 渲染。
- 底图切换控件：`smap.control.add('layers', { options })`；`smap.getTileType()` 返回当前底图类型。
- 右键菜单：`smap.contextMenu.setItems()` / `bind()`。
- 浏览器定位：`smap.locate()` / `clearLocation()`；`getLocation()` 的结果增加 `accuracy`。
- 坐标转换：`transformGeoJSON()`、`transformCoord()`。
- 测量结果可以用代码获取：`measure.on('created' | 'removed')`、`measure.getResults()`，以及地图级的 `measure:created` / `measure:removed` 事件。
- `smap.service` 自动使用地图的 `tdtKey` 和当前视野，`tk` 变为可选；`search({ keyword })` 不再需要传地图。
- 天地图各接口的返回值类型（`TdtSearchResult` 等）。
- `registerProvider()` 注册自定义底图，`getTileTypes()` 列出全部可用类型。
- `TileType` 对内置底图提供字面量联合，编辑器可自动补全。
- `llms.txt`（随包发布）和 `AGENTS.md`，供 AI 编码助手使用。

### 修复

- 腾讯底图未登记为 GCJ-02，叠加的数据会向西偏移约 500 米。
- 行政区划查询使用的天地图 v1 接口已失效，改用 v2 接口。
- `setTileLayer` 传入不存在的类型时，会先移除现有底图再抛错，留下空白地图；现在保留原底图。
- `getLocation` 在定位回调同步触发时会报「变量未初始化」。
- `smap.destroy()` 现在会清理登记的图层、绘制工具、右键菜单和定位标记。

### 变更

- `getAdministrative` 的参数改为 `{ keyword, childLevel?, extensions? }`，返回结构随 v2 接口变化；区划码需要 9 位（如 `156340100`）。旧参数名 `searchWord` 仍可用。
- `search(map, params)` 的写法已弃用，仍可用。

## [2.0.0] - 2026-11-11

用 TypeScript 重写，API 与 1.x **不兼容**，升级请对照下面的迁移说明。

### 破坏性变更

- 入口由 `import { map, utils }` 改为 `import { SMap }`，地图通过 `new SMap(container, options)` 创建，支持同页面多个实例。
- 配置项改名：`type` → `tileType`，`key` → `tdtKey`；容器改为构造函数的第一个参数。
- 样式需要单独引入：`import 'smap-leaflet/style.css'`。
- `leaflet` 改为 peerDependency，需要由使用方安装。
- 测量工具改为 `await smap.createMeasure(type, options)`，首次调用时按需加载 leaflet-draw。
- 图层、控件、服务改为实例上的 `smap.layer` / `smap.control` / `smap.service`，方法名有调整，见 README。
- 坐标转换函数返回 `{ lng, lat }` 对象。
- 产物路径由 `lib/` 改为 `dist/`，同时提供 ESM、CJS 和类型定义。

### 新增

- 完整的 TypeScript 类型定义。
- `addTileLayer` / `clearTileLayers` / `getTileLayers`。
- `loaded`、`tileLoaded` 事件。
- `destroy()` 统一清理测量工具、控件、底图、事件监听和 DOM 观察器。
- 单元测试（Vitest）、ESLint、Prettier 和 CI。

### 变更

- 构建工具由 Rollup + Babel 换成 Vite。
- 网络请求改用原生 `fetch`，移除 axios、lodash-es、nanoid 依赖。
- `tdtKey` 只用于天地图底图，`mapboxToken` 只用于 Mapbox 底图。

### 修复

- 同一地图上多个测量工具会互相响应对方的绘制结果。
- `measure.disable()` 无法取消正在进行的绘制。
- 构造时触发的 `loaded` / `tileLoaded` 事件无法被监听到。

## [1.0.14] 及更早

1.x 版本没有单独维护更新日志，变更见 git 提交记录。
