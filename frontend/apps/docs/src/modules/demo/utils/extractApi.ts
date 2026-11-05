// API 自动提取工具（半自动版）
//
// 自动提取：name / type / required
// 不提取：default（需 withDefaults 解析）/ description（TS 无 doc）
//
// 解析策略：
//   1. 正则切分 SFC 三个块（script setup / template / style）
//   2. TypeScript Compiler API 解析 defineProps / defineEmits 调用
//   3. 正则扫描 template 找 <slot> 标签
//
// 边界：SFC 内含 `</script>` 字面量时正则切分会失配——Vue 官方编译器同款行为。

import * as ts from 'typescript'

export interface ApiItem {
  name: string
  type: string
  default: string
  required: boolean
}

export interface SlotItem {
  name: string
  scoped: boolean
}

export interface ExtractedApi {
  props: ApiItem[]
  events: ApiItem[]
  slots: SlotItem[]
}

/**
 * 从 .vue 源码自动提取 API 文档。
 */
export function extractApi(source: string): ExtractedApi {
  const blocks = splitSFC(source)
  return {
    props: extractProps(blocks.scriptSetup),
    events: extractEvents(blocks.scriptSetup),
    // slot 只可能出现在 template 段，但 splitSFC 的懒匹配会被嵌套 <template v-if> 截断
    // ——直接扫整个 source 更可靠（script 段不含 <slot 标签）
    slots: extractSlots(source),
  }
}

function splitSFC(source: string): { scriptSetup: string; template: string } {
  const scriptSetupMatch = source.match(/<script\s+setup(?:\s+[^>]*)?>([\s\S]*?)<\/script>/)
  const templateMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/)
  return {
    scriptSetup: scriptSetupMatch?.[1] ?? '',
    template: templateMatch?.[1] ?? '',
  }
}

function findCallExpression(script: string, calleeName: string): ts.CallExpression | null {
  const sf = ts.createSourceFile(
    'inline.ts',
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  let result: ts.CallExpression | null = null
  function visit(node: ts.Node): void {
    if (result) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === calleeName
    ) {
      result = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return result
}

/** TypeScript 类型节点 → 可读字符串。覆盖 union / array / literal / reference / tuple / function。 */
function typeNodeToString(node: ts.TypeNode): string {
  if (ts.isUnionTypeNode(node)) {
    return node.types.map(typeNodeToString).join(' | ')
  }
  if (ts.isArrayTypeNode(node)) {
    return typeNodeToString(node.elementType) + '[]'
  }
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal
    if (ts.isStringLiteral(lit)) return `'${lit.text}'`
    if (ts.isNumericLiteral(lit)) return lit.text
    return lit.getText()
  }
  if (ts.isTupleTypeNode(node)) {
    // 事件签名：defineEmits<{ retry: [] }>() / { update: [value: string] }()
    // 格式化为函数签名：() => void / (value: string) => void
    const params = node.elements
      .map((e) => {
        if (ts.isNamedTupleMember(e)) {
          return `${e.name.getText()}: ${e.type ? typeNodeToString(e.type) : 'unknown'}`
        }
        return typeNodeToString(e)
      })
      .join(', ')
    return `(${params}) => void`
  }
  if (ts.isTypeReferenceNode(node)) {
    // 处理泛型：Error | null 已经走 union 分支；Array<T> 走 array 分支
    // 这里只处理简单引用 + 可选泛型参数
    const name = node.typeName.getText()
    const args = node.typeArguments
      ? `<${node.typeArguments.map(typeNodeToString).join(', ')}>`
      : ''
    return `${name}${args}`
  }
  if (ts.isFunctionTypeNode(node)) {
    return node.getText()
  }
  return node.getText()
}

function extractProps(scriptContent: string): ApiItem[] {
  const call = findCallExpression(scriptContent, 'defineProps')
  if (!call) return []
  const typeArg = call.typeArguments?.[0]
  if (!typeArg) return []

  // 支持内联类型字面量和 type alias（如 `interface Props` / `type Props = ...`）
  let members: ts.NodeArray<ts.TypeElement> | undefined
  if (ts.isTypeLiteralNode(typeArg)) {
    members = typeArg.members
  } else if (ts.isTypeReferenceNode(typeArg)) {
    const interfaces = findInterfaceDeclarations(scriptContent)
    const name = typeArg.typeName.getText()
    const iface = interfaces.get(name)
    if (iface) members = iface.members
  }
  if (!members) return []

  return members.filter(ts.isPropertySignature).map((prop) => {
    const name = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText()
    const required = !prop.questionToken
    const type = prop.type ? typeNodeToString(prop.type) : 'unknown'
    return { name, type, default: '—', required }
  })
}

function extractEvents(scriptContent: string): ApiItem[] {
  const call = findCallExpression(scriptContent, 'defineEmits')
  if (!call) return []
  const typeArg = call.typeArguments?.[0]
  if (!typeArg) return []

  let members: ts.NodeArray<ts.TypeElement> | undefined
  if (ts.isTypeLiteralNode(typeArg)) {
    members = typeArg.members
  } else if (ts.isTypeReferenceNode(typeArg)) {
    const interfaces = findInterfaceDeclarations(scriptContent)
    const name = typeArg.typeName.getText()
    const iface = interfaces.get(name)
    if (iface) members = iface.members
  }
  if (!members) return []

  return members.filter(ts.isPropertySignature).map((event) => {
    const name = ts.isIdentifier(event.name) ? event.name.text : event.name.getText()
    const signature = event.type ? typeNodeToString(event.type) : '() => void'
    return { name, type: signature, default: '—', required: false }
  })
}

/** 扫描同文件所有 interface 声明（支持 `defineProps<Props>()` 引用类型别名）。 */
function findInterfaceDeclarations(source: string): Map<string, ts.InterfaceDeclaration> {
  const sf = ts.createSourceFile(
    'inline.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const map = new Map<string, ts.InterfaceDeclaration>()
  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node)) {
      map.set(node.name.text, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return map
}

function extractSlots(templateContent: string): SlotItem[] {
  // 同时匹配：<slot /> / <slot name="..." /> / <slot>...</slot> / <slot name="...">...</slot>
  const slotRegex = /<slot\b([^>]*?)(?:\/>|>([\s\S]*?)<\/slot\s*>)/g
  const slots: SlotItem[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = slotRegex.exec(templateContent)) !== null) {
    const attrs = m[1] ?? ''
    const nameMatch = attrs.match(/(?::?name=)['"]([^'"]+)['"]/)
    const name = nameMatch?.[1] ?? 'default'
    // 作用域插槽：含 v-bind 简写（:foo）或显式 v-bind:foo
    const isScoped = /:[\w-]+=|v-bind:/.test(attrs)
    if (!seen.has(name)) {
      seen.add(name)
      slots.push({ name, scoped: isScoped })
    }
  }
  return slots
}
