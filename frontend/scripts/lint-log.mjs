/**
 * lint:log —— 跑 `pnpm lint`，把输出落盘 lint.log 后再回显到终端。
 *
 * 存在原因：部分终端环境（PowerShell + ConPTY）下原生子进程直接写 TTY 的输出
 * 会被渲染层吞掉/清屏（2026-11-13 排查实证）；输出经「文件中转 + cat 回显」
 * 则稳定可见。本脚本把该 workaround 固化为跨平台命令（npm scripts 在 Windows
 * 经 cmd 执行，shell 语法不通用，故用 Node 实现）。
 *
 * 行为契约：
 * - lint.log 写在执行时的 cwd（项目根），已被 .gitignore（*.log）排除
 * - stderr 经 shell 的 2>&1 并入 stdout 单一管道，落盘顺序 = 真实输出时序
 * - 退出码原样透传 pnpm lint（--max-warnings 0 语义不变）
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// stderr 经 shell 的 2>&1 并入 stdout 单一管道——保证捕获顺序是真实输出时序
// （分别捕获 stdout/stderr 再拼接会把两类缓冲分组，顺序失真）
const result = spawnSync('pnpm run lint 2>&1', {
  encoding: 'utf8',
  // Windows 上 pnpm 是 pnpm.cmd，spawn 需经 shell 解析；Linux CI 上同样无害
  shell: true,
  env: process.env,
})

const output = result.stdout ?? ''
writeFileSync('lint.log', output)
process.stdout.write(output)

process.exit(result.status ?? 1)
