# AGENTS.md

给在本仓库里工作的 AI 编码助手看的说明。面向**使用**这些包的 AI 的 API 速查在各包的 `llms.txt`（[core](packages/core/llms.txt)、[vue](packages/vue/llms.txt)）。

## 这是什么

npm workspaces 管理的 monorepo，两个发布在 npm 上的包加一个示例站：

- `packages/core` → `leaflet-smap`：基于 Leaflet 1.x 的地图库，与框架无关。TypeScript，Vite 库模式构建。
- `packages/vue` → `leaflet-smap-vue`：上面那个包的 Vue 3 封装。纯 `.ts`（`defineComponent` + `h`），没有 `.vue` 文件。
- `example` → 示例站，通过 alias 直接引用两个包的源码。

## 命令

都在**仓库根目录**运行；不要在子目录里 `npm install`。

```bash
npm install        # 安装全部工作区的依赖
npm run check      # 构建 core → 类型检查 → lint → 格式检查 → 全部测试。改完代码必须跑通
npm run test       # 只跑测试（Vitest + jsdom）
npm run lint:fix   # 自动修 lint
npm run format     # Prettier 格式化
npm run build      # 按顺序构建 core、vue
npm run example    # 启动示例站（端口 7999），改源码即时生效

npm run test -w leaflet-smap-vue   # 只操作一个包
```

`packages/vue` 的类型检查和构建读取的是 `packages/core/dist` 里的类型声明，所以**改了 core 的公开类型后要先构建 core**（`npm run check` 已经包含这一步）。它的测试则通过 alias 直接跑 core 的源码，不依赖构建。

## 结构

```
packages/core/src/SMap.ts                    主类，唯一的对外入口类
packages/core/src/index.ts                   所有公开导出都从这里出去
packages/core/src/types.ts                   公共类型
packages/core/src/core/layer.ts              LayerManager：图层登记表、WFS / WMS、遮罩、海量点
packages/core/src/core/control.ts            ControlManager：水印、缩放、比例尺、底图切换
packages/core/src/core/context-menu.ts       ContextMenu：地图和图层的右键菜单
packages/core/src/core/cluster.ts            ClusterLayer：点聚合
packages/core/src/core/export.ts             导出地图为图片
packages/core/src/core/draw-kit.ts           DrawSession：一张地图上同一时刻只进行一次绘制（测量和绘制共用）
packages/core/src/core/sketch/               自研的绘制与编辑引擎：drawers.ts 各形状的绘制交互、editors.ts 编辑手柄与撤销、snap.ts 吸附、hint.ts 提示气泡、geometry.ts 面积与长度
packages/core/src/core/draw.ts               DrawTool：绘制、编辑、GeoJSON 导入导出
packages/core/src/core/service.ts            ServiceClient：天地图 Web 服务
packages/core/src/core/measure/              测量工具（base.ts 管生命周期，各工具只负责算数和措辞）
packages/core/src/plugins/                   底图 provider、坐标转换、纠偏和瓦片缝隙补丁
packages/core/tests/                         核心库的单元测试

packages/vue/src/SMapView.ts                 <SMapView>：创建地图并通过 provide 交给子组件
packages/vue/src/components.ts               SMapGeoJson / SMapPoints / SMapCluster / SMapMask / SMapMarker / SMapControl / SMapContextMenu
packages/vue/src/composables.ts              useMeasure / useDraw
packages/vue/src/context.ts                  注入 key、useSMap、resolveSMap
packages/vue/tests/                          Vue 包的单元测试

example/                                     示例站，说明见 example/README.md
```

下文「必须知道的坑」里的 `src/...` 路径都指 `packages/core/src/...`。

## 必须知道的坑

这些都是踩过的，改相关代码前先读：

1. **绘制和编辑是自己实现的，不依赖 leaflet-draw。** 引擎在 `src/core/sketch/`，只用 Leaflet 的公开 API 和地图事件（`click`、`mousemove`、`mousedown`、`mouseup`）。不要再引入 leaflet-draw 或依赖全局 `L`。
2. **基类构造函数里不要调用依赖子类字段的方法。** 构造函数执行时子类字段（如 `drawType`）尚未初始化。现在所有对子类的调用都发生在绘制开始之后，保持这一点。
3. **一张地图同一时刻只能有一次绘制。** `DrawSession.start()` 会先取消该地图上正在进行的其他绘制。新增需要画图的工具必须走 `DrawSession`，不要自己监听地图的 `click`。
4. **绘制器（`sketch/drawers.ts`）只负责交互和预览，产出一个 Leaflet 图层就结束**；结果、事件、标签是工具层的事。绘制器改动了地图状态（双击缩放、拖动）必须在 `stop()` 里还原，有测试检查。
5. **`loaded` 和首次 `tileLoaded` 在微任务里触发**，因为构造函数返回前外部无法注册监听。不要改回同步 emit。
6. **坐标转换函数返回 `{ lng, lat }` 对象**，不是数组。
7. **底图坐标系的拼写是 `corrdType`**（历史拼写错误，纠偏补丁按这个名字读取）。不要「顺手修正」成 `coordType`，除非同时改 `map-correction.ts`。
8. **新底图必须确认坐标系。** 国内商业底图（高德、腾讯、谷歌中国）是 GCJ-02，百度是 BD-09；漏登记不会报错，只会让叠加数据偏几百米（腾讯底图就这样漏过一次）。`BUILTIN_TILE_TYPES` 要和 `providers` 同步，有测试把关。
9. **天地图接口以实测为准。** 行政区划 v1 接口已下线；各接口成功标志、坐标是字符串还是数字都不一致，改 `service.ts` 或 `Tdt*` 类型前先在示例里真实请求一次。
10. **key 按 provider 分发**：`tdtKey` 只给 `TianDiTu.*`，`mapboxToken` 只给 `Mapbox.*`（见 `SMap.resolveKey`）。
11. **jsdom 没有 canvas 和 SVG 渲染器，测试里创建地图要带上 `vectorSafe()`。** 它在 `packages/core/tests/helpers.ts`，换上一个不画东西的渲染器，矢量图层才能真的加到地图上。同一个文件里的 `pointer`（模拟点击、拖动、按键）、`handles`、`dragTo` 用来驱动绘制和编辑。不要再用假图层或直接触发内部事件。
12. **凡是会把矢量图层加到地图上的方法，都要有一个只创建不添加的版本**（`createMask` / `addMask`、`createPointLayer` / `addPoints`），否则在 jsdom 里没法测。
13. **`setTileLayer` 先创建后替换。** 新图层全部创建成功后才移除旧的，这样类型写错时不会留下空白地图，不要改回边删边建。
14. **右键菜单的 `contextmenu` 监听只在有菜单项时才挂到地图上**，因为 Leaflet 一旦发现有这个监听就会屏蔽浏览器的默认菜单。
15. **矢量图层必须画在同一张 canvas 上。** Leaflet 每个渲染器是一张铺满地图的 `<canvas>`，只有最上面一张收得到鼠标事件，而且图层移除后渲染器不会跟着移除。所以不要写 `renderer: L.canvas()`，用 `LayerManager` 里的 `canvas()`。
16. **样式是独立产物** `dist/style.css`，文件名必须和 `package.json` 的 `exports["./style.css"]` 一致（由 `vite.config.ts` 的 `cssFileName` 控制）。

## 绘制引擎里容易错的地方

- **像素坐标用 `map.project()` / `unproject()`，不要用 `latLngToContainerPoint()`。** 后者取整到整像素，吸附到边上时会差出零点几个像素。
- **吸附会改变点击落点**，所以「是否点在首尾顶点上」要同时看原始位置和吸附后的位置，否则偏了几像素的闭合点击会变成重复顶点。
- **撤销按手势记录**：每个编辑器在改动前调 `begin()` 存一份状态。新增一种编辑手势时别忘了调，否则这一步撤不回来。
- **导出图片不能依赖动画帧。** 瓦片的淡入透明度、canvas 渲染器的重绘都排在下一帧，页面不在前台时帧不会来。`export.ts` 里已经绕开，改动时保持。

## 测量工具的分工

- `BaseMeasureTool` 负责全部流程：绘制、标签、结果、事件、清理。
- 具体工具只实现四件事：`measure(layer)` 从图形读出数值、`anchor(result)` 结果标签放哪、`defaultText(label)` 默认措辞、`legacyValue(label)` 给已弃用的 `valueFormatter` 传什么。测面和测矩形共用 `RingAreaMeasure`。
- 新增一种测量时照这个分工写，不要在子类里碰事件和图层管理。

## Vue 包的规则

1. **Leaflet 对象绝不能被 Vue 代理。** 地图实例、工具、带 `layer` 的结果对象一律 `markRaw`，并放在 `shallowRef` 里。Leaflet 的对象图成环且依赖 `===`，被深层代理后会出错。
2. **交给 Leaflet 的属性值先 `toRaw`。** 父组件常用 `ref()` 存 GeoJSON，传下来的是深层代理；让 Leaflet 遍历代理会为每个坐标数组创建代理，并把代理留在图层里。
3. **不要对数据属性用 `deep: true` 的 watch。** 数据靠「替换」触发更新，不靠「修改」。只有 `tileType`、`center`、控件 `options` 这类小对象才深层监听。
4. **`v-model` 的回写要能被识别并忽略**：`SMapView` 的 watch 会把传入值和地图当前状态比较，一致就不动，否则会循环触发 `setView`。
5. **地图在 `onUnmounted` 里销毁，不是 `onBeforeUnmount`。** 子组件要在地图还活着的时候移除自己的图层。
6. **`.ts` + `h()`，不要引入 `.vue` 文件**，这样构建和类型声明都不需要 Vue 编译器。
7. 以上几条都有测试锁定（`packages/vue/tests/vue.test.ts` 的 `reactivity safety` 一组），改动后必须保持通过。

## 改动规则

- **公开 API 变了，必须同步改四处**：该包 `src/index.ts` 的导出，以及该包目录下的 `README.md`、`llms.txt`、`CHANGELOG.md`。README 和 llms.txt 里的每个方法名都必须能在代码里找到。
- **core 的 API 变了，要检查 vue 包是否需要跟着改**（组件属性、组合式函数、peerDependency 的版本范围）。
- **新增底图**：在 `providers` 里登记 URL，在 `COORD_TYPE_MAP` 里声明坐标系（GCJ-02 或 BD-09 的必须声明，否则会偏移），并更新 README 的底图表。`tests/providers.test.ts` 会自动遍历所有类型。
- **修 bug 先补测试**，能在 jsdom 里复现的都要有用例。
- 不引入新的运行时依赖，除非确有必要；`leaflet` 是 peerDependency，`proj4` / `proj4leaflet` 是外部依赖，不打进产物。
- 代码风格由 Prettier 决定（无分号、单引号、行宽 100），不要手动对抗。
- 提交信息格式 `类型: 说明`，类型取 `feat` / `fix` / `docs` / `refactor` / `test` / `chore`。

## 安全

- **`.npmrc` 可能含个人令牌，已被 git 忽略，绝不能提交**，也不要把其中的内容写进任何文件或日志。
- **这是公开仓库。** 不要提交内网地址、内部域名、公司项目名或任何只在内部有意义的配置。
- 不要在代码、文档、测试里写真实的天地图 key 或 Mapbox token，用 `'your-key'` 之类的占位符。
- **发布（`npm publish`）、推送、打 tag 只在用户明确要求时做。** 两个包各自发布、各自有版本号，发布到公共 npm（`publishConfig.registry`），流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
