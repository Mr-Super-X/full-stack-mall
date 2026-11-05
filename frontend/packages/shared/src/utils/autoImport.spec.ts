import { describe, it, expect, vi } from 'vitest'
import { autoImport } from './autoImport'

describe('autoImport（基础）', () => {
  it('遍历所有模块并调用 transform', () => {
    const modules = {
      '/a.ts': { default: 'A' },
      '/b.ts': { default: 'B' },
    }
    const result = autoImport({
      modules,
      transform: (_, mod) => mod.default,
    })
    expect(result).toEqual(['A', 'B'])
  })

  it('transform 接收 path 参数', () => {
    const modules = {
      '/x/a.ts': { default: 'A' },
      '/x/b.ts': { default: 'B' },
    }
    const paths: string[] = []
    autoImport({
      modules,
      transform: (path, mod) => {
        paths.push(path)
        return mod.default
      },
    })
    expect(paths).toEqual(['/x/a.ts', '/x/b.ts'])
  })

  it('空 modules 返回空数组', () => {
    const result = autoImport({
      modules: {},
      transform: () => 'x' as const,
    })
    expect(result).toEqual([])
  })
})

describe('autoImport（filter）', () => {
  it('filter 返回 true 的模块被跳过', () => {
    const modules = {
      '/a.ts': { default: 'A' },
      '/b.ts': { default: 'B' },
      '/c.ts': { default: 'C' },
    }
    const result = autoImport({
      modules,
      filter: (path) => path === '/b.ts',
      transform: (_, mod) => mod.default,
    })
    expect(result).toEqual(['A', 'C'])
  })

  it('不传 filter 时遍历全部', () => {
    const modules = { '/a.ts': { default: 1 }, '/b.ts': { default: 2 } }
    const result = autoImport({
      modules,
      transform: (_, mod) => mod.default,
    })
    expect(result).toEqual([1, 2])
  })

  it('filter 全部返回 true 时结果为空', () => {
    const modules = { '/a.ts': { default: 'A' }, '/b.ts': { default: 'B' } }
    const result = autoImport({
      modules,
      filter: () => true,
      transform: (_, mod) => mod.default,
    })
    expect(result).toEqual([])
  })
})

describe('autoImport（类型与副作用）', () => {
  it('transform 可返回任意类型（侧副作用 + 返回值）', () => {
    const onInstall = vi.fn()
    const modules = {
      '/a.ts': { default: { install: () => onInstall('A') } },
      '/b.ts': { default: { install: () => onInstall('B') } },
    }
    const result = autoImport({
      modules,
      transform: (_, mod) => mod.default.install(),
    })
    expect(onInstall).toHaveBeenCalledWith('A')
    expect(onInstall).toHaveBeenCalledWith('B')
    expect(result).toEqual([undefined, undefined])
  })

  it('transform 抛错时不中断其他模块（异常继续抛）', () => {
    const modules = {
      '/a.ts': { run: () => 'A' },
      '/b.ts': {
        run: () => {
          throw new Error('boom')
        },
      },
    }
    expect(() => {
      autoImport({
        modules,
        transform: (_, mod) => mod.run(),
      })
    }).toThrow('boom')
  })
})

describe('autoImport（典型场景）', () => {
  it('路由聚合：transform 返回数组时收集所有', () => {
    const modules = {
      '/users/routes/index.ts': { default: [{ path: '/users' }] },
      '/orders/routes/index.ts': { default: [{ path: '/orders' }, { path: '/orders/1' }] },
    }
    const routes = autoImport({
      modules,
      transform: (_, m) => m.default,
    }).flat()
    expect(routes).toHaveLength(3)
    expect(routes[0]).toEqual({ path: '/users' })
    expect(routes[2]).toEqual({ path: '/orders/1' })
  })

  it('目录排除常见模式：index.ts + 下划线开头', () => {
    const modules = {
      '/index.ts': { default: 'skip-self' },
      '/_utils.ts': { default: 'skip-internal' },
      '/real.ts': { default: 'keep' },
    }
    const result = autoImport({
      modules,
      filter: (path) => path.endsWith('/index.ts') || path.includes('/_'),
      transform: (_, mod) => mod.default,
    })
    expect(result).toEqual(['keep'])
  })
})
