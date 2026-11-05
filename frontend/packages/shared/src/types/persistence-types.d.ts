/**
 * pinia-plugin-persistedstate 模块增强（DefineSetupStoreOptions.persist 选项类型）。
 *
 * store/modules/{app,theme}.ts 的 persist 选项类型依赖本增强。本文件只承载类型增强——
 * shared 生产源码已全量显式 import（P0），不再有任何「运行时全局变量」声明。
 * 原 auto-globals.d.ts 的伪全局（ref/defineStore/ElMessage 等）已随显式导入迁移退役。
 */
import 'pinia-plugin-persistedstate'

export {}
