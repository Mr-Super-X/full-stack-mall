<script setup lang="ts">
/**
 * 演示 reaction 防抖 / 节流
 *
 * 场景：
 * 1. 远程搜索(debounce):输入搜索词 → 300ms 后才触发远程接口,避免每字符都请求
 * 2. 自动保存节流(throttle):model 任意字段变化 → 最多 1 秒一次自动保存
 * 3. 普通反应式(default sync):开关切换 → 立即更新显示
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { reactionItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormReaction.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onSave, copySchema } = useXFormDemo({
  name: 'reaction',
  schema: () => schema,
  model: () => model,
})

// 模拟远程搜索:返回基于 keyword 的 mock 结果(中英文都支持)
function mockRemoteSearch(keyword: string): string[] {
  if (!keyword) return []
  const FRUITS = [
    '苹果 Apple',
    '香蕉 Banana',
    '樱桃 Cherry',
    '椰枣 Date',
    '接骨木果 Elderberry',
    '无花果 Fig',
    '葡萄 Grape',
    '哈密瓜 Hami melon',
    '西瓜 Watermelon',
  ]
  const lower = keyword.toLowerCase()
  return FRUITS.filter((f) => f.toLowerCase().includes(lower))
}

// 计数器:debounce / throttle 演示用 —— 必须放在 model 外部!
// ⚠️ 如果写到 model.X,会触发 deep watch 重跑 reaction,造成死循环(searchCallCount 一直 +1)
const searchCallCount = ref(0)
const saveCallCount = ref(0)

// 反应式结果存储 —— 必须在 model 外部!
// ⚠️ reaction 函数如果写入 model.X(被 watch deep 监听),会导致死循环:
//   watch deep → reaction 跑 → 写 model.X → watch 再触发 → reaction 再跑 → +1 +1 +1...
// 把 reaction 的副作用(搜索结果/保存时间)写到 model 外的 reactive,避开 watch 路径
const reactionStore = reactive<{ searchResults: string[]; lastSavedAt: string }>({
  searchResults: [],
  lastSavedAt: '',
})

const schema: SchemaNode = {
  column: 1,
  children: [
    // 1. debounce 远程搜索:输入框 + reaction 同步搜索结果到 model.searchResults
    {
      label: '搜索水果（debounce 300ms）',
      name: 'keyword',
      component: 'Input',
      props: { placeholder: '输入 fruit 名称', clearable: true },
      // reaction: 高频输入场景用 debounce —— 停止输入 300ms 后才跑
      reaction: {
        strategy: 'debounce',
        delay: 300,
        searchResults: () => {
          // ⚠️ 计数器必须写到 model 外部 ref,不能写到 model.searchCallCount
          // 否则 deep watch 会监听自身写入,造成死循环
          searchCallCount.value++
          // 搜索结果也必须写到 model 外部(reactionStore),否则死循环
          reactionStore.searchResults = mockRemoteSearch(model.keyword as string)
          return reactionStore.searchResults
        },
      },
    },

    // 2. throttle 自动保存:model 任何字段变化 → 最多 1 秒一次
    {
      label: '备注（throttle 1s 自动保存）',
      name: 'note',
      component: 'Input',
      props: { type: 'textarea', placeholder: '任意输入', rows: 2 },
      reaction: {
        strategy: 'throttle',
        delay: 1000,
        lastSavedAt: () => {
          // 计数器写到外部 ref,避免 watch 死循环
          saveCallCount.value++
          // 保存时间也写到外部 store
          reactionStore.lastSavedAt = new Date().toLocaleTimeString()
          return reactionStore.lastSavedAt
        },
      },
    },

    // 3. 普通反应式(default sync):开关 → 立即更新显示
    {
      label: '启用通知',
      name: 'enableNotify',
      component: 'Switch',
    },
    {
      label: '通知类型',
      name: 'notifyType',
      component: 'Select',
      props: {
        placeholder: '选择通知类型',
        clearable: true,
        options: [
          { value: 'email', label: '邮件' },
          { value: 'sms', label: '短信' },
          { value: 'push', label: 'App 推送' },
        ],
      },
      // 3. 默认 sync 反应式联动(disabled 字段):开关联动禁用
      // 开关 off → Select 变灰禁用(视觉立即感知);开关 on → Select 启用
      reaction: {
        disabled: (m: Record<string, unknown>) => !m.enableNotify,
      },
    },

    // 4. hidden + 必填：隐藏的必填字段不参与校验
    // 关（默认）→ 发票抬头隐藏，点「保存」校验直接通过
    // 开 → 发票抬头显示，留空点「保存」→ 报必填红字
    {
      label: '需要发票',
      name: 'needInvoice',
      component: 'Switch',
    },
    {
      label: '发票抬头',
      name: 'invoiceTitle',
      component: 'Input',
      props: { placeholder: '隐藏时留空也不阻塞提交', clearable: true },
      rules: [{ required: true, message: '请输入发票抬头', trigger: 'blur' }],
      reaction: {
        hidden: (m: Record<string, unknown>) => !m.needInvoice,
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  keyword: '',
  note: '',
  enableNotify: true,
  notifyType: 'email', // 默认选邮件,演示 enabled 状态
  needInvoice: false,
  invoiceTitle: '',
})

// onSave / copySchema / formRef / bem 由 useXFormDemo 统一提供（见 import 区上方）

const tocItems = [
  { id: 'demo-reaction', label: '反应式联动演示' },
  { id: 'api-reaction', label: 'ReactionConfig' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="反应式防抖 / 节流（strategy + delay）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'ReactionConfig 的 strategy + delay 字段，应对 reaction 函数被高频调用的场景：',
      '1. 远程搜索 debounce 300ms:输入「苹果」,连续打字 5 字符只触发 1 次远程(mockRemoteSearch)',
      '2. 自动保存 throttle 1s:输入备注时,1 秒内多次 input 只触发 1 次 lastSavedAt',
      '3. 默认 sync:开关切换通知,通知类型 Select 立即禁用/启用',
      '4. hidden 必填回归:关闭「需要发票」时发票抬头隐藏,留空点保存也通过;打开后留空保存报必填',
      '注意:searchCallCount / saveCallCount 显示在 model 区域,直观看到防抖/节流效果',
    ]"
  >
    <section id="demo-reaction">
      <DemoField label="防抖/节流" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('state')">
          <ModelPreview :model="model" />

          <!-- 搜索结果:输入框正下方实时显示,更醒目 -->
          <div v-if="model.keyword" :class="bem.e('results')">
            <strong>搜索结果({{ reactionStore.searchResults.length }} 项):</strong>
            <span v-if="reactionStore.searchResults.length > 0">
              <el-tag
                v-for="item in reactionStore.searchResults"
                :key="item"
                :class="bem.e('tag')"
                size="small"
              >
                {{ item }}
              </el-tag>
            </span>
            <span v-else style="color: #909399">无匹配(试试输入"苹果"/"Apple"/"ban")</span>
          </div>

          <div :class="bem.e('counter')">
            <strong>搜索调用次数（停止输入 300ms 后 searchCallCount +1）:</strong>
            {{ searchCallCount }}
            <br />
            <strong>保存触发次数（throttle 1s 后 +1）:</strong>
            {{ saveCallCount }}
            <br />
            <strong>最近一次保存时间:</strong>
            {{ reactionStore.lastSavedAt || '(尚未保存)' }}
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="ReactionConfig" :items="reactionItems" anchor="api-reaction" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__state {
    margin-top: 16px;
  }

  &__results {
    margin-top: 12px;
    padding: 8px 12px;
    background: #fdf6ec;
    border-radius: 4px;
    font-size: 13px;

    strong {
      color: #e6a23c;
      margin-right: 8px;
    }
  }

  &__tag {
    margin-right: 4px;
    margin-bottom: 4px;
  }

  &__counter {
    margin-top: 12px;
    padding: 8px 12px;
    background: #ecf5ff;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.8;

    strong {
      color: #409eff;
      margin-right: 4px;
    }
  }
}
</style>
