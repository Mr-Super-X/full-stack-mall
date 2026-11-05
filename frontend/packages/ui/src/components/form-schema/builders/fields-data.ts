/**
 * builders/fields-data —— 数据操作类组件 builder
 *
 * 从 builders.ts 拆分（架构审查 #3）。含 Transfer / TreeSelect / Upload / ColorPicker
 * —— 数据源配置（data/tree/action）或文件操作语义较重的组件。
 *
 * @group XForm 构建器
 */
import { makeBuilder, makeSimpleBuilder } from './core'

// ── ColorPicker ──
/** xColorPicker —— ColorPicker 组件链式构造器入口 */
export const xColorPicker = makeSimpleBuilder('ColorPicker')

// ── Transfer ──
const TransferBuilder = makeBuilder('Transfer')
class TransferBuilderExt extends TransferBuilder {
  data(items: Array<{ key: unknown; label: string; disabled?: boolean }>): this {
    return this.prop('data', items)
  }
  titles(left: string, right: string): this {
    return this.prop('titles', [left, right] as never)
  }
  filterable(): this {
    return this.prop('filterable', true)
  }
  buttonTexts(btnLeft: string, btnRight: string): this {
    return this.prop('buttonTexts', [btnLeft, btnRight])
  }
}
/**
 * xTransfer —— Transfer 穿梭框组件链式构造器入口
 *
 * @see TransferBuilderExt Ext 方法：data / titles / filterable / buttonTexts
 */
export const xTransfer = (name: string) => new TransferBuilderExt(name)

// ── TreeSelect ──
const TreeSelectBuilder = makeBuilder('TreeSelect')
class TreeSelectBuilderExt extends TreeSelectBuilder {
  data(tree: Array<unknown>): this {
    return this.prop('data', tree)
  }
  multiple(): this {
    return this.prop('multiple', true)
  }
  checkStrictly(): this {
    return this.prop('checkStrictly', true)
  }
  nodeKey(k: string): this {
    return this.prop('nodeKey', k)
  }
  props(p: { children?: string; label?: string; value?: string }): this {
    return this.prop('props', p as never)
  }
}
/**
 * xTreeSelect —— TreeSelect 树形选组件链式构造器入口
 *
 * @see TreeSelectBuilderExt Ext 方法：data / multiple / checkStrictly / nodeKey / props
 */
export const xTreeSelect = (name: string) => new TreeSelectBuilderExt(name)

// ── Upload ──
const UploadBuilder = makeBuilder('Upload')
class UploadBuilderExt extends UploadBuilder {
  action(url: string): this {
    return this.prop('action', url)
  }
  accept(types: string): this {
    return this.prop('accept', types)
  }
  multiple(): this {
    return this.prop('multiple', true)
  }
  drag(): this {
    return this.prop('drag', true)
  }
  listType(t: 'text' | 'picture' | 'picture-card' | 'picture-circle'): this {
    return this.prop('listType', t)
  }
}
/**
 * xUpload —— Upload 上传组件链式构造器入口
 *
 * @see UploadBuilderExt Ext 方法：action / accept / multiple / drag / listType
 */
export const xUpload = (name: string) => new UploadBuilderExt(name)
