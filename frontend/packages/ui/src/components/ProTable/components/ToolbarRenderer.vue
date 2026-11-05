<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * ToolbarRenderer —— toolbar / selectionBarActions 配置的统一渲染器
 * （spec 2026-09-18-pro-table-toolbar-design §3.2）
 *
 * 渲染管线：perm 过滤(useAuth) → hidden 计算 → primary 重复 warn →
 * 按 maxVisible 截断（超出折叠「更多」dropdown）→ 点击 confirm(useConfirm) 包装 → onClick(ctx)。
 * children 拍平参与折叠计数（紧跟父后，同样过 perm/hidden 过滤）。
 *
 * 纯渲染组件：唯一自有状态是 pendingAction（Promise 未结算的点击防重入），
 * 业务状态（选中行/loading）全经 props.ctx 注入，不自行拉取。
 *
 * @group ProTable 子组件
 */
import { computed, ref, watch } from 'vue'
import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon } from 'element-plus' // element-plus 按需注入
import { ArrowDown } from '@element-plus/icons-vue' // 显式 import（§1.6.1 来源注释）
// 包内跨目录引用用相对路径（@vv/ui 包规范）；app 侧 AutoImport 对显式导入的标识符跳过注入
import { useConfirm } from '../../../composables/useConfirm.ts'
import type { ToolbarAction, ToolbarCtx } from '../types'

interface Props {
  /** 业务方配置（props.toolbar / props.selectionBarActions） */
  actions: ToolbarAction<T>[]
  /** 编排层聚合的上下文（选中行/loading/refresh 单一来源） */
  ctx: ToolbarCtx<T>
  /** 直出按钮上限（默认 3），超出部分折叠进「更多」下拉；`| undefined` 兼容 exactOptionalPropertyTypes 显式传 undefined */
  maxVisible?: number | undefined
}
const props = withDefaults(defineProps<Props>(), { maxVisible: 3 })

const bem = createNamespace('pro-table-toolbar')

/** useAuth 由 unplugin-auto-import 全局注入（CLAUDE.md §1.6 业务 composables） */
const { hasPerm } = useAuth()

/** 布尔或 ctx 函数统一求值 —— hidden/disabled 共用（函数形态每次渲染实时计算） */
function resolveBoolOrFn(v: boolean | ((ctx: ToolbarCtx<T>) => boolean) | undefined): boolean {
  return typeof v === 'function' ? v(props.ctx) : Boolean(v)
}

/** 单个 action 的 perm + hidden 过滤（children 拍平复用） */
function isActionVisible(action: ToolbarAction<T>): boolean {
  if (action.perm) {
    // string | string[] 归一为 AND 语义数组（与 v-auth 指令一致）
    const codes = Array.isArray(action.perm) ? action.perm : [action.perm]
    if (!hasPerm(codes)) return false
  }
  return !resolveBoolOrFn(action.hidden)
}

/** 可见 actions（children 拍平进主序列，参与折叠计数——设计 D3） */
const visibleActions = computed<ToolbarAction<T>[]>(() => {
  const out: ToolbarAction<T>[] = []
  for (const action of props.actions) {
    if (!isActionVisible(action)) continue
    out.push(action)
    if (action.children) {
      for (const child of action.children) {
        if (isActionVisible(child)) out.push(child)
      }
    }
  }
  return out
})

/** 主按钮唯一性哨兵 —— 实例级只 warn 一次，避免响应式重算刷屏 */
let hasWarnedPrimary = false
watch(
  visibleActions,
  (list) => {
    if (hasWarnedPrimary) return
    if (list.filter((a) => a.type === 'primary').length > 1) {
      hasWarnedPrimary = true
      console.warn(
        '[ProTable] toolbar 存在多个 type="primary" 按钮：主操作应唯一，页面视觉层级会漂移'
      )
    }
  },
  { immediate: true }
)

/** 直出列表 / 折叠列表（按可见顺序截断） */
const directList = computed(() => visibleActions.value.slice(0, props.maxVisible))
const overflowList = computed(() => visibleActions.value.slice(props.maxVisible))

/** 点击防重入：Promise 形态的 onClick 未结算前禁止再次点击（按钮 loading 反馈）。
 *  2026-09-18 review：confirm 等待期间同样持锁——否则用户在弹窗未决时点其他按钮，
 *  命令式 useConfirm 二次触发会替换首个弹窗，首个 Promise 悬挂造成泄漏窗口。 */
const pendingAction = ref<ToolbarAction<T> | null>(null)

async function handleClick(action: ToolbarAction<T>): Promise<void> {
  if (resolveBoolOrFn(action.disabled)) return
  // 全局单锁：置锁后覆盖 confirm + onClick 全程，结算（含取消）才释放
  if (pendingAction.value) return
  pendingAction.value = action
  try {
    // 二次确认：useConfirm 取消时 resolve false 直接返回（无须 try/catch，CLAUDE.md §1.5）。
    // 注意：typeof 分流不是冗余——useConfirm 有两个重载（string / UseConfirmOptions），
    // 联合类型参数无法匹配单个重载，必须先 narrow（2026-09-18 review 曾误合并导致 TS2769，已回退）
    if (action.confirm) {
      const ok =
        typeof action.confirm === 'string'
          ? await useConfirm(action.confirm)
          : await useConfirm(action.confirm)
      if (!ok) return
    }
    // 异常向上抛交给业务，不静默吞（项目错误处理规范）；finally 保证锁一定释放
    await action.onClick(props.ctx)
  } finally {
    pendingAction.value = null
  }
}

/** ElDropdown command 入口（overflow item 点击） */
function handleCommand(action: ToolbarAction<T>): void {
  void handleClick(action)
}
</script>

<template>
  <div :class="bem.b()">
    <ElButton
      v-for="action in directList"
      :key="action.label"
      :type="action.type ?? 'default'"
      :icon="action.icon!"
      :disabled="resolveBoolOrFn(action.disabled)"
      :loading="action.loading || pendingAction === action"
      @click="handleClick(action)"
    >
      {{ action.label }}
    </ElButton>
    <ElDropdown v-if="overflowList.length > 0" trigger="click" @command="handleCommand">
      <ElButton>
        更多
        <ElIcon><ArrowDown /></ElIcon>
      </ElButton>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem v-for="action in overflowList" :key="action.label" :command="action">
            {{ action.label }}
          </ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-table-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
