<script setup lang="ts">
/**
 * v-permission 指令演示 —— 旧版权限指令（兼容）
 *
 * 覆盖场景：
 *  - 单权限（v-permission="'user:edit'"）
 *  - 多权限 AND（v-permission="['user:view', 'user:edit']"）
 *  - :any 修饰符（v-permission:any="['a','b']"）
 *  - 与 v-auth 对比：无 disabled 修饰符，行为固定为 display:none
 *
 * 路由：/demo/directive-permission
 *
 * 推荐新代码使用 v-auth（统一指令，支持更多修饰符）；
 * v-permission 保留以兼容已有调用。
 */
import { useUserStore } from '@vv/shared'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-permission')

/* ───── 演示数据：mock 权限切换（与 v-auth 共用同一份 panel） ───────────── */

const userStore = useUserStore()

const ALL_PERMS = [
  { code: 'user:view', label: '用户查看' },
  { code: 'user:edit', label: '用户编辑' },
  { code: 'user:delete', label: '用户删除' },
  { code: 'report:export', label: '报表导出' },
]

const selectedPerms = ref<string[]>(['user:view', 'user:edit'])

watch(
  selectedPerms,
  (val) => {
    userStore.permissions = [...val]
  },
  { immediate: true, deep: true }
)

function togglePerm(code: string): void {
  const idx = selectedPerms.value.indexOf(code)
  if (idx >= 0) {
    selectedPerms.value = selectedPerms.value.filter((c) => c !== code)
  } else {
    selectedPerms.value = [...selectedPerms.value, code]
  }
}

const editBinding = computed(() => 'user:edit')
const multiAndBinding = computed(() => ['user:view', 'user:edit'])
const multiAnyBinding = computed(() => ['user:delete', 'report:export'])

const tocItems = [
  { id: 'demo-control', label: '权限切换面板' },
  { id: 'demo-single', label: '单权限' },
  { id: 'demo-and', label: '多权限 AND' },
  { id: 'demo-any', label: '多权限 ANY' },
  { id: 'demo-vs-auth', label: '与 v-auth 对比' },
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

const argItems = [
  {
    name: 'arg:any',
    type: '—',
    required: false,
    description: "v-permission:any=\"['a','b']\" —— ANY 语义，任一权限满足即可",
  },
]

/* ───── code 字符串 + introductions（避免 inline 触发 Vue 模板解析错误） ───────────── */

const permissionIntroductions = [
  '全局指令：与 v-auth 类似，但仅支持 :any 修饰符，无 disabled / remove 修饰符。',
  '行为固定：display:none + aria-hidden=true（无权限时彻底隐藏元素）。',
  '推荐新代码使用 v-auth（统一指令 + 修饰符组合）；v-permission 保留以兼容已有调用。',
]

const singleCode = '<el-button v-permission="editBinding">编辑用户</el-button>'

const andCode = `<el-button v-permission="['user:view', 'user:edit']">查看+编辑</el-button>`

const anyCode = `<el-button v-permission:any="['user:delete', 'report:export']">高级操作</el-button>`

const compareCode = `// v-auth 可用：
//   v-auth:disabled="perm"   无权限时仅禁用
//   v-auth:remove="perm"     显式移除
// v-permission 固定 display:none 行为，无以上修饰符`
</script>

<template>
  <DemoFrame
    title="v-permission 权限指令（兼容）"
    source="src/directives/permission.ts"
    :introductions="permissionIntroductions"
  >
    <!-- 权限切换面板 -->
    <section id="demo-control">
      <h3 :class="bem.e('heading')">权限切换面板</h3>
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
      <DemoField label="单权限" :code="singleCode">
        <el-button v-permission="editBinding" type="primary">编辑用户</el-button>
        <p :class="bem.e('hint')">取消勾选「用户编辑」权限 → 按钮消失；勾选 → 按钮出现。</p>
      </DemoField>
    </section>

    <!-- 多权限 AND -->
    <section id="demo-and">
      <DemoField label="多权限 AND" :code="andCode">
        <el-button v-permission="multiAndBinding" type="success">
          查看+编辑（user:view AND user:edit）
        </el-button>
        <p :class="bem.e('hint')">取消任一权限 → 按钮消失。</p>
      </DemoField>
    </section>

    <!-- 多权限 ANY -->
    <section id="demo-any">
      <DemoField label="多权限 ANY（v-permission:any）" :code="anyCode">
        <el-button v-permission:any="multiAnyBinding" type="warning">
          高级操作（user:delete OR report:export）
        </el-button>
        <p :class="bem.e('hint')">勾选任一权限 → 按钮出现。</p>
      </DemoField>
    </section>

    <!-- 与 v-auth 对比 -->
    <section id="demo-vs-auth">
      <DemoField label="与 v-auth 对比（仅 remove 模式，无 disabled）" :code="compareCode">
        <div :class="bem.e('compare-table')">
          <table :class="bem.e('table')">
            <thead>
              <tr>
                <th>特性</th>
                <th>v-auth（推荐）</th>
                <th>v-permission（兼容）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>单权限</td>
                <td><code>v-auth="'user:edit'"</code></td>
                <td><code>v-permission="'user:edit'"</code></td>
              </tr>
              <tr>
                <td>多权限 AND</td>
                <td><code>v-auth="['a','b']"</code></td>
                <td><code>v-permission="['a','b']"</code></td>
              </tr>
              <tr>
                <td>多权限 ANY</td>
                <td><code>v-auth:any="['a','b']"</code></td>
                <td><code>v-permission:any="['a','b']"</code></td>
              </tr>
              <tr>
                <td>无权限时禁用</td>
                <td><code>v-auth:disabled</code></td>
                <td>❌ 不支持</td>
              </tr>
              <tr>
                <td>显式移除</td>
                <td><code>v-auth:remove</code></td>
                <td>❌ 不支持</td>
              </tr>
              <tr>
                <td>行为固定</td>
                <td>display:none（默认）</td>
                <td>display:none</td>
              </tr>
              <tr>
                <td>状态来源</td>
                <td><code>useAuth() → userStore.permissions</code></td>
                <td><code>useAuth() → userStore.permissions</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p :class="bem.e('hint')">
          新代码推荐 v-auth；遇到旧项目 / 存量调用保持 v-permission 不动。
        </p>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="v-permission Binding" :items="bindingItems" anchor="api-binding" />
    <ApiTable title="Arg（修饰参数）" :items="argItems" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-permission {
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

  &__compare-table {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      border: 1px solid var(--el-border-color-light);
      text-align: left;
    }

    th {
      background: var(--el-fill-color-light);
      font-weight: 600;
    }

    code {
      padding: 1px 4px;
      background: var(--el-fill-color-lighter);
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  }
}
</style>
