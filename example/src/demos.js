const sources = import.meta.glob('./demos/*.vue', { query: '?raw', import: 'default', eager: true })
const components = import.meta.glob('./demos/*.vue')

const groups = [
  {
    title: '基础',
    items: [
      { id: 'basic', title: '基础地图', desc: '创建地图、添加控件、监听事件、浏览器定位。' },
      { id: 'tiles', title: '底图切换', desc: '运行时替换或叠加内置底图，以及地图上的切换控件。' },
      {
        id: 'correction',
        title: '坐标纠偏',
        desc: '同一个 WGS-84 坐标在不同坐标系的底图上都落在同一地物上。',
      },
      {
        id: 'transform',
        title: '数据坐标转换',
        desc: '把 GCJ-02 或 BD-09 的 GeoJSON 数据转成 WGS-84 再上图。',
      },
      { id: 'custom-provider', title: '自定义底图', desc: '用 registerProvider 注册库里没有的瓦片服务。' },
    ],
  },
  {
    title: '绘制与测量',
    items: [
      { id: 'draw', title: '绘制与编辑', desc: '画点、线、面、矩形、圆，编辑后导出 GeoJSON。' },
      { id: 'measure', title: '测量工具', desc: '测距、测面、测圆、测矩形，并用事件拿到数值。' },
    ],
  },
  {
    title: '图层',
    items: [
      { id: 'layers', title: '图层管理', desc: '按 id 登记图层，统一显示、隐藏和移除。' },
      { id: 'geojson', title: 'GeoJSON 图层', desc: '加载本地 GeoJSON 并缩放到图层范围。' },
      { id: 'points', title: '海量点', desc: '上万个点画在同一张 canvas 上，保持流畅。' },
      { id: 'mask', title: '区域遮罩', desc: '压暗指定行政区以外的区域。' },
      { id: 'ogc', title: 'WFS / WMS', desc: '加载 GeoServer 发布的 WFS、WMS 图层。' },
      { id: 'esri', title: 'ESRI 图层', desc: '配合 esri-leaflet 加载 ArcGIS MapServer。' },
    ],
  },
  {
    title: '交互',
    items: [{ id: 'contextmenu', title: '右键菜单', desc: '给地图和单个图层设置右键菜单。' }],
  },
  {
    title: 'Vue 封装',
    items: [
      {
        id: 'vue-components',
        title: 'Vue 组件',
        desc: '用 leaflet-smap-vue 的组件和组合式函数声明式地写地图。',
      },
    ],
  },
  {
    title: '天地图服务',
    items: [
      { id: 'search', title: 'POI 搜索', desc: '在当前视野内按关键词搜索地点。' },
      { id: 'geocode', title: '地理编码', desc: '地址转坐标；点击地图把坐标转回地址。' },
      { id: 'district', title: '行政区划', desc: '查询行政区的边界和下级区划。' },
      { id: 'ip', title: 'IP 定位', desc: '根据访问者 IP 得到所在城市。' },
    ],
  },
]

/** 只保留 <script setup> 里的内容，这才是使用者要抄的部分 */
function scriptOf(source = '') {
  const match = source.match(/<script setup[^>]*>\n?([\s\S]*?)<\/script>/)
  return (match ? match[1] : source).trim()
}

for (const group of groups) {
  for (const item of group.items) {
    const file = `./demos/${item.id}.vue`
    item.path = `/${item.id}`
    item.component = components[file]
    item.code = scriptOf(sources[file])
  }
}

export default groups
