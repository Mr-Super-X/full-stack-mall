/**
 * use-scan-forbidden —— schema 表达式危险标识符 dev 扫描器
 *
 * 仅在 dev mode 触发（useDevRuntime 门控）：console.warn + DebugBanner 提示，
 * 不阻断渲染。真实安全边界是 schema 来自可信配置（README §安全）；本扫描仅做兜底提醒。
 *
 * 性能防护：WeakSet 去重 + MAX_DEPTH 32 + MAX_NODES 10000 防止恶意巨型 schema 拖死诊断路径。
 *
 * @group 表单编排：开发态
 */
import type { SchemaNode } from '../types'

// 危险标识符黑名单：覆盖 OWASP A03 Injection 主要攻击面
// 取舍说明：open/location/navigator 未收录 —— 与常见表单字段同名（model.location 等），
// 误报噪声大于收益
const FORBIDDEN_REG =
  /\b(window|document|globalThis|self|top|parent|frames|eval|Function|setTimeout|setInterval|fetch|XMLHttpRequest|process|Reflect|Proxy|constructor|__proto__|prototype|localStorage|sessionStorage|indexedDB|import|require|alert|prompt|confirm)\b/
const MAX_DEPTH = 32
const MAX_NODES = 10_000

/** 扫描 on/reaction/disabled/permission/directives/slots/formItem.slots 中危险标识符，返回命中路径清单 */
export function scanForForbidden(schema: SchemaNode | SchemaNode[]): string[] {
  const errors: string[] = []
  const seen = new WeakSet<object>()
  let count = 0
  traverse(schema, 0)
  return errors

  function traverse(node: unknown, depth: number): void {
    if (
      depth > MAX_DEPTH ||
      count > MAX_NODES ||
      node === null ||
      typeof node !== 'object' ||
      seen.has(node as object)
    )
      return
    seen.add(node as object)
    count++
    // 数组顶层：递归每个元素
    if (Array.isArray(node)) {
      for (const item of node) traverse(item, depth + 1)
      return
    }
    const obj = node as Record<string, unknown>
    scanValue(obj.on, 'on')
    scanValue(obj.reaction, 'reaction')
    // disabled / permission 同样接受函数表达式字符串（ReactionValue），不能只扫 on/reaction
    scanValue(obj.disabled, 'disabled')
    scanValue(obj.permission, 'permission')
    // D(#5)：hidden / readonly 的函数与 '{{ }}' 形态经 hasReactiveStandaloneField /
    // use-top-level-fields 归一化进沙箱求值（可达 new Function 的字段），此前漏扫
    scanValue(obj.hidden, 'hidden')
    scanValue(obj.readonly, 'readonly')
    if (Array.isArray(obj.directives)) {
      for (const d of obj.directives) {
        if (d && typeof d === 'object') {
          const v = (d as Record<string, unknown>).value
          if (typeof v === 'string' && FORBIDDEN_REG.test(v)) errors.push(`directive.value: ${v}`)
        }
      }
    }
    if (Array.isArray(obj.children)) obj.children.forEach((c) => traverse(c, depth + 1))
    else if (obj.children && typeof obj.children === 'object') traverse(obj.children, depth + 1)
    if (obj.slots && typeof obj.slots === 'object') {
      for (const slot of Object.values(obj.slots as Record<string, unknown>))
        traverse(slot, depth + 1)
    }
    if (obj.formItem && typeof obj.formItem === 'object') {
      const fi = obj.formItem as Record<string, unknown>
      if (fi.slots && typeof fi.slots === 'object') {
        for (const slot of Object.values(fi.slots as Record<string, unknown>))
          traverse(slot, depth + 1)
      }
    }
    // 数组节点：itemSchema 子树内的表达式同样可执行，必须递归扫描
    if (obj.kind === 'array' && obj.array && typeof obj.array === 'object') {
      traverse((obj.array as Record<string, unknown>).itemSchema, depth + 1)
    }
  }

  /** 递归扫描任意深度嵌套的字符串值（reaction.props.x / on.xxx 等可能嵌套对象） */
  function scanValue(value: unknown, path: string): void {
    if (value === null || value === undefined) return
    if (typeof value === 'string') {
      if (FORBIDDEN_REG.test(value)) errors.push(`${path}: ${value}`)
      return
    }
    if (typeof value !== 'object') return
    if (seen.has(value as object)) return
    seen.add(value as object)
    if (Array.isArray(value)) {
      value.forEach((v, i) => scanValue(v, `${path}[${i}]`))
      return
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      scanValue(v, `${path}.${k}`)
    }
  }
}
