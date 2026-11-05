<script setup lang="ts">
/**
 * ProDialog 可拖拉调整宽高演示页（resizable）。
 *
 * 覆盖验证点：
 * 1. 基础 resizable：右下角三角手柄，mousedown → mousemove 改尺寸 → mouseup 结束
 * 2. 视口边界钳制：拖到边缘不能再放大；拖到左上尺寸钳制到 320×200
 * 3. resizeChange 事件：mouseup 抛 { width, height }，可用于持久化用户偏好
 * 4. 全屏 × resize 交叉：先 resize → 切全屏 → 退出全屏：内联 width/height 必须被清除，
 *    弹窗回到 EP 默认尺寸 + 默认居中（与现有拖拽清理逻辑同一思路）
 * 5. resizeMinToInitial：最小尺寸锁定「本次打开」的初始宽高——只能放大、
 *    不能缩小到比初始打开时更小（防止内容排版被拖乱）
 *
 * 覆盖事件：
 * - 全屏态自动禁用 resize（resizableEnabled computed 已聚合）
 * - onUnmounted 清 document 监听（防内存泄漏）
 */
import { ElMessage } from 'element-plus'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-pro-dialog-resizable')

// —— ① 基础可调整 ——
const basicVisible = ref(false)
const basicSize = ref('尚未调整（鼠标按住右下角拖拽）')
function onBasicResize(w: number, h: number) {
  basicSize.value = `${w} × ${h}`
}

const SNIPPET_BASIC = `<ProDialog
  v-model="visible"
  title="可调整宽高"
  width="480px"
  :resizable="true"
  @resize-change="onResize"
>
  按住右下角三角手柄拖拽...
</ProDialog>`

// —— ② 边界钳制 ——
const boundsVisible = ref(false)
const boundsLog = ref<string[]>([])
function onBoundsResize(w: number, h: number) {
  // 只在钳制边界被命中时记录（防止日志刷屏）
  const last = boundsLog.value[boundsLog.value.length - 1] ?? ''
  const cur = `${w} × ${h}`
  if (last !== cur) boundsLog.value = [...boundsLog.value, cur].slice(-5)
}
function tryShrink() {
  // 拖到 -100/-100 应被钳制在 320×200
  // 此处不模拟拖拽，仅作为提示
  ElMessage.info('请手动拖拽至左上方向，验证最小尺寸钳制到 320×200')
}
function tryExpand() {
  // 拖到视口外应被钳制在 viewport - 16px
  ElMessage.info('请手动拖拽至视口外，验证最大尺寸钳制到 viewport - 16px')
}

const SNIPPET_BOUNDS = `<ProDialog :resizable="true" />
<!-- 钳制规则（硬编码于组件内）：
     minWidth: 320, minHeight: 200
     maxWidth: window.innerWidth - 16
     maxHeight: window.innerHeight - 16 -->`

// —— ③ resizeChange 事件日志 ——
const eventVisible = ref(false)
const eventLog = ref<string[]>([])
function onEventResize(w: number, h: number) {
  eventLog.value = [...eventLog.value, `${new Date().toLocaleTimeString()} → ${w} × ${h}`].slice(-5)
}

const SNIPPET_EVENT = `<ProDialog :resizable="true" @resize-change="onResize" />
<!-- 仅在 mouseup 时抛一次，mousemove 高频不抛以避免父组件重渲染抖动 -->`

// —— ④ 全屏 × resize 交叉 ——
const fullVisible = ref(false)
const fullState = ref('窗口态')
function onFullScreenChange(v: boolean) {
  fullState.value = v ? '全屏态（resize 已禁用）' : '窗口态'
}
// 拖拽后自动记录尺寸：状态字段直接响应 resizeChange，无需手动点「记录」按钮
const sizeBeforeFullScreen = ref('')
function onFullResize(w: number, h: number) {
  sizeBeforeFullScreen.value = `${w} × ${h}`
}

const SNIPPET_FULL = `<ProDialog
  :resizable="true"
  @full-screen-change="onFullScreen"
/>
<!-- 路径：拖大弹窗 → 切全屏 → 退出全屏 → 应回到 EP 默认 width -->
<!-- resize 与 fullScreen 的内联 width/height 在 toggleFullScreen 中已清理 -->`

// —— ⑤ 最小尺寸锁定初始打开宽高 ——
const minInitVisible = ref(false)
const minInitSize = ref('尚未调整')
function onMinInitResize(w: number, h: number) {
  minInitSize.value = `${w} × ${h}`
}

const SNIPPET_MIN_INIT = `<ProDialog
  v-model="visible"
  title="只能放大"
  width="480px"
  resizable
  resize-min-to-initial
  @resize-change="onResize"
>
  最小尺寸 = 本次打开的初始宽高：可放大，拖小会被钳回初始尺寸。
</ProDialog>`

const tocItems = [
  { id: 'demo-basic', label: '基础可调整' },
  { id: 'demo-bounds', label: '视口边界钳制' },
  { id: 'demo-event', label: 'resizeChange 事件' },
  { id: 'demo-fullscreen', label: '全屏 × resize 交叉' },
  { id: 'demo-min-initial', label: '最小尺寸锁定初始' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProDialog 可拖拉调整宽高"
    source="src/components/common/ProDialog/ProDialog.vue"
    :introductions="[
      '在 ElDialog 基础上扩展：右下角三角手柄，mousedown → mousemove 改尺寸 → mouseup 抛 resizeChange。',
      '钳制规则：最小 320×200（resize-min-to-initial 开启时为本次打开的初始宽高）/ 最大 viewport - 16px；全屏态自动禁用。',
      '仅在 mouseup 时抛一次事件，mousemove 高频不抛——避免父组件重渲染抖动（可持久化用户偏好）。',
    ]"
  >
    <section id="demo-basic">
      <DemoField :code="SNIPPET_BASIC" label="① 基础可调整（拖拽右下角三角手柄）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="basicVisible = true">打开可调整弹窗</el-button>
          <span :class="bem.e('status')">当前尺寸：{{ basicSize }}</span>
        </div>
        <ProDialog
          v-model="basicVisible"
          title="可调整宽高（默认 480px）"
          width="480px"
          resizable
          @resize-change="onBasicResize"
        >
          <p :class="bem.e('para')">
            按住
            <b>右下角三角</b>
            拖拽，鼠标变 ↘ 光标；放开后抛 resizeChange 事件。
          </p>
          <p :class="bem.e('para')">拖拽中观察：</p>
          <ul :class="bem.e('list')">
            <li>body 内的文字不会被选中（user-select: none）</li>
            <li>鼠标光标全程保持 se-resize</li>
            <li>拖到视口边界 / 最小尺寸时被钳制</li>
          </ul>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-bounds">
      <DemoField :code="SNIPPET_BOUNDS" label="② 视口边界 + 最小尺寸钳制">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="boundsVisible = true">打开弹窗</el-button>
          <el-button @click="tryShrink">提示：拖小（验证 320×200）</el-button>
          <el-button @click="tryExpand">提示：拖大（验证 viewport - 16）</el-button>
          <el-button @click="boundsLog = []">清空日志</el-button>
        </div>
        <div :class="bem.e('log')">
          <span :class="bem.e('log-label')">尺寸变化日志（最多 5 条）：</span>
          <template v-if="boundsLog.length">
            <div v-for="(line, i) in boundsLog" :key="i">{{ line }}</div>
          </template>
          <span v-else :class="bem.e('log-empty')">尚未拖拽调整</span>
        </div>
        <ProDialog
          v-model="boundsVisible"
          title="边界钳制演示"
          width="400px"
          resizable
          @resize-change="onBoundsResize"
        >
          <p :class="bem.e('para')">硬编码钳制（不可配置）：最小 320×200、最大 viewport - 16px。</p>
          <p :class="bem.e('para')">
            拖拽至左下角继续往左下：尺寸冻结在 320×200；拖拽至右上角继续往右上： 尺寸冻结在 viewport
            - 16px。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-event">
      <DemoField :code="SNIPPET_EVENT" label="③ resizeChange 事件（仅 mouseup 触发一次）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="eventVisible = true">打开弹窗</el-button>
          <el-button @click="eventLog = []">清空事件日志</el-button>
        </div>
        <div :class="bem.e('log')">
          <span :class="bem.e('log-label')">resizeChange 事件记录：</span>
          <template v-if="eventLog.length">
            <div v-for="(line, i) in eventLog" :key="i">{{ line }}</div>
          </template>
          <span v-else :class="bem.e('log-empty')">
            拖拽放开手后应出现一条新日志，mousemove 中不会刷屏
          </span>
        </div>
        <ProDialog
          v-model="eventVisible"
          title="resizeChange 事件日志"
          width="500px"
          resizable
          @resize-change="onEventResize"
        >
          <p :class="bem.e('para')">
            拖拽中观察：日志
            <b>不会</b>
            持续刷新；松手瞬间出现一条新记录。 这是有意的——高频 mousemove
            抛事件会让父组件重渲染抖动。
          </p>
          <p :class="bem.e('para')">
            实用场景：父组件把 size 持久化到 localStorage，下一次打开弹窗时按此尺寸渲染。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-fullscreen">
      <DemoField :code="SNIPPET_FULL" label="④ 全屏 × resize 交叉（回归验证）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="fullVisible = true">打开弹窗</el-button>
          <el-tag :type="fullState.includes('全屏') ? 'warning' : 'info'">{{ fullState }}</el-tag>
        </div>
        <p :class="bem.e('para')">
          操作路径：
          <b>先拖大弹窗到任意尺寸</b>
          → 点头部全屏按钮 → 应贴满视口 → 退出全屏 → 应回到
          <b>EP 默认 width</b>
          （不是拖拽后的尺寸），否则说明内联 width 残留回归。
        </p>
        <p :class="bem.e('para')">
          最后一次 resize 尺寸：
          <b>{{ sizeBeforeFullScreen || '尚未操作' }}</b>
        </p>
        <ProDialog
          v-model="fullVisible"
          title="全屏 × resize 交叉"
          width="520px"
          resizable
          @resize-change="onFullResize"
          @full-screen-change="onFullScreenChange"
        >
          <p :class="bem.e('para')">
            拖拽后下方「最后一次 resize 尺寸」应立刻更新；
            退出全屏后弹窗异常（仍是拖拽尺寸）说明内联 width/height
            清除逻辑回归——应保持与拖拽清理同一思路。
          </p>
        </ProDialog>
      </DemoField>
    </section>

    <section id="demo-min-initial">
      <DemoField :code="SNIPPET_MIN_INIT" label="⑤ 最小尺寸锁定初始打开宽高（只能放大）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="minInitVisible = true">打开弹窗</el-button>
          <span :class="bem.e('status')">当前尺寸：{{ minInitSize }}</span>
        </div>
        <p :class="bem.e('para')">
          <code>resize-min-to-initial</code>
          开启后，本次打开弹窗的初始宽高即为最小可缩尺寸——往左下拖会被钳制回初始尺寸，往右上拖可正常放大。
        </p>
        <p :class="bem.e('para')">
          适用场景：弹窗内容按设计稿固定了舒适尺寸（如 480px
          宽表单），不允许用户拖小到内容排版错乱。
          关闭后重新打开，钳制基准会重新按本次打开的初始尺寸计算。
        </p>
        <ProDialog
          v-model="minInitVisible"
          title="只能放大（初始 480px）"
          width="480px"
          resizable
          resize-min-to-initial
          @resize-change="onMinInitResize"
        >
          <p :class="bem.e('para')">
            初始宽 480px：尝试往
            <b>左下</b>
            拖小——尺寸会停在初始宽高；往
            <b>右上</b>
            拖大不受限。
          </p>
          <p :class="bem.e('para')">
            对比：上方「② 边界钳制」不传本开关时，往左下最小只能到硬编码的 320×200。
          </p>
        </ProDialog>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-dialog-resizable {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  &__status {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__log {
    padding: 8px 12px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.8;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    margin-bottom: 12px;
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

  &__list {
    margin: 4px 0;
    padding-left: 24px;
    line-height: 1.8;
  }
}
</style>
