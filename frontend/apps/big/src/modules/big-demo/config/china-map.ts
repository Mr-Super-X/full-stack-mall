/**
 * 9000 超宽页 · 中国地图配置（geo 底图 + 涟漪散点 + 飞线）。
 *
 * 独立文件而非并入 charts.ts 的原因：china.json（159KB）经本文件 import，
 * 只有 Wide.vue（/big-demo/wide 路由）依赖本模块。Wide.vue 以动态 import() 加载本模块
 * （二级 chunk）：路由 chunk 不含 GeoJSON、页面壳先渲染，加载/失败态就地呈现（见 Wide.vue）。
 * 1920 标准页零体积负担。
 *
 * registerMap 在模块执行期运行（动态 import resolve 后、option 消费前完成，时序安全；
 * echarts 全局注册表同名幂等覆盖）。
 * 注意：echarts 无 unregister API，视图卸载后注册表残留属可接受设计（一次性 159KB 常驻），
 * 勿误判为内存泄漏。
 */
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import chinaGeoJson from './china.json'

// GeoJSON 结构与 echarts 内部类型存在声明差异，收窄到 registerMap 入参类型（运行时为标准 GeoJSON）
echarts.registerMap(
  'big-china',
  chinaGeoJson as unknown as Parameters<typeof echarts.registerMap>[1]
)

/** 大区中心城市点（value = [经度, 纬度, 指标值]） */
interface CityPoint {
  name: string
  value: [number, number, number]
}

// 飞线枢纽（上海）：与其余大区中心两两相连形成辐射线
const HUB: CityPoint = { name: '上海', value: [121.47, 31.23, 4860] }
const SPOKES: CityPoint[] = [
  { name: '深圳', value: [114.06, 22.55, 3920] },
  { name: '北京', value: [116.4, 39.9, 3410] },
  { name: '成都', value: [104.07, 30.57, 2380] },
  { name: '武汉', value: [114.3, 30.59, 1960] },
  { name: '沈阳', value: [123.43, 41.8, 1120] },
]
const CITY_POINTS: CityPoint[] = [HUB, ...SPOKES]
const FLIGHT_LINES = SPOKES.map((c) => ({
  coords: [HUB.value.slice(0, 2), c.value.slice(0, 2)] as [number[], number[]],
}))

/** 中国地图 option：geo 底图（深蓝辉光）+ 飞线（金色箭头动效）+ 涟漪散点（数值越大点越大） */
export const chinaMapOption: EChartsOption = {
  backgroundColor: 'transparent',
  geo: {
    map: 'big-china',
    roam: false,
    zoom: 1.05,
    label: { show: false },
    itemStyle: {
      areaColor: 'rgba(21, 56, 116, 0.55)',
      borderColor: '#3e8cff',
      borderWidth: 2,
      shadowColor: 'rgba(43, 109, 224, 0.6)',
      shadowBlur: 30,
    },
    emphasis: {
      label: { show: true, color: '#ffffff', fontSize: 28 },
      itemStyle: { areaColor: 'rgba(43, 109, 224, 0.8)' },
    },
  },
  series: [
    {
      name: '飞线',
      type: 'lines',
      coordinateSystem: 'geo',
      polyline: false,
      effect: {
        show: true,
        period: 5,
        trailLength: 0.4,
        symbol: 'arrow',
        symbolSize: 16,
        color: '#f7c948',
      },
      lineStyle: { color: '#4da3ff', width: 3, opacity: 0.5, curveness: 0.3 },
      data: FLIGHT_LINES,
    },
    {
      name: '区域中心',
      type: 'effectScatter',
      coordinateSystem: 'geo',
      rippleEffect: { brushType: 'stroke', scale: 6 },
      symbolSize: (val: unknown) => {
        const v = Array.isArray(val) ? Number(val[2]) : 0
        return Math.max(18, v / 150)
      },
      label: {
        show: true,
        position: 'right',
        formatter: '{b}',
        color: '#d6e4ff',
        fontSize: 30,
      },
      itemStyle: { color: '#4da3ff', shadowBlur: 20, shadowColor: '#4da3ff' },
      data: CITY_POINTS,
    },
  ],
}
