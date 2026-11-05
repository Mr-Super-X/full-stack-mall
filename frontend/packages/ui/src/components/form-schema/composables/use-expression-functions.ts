/**
 * useExpressionFunctions —— 表达式沙箱白名单函数表生命周期管理（H2：实例级 scope）
 *
 * watch props.expressionFunctions → 写入**注入的 ExpressionScope**（非模块级表）。
 * immediate: true 保证 setup 期同步注册一次（首屏 {{ fn }} 表达式可用）。
 *
 * 为什么无 onScopeDispose 清理：scope 是 per-instance 对象（composer 持有），
 * 组件卸载后随闭包 GC；旧实现的模块级清表正是 H2 污染源 —— A 卸载时
 * setExpressionFunctions(undefined) 会毁掉同页实例 B 的注册（2026-09-09 浏览器实测）。
 *
 * @see ./use-expression.ts ExpressionScope / createExpressionScope —— 实例级沙箱工厂
 * @see ../types/xform.ts XFormProps.expressionFunctions —— 业务入参契约
 *
 * @group 表单编排：表达式
 */
import { watch } from 'vue'

import type { ExpressionScope } from './use-expression'

/** useExpressionFunctions 入参 */
export interface UseExpressionFunctionsDeps {
  /** H2：目标 scope —— composer 用 createExpressionScope() 创建，每 XForm 实例一份 */
  scope: ExpressionScope
  /** getter 形式：props.expressionFunctions 可能在运行时改变（demo 模式切换等） */
  expressionFunctions: () => Record<string, (...args: never[]) => unknown> | undefined
}

/**
 * 注册白名单到实例级 scope（副作用函数，不返回值）
 *
 * 用法：useExpressionFunctions({ scope, expressionFunctions: () => props.expressionFunctions })
 */
export function useExpressionFunctions(deps: UseExpressionFunctionsDeps): void {
  // 类型归因：XFormProps.expressionFunctions 的 Record<string, Function> 与 fns 表签名
  // （Record<string, (...args: never[]) => unknown>）变参约束不等价（C1 根因，详见 types/TYPE-CAST-AUDIT.md）；
  // 运行时已验证沙箱执行无越界，TS 层用 as never 兜底。
  watch(
    () => deps.expressionFunctions(),
    (fns) => deps.scope.setExpressionFunctions(fns as never),
    { immediate: true }
  )
}
