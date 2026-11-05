import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// coverage 阈值说明（2026-10-26 实测重锚定）：
//   - 旧基线 50/48/45/50 是单应用时代（业务逻辑全在 src/）2026-08-12 的门槛；
//     Monorepo 下沉后 admin src 仅剩装配外壳 + 业务 views（大头逻辑在 packages/*），
//     旧阈值失去意义——本次实测 35.01/31.56/20.22/34.03，取 floor 为防倒退基线
//   - 阈值的第一职责是「防 CI 倒退」（ci.yml 已接入 coverage gate），非达标承诺；
//     回升路线 = 测试审计 #4 专项（admin 业务模块 views / layouts 补 spec，
//     目标先回 50/45/48/50，再按原路线图 v4.0 70/70/65/70）
//   - perFile 暂不启用（避免单文件未达标阻塞）；按业务模块渐进加
//   - 实测命令：pnpm test:coverage（输出到 coverage/index.html）
export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    include: ['src/**/*.{ts,vue}'],
    exclude: ['src/**/__tests__/**', 'src/**/index.ts', 'src/main.ts', 'src/types/**'],
    thresholds: { lines: 34, functions: 20, branches: 31, statements: 35 },
  },
})
