<script setup lang="ts">
/**
 * 大文件分片上传真实演示 —— 组合 runConcurrent（并发闸门）+ withRetry（单分片重试）
 * + UploadProgressTracker（字节级进度）的完整状态机流程。
 *
 * 数据流（Network 面板全程可见真实请求）：
 * 选文件 → hashing（Worker 内 hash-wasm 增量 SHA-256，不阻塞页面）
 * → POST /uploads/init（服务端按 fileHash 返回 uploadId + 已收分片 = 断点续传）
 * → PUT 分片二进制（Blob.slice 按需读取，只传缺失，并发 limit 可配）
 * → POST /uploads/:id/complete（齐全校验 + 模拟合并）→ 返回 fileUrl
 *
 * 验证方法：
 * 1. 点「生成 32MB 测试文件」再「开始上传」：状态标签走完
 *    哈希→查询→上传→合并→完成，进度条按字节推进，分片格并发变蓝。
 * 2. 上传中点「暂停」→ 在途请求被 AbortController 中止；点「继续」只补缺失分片。
 * 3. 上传中点「取消」→ 请求中止 + DELETE 清理服务端任务，状态「已取消」；
 *    暂停/失败后也可点「取消并清理」放弃服务端 session。
 * 4. 断点续传：上传中途刷新页面，重新选同一文件点开始——服务端返回已收分片，
 *    进度直接从断点续起（服务端状态是唯一事实源，不依赖浏览器本地记录）。
 * 5. 分片重试：单分片失败自动重试（指数退避）；重试耗尽后 error 态列出失败编号，
 *    点「重试」只补失败分片。
 */
import { createUploader } from '@api/upload/uploader'
import { createWorkerHasher } from '@api/upload/worker-hasher'
import { planChunks } from '@api/upload/chunk'
import type { Uploader, UploaderSnapshot, UploadState } from '@api/upload/types'
import ApiTable from '../components/ApiTable.vue'
import DemoField from '../components/DemoField.vue'
import DemoFrame from '../components/DemoFrame.vue'
import { useDocToc } from '../composables/useDocToc'
import { uploadApiItems } from './api-demos-api'
import { createMockUploadAdapter } from './upload/mock-adapter'

const bem = createNamespace('demo-api-upload')

const isDev = import.meta.env.DEV

const tocItems = [
  { id: 'demo-upload', label: '分片上传全流程' },
  { id: 'demo-resume', label: '断点续传说明' },
  { id: 'api-upload', label: 'API 说明' },
]
useDocToc(tocItems)

// ── 配置（idle 态可调；上传中锁定）──
const chunkSize = ref(1024 * 1024)
const concurrency = ref(3)

// ── 文件选择 ──
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const selectedFile = ref<File | null>(null)

function onPickFile(e: Event): void {
  selectedFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
  // 换文件后上一轮服务端会话与本页展示脱钩：回到待命态（服务端 session 由过期 GC 兜底）
  if (snap.value.state === 'done' || snap.value.state === 'cancelled') {
    uploader = null
    ensureUploader()
  }
}

/** 生成模式化测试文件：每 MB 块填充块索引字节——分片内容互异，哈希/ETag 真实可验 */
function makeTestFile(sizeMb = 32): void {
  const MB = 1024 * 1024
  const parts: BlobPart[] = []
  for (let i = 0; i < sizeMb; i += 1) {
    const buf = new Uint8Array(MB)
    buf.fill(i % 251)
    parts.push(buf)
  }
  selectedFile.value = new File(parts, `demo-${sizeMb}mb.bin`, {
    type: 'application/octet-stream',
  })
  if (snap.value.state === 'done' || snap.value.state === 'cancelled') {
    uploader = null
    ensureUploader()
  }
}

// ── uploader（惰性创建；配置变化且非运行态时重建）──
let uploader: Uploader | null = null
const snap = ref<UploaderSnapshot>({
  state: 'idle',
  progress: 0,
  uploadId: null,
  fileUrl: null,
  fileName: null,
  fileSize: 0,
  fileHash: null,
  doneParts: [],
  runningParts: [],
  failedParts: [],
  error: null,
})

function ensureUploader(): Uploader {
  if (!uploader) {
    uploader = createUploader({
      adapter: createMockUploadAdapter(),
      chunkSize: chunkSize.value,
      concurrency: concurrency.value,
      partRetry: 2,
      hashFile: createWorkerHasher(),
    })
    uploader.subscribe((s) => {
      snap.value = s
    })
    snap.value = uploader.snapshot()
  }
  return uploader
}

const isRunning = computed(() =>
  ['hashing', 'checking', 'uploading', 'merging'].includes(snap.value.state)
)

watch([chunkSize, concurrency], () => {
  if (isRunning.value) return
  uploader = null
  ensureUploader()
})

// ── 控制动作 ──
async function startUpload(): Promise<void> {
  if (!selectedFile.value || isRunning.value) return
  try {
    await ensureUploader().upload(selectedFile.value)
  } catch {
    // pause/cancel/error 的 reject 已由状态机落快照（snap.error / state），无需再弹
  }
}

function pauseUpload(): void {
  uploader?.pause()
}

async function cancelUpload(): Promise<void> {
  await uploader?.cancel()
}

// 组件卸载：中止在途请求与 Worker（服务端 session 保留，回来可续传）
onUnmounted(() => {
  uploader?.pause()
})

// ── 展示派生 ──
const STATE_META: Record<
  UploadState,
  { text: string; type: 'info' | 'warning' | 'primary' | 'success' | 'danger' }
> = {
  idle: { text: '待命', type: 'info' },
  hashing: { text: '哈希计算中', type: 'warning' },
  checking: { text: '查询服务端', type: 'warning' },
  uploading: { text: '上传中', type: 'primary' },
  merging: { text: '合并中', type: 'warning' },
  done: { text: '已完成', type: 'success' },
  error: { text: '失败', type: 'danger' },
  cancelled: { text: '已取消', type: 'info' },
  paused: { text: '已暂停', type: 'warning' },
}

const stateMeta = computed(() => STATE_META[snap.value.state])

const partPlans = computed(() =>
  selectedFile.value ? planChunks(selectedFile.value.size, chunkSize.value) : []
)

function partStatus(n: number): string {
  if (snap.value.doneParts.includes(n)) return 'done'
  if (snap.value.runningParts.includes(n)) return 'running'
  if (snap.value.failedParts.includes(n)) return 'failed'
  return 'idle'
}

const progressPercent = computed(() => Math.round(snap.value.progress * 100))

/** el-progress status 只接受字面量联合（exactOptionalPropertyTypes 下不能显式传 undefined） */
const progressStatus = computed(() => (snap.value.state === 'error' ? 'exception' : ''))

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, exp)).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}

const transferredBytes = computed(() => Math.round(snap.value.progress * snap.value.fileSize))

const startButtonText = computed(() => {
  if (snap.value.state === 'paused') return '继续上传（只补缺失分片）'
  if (snap.value.state === 'error') return '重试（只补失败/缺失分片）'
  return '开始上传'
})

ensureUploader()
</script>

<template>
  <DemoFrame
    title="大文件分片上传 · 完整状态机"
    source="packages/shared/src/api/upload/uploader.ts"
    :introductions="[
      '真实分片上传流程：Worker 哈希 → init 查服务端 → Blob.slice 并发传缺失分片 → complete 合并。',
      '并发闸门复用 runConcurrent，单分片重试复用 withRetry，进度按已传输字节计算。',
      '暂停/取消经 AbortController 真中止在途请求；断点续传以服务端状态为唯一事实源。',
    ]"
  >
    <el-alert
      v-if="!isDev"
      type="info"
      :closable="false"
      title="生产模式（mockjs 劫持）：流程可跑通但无延迟瀑布、无字节级上传进度（mockjs 不触发 upload progress 事件），完整体验请走 dev"
      :class="bem.e('env-alert')"
    />

    <section id="demo-upload" :class="bem.b()">
      <DemoField
        label="全流程演示"
        :code="`const uploader = createUploader({\n  adapter: mockAdapter,\n  chunkSize: 1MB, concurrency: 3,\n  hashFile: createWorkerHasher(), // hash-wasm Worker\n})\nawait uploader.upload(file)`"
      >
        <div :class="bem.e('controls')">
          <input ref="fileInput" type="file" hidden @change="onPickFile" />
          <el-button @click="fileInput?.click()">选择文件</el-button>
          <el-button plain @click="makeTestFile(32)">生成 32MB 测试文件</el-button>
          <span v-if="selectedFile" :class="bem.e('file-info')">
            {{ selectedFile.name }}（{{ formatBytes(selectedFile.size) }}，{{ partPlans.length }}
            分片）
          </span>
        </div>

        <div :class="bem.e('controls')">
          <span :class="bem.e('cfg-label')">分片大小</span>
          <el-radio-group v-model="chunkSize" :disabled="isRunning" :class="bem.e('cfg-radio')">
            <el-radio-button :value="256 * 1024" label="256 KB" />
            <el-radio-button :value="512 * 1024" label="512 KB" />
            <el-radio-button :value="1024 * 1024" label="1 MB" />
            <el-radio-button :value="2 * 1024 * 1024" label="2 MB" />
          </el-radio-group>
          <span :class="bem.e('cfg-label')">并发 = {{ concurrency }}</span>
          <el-slider
            v-model="concurrency"
            :min="1"
            :max="6"
            :disabled="isRunning"
            :class="bem.e('slider')"
          />
        </div>

        <div :class="bem.e('actions')">
          <template v-if="!isRunning">
            <el-button type="primary" :disabled="!selectedFile" @click="startUpload">
              {{ startButtonText }}
            </el-button>
            <!-- 暂停/失败态的取消入口：引擎 cancel 会 DELETE 清理服务端 session
                 （paused 保留 session 可续传；取消即放弃，下次上传为全新会话） -->
            <el-button
              v-if="snap.state === 'paused' || snap.state === 'error'"
              type="danger"
              plain
              @click="cancelUpload"
            >
              取消并清理
            </el-button>
          </template>
          <template v-else>
            <el-button type="warning" @click="pauseUpload">暂停</el-button>
            <el-button type="danger" @click="cancelUpload">取消</el-button>
          </template>
          <el-tag :type="stateMeta.type" :class="bem.e('state-tag')">
            {{ stateMeta.text }}
          </el-tag>
          <span v-if="snap.uploadId" :class="bem.e('meta')">uploadId: {{ snap.uploadId }}</span>
        </div>

        <el-progress
          :percentage="progressPercent"
          :class="bem.e('progress')"
          :status="progressStatus"
        />
        <p :class="bem.e('bytes')">
          已传输 {{ formatBytes(transferredBytes) }} / {{ formatBytes(snap.fileSize) }}
          <template v-if="snap.state === 'hashing'">（哈希读取进度，非上传）</template>
        </p>

        <div v-if="partPlans.length" :class="bem.e('shards')">
          <div
            v-for="p in partPlans"
            :key="p.partNumber"
            :class="[bem.e('shard'), bem.em('shard', partStatus(p.partNumber))]"
            :title="`#${p.partNumber} · ${formatBytes(p.size)}`"
          >
            {{ p.partNumber }}
          </div>
        </div>

        <el-alert
          v-if="snap.state === 'error' && snap.error"
          type="error"
          :closable="false"
          :title="`上传失败：${snap.error}`"
          :description="
            snap.failedParts.length
              ? `失败分片：#${snap.failedParts.join('、#')}（点上方「重试」只补这些分片）`
              : ''
          "
          :class="bem.e('error-alert')"
        />
        <el-alert
          v-if="snap.state === 'done' && snap.fileUrl"
          type="success"
          :closable="false"
          :title="`合并完成：${snap.fileUrl}`"
          :description="`fileHash: ${snap.fileHash}`"
          :class="bem.e('done-alert')"
        />
      </DemoField>
    </section>

    <section id="demo-resume" :class="bem.b()">
      <DemoField
        label="断点续传验证步骤"
        code="refresh → 选同一文件 → 开始\n// init 按 fileHash 命中旧 session\n// uploadedParts = 服务端已收 → 只补缺失"
      >
        <ol :class="bem.e('steps')">
          <li>
            上传中途（如进度 40%）直接
            <strong>刷新页面</strong>
            ——浏览器本地无任何分片记录。
          </li>
          <li>重新点「生成 32MB 测试文件」（或选回同一文件），点「开始上传」。</li>
          <li>
            服务端按
            <code>fileHash</code>
            命中旧 session，init 返回已收分片；进度从断点续起， Network 面板可见
            <strong>缺失分片</strong>
            的真实 PUT 请求。
          </li>
          <li>
            暂停/取消语义差异：暂停保留服务端分片（可续传）；取消会发
            <code>DELETE</code>
            清理服务端任务，再传即全新会话。
          </li>
        </ol>
      </DemoField>
    </section>

    <ApiTable title="分片上传引擎 API" :items="uploadApiItems" anchor="api-upload" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-api-upload {
  &__env-alert {
    margin-bottom: 16px;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__file-info {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  &__cfg-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__cfg-radio {
    margin-right: 8px;
  }

  &__slider {
    width: 160px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  &__state-tag {
    font-weight: 600;
  }

  &__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }

  &__progress {
    margin-top: 16px;
  }

  &__bytes {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__shards {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__shard {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 12px;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    transition: background 0.2s;

    &--running {
      background: var(--el-color-primary-light-7);
      color: var(--el-color-primary);
    }

    &--done {
      background: var(--el-color-success-light-8);
      color: var(--el-color-success);
    }

    &--failed {
      background: var(--el-color-danger-light-8);
      color: var(--el-color-danger);
    }
  }

  &__error-alert,
  &__done-alert {
    margin-top: 12px;
  }

  &__steps {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.9;
    color: var(--el-text-color-regular);

    code {
      background: var(--el-fill-color);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 12px;
    }
  }
}
</style>
