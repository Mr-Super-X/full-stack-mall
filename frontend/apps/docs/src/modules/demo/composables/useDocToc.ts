/**
 * demo 文档站「右侧锚点导航」的跨层数据通道。
 *
 * 背景：DocLayout 提升为路由级布局（layouts/DemoDocs.vue）后，子路由 <RouterView>
 * 与 toc 分属两层，原 demo 页的 `#toc` slot 透传不可用。改为数据驱动：demo 页
 * setup 中 useDocToc(tocItems) 写入模块级 currentDocToc，布局侧统一渲染 <DocToc>。
 *
 * 生命周期：onScopeDispose 清空——页面卸载时移除本页锚点，避免无 toc 页残留上一页。
 * 清空前做引用相等守卫：防止「新页已注册、旧页后卸载」的时序竞争把新锚点清掉。
 *
 * @see layouts/DemoDocs.vue 消费方
 */
// onScopeDispose / shallowRef 由 unplugin-auto-import 注入（§1.6）；类型 Ref 须显式 type import
import type { Ref } from 'vue'

/** 单个锚点项（与 DocToc props.items 形态一致） */
export interface DocTocItem {
  id: string
  label: string
}

/** 当前 demo 页的锚点数据（模块级，跨路由共享给 DemoDocs 布局） */
export const currentDocToc: Ref<DocTocItem[]> = shallowRef<DocTocItem[]>([])

/**
 * demo 页注册本页右侧锚点。在页面 setup 中调用一次即可；
 * 页面卸载（作用域销毁）时自动清除注册。
 */
export function useDocToc(items: DocTocItem[]): void {
  currentDocToc.value = items
  onScopeDispose(() => {
    if (currentDocToc.value === items) currentDocToc.value = []
  })
}
