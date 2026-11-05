/**
 * 第三方库 vendor chunk 分组（顺序敏感——先匹配先返回）
 * 新增分组只需追加一项。
 *
 * 命名约定：`vendor-<主题>`，按包大小 / 加载频率决定排序：
 *   - vendor-vue: Vue 核心（vue / vue-router / pinia / @vue/*）
 *   - vendor-ui: UI 库（element-plus / unplugin-vue-components / vant）——变更较频繁
 *   - vendor-charts: 图表库（echarts）——独立拆 chunk 避免污染 vendor-ui 的缓存命中
 *
 * vant 入 vendor-ui 的裁定（2026-10-27）：vant 与 EP 同为 UI 组件库、升级频率同量级，
 * 且 h5 按需引入后体量小（~30KB gzip）——混入不显著污染缓存命中；其他 app 不装 vant，
 * pattern 只在 h5 命中（与 echarts ~1MB 需独立拆分的体量理由不同量级）。
 *
 * 单独拆 echarts 的原因（2026-09-10）：echarts 包体 ~1MB，混入 vendor-ui 会让
 * 升级 EP 时连带把 echarts 也下载；独立 chunk 利于按 chunk 缓存复用
 */
export const VENDOR_CHUNKS: ReadonlyArray<{
  name: string
  patterns: ReadonlyArray<string>
}> = [
  {
    name: 'vendor-vue',
    patterns: ['/vue/', '/pinia/', '/@vue/'],
  },
  {
    name: 'vendor-ui',
    patterns: ['/element-plus/', '/unplugin-vue-components/', '/vant/'],
  },
  {
    name: 'vendor-charts',
    patterns: ['/echarts/'],
  },
]
