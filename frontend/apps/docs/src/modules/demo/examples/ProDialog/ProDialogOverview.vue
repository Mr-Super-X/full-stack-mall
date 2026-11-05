<script setup lang="ts">
/**
 * ProDialog 声明式用法演示页。
 *
 * 覆盖验证点：
 * 1. v-model 显隐 + ElDialog 原生 props 透传（width / close-on-click-modal / top）
 * 2. open / close / confirm 事件抛出
 * 3. 头部拖拽 + 视口边界钳制（实时坐标读数）
 * 4. 全屏切换与拖拽的交叉行为（先拖拽 → 切全屏 → 退出全屏应复位）
 * 5. header / footer 插槽覆盖（header 插槽只替换标题文本，拖拽手柄与全屏按钮保留）
 */
import { Bell } from '@element-plus/icons-vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-pro-dialog')

// —— 1. 基础用法：v-model + 原生 props 透传 + 事件 ——
const baseVisible = ref(false)
const eventLog = ref<string[]>([])

function onEvent(name: 'open' | 'close' | 'confirm') {
  eventLog.value = [...eventLog.value, `${new Date().toLocaleTimeString()} → ${name}`].slice(-5)
}

const SNIPPET_BASIC = `<ProDialog
  v-model="visible"
  title="基础弹窗"
  width="420px"
  :close-on-click-modal="false"
  @open="onOpen" @close="onClose" @confirm="onConfirm"
>
  原生 ElDialog 的 props 全部透传
</ProDialog>`

// —— 3. 拖拽与视口边界 ——
const dragVisible = ref(false)
const dragEnabled = ref(true)
const dragPosText = ref('尚未拖拽（margin 居中定位）')

// 拖拽结束时（document mouseup）读取 .el-dialog 的内联定位，直观验证边界钳制结果
// 修复:用组件作用域的 mouseup 监听（绑定到演示段落容器）替代全局 document 监听。
// 原实现的副作用:每次 dragVisible=true 都挂 document mouseup 全局监听器，叠加在
// 4 个 ProDialog 实例的 EP overlay 容器 patch 之上，造成打开后续示例时主线程繁忙。
// 新实现:用模板 @mouseup 绑定到 demo 段落，事件冒泡自动清理，无 watch 开销。
function onDragMouseUp(_e: MouseEvent): void {
  // 仅在弹窗打开时响应（dragVisible 控制的 ProDialog 已 visible=true，page 上有可见 .el-dialog）
  const dialog = document.querySelector<HTMLElement>(
    '.el-overlay-dialog:not([style*="display: none"]) .el-dialog'
  )
  if (!dialog) return
  // 仅当用户确实在拖拽后松开（即有 left 内联定位）才更新提示文案
  if (dialog.style.left) {
    dragPosText.value = `left: ${dialog.style.left}，top: ${dialog.style.top}（内联定位已接管）`
  }
}

const SNIPPET_DRAG = `<ProDialog v-model="visible" title="按住标题栏拖拽" :draggable="true">
  只能按住头部拖拽；越出视口的位移会被钳制，
  底部始终保留一段标题栏可拖回
</ProDialog>`

// —— 4. 全屏 × 拖拽交叉 ——
const fullVisible = ref(false)
const fullState = ref('窗口态')

// 回归点（code-reviewer #2 HIGH）：拖拽产生内联定位后切全屏，
// 若内联 left/top 未清除，全屏弹窗会被顶出视口
function onFullScreenChange(v: boolean) {
  fullState.value = v ? '全屏态（拖拽已禁用）' : '窗口态'
}

const SNIPPET_FULLSCREEN = `<ProDialog v-model="visible" title="拖拽 × 全屏交叉" @full-screen-change="onChange">
  操作路径：拖拽一段距离 → 点全屏按钮 → 应贴满视口无偏移 → 退出全屏 → 应回默认居中
</ProDialog>`

// —— 5. header / footer 插槽 ——
const slotVisible = ref(false)

const SNIPPET_SLOTS = `<ProDialog v-model="visible">
  <template #header>
    <el-icon><Bell /></el-icon> 自定义标题（插槽只替换文本，拖拽/全屏按钮保留）
  </template>
  内容区
  <template #footer>
    <el-button @click="slotVisible = false">自定义关闭</el-button>
  </template>
</ProDialog>`

const tocItems = [
  { id: 'demo-basic', label: '基础用法（v-model + 透传）' },
  { id: 'demo-drag', label: '拖拽与视口边界' },
  { id: 'demo-fullscreen', label: '全屏 × 拖拽交叉' },
  { id: 'demo-slots', label: 'header / footer 插槽' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProDialog 用法总览（声明式）"
    source="src/components/common/ProDialog/ProDialog.vue"
    :introductions="[
      '在 ElDialog 基础上扩展：头部拖拽（视口边界钳制）、全屏切换按钮、内置确认/取消 footer。',
      '除 modelValue / title / draggable / fullScreen / showFullScreenButton 外，ElDialog 原生 props 经 $attrs 全量透传。',
      '本页用真实交互验证：事件抛出、拖拽边界、全屏交叉复位、插槽覆盖四类行为。',
    ]"
  >
    <section id="demo-basic">
      <DemoField :code="SNIPPET_BASIC" label="① 基础用法：v-model + 原生 props 透传 + 事件">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="baseVisible = true">打开弹窗</el-button>
          <el-button @click="eventLog = []">清空事件记录</el-button>
        </div>
        <div :class="bem.e('log')">
          <span :class="bem.e('log-label')">事件记录（最多保留 5 条）：</span>
          <template v-if="eventLog.length">
            <div v-for="(line, i) in eventLog" :key="i">{{ line }}</div>
          </template>
          <span v-else :class="bem.e('log-empty')">
            暂无事件，打开弹窗后点「确定 / 取消 / X」试试
          </span>
        </div>
        <ProDialog
          v-model="baseVisible"
          title="基础弹窗（width=420 透传生效）"
          width="420px"
          :close-on-click-modal="false"
          @open="onEvent('open')"
          @close="onEvent('close')"
          @confirm="onEvent('confirm')"
        >
          <p :class="bem.e('para')">
            原生 ElDialog 的 props（此处 width / close-on-click-modal）经 $attrs 透传生效。
          </p>
          <p :class="bem.e('para')">
            点「确定」应触发 confirm + close 两条事件；点「取消 / X」只触发 close。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-drag">
      <DemoField :code="SNIPPET_DRAG" label="② 拖拽与视口边界钳制">
        <!-- mouseup 监听绑定到本段容器（局部作用域），不再挂全局 document 监听器。
               这样既避免叠加 EP overlay 容器 patch 的主线程开销，也无需 onUnmounted 清理 -->
        <div :class="bem.e('controls')" @mouseup="onDragMouseUp">
          <el-button type="primary" @click="dragVisible = true">打开可拖拽弹窗</el-button>
          <el-switch v-model="dragEnabled" active-text="允许拖拽" inactive-text="禁用拖拽" />
        </div>
        <p :class="bem.e('para')">
          按住标题栏拖动：往右下猛拖应被钳制在视口内——整个弹窗完整可见，overlay
          不产生滚动条；连续多次拖拽应以落点续拖，不再跳变。{{ dragPosText }}
        </p>
        <ProDialog
          v-model="dragVisible"
          title="按住标题栏拖拽（试试拖到屏幕边缘外）"
          width="480px"
          :draggable="dragEnabled"
        >
          <p :class="bem.e('para')">
            内容区不可拖拽；只有头部是拖拽手柄。切换「禁用拖拽」开关后光标应变回默认。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-fullscreen">
      <DemoField :code="SNIPPET_FULLSCREEN" label="③ 全屏切换 × 拖拽交叉（回归验证）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="fullVisible = true">打开弹窗</el-button>
          <el-tag :type="fullState.includes('全屏') ? 'warning' : 'info'">{{ fullState }}</el-tag>
        </div>
        <p :class="bem.e('para')">
          操作路径：
          <b>先拖拽一段距离</b>
          → 点头部全屏按钮 → 应贴满视口且无偏移 → 再点退出全屏 → 应回到默认居中（拖拽偏移已复位）。
        </p>
        <ProDialog
          v-model="fullVisible"
          title="拖拽 × 全屏交叉验证"
          width="520px"
          @full-screen-change="onFullScreenChange"
        >
          <p :class="bem.e('para')">
            若退出全屏后弹窗位置异常（偏出屏幕/残留偏移），说明内联定位清除逻辑回归。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-slots">
      <DemoField :code="SNIPPET_SLOTS" label="④ header / footer 插槽覆盖">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="slotVisible = true">打开弹窗</el-button>
        </div>
        <p :class="bem.e('para')">
          header 插槽只替换标题文本——拖拽手柄、全屏按钮、X 按钮全部保留且可用；footer
          插槽完全接管底部按钮区（内置「确定/取消」不再出现）。
        </p>
        <ProDialog v-model="slotVisible" width="480px">
          <template #header>
            <el-icon><Bell /></el-icon>
            <span :class="bem.e('slot-title')">自定义标题（验证拖拽手柄是否保留）</span>
          </template>
          <p :class="bem.e('para')">内容区不变。</p>
          <template #footer>
            <el-button type="danger" plain @click="slotVisible = false">
              自定义关闭（无内置按钮）
            </el-button>
          </template>
        </ProDialog>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-dialog {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__log {
    padding: 8px 12px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.8;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  &__log-label {
    color: var(--el-text-color-secondary);
  }

  &__log-empty {
    color: var(--el-text-color-placeholder);
  }

  &__para {
    margin: 0 0 8px;
    line-height: 1.7;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__slot-title {
    margin-left: 4px;
  }
}
</style>
