/**
 * 校验 tsconfig.app.json paths 与 @vv/config 别名单一来源一致性
 *
 * 复用 generate-tsconfig-paths.ts 的 --check 模式（单一逻辑来源）
 * 失败时 exit 1（CI 阶段会阻断）
 *
 * v2（P1-1）：数据源从 build/aliases.ts（已删）切换到 packages/config/src/app-aliases.ts；
 * 脚本路径锚定自身位置而非 cwd（pnpm 从根调用，但入口不依赖调用目录）
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const generator = fileURLToPath(new URL('./generate-tsconfig-paths.ts', import.meta.url))

const result = spawnSync(process.execPath, ['--experimental-strip-types', generator, '--check'], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
