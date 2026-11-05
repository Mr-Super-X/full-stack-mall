<script setup lang="ts">
/**
 * 字典组件功能演示页（DictSelect / DictTag / useDict 契约形态）。
 *
 * 三段演示：
 * 1. DictSelect 表单下拉 —— clearable / filterable 经 $attrs 透传；user_status 的
 *    「锁定」项带 disabled，下拉中禁选（契约 disabled 字段效果）
 * 2. DictTag 表格状态列 —— 按字典项 type 渲染主题色；脏数据 'legacy'（字典中不存在）
 *    直接显示原文兜底；空值显示 '-' 占位
 * 3. useDict 契约形态 —— 按 code 解构 Ref<DictItem[]> + refreshDict 强制刷新
 *
 * 注意：DictSelect / DictTag 是 components/common 全局组件（构建期自动注册，
 * 见 CLAUDE.md §1.7），模板直接 <DictSelect /> 使用，不要显式 import ——
 * 显式 import 会让 Volar 丢失 DefineComponent 类型展开。
 */
import DictSelectSource from '@vv/ui/components/common/DictSelect.vue?raw'
import DictTagSource from '@vv/ui/components/common/DictTag.vue?raw'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import type { DictItem, DictTagType } from '@vv/shared'

const bem = createNamespace('demo-dict')

/**
 * el-tag 的 type 不接受空串：字典项 type 为空串（默认主题）时返回空对象不绑定 type。
 * exactOptionalPropertyTypes 下不能给可选 prop 显式传 undefined，用 v-bind 对象展开规避。
 */
function tagTypeOf(item: DictItem): { type: Exclude<DictTagType, ''> } | Record<string, never> {
  return item.type ? { type: item.type } : {}
}

// —— 演示 1：DictSelect 表单（gender 纯文本项 + user_status 带禁用项）——
const form = ref<{ gender: string | null; status: string | null }>({
  gender: null,
  status: null,
})

function resetForm() {
  form.value = { gender: null, status: null }
}

// —— 演示 2：DictTag 表格（含脏数据与空值，验证兜底链路）——
interface DemoUser {
  name: string
  gender: string | null
  status: string
}

const users = ref<DemoUser[]>([
  { name: '张三', gender: 'male', status: 'active' },
  { name: '李四', gender: 'female', status: 'locked' },
  { name: '王五', gender: null, status: 'inactive' },
  // 'legacy' 不在 user_status 字典中 —— DictTag 直接显示原文，不报错
  { name: '赵六（历史数据）', gender: 'secret', status: 'legacy' },
])

// —— 演示 3：useDict 契约形态（按 code 解构 + refreshDict 强制刷新）——
// 项目 composable @composables/useDict（AutoImport 注入，无须 import）
const { order_type, refreshDict } = useDict('order_type')
const refreshing = ref(false)

async function onRefreshOrderType() {
  refreshing.value = true
  try {
    await refreshDict('order_type')
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <DemoFrame
    title="Dict 字典组件"
    source="src/components/common/DictSelect.vue + DictTag.vue"
    :introductions="[
      '前端主导数据结构：DictItem 契约定义在 src/types/dict.ts，后端 /mock/dict/:code 按契约返回数组。',
      'DictSelect / DictTag 传 dictCode 即可用，字典加载、缓存、并发合并内部完成（useDict + store 防抖池）。',
      '字典项支持 type（el-tag 主题）/ disabled（下拉禁选）/ cssClass（自定义样式钩子）扩展字段。',
    ]"
  >
    <!-- 演示 1：DictSelect 表单下拉 -->
    <section :class="bem.e('section')">
      <h2 :class="bem.e('subtitle')">DictSelect 表单下拉（clearable + filterable）</h2>
      <DemoField :code="DictSelectSource" language="xml">
        <el-form :class="bem.e('form')" label-width="80px">
          <el-form-item label="性别">
            <DictSelect
              v-model="form.gender"
              dict-code="gender"
              clearable
              filterable
              placeholder="请选择性别"
            />
          </el-form-item>
          <el-form-item label="用户状态">
            <DictSelect
              v-model="form.status"
              dict-code="user_status"
              clearable
              filterable
              placeholder="请选择状态"
            />
          </el-form-item>
          <el-form-item>
            <el-button @click="resetForm">重置</el-button>
            <span :class="bem.e('form-value')">表单值：{{ JSON.stringify(form) }}</span>
          </el-form-item>
        </el-form>
        <p :class="bem.e('hint')">「锁定」项在 mock 中带 disabled: true —— 下拉中可见但不可选。</p>
      </DemoField>
    </section>

    <!-- 演示 2：DictTag 表格状态列 -->
    <section :class="bem.e('section')">
      <h2 :class="bem.e('subtitle')">DictTag 表格状态列</h2>
      <DemoField :code="DictTagSource" language="xml">
        <el-table :data="users" border>
          <el-table-column prop="name" label="姓名" min-width="160" />
          <el-table-column label="性别" width="120">
            <template #default="{ row }">
              <DictTag dict-code="gender" :value="(row as DemoUser).gender" />
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <DictTag dict-code="user_status" :value="(row as DemoUser).status" />
            </template>
          </el-table-column>
        </el-table>
        <p :class="bem.e('hint')">
          「女」标签经字典项 cssClass 钩子渲染粉色（vv-dict-tag--female）；脏数据 legacy
          不在字典中直接显示原文；性别为空显示 - 占位。
        </p>
      </DemoField>
    </section>

    <!-- 演示 3：useDict 契约形态 -->
    <section :class="bem.e('section')">
      <h2 :class="bem.e('subtitle')">useDict 契约形态（按 code 解构 + refreshDict）</h2>
      <DemoField
        :code="`const { order_type, refreshDict } = useDict('order_type')\nawait refreshDict('order_type') // 强制刷新`"
        language="typescript"
      >
        <div :class="bem.e('chips')">
          <el-tag v-for="item in order_type" :key="item.value" v-bind="tagTypeOf(item)">
            {{ item.label }}
          </el-tag>
          <el-button :loading="refreshing" size="small" @click="onRefreshOrderType">
            refreshDict('order_type')
          </el-button>
        </div>
        <p :class="bem.e('hint')">
          多字典场景：const {'{'} gender, user_status, refreshDict {'}'} = useDict('gender',
          'user_status')。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-dict {
  &__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__subtitle {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  &__form {
    max-width: 480px;
  }

  &__form-value {
    margin-left: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

  &__chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

// mock 字典数据 cssClass 钩子的配套样式（数据侧指定 vv-dict-tag--female，见 mock/dict.ts）
.#{$BEM_PREFIX}-dict-tag--female {
  color: #f56c6c;
  background-color: #fef0f0;
  border-color: #fbc4c4;
}
</style>
