<script setup lang="ts">
/**
 * v-auth 指令演示 —— 权限控制（推荐）
 *
 * 覆盖场景：
 *  - 单权限（v-auth="'user:edit'"）
 *  - 多权限 AND（v-auth="['user:edit', 'user:view']"）
 *  - 多权限 ANY（v-auth:any="['user:edit', 'user:view']"）
 *  - 修饰符：disabled（仅禁用不隐藏）、remove（移除元素，默认）
 *  - 响应 store 变化：切换下方权限 checkbox，元素实时显示/隐藏
 *
 * 路由：/demo/directive-auth
 *
 * 与 v-permission 关系：
 *  - v-auth 是 P0-4 阶段推出的统一权限指令，支持修饰符组合
 *  - v-permission 保留以兼容已有调用
 *  - 推荐新代码用 v-auth
 */
import { useUserStore } from '@vv/shared'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-auth')

/* ───── 演示数据：mock 权限切换 ───────────── */

const userStore = useUserStore()

// 可选权限码
const ALL_PERMS = [
  { code: 'user:view', label: '用户查看' },
  { code: 'user:edit', label: '用户编辑' },
  { code: 'user:delete', label: '用户删除' },
  { code: 'order:view', label: '订单查看' },
  { code: 'order:refund', label: '订单退款' },
  { code: 'report:export', label: '报表导出' },
]

// 当前 mock 启用的权限（持久化到一个临时 ref，演示过程可修改）
const selectedPerms = ref<string[]>(['user:view', 'user:edit'])

// 监听 selectedPerms 变化，同步到 store（v-auth 通过 useAuth() 读 store）
//
// ⚠️ DEMO-ONLY 故意绕过封装：直接改 store.permissions 是为了演示「权限切换实时影响 v-auth 渲染」，
// 真实业务请用 useAuth() 暴露的封装 setter（如 setPermissions / updatePermissions），
// 切勿照搬此写法到业务代码。
// 为什么不调封装 setter：useAuth 的 setter 走 reactive proxy 链路 + 触发整个 userStore 的副作用，
// demo 频繁切换会触发非预期日志；mock 演示场景隔离 store 写入，副作用可控。
watch(
  selectedPerms,
  (val) => {
    userStore.permissions = [...val]
  },
  { immediate: true, deep: true }
)

/** 切换权限码（在选中数组中加/删） */
function togglePerm(code: string): void {
  const idx = selectedPerms.value.indexOf(code)
  if (idx >= 0) {
    selectedPerms.value = selectedPerms.value.filter((c) => c !== code)
  } else {
    selectedPerms.value = [...selectedPerms.value, code]
  }
}

/**
 * v-auth 的响应式来自 useAuth().permissions（auth.ts:149-154 watchEffect）：
 * 只要 store.permissions 变更（无需 binding 自身响应式），所有 v-auth 元素重新求值。
 * 此处仍用 computed 仅为「演示规范化」（props 多处复用同一权限码时抽 computed）。
 */
const editBinding = computed(() => 'user:edit')
const deleteBinding = computed(() => 'user:delete')
const multiAndBinding = computed(() => ['user:view', 'user:edit'])
const multiAnyBinding = computed(() => ['user:delete', 'report:export'])
const refundBinding = computed(() => 'order:refund')

const tocItems = [
  { id: 'demo-control', label: '权限切换面板' },
  { id: 'demo-single', label: '单权限' },
  { id: 'demo-and', label: '多权限 AND' },
  { id: 'demo-any', label: '多权限 ANY' },
  { id: 'demo-modifier', label: '修饰符' },
  { id: 'api-binding', label: 'Binding 类型' },
]

useDocToc(tocItems)

const bindingItems = [
  {
    name: 'value',
    type: 'string | string[]',
    required: true,
    description: '权限码或权限码数组（AND 语义）',
  },
]

const modifierItems = [
  {
    name: 'arg:any',
    type: '—',
    required: false,
    description: "v-auth:any=\"['a','b']\" —— ANY 语义，任一权限满足即可",
  },
  {
    name: 'modifiers.disabled',
    type: '—',
    required: false,
    description: 'v-auth:disabled —— 无权限时仅禁用（保留元素 + aria-disabled=true）',
  },
  {
    name: 'modifiers.remove',
    type: '—',
    required: false,
    description: 'v-auth:remove —— 无权限时 display:none（默认行为）',
  },
]

/* ───── code 字符串（避免 inline `<>` 触发 Vue 模板解析错误） ───────────── */

const singleAuthCode = `<el-button v-auth="editBinding">编辑用户</el-button>
<el-button v-auth="deleteBinding">删除用户</el-button>`

const andAuthCode = `<el-button v-auth="['user:view', 'user:edit']">查看+编辑（需两权限）</el-button>`

const anyAuthCode = `<el-button v-auth:any="['user:delete', 'report:export']">高级操作（任一即可）</el-button>`

const disabledAuthCode = `<el-button v-auth:disabled="refundBinding">订单退款</el-button>`

const removeAuthCode = `<el-button v-auth:remove="refundBinding">订单退款</el-button>`
</script>

<template>
  <DemoFrame
    title="v-auth 权限指令（推荐）"
    source="src/directives/auth.ts"
    :introductions="[
      '全局指令：根据当前用户的权限码，控制元素的显示 / 禁用。',
      '支持单权限、多权限 AND / ANY、disabled / remove 修饰符；',
      '响应 userStore.permissions 变化，权限码增加 / 移除时元素实时显示 / 隐藏。',
      '下方「权限切换面板」控制当前模拟用户拥有的权限码——观察各按钮 / select 的可见性变化。',
    ]"
  >
    <!-- 权限切换面板 -->
    <section id="demo-control">
      <h3 :class="bem.e('heading')">权限切换面板（修改 store.permissions）</h3>
      <div :class="bem.e('control')">
        <el-checkbox
          v-for="p in ALL_PERMS"
          :key="p.code"
          :model-value="selectedPerms.includes(p.code)"
          :label="p.code"
          @change="() => togglePerm(p.code)"
        >
          {{ p.label }} ({{ p.code }})
        </el-checkbox>
      </div>
      <p :class="bem.e('hint')">
        当前 store.permissions：
        <code>[{{ selectedPerms.join(', ') || '(空)' }}]</code>
      </p>
    </section>

    <!-- 单权限 -->
    <section id="demo-single">
      <DemoField label='单权限（v-auth="权限码"）' :code="singleAuthCode">
        <div :class="bem.e('row')">
          <el-button v-auth="editBinding" type="primary">编辑用户</el-button>
          <el-button v-auth="deleteBinding" type="danger">删除用户</el-button>
        </div>
        <p :class="bem.e('hint')">
          取消勾选「用户编辑」权限 → 编辑按钮消失；勾选「用户删除」 → 删除按钮出现。
        </p>
      </DemoField>
    </section>

    <!-- 多权限 AND -->
    <section id="demo-and">
      <DemoField label='多权限 AND（v-auth="数组"）' :code="andAuthCode">
        <el-button v-auth="multiAndBinding" type="success">
          查看+编辑（需 user:view AND user:edit）
        </el-button>
        <p :class="bem.e('hint')">取消勾选「用户查看」或「用户编辑」任一权限 → 按钮消失。</p>
      </DemoField>
    </section>

    <!-- 多权限 ANY -->
    <section id="demo-any">
      <DemoField label='多权限 ANY（v-auth:any="数组"）' :code="anyAuthCode">
        <el-button v-auth:any="multiAnyBinding" type="warning">
          高级操作（user:delete OR report:export）
        </el-button>
        <p :class="bem.e('hint')">勾选「用户删除」或「报表导出」任一权限 → 按钮出现。</p>
      </DemoField>
    </section>

    <!-- 修饰符 -->
    <section id="demo-modifier">
      <DemoField label="修饰符：disabled（禁用而非移除）" :code="disabledAuthCode">
        <div :class="bem.e('row')">
          <el-button v-auth:disabled="refundBinding">订单退款（无权限时禁用）</el-button>
        </div>
        <p :class="bem.e('hint')">
          无权限时按钮仍可见但禁用；适合「存在但不可操作」的语义（如管理员可见但被撤销了权限）。
        </p>
      </DemoField>

      <DemoField label="修饰符：remove（显式移除，默认行为）" :code="removeAuthCode">
        <div :class="bem.e('row')">
          <el-button v-auth:remove="refundBinding">订单退款（无权限时移除）</el-button>
        </div>
        <p :class="bem.e('hint')">与不带修饰符行为一致——display: none + aria-hidden="true"。</p>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="v-auth Binding" :items="bindingItems" anchor="api-binding" />
    <ApiTable title="Arg / Modifiers" :items="modifierItems" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-auth {
  &__heading {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
  }

  &__control {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  &__hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.6;

    code {
      padding: 1px 4px;
      background: var(--el-bg-color);
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
}
</style>
