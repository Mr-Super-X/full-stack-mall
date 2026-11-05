/**
 * sortablejs ambient module declaration（项目实际依赖 sortablejs ^1.15.7，
 * 但该包未自带 .d.ts，也不在 @types/sortablejs 包中）。
 * 仅暴露 ProTable 拖拽（useRowDrag.ts / ColSetting.vue）实际用到的最小 API 表面。
 */
declare module 'sortablejs' {
  export interface SortableEvent {
    oldIndex?: number
    newIndex?: number
    dragged?: HTMLElement
    related?: HTMLElement
  }

  export interface SortableOptions {
    handle?: string
    /** 命中选择器的元素不启动拖拽（如列设置里排除 .el-checkbox 勾选区） */
    filter?: string
    animation?: number
    onStart?: (evt: SortableEvent) => void
    onMove?: (evt: SortableEvent, originalEvent: Event) => boolean
    onEnd?: (evt: SortableEvent) => void
  }

  export default class Sortable {
    static create(el: HTMLElement, options?: SortableOptions): Sortable
    option(name: string, value: unknown): void
    destroy(): void
  }
}
