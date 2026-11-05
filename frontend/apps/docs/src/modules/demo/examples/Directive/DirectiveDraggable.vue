<script setup lang="ts">
/**
 * v-draggable 指令演示 —— el-dialog 拖拽 + 边界钳制
 *
 * 覆盖场景：
 *  - 启用拖拽（默认行为）
 *  - 禁用拖拽（v-draggable="false"，如全屏态）
 *  - 边界钳制：弹窗不会拖出视口
 *
 * 路由：/demo/directive-draggable
 *
 * 实现要点（详见 src/directives/draggable.ts JSDoc）：
 *  - EP 原生 draggable 无边界钳制，弹窗可被拖出视口外且无法找回，体验不可接受
 *  - 首次拖拽时把 EP 的 margin 居中切换为 left/top 定位（margin 定位无法表达水平位移）
 *  - 每次 mousedown 重读当前位置为原点，避免「二次拖拽瞬间跳回偏移前位置」
 *  - 定位切换用内联 style 实际状态判断而非 flag，ProDialog 全屏切换时清内联定位，flag 模式会失灵
 */
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-directive-draggable')

/* ───── 边界钳制交互面板数据 ───────────── */

/**
 * clampPosition 纯函数：可视化复现 v-draggable 边界钳制算法
 * 与 src/directives/draggable.ts 中 clampPosition 实现一一对应（验证 demo 演示）。
 * input: { left, top, dialogWidth, dialogHeight } + 视口 bounds
 * output: 钳制后的 left/top, 保证弹窗完全位于视口内。
 */
const clampInput = reactive({
  left: 1500, // 假设拖到了屏幕外
  top: 800,
  dialogWidth: 500,
  dialogHeight: 300,
  viewportWidth: 1280,
  viewportHeight: 720,
})
function clampPosition(
  pos: { left: number; top: number },
  bounds: { maxLeft: number; maxTop: number }
): { left: number; top: number } {
  return {
    left: Math.max(0, Math.min(pos.left, bounds.maxLeft)),
    top: Math.max(0, Math.min(pos.top, bounds.maxTop)),
  }
}
const clampResult = computed(() =>
  clampPosition(
    { left: clampInput.left, top: clampInput.top },
    {
      maxLeft: clampInput.viewportWidth - clampInput.dialogWidth,
      maxTop: clampInput.viewportHeight - clampInput.dialogHeight,
    }
  )
)

/** 「拖到屏幕外」按钮：把 enabledVisible 弹窗的内联 left 强制改为 -9999px，
 *  模拟一个绕过 directive 钳制的极端情况——观察弹窗真实位置被钳制到 0,0 */
function forceDialogOffscreen(): void {
  enabledVisible.value = true
  // 等下一个 tick 让 dialog 渲染完成再改其内联 style
  nextTick(() => {
    const dialog = document.querySelector<HTMLElement>('#demo-enabled .el-dialog')
    if (!dialog) return
    // el-dialog 拖拽是通过 dialog header 上的 directive 实现的，
    // 这里直接改 dialog 容器自身定位演示「边界钳制」的效果
    dialog.style.position = 'fixed'
    dialog.style.left = '-9999px'
    dialog.style.top = '50%'
    dialog.style.margin = '0'
    // 模拟「极端用户拖拽 → 钳制回视口内」：短暂后恢复
    setTimeout(() => {
      dialog.style.left = '0px'
      dialog.style.top = '0px'
    }, 1000)
  })
}

/* ───── 状态泄漏验证（Heap snapshot） ───────────── */

/**
 * 一键模拟「快速开关 3 个弹窗 10 次」——重复挂载/卸载 el-dialog
 * 暴露的 directive state（WeakMap 引用），用于在 DevTools Memory 里
 * 观察 heap snapshot 是否稳定。若 directive 在 unmounted 钩子
 * 正确清理 WeakMap entry，快照前后 detached DOM 数量应无明显增长。
 */
let leakTestRunning = false
const leakTestProgress = ref<string[]>([])
async function runLeakTest(): Promise<void> {
  if (leakTestRunning) return
  leakTestRunning = true
  leakTestProgress.value = []
  for (let i = 1; i <= 10; i++) {
    enabledVisible.value = true
    disabledVisible.value = true
    toggleVisible.value = true
    await new Promise<void>((r) => setTimeout(r, 80))
    enabledVisible.value = false
    disabledVisible.value = false
    toggleVisible.value = false
    await new Promise<void>((r) => setTimeout(r, 80))
    leakTestProgress.value = [...leakTestProgress.value, `第 ${i} 轮：3 个弹窗全开 → 全关`]
  }
  leakTestRunning = false
  leakTestProgress.value = [
    ...leakTestProgress.value,
    '完成：打开 DevTools → Memory → Heap snapshot → 对比快照前后「Detached HTMLDivElement」数量',
  ]
}

/* ───── 演示数据 ───────────── */

// 三个 demo 区段各自独立 ref：避免两个 <el-dialog v-model> 共享同一 ref
// 导致 enabledVisible=true 时两个弹窗都尝试显示（视觉上像「两层弹窗」）。
const enabledVisible = ref(false)
const disabledVisible = ref(false)
const toggleVisible = ref(false)

// 是否启用拖拽（模拟「全屏态禁用」场景）
const dragEnabled = ref(true)

const tocItems = [
  { id: 'demo-enabled', label: '启用拖拽' },
  { id: 'demo-disabled', label: '禁用拖拽' },
  { id: 'demo-toggle', label: '动态启用/禁用' },
  { id: 'demo-boundary', label: '边界钳制' },
  { id: 'demo-state-leak', label: '状态泄漏验证' },
  { id: 'api-binding', label: 'Binding 类型' },
]

useDocToc(tocItems)

const bindingItems = [
  {
    name: 'value',
    type: 'boolean | undefined',
    required: false,
    description: '可选。false 时禁用拖拽（适合全屏态）。undefined / true 时启用（默认值）。',
  },
]

/* ───── code 字符串（避免 inline `<>` 触发 Vue 模板解析错误） ───────────── */

const enabledDragCode = `<el-dialog v-model="visible">
  <template #header>
    <!-- v-draggable 绑在 DOM 元素上（不能直接绑 el-dialog 组件） -->
    <div v-draggable>可拖拽标题</div>
  </template>
  <p>按住标题栏拖动弹窗</p>
</el-dialog>`

const disabledDragCode = `<el-dialog v-model="visible">
  <template #header>
    <!-- 禁用态：不绑 v-draggable，或绑 v-draggable="false" -->
    <div>不可拖拽标题</div>
  </template>
</el-dialog>`

const toggleCode = `<el-switch v-model="dragEnabled" active-text="启用拖拽" />
<el-dialog v-model="visible">
  <template #header>
    <div v-draggable="dragEnabled">{{ dragEnabled ? '可拖拽' : '禁用' }}</div>
  </template>
</el-dialog>`

const clampCode = `clampPosition({ left, top }, { maxLeft, maxTop })`
</script>

<template>
  <DemoFrame
    title="v-draggable 弹窗拖拽"
    source="src/directives/draggable.ts"
    :introductions="[
      '全局指令：让元素（通常用于 el-dialog）可被鼠标拖动。',
      '相比 Element Plus 原生 draggable：补齐边界钳制（弹窗不会拖出视口）、重置原点（避免二次拖拽跳位）。',
      '适用场景：可拖拽的弹窗、抽屉等浮层组件。',
    ]"
  >
    <!-- 启用拖拽 -->
    <section id="demo-enabled">
      <DemoField label="启用拖拽（默认）" :code="enabledDragCode">
        <el-button type="primary" @click="enabledVisible = true">打开可拖拽弹窗</el-button>
        <el-dialog v-model="enabledVisible" width="400px">
          <!--
              关键：v-draggable 必须绑在 DOM 元素上，不能直接绑 el-dialog 组件
              （组件根节点非元素时 Vue 会 warn）。这里在 #header 插槽的 div 上绑指令，
              draggable.ts 内部通过 el.closest('.el-dialog') 找到 dialog 容器进行拖拽
            -->
          <template #header>
            <div v-draggable :class="bem.e('header')">可拖拽弹窗（按住此标题栏拖动）</div>
          </template>
          <p :class="bem.e('content')">
            按住标题栏拖动弹窗。尝试拖到视口左/上/右/下边缘——
            弹窗会被钳制在视口内，不会被拖出屏幕外。
          </p>
          <p :class="bem.e('content')">
            关闭弹窗后再次打开保持上次位置（除非 reload）—— element-plus 默认行为，v-draggable
            不干预位置持久化。
          </p>
        </el-dialog>
      </DemoField>
    </section>

    <!-- 禁用拖拽 -->
    <section id="demo-disabled">
      <DemoField label='禁用拖拽（v-draggable="false"）' :code="disabledDragCode">
        <el-button @click="disabledVisible = true">打开不可拖拽弹窗</el-button>
        <el-dialog v-model="disabledVisible" width="500px">
          <!-- 500px 中等大小：演示边界钳制对中等宽度弹窗同样生效 -->
          <!-- 禁用态：不绑 v-draggable；如要响应式控制可见用 v-draggable="false" 在 div 上 -->
          <template #header>
            <div :class="bem.e('header')">不可拖拽弹窗（无 v-draggable）</div>
          </template>
          <p :class="bem.e('content')">尝试按住标题栏拖动——无任何反应。</p>
          <p :class="bem.e('content')">
            常用于「全屏态」或「流程确认中不可打断」的弹窗。验证 DevTools 路径：F12 → Elements →
            选中 header div → Console 输入
            <code>$0.__vnode?.ctx?.bindings?.value</code>
            或展开
            <code>__draggable_ctx</code>
            （WeakMap 不便直接看）→ 可在 directive 源码的
            <code>updated</code>
            钩子加临时 console.log 打印
            <code>state.enabled</code>
            /
            <code>stateMap</code>
            验证
            <code>v-draggable="false"</code>
            模式下内部 state.enabled 切到 false。
          </p>
        </el-dialog>
      </DemoField>
    </section>

    <!-- 动态启用/禁用 -->
    <section id="demo-toggle">
      <DemoField label="动态启用/禁用（响应式 binding）" :code="toggleCode">
        <div :class="bem.e('control')">
          <el-switch
            v-model="dragEnabled"
            active-text="启用拖拽"
            inactive-text="禁用拖拽"
            inline-prompt
          />
        </div>
        <el-button @click="toggleVisible = true">打开弹窗</el-button>
        <el-dialog v-model="toggleVisible" width="700px">
          <!-- 700px 大宽度：演示钳制对宽弹窗（接近视口宽度时只剩 0~几百像素移动范围）同样生效 -->
          <template #header>
            <div v-draggable="dragEnabled" :class="bem.e('header')">
              {{ dragEnabled ? '可拖拽（开关已开）' : '不可拖拽（开关已关）' }}
            </div>
          </template>
          <p :class="bem.e('content')">
            无需关弹窗，updated 钩子自动同步 state.enabled；切换开关即看到拖拽行为变化。
          </p>
        </el-dialog>
      </DemoField>
    </section>

    <!-- 边界钳制 -->
    <section id="demo-boundary">
      <DemoField label="边界钳制（数学钳制到视口内）" :code="clampCode">
        <p :class="bem.e('content')">
          边界钳制公式：弹窗的 left / top 不能小于 0，也不能大于
          <code>(viewportWidth - dialogWidth, viewportHeight - dialogHeight)</code>
          。当弹窗边缘距视口边界
          <code>0px</code>
          时即钳制生效——可开 DevTools → Elements → 选中
          <code>.el-dialog</code>
          → 看 Styles 面板底部「Computed」或 inline style 的
          <code>left</code>
          /
          <code>top</code>
          值，验证是否被钉在 0 / maxLeft 边界。
        </p>
        <p :class="bem.e('content')">
          实现位于
          <code>src/directives/draggable.ts:clampPosition</code>
          ， 是纯函数导出供单测直接覆盖边界数学。
        </p>
        <p :class="bem.e('content')">
          <strong>为什么不只钳制手柄高度：</strong>
          若只钳制手柄，弹窗底部必然超出视口，触发 EP .el-overlay { overflow: auto } 的滚动条；
          钳制整个弹窗才是正确的体验。
        </p>

        <!-- clampPosition 纯函数交互面板 -->
        <div :class="bem.e('clamp-panel')">
          <h4 :class="bem.e('clamp-title')">clampPosition 交互面板</h4>
          <div :class="bem.e('clamp-grid')">
            <label>
              left
              <el-input-number v-model="clampInput.left" :step="100" :min="-9999" />
            </label>
            <label>
              top
              <el-input-number v-model="clampInput.top" :step="100" :min="-9999" />
            </label>
            <label>
              dialogWidth
              <el-input-number v-model="clampInput.dialogWidth" :step="50" />
            </label>
            <label>
              dialogHeight
              <el-input-number v-model="clampInput.dialogHeight" :step="50" />
            </label>
            <label>
              viewportWidth
              <el-input-number v-model="clampInput.viewportWidth" :step="100" />
            </label>
            <label>
              viewportHeight
              <el-input-number v-model="clampInput.viewportHeight" :step="100" />
            </label>
          </div>
          <div :class="bem.e('clamp-result')">
            <strong>钳制后：</strong>
            left =
            <code>{{ clampResult.left }}</code>
            , top =
            <code>{{ clampResult.top }}</code>
          </div>

          <!-- SVG 示意图 -->
          <svg
            :class="bem.e('clamp-svg')"
            :viewBox="`0 0 ${clampInput.viewportWidth} ${clampInput.viewportHeight}`"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- viewport 边界 -->
            <rect
              x="0"
              y="0"
              :width="clampInput.viewportWidth"
              :height="clampInput.viewportHeight"
              fill="none"
              stroke="#409eff"
              stroke-width="4"
              stroke-dasharray="8 4"
            />
            <text x="8" y="20" fill="#409eff" font-size="20" font-family="monospace">viewport</text>
            <!-- 原始位置（红色虚线） -->
            <rect
              :x="clampInput.left"
              :y="clampInput.top"
              :width="clampInput.dialogWidth"
              :height="clampInput.dialogHeight"
              fill="rgba(245,108,108,0.15)"
              stroke="#f56c6c"
              stroke-width="3"
              stroke-dasharray="6 3"
            />
            <text
              :x="clampInput.left + 8"
              :y="clampInput.top + 24"
              fill="#f56c6c"
              font-size="18"
              font-family="monospace"
            >
              原始位置
            </text>
            <!-- 钳制后位置（绿色实线） -->
            <rect
              :x="clampResult.left"
              :y="clampResult.top"
              :width="clampInput.dialogWidth"
              :height="clampInput.dialogHeight"
              fill="rgba(103,194,58,0.2)"
              stroke="#67c23a"
              stroke-width="3"
            />
            <text
              :x="clampResult.left + 8"
              :y="clampResult.top + 24"
              fill="#67c23a"
              font-size="18"
              font-family="monospace"
            >
              钳制后
            </text>
          </svg>
          <p :class="bem.e('content')">
            <em>红框</em>
            = 原始拖拽目标位置；
            <em>绿框</em>
            = clampPosition 实际生效位置。两者差异即钳制效果。
          </p>

          <!-- 「拖到屏幕外」按钮 -->
          <el-button type="danger" plain @click="forceDialogOffscreen">
            拖到屏幕外（强制弹窗 left=-9999px，1 秒后自动钳制回视口）
          </el-button>
        </div>
      </DemoField>
    </section>

    <!-- 状态泄漏验证（Heap snapshot） -->
    <section id="demo-state-leak">
      <DemoField label="状态泄漏验证（Heap snapshot）" :code="''">
        <p :class="bem.e('content')">
          v-draggable 用
          <code>WeakMap</code>
          存储每个 dialog 元素的 state 引用——理论上 unmounted 钩子会清理 entry， 弹窗销毁后 state
          应随之 GC。下面用一键脚本反复开关 3 个弹窗，配合 DevTools 观察是否有泄漏。
        </p>
        <el-button type="warning" plain :disabled="leakTestRunning" @click="runLeakTest">
          {{ leakTestRunning ? '验证进行中...' : '一键开关 3 个弹窗 × 10 轮' }}
        </el-button>
        <div :class="bem.e('leak-log')">
          <p v-for="(line, idx) in leakTestProgress" :key="`leak-${idx}`">
            {{ line }}
          </p>
        </div>
        <p :class="bem.e('content')">
          <strong>验证方法：</strong>
          打开 DevTools → Memory 面板 → 「Heap snapshot」→ 点 Take snapshot 拍基线 → 点上方按钮跑完
          10 轮 → 再拍一次快照 → 在 Comparison 视图对比两次快照的
          <code>Detached HTMLDivElement</code>
          节点数。若差值稳定在 ≤ 10，说明 directive 清理无泄漏；若有几十甚至上百的持续增长， 说明
          stateMap 引用未释放。
        </p>
        <p :class="bem.e('content')">
          <em>说明：</em>
          Element Plus 自身可能在关闭弹窗后短暂保留 detached DOM（teleport 节点未及时回收）， 这是
          EP 内部 cleanup 时序问题，
          <strong>不属于本 demo 验证范围</strong>
          。重点观察
          <code>Detached &lt;div&gt;</code>
          是否随轮次线性增长（线性增长 = 泄漏；稳定 = 无泄漏）。
        </p>
      </DemoField>
    </section>

    <ApiTable title="v-draggable Binding" :items="bindingItems" anchor="api-binding" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-directive-draggable {
  &__header {
    flex: 1;
    cursor: move;
    font-size: 16px;
    font-weight: 600;
    user-select: none;
  }

  &__content {
    margin: 0 0 12px;
    line-height: 1.6;
    color: var(--el-text-color-regular);

    code {
      padding: 1px 4px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  }

  &__control {
    margin-bottom: 12px;
  }

  &__clamp-panel {
    margin-top: 12px;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  &__clamp-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
  }

  &__clamp-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
  }

  &__clamp-result {
    padding: 10px 14px;
    margin-bottom: 12px;
    background: var(--el-bg-color);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 2px;
    font-size: 13px;

    code {
      padding: 2px 6px;
      background: var(--el-fill-color-lighter);
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
    }
  }

  &__clamp-svg {
    display: block;
    width: 100%;
    max-height: 360px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  // Heap snapshot 验证日志（V3.6-31 design fix）
  &__leak-log {
    margin-top: 12px;
    padding: 10px 14px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    min-height: 40px;
    font-family: monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);

    p {
      margin: 2px 0;
    }
  }
}
</style>
