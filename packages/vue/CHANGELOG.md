# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。1.0 之前的次版本号升级可能包含不兼容改动。

## [0.4.0] - 2026-11-11

首个发布到公共 npm 的版本。此前以 `@attach/leaflet-smap-vue` 的名字发布在内部仓库。

### 变更

- 包名改为 `leaflet-smap-vue`，依赖的核心库改为 `leaflet-smap`。API 不变。

## [0.3.0] - 2026-11-11

### 新增

- `useDraw` 新增 `canUndo`、`undo`；`useMeasure` 新增 `undo`。
- `useMeasure` 的 `results` 在编辑拖动过程中实时更新。

需要 `leaflet-smap` >= 2.5.0（撤销、吸附、`updating` 事件都在其中）。

## [0.2.0] - 2026-11-11

### 新增

- `<SMapMarker>`：标记，默认插槽即弹窗，支持 `v-model:lat-lng`、拖动、提示、右键菜单。
- `<SMapCluster>`：点聚合。
- `<SMapContextMenu>`：地图右键菜单。
- `<SMapControl type="overlays">`：业务图层开关。
- `useMeasure` 新增 `editing`、`startEdit`、`finishEdit`、`setOptions`。

需要 `leaflet-smap` >= 2.4.0（自研绘制引擎、聚合、测量编辑都在其中）。

## [0.1.1] - 2026-11-11

### 变更

- `useMeasure` 改用测量工具自己的 `stop` 事件判断测量结束，不再监听 leaflet-draw 的内部事件。需要 `leaflet-smap` >= 2.3.0。

## [0.1.0] - 2026-11-11

### 新增

- `<SMapView>`：地图组件，支持 `v-model:center`、`v-model:zoom` 和响应式的 `tile-type`。
- `<SMapGeoJson>`、`<SMapPoints>`、`<SMapMask>`、`<SMapControl>`：声明式的图层和控件。
- `useMeasure()`、`useDraw()`：带响应式状态的测量和绘制。
- `useSMap()`：在 `<SMapView>` 内部取得地图实例。
