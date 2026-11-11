# leaflet-smap 示例

`leaflet-smap` 和 `leaflet-smap-vue` 的本地示例站，Vue 3 + Vite。直接引用 `packages/*/src`，改库代码会热更新。

依赖由仓库根目录统一安装（npm workspaces），不要在这个目录里单独 `npm install`：

```bash
# 在仓库根目录
npm install
cp example/.env.example example/.env.local   # 填入天地图密钥；不填时天地图底图和服务不可用
npm run example                              # http://localhost:7999
```

## 结构

```
src/
  demos.js              示例注册表：分组、标题、说明
  demos/*.vue           每个示例一个文件，右侧「代码」页签显示它的 <script setup>
  components/DemoPage.vue  页面框架：地图 + 右侧操作 / 代码面板
  styles/main.css       全部样式和设计变量
  lib/                  标记、格式化等小工具
  data/                 示例用的 GeoJSON
```

## 新增示例

1. 在 `src/demos/` 下新建 `xxx.vue`，模板最外层用 `<DemoPage>`，地图容器放进 `#map` 插槽，操作面板放默认插槽。
2. 在 `src/demos.js` 里登记 `{ id: 'xxx', title, desc }`，`id` 与文件名一致。

示例的 `<script setup>` 会原样展示给使用者，所以直接使用 `SMap`，不要再包一层。面板里的控件用 `main.css` 里已有的类（`block`、`kv`、`btn`、`seg`、`list`、`note` 等）。

## 需要自备服务的示例

「WFS / WMS」和「ESRI 图层」需要你自己的 GeoServer / ArcGIS Server。把服务地址写进 `.env.local`（见 `.env.example`），开发服务器会代理过去；没配时这两个示例会显示加载失败。
