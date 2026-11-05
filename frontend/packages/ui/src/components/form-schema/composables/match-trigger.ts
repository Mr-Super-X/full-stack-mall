/**
 * 校验 rule.trigger 是否匹配当前事件类型
 *
 * - 未指定 trigger → 默认响应 'blur'（向后兼容现有 schema，跨字段校验主要场景是失焦）
 * - rule.trigger === eventType → 匹配
 * - rule.trigger 是数组 → 包含 eventType 即匹配
 * - rule.trigger === 'manual' → 永远不匹配（只在 validateForm() 时跑）
 *
 * 提取到独立文件便于单元测试，避免 XForm.vue SFC 无法 export 的限制。
 *
 * @group 表单编排：校验
 */
export function matchTrigger(
  ruleTrigger: 'blur' | 'change' | 'manual' | string | string[] | undefined,
  eventType: 'blur' | 'change'
): boolean {
  if (ruleTrigger === undefined) return eventType === 'blur'
  if (ruleTrigger === 'manual') return false
  // flat() 兼容类型修复前运行时可写入的嵌套数组（[['blur','change']]）
  if (Array.isArray(ruleTrigger)) return ruleTrigger.flat().includes(eventType)
  return ruleTrigger === eventType
}
