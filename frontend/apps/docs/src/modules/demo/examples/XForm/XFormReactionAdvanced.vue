<script setup lang="ts">
/**
 * reaction 进阶用法总览（导航页）
 *
 * 原文件 427 行覆盖 4 大进阶场景，超过 CLAUDE.md §二 业务组件 ≤300 行上限，
 * 故拆分为 4 个独立 demo，本文件作为导航总览：
 *
 *   ① 计算字段 + deps 精确监听（数量×单价×折扣=折后价）
 *     → /demo/xform-reaction-calc-field
 *
 *   ② 跨字段级联清空（省/市/区 + 商品/型号）
 *     → /demo/xform-reaction-cascade-clear
 *
 *   ③ 反应式 props/rules/options 联动（度量单位 + 折扣等级）
 *     → /demo/xform-reaction-reactive-props
 *
 *   ④ 数组行内嵌 reaction（采购明细行内联动）
 *     → /demo/xform-reaction-array-row
 *
 * XFormReaction 基础 4 场景（基础计数 / 可见性 / props 替换 / 数组）见
 * XFormReaction.vue，与本 demo 不重叠。
 *
 * reaction 函数副作用承载约定：使用 _effect 字段存放副作用函数，返回 undefined →
 * use-reaction 的 isEqual 比较 target._effect 与 undefined 相等 → 跳过写入节点字段。
 */
import DemoFrame from '../../components/DemoFrame.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-x-form-reaction-advanced')

// 4 个子 demo 路由跳转 —— 用 useAppRouter().pushByName 而非 router.push：
// vue-router 4 的 router.push/path 不自动加 basename，dev 环境下 Vite server.base
// 是 /vue3-vite-project/ 而 router basename 是 /，导致 router.push('/demo/...')
// 跳到 /demo/... → 路由表无匹配 → 跳通配符 → 404。
// pushByName 用 route.name（路由注册时唯一标识）从 router 内部 lookup，
// 自动处理 basename + history + match —— 与侧边菜单跳转逻辑一致。
const appRouter = useAppRouter()
const SUB_DEMOS = [
  {
    idx: '①',
    title: '计算字段',
    desc: '数量×单价×折扣=折后价...',
    name: 'DemoXFormReactionCalcField',
  },
  {
    idx: '②',
    title: '级联清空',
    desc: '省/市/区 + 商品/型号...',
    name: 'DemoXFormReactionCascadeClear',
  },
  {
    idx: '③',
    title: '反应式 props/rules',
    desc: '度量单位切换...',
    name: 'DemoXFormReactionReactiveProps',
  },
  {
    idx: '④',
    title: '数组行内嵌',
    desc: '每行数量×单价=小计...',
    name: 'DemoXFormReactionArrayRow',
  },
] as const

function gotoSubDemo(name: string) {
  // pushByName 内部用 router.push({ name })，自动走 basename + history mode
  // 侧边菜单（demo-sidebar）走相同 API，跳转工作正常 → 这里也走 pushByName
  appRouter.pushByName(name)
}

const tocItems = [{ id: 'demo-overview', label: '四个进阶场景导航' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="反应式联动·进阶总览（4 大场景）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      'XFormReaction 基础 4 场景之外的复杂联动。原 427 行 demo 已拆分到 4 个独立子页面：',
      '① 计算字段：reaction 闭包副作用 + deps 精确监听切断自触发',
      '② 级联清空：上级 on.change 清空下级 + reaction.props 动态切 options',
      '③ 反应式 props/rules：单个 reaction 节点同时改 label + props，rules 用 {{ fn }} 表达式',
      '④ 数组行内嵌：行内 deps 用相对路径（不写 array.rows.0.qty）',
    ]"
  >
    <section id="demo-overview">
      <el-row :gutter="16" :class="bem.e('grid')">
        <el-col v-for="d in SUB_DEMOS" :key="d.name" :xs="24" :md="12">
          <div :class="bem.e('card')">
            <h3 :class="bem.e('card-title')">{{ d.idx }} {{ d.title }}</h3>
            <p :class="bem.e('card-desc')">{{ d.desc }}</p>
            <el-link type="primary" @click="gotoSubDemo(d.name)">打开子 demo →</el-link>
          </div>
        </el-col>
      </el-row>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-advanced {
  &__grid {
    margin-top: 16px;
  }
  &__card {
    padding: 16px;
    margin-bottom: 16px;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }
  }
  &__card-title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-color-primary);
  }
  &__card-desc {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}
</style>
