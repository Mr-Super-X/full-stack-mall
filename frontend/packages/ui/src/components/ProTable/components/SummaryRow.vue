<script setup lang="ts">
/**
 * SummaryRow —— 汇总行视觉样式组件（v3.0 新增 5a）
 *
 * 项目角色：实际汇总逻辑由 useSummary.computed 产出，el-table 的 :summary-method
 * 直接调用（无需 SummaryRow 中转）。本组件保留作为视觉占位 + 样式入口，
 * 未来若需要"非 el-table 内置 footer 风格"的汇总行（如分组汇总 / 双行汇总），
 * 可在此组件实现。
 *
 * @group ProTable 组件
 */
const bem = createNamespace('pro-table-summary')
</script>

<template>
  <!-- 当前 el-table 内置 show-summary 机制已满足 5a 需求；
       此组件作为未来扩展占位（双行汇总 / 嵌套汇总 / 图表汇总等） -->
  <div :class="bem.b()" hidden />
</template>

<style lang="scss">
/*
 * SummaryRow 当前是 v3.0 5a 占位组件（hidden）—— 实际汇总由 useSummary + el-table 内置
 * :summary-method 实现，不渲染任何 td 子节点。原 td { background-color !important }
 * 永远走不到，纯死代码，连同整个块一并移除。
 */
</style>
