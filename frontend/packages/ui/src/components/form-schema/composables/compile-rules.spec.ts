/**
 * compile-rules 单元测试
 *
 * 覆盖：
 * - rules=undefined → 空数组
 * - rules=RuleItem 对象数组 → 归一化 + 默认 message 注入
 * - rules=字符串（命名引用）→ 从 propsRules 查表
 * - 字符串未注册 → 降级为 required + console.error
 * - 'required' 字符串（DSL 简写）→ 静默放行不告警
 * - required + 用户显式 message → 不覆盖
 * - required + 无 message + 有 label → message = "<label>必填"
 * - required + 无 message + 无 label → message = "必填"
 */
import { describe, expect, it, vi } from 'vitest'
import { compileRules } from './compile-rules'
import type { SchemaNode } from '../types'

describe('compileRules', () => {
  it('rules=undefined → 返回空数组', () => {
    expect(compileRules(undefined, {})).toEqual([])
  })

  it('rules=RuleItem 对象数组 → 归一化（无 message 注入）', () => {
    const rules: SchemaNode['rules'] = [{ pattern: /^1/, message: '需以 1 开头' }]
    const out = compileRules(rules, {})
    expect(out).toHaveLength(1)
    expect(out[0]?.pattern).toEqual(/^1/)
    expect(out[0]?.message).toBe('需以 1 开头')
  })

  it('required + 无 message + 有 label → message = "<label>必填"', () => {
    const rules: SchemaNode['rules'] = [{ required: true }]
    const out = compileRules(rules, {}, '订单号')
    expect(out[0]?.required).toBe(true)
    expect(out[0]?.message).toBe('订单号必填')
  })

  it('required + 无 message + 无 label → message = "必填"', () => {
    const rules: SchemaNode['rules'] = [{ required: true }]
    const out = compileRules(rules, {})
    expect(out[0]?.message).toBe('必填')
  })

  it('required + 用户显式 message → 不覆盖', () => {
    const rules: SchemaNode['rules'] = [{ required: true, message: '请填写邮箱' }]
    const out = compileRules(rules, {}, '邮箱')
    expect(out[0]?.message).toBe('请填写邮箱')
  })

  it('非 required 规则 + 无 message → 不注入默认 message', () => {
    const rules: SchemaNode['rules'] = [{ pattern: /^1/ }]
    const out = compileRules(rules, {})
    expect(out[0]?.message).toBeUndefined()
  })

  it('字符串规则名 → 从 propsRules 查表', () => {
    const propsRules = { emailRule: { type: 'email', message: '邮箱格式错误' } }
    const out = compileRules('emailRule' as never, propsRules)
    expect(out).toHaveLength(1)
    expect(out[0]?.type).toBe('email')
    expect(out[0]?.message).toBe('邮箱格式错误')
  })

  it("字符串 'required'（DSL 简写）→ 静默降级为 required，不告警", () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = compileRules('required' as never, {})
    // 默认 message='必填' 由第二阶段注入
    expect(out).toEqual([{ required: true, message: '必填' }])
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('未注册字符串 → 降级为 required + console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = compileRules('unknownRule' as never, {})
    expect(out).toEqual([{ required: true, message: '必填' }])
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('命名校验规则 "unknownRule" 未在 props.rules 中注册')
    )
    errorSpy.mockRestore()
  })

  it("字符串 'required' + required + 有 label → 注入默认 message", () => {
    const out = compileRules('required' as never, {}, '订单号')
    expect(out[0]?.message).toBe('订单号必填')
  })

  it('混合：字符串 + 对象 + 字符串数组', () => {
    const propsRules = { phoneRule: { pattern: /^1[3-9]/, message: '手机号格式' } }
    const rules = [
      'phoneRule' as never,
      { required: true, message: '用户提示' },
      'required' as never,
    ]
    const out = compileRules(rules, propsRules, '订单')
    expect(out).toHaveLength(3)
    expect(out[0]?.pattern).toEqual(/^1[3-9]/)
    expect(out[1]?.message).toBe('用户提示')
    expect(out[2]?.required).toBe(true)
    expect(out[2]?.message).toBe('订单必填')
  })

  it('未注册字符串 → 降级为 required（filter 后保留）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = compileRules(['invalid' as never] as never, {})
    expect(out).toEqual([{ required: true, message: '必填' }])
    errorSpy.mockRestore()
  })

  describe('crossValidator 规则 el-form 透传根治（audit 2026-10-15 遗留 P1）', () => {
    const crossRule = {
      dependsOn: ['qty'],
      crossValidator: (value: unknown, ...deps: unknown[]) =>
        (deps[0] as number) >= (value as number) || '数量超出库存',
    }

    it('纯 cross 规则（number 目标、无 type 声明）→ 整条不进 el-form', () => {
      // 根治 async-validator 默认 type:'string' 致 number 目标字段保存被拦（is not a string）
      const rules: SchemaNode['rules'] = [{ ...crossRule, trigger: 'blur' }]
      const out = compileRules(rules, {}, '数量')
      expect(out).toEqual([])
    })

    it('纯 cross 规则仅带调度键（trigger）→ 也无校验实质，整体丢弃', () => {
      const rules: SchemaNode['rules'] = [
        { crossValidator: crossRule.crossValidator, trigger: 'change' },
      ]
      const out = compileRules(rules, {})
      expect(out).toEqual([])
    })

    it('混合规则（crossValidator + required 同条）→ 拆分：剔除 XForm 扩展键，字段校验部分保留', () => {
      const rules: SchemaNode['rules'] = [{ required: true, ...crossRule }]
      const out = compileRules(rules, {}, '数量')
      expect(out).toEqual([{ required: true, message: '数量必填' }])
      expect(out[0]).not.toHaveProperty('crossValidator')
      expect(out[0]).not.toHaveProperty('dependsOn')
    })

    it('propsRules 注册的 cross 规则（字符串名查表）→ 同样过滤', () => {
      const propsRules = { stockRule: { ...crossRule } }
      const out = compileRules('stockRule' as never, propsRules)
      expect(out).toEqual([])
    })
  })
})
