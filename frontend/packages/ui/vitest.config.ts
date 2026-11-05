/**
 * @vv/ui 单测配置（vitest）
 *
 * 与 apps/admin/vitest.config.ts 的关系：admin 侧 mergeConfig(完整 vite 工厂配置)；
 * 本包按「最小可用」原则只装配组件测试必需的插件，语义与工厂逐项对齐：
 *
 * - vue 插件：包内含 .vue SFC（与 @vv/shared 纯 ts 形态的差异点）
 * - AutoImport：vue/vue-router/pinia 预设 + ElementPlusResolver + @vv/shared 业务注入，
 *   覆盖包内源码按 app 约定书写的注入式全局（ref / createNamespace / useDict / useAuth 等）；
 *   dts 关闭——类型层由 src/types/auto-globals.d.ts 手工同构子集承担（同 @vv/shared 约定）
 * - Components：dirs 指包内三组件目录——模板内 <XForm> / <ProDialog> 等跨组件标签的
 *   编译期解析依赖它（与 app 侧全局注册机制等价）；dts 关闭（**\/src/types/components.d.ts
 *   全局 gitignore，类型检查不依赖生成物；非 strictTemplates 下未知标签不报错）
 * - Icons：registry.ts 与 AppDynamicIcon.vue 依赖 virtual:icons/* 虚拟模块，
 *   global-plugin.spec.ts 的 eager glob 会真实加载 AppDynamicIcon → 必须装配；
 *   customCollections 与工厂同源（app 集合指包内 assets/icons，fill/stroke → currentColor）
 * - scss：与工厂同源 createScssPreprocessorOptions，bemPath 指包内 assets——css:true 下
 *   <style lang="scss"> 的 $BEM_PREFIX 注入缺失会直接 sass 编译失败
 * - resolve.alias：createAppAliases(自身) 作安全网（包内规范是相对路径 + 包名引用，
 *   别名不应被命中；留着防存量遗漏静默漂移）
 * - server.deps.inline：element-plus ESM/CJS 互操作（与 admin 配置一致）
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig, configDefaults } from 'vitest/config'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import { createAppAliases, createScssPreprocessorOptions } from '@vv/config'

const pkgRoot = fileURLToPath(new URL('./', import.meta.url))
const srcDir = path.join(pkgRoot, 'src')

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        // 与工厂 create-vite-config.ts 的 @vv/shared 注入清单保持同构（包内消费子集）
        { from: '@vv/shared', imports: [{ name: 'createNamespace' }] },
        { from: '@vv/shared', imports: [{ name: 'useDict' }] },
        { from: '@vv/shared', imports: [{ name: 'useAuth' }] },
      ],
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: false,
    }),
    Icons({
      compiler: 'vue3',
      customCollections: {
        app: FileSystemIconLoader(path.join(srcDir, 'assets/icons'), (svg) =>
          svg
            .replace(/fill="(?!none")[^"]*"/g, 'fill="currentColor"')
            .replace(/stroke="(?!none")[^"]*"/g, 'stroke="currentColor"')
        ),
      },
    }),
    Components({
      resolvers: [
        ElementPlusResolver({ importStyle: 'css' }),
        IconsResolver({
          prefix: 'i',
          enabledCollections: ['ep', 'tabler'],
          customCollections: ['app'],
        }),
      ],
      dirs: [
        path.join(srcDir, 'components/common'),
        path.join(srcDir, 'components/ProTable'),
        path.join(srcDir, 'components/form-schema'),
      ],
      deep: true,
      dts: false,
    }),
  ],
  resolve: { alias: createAppAliases(pkgRoot, pkgRoot) },
  css: {
    preprocessorOptions: {
      scss: createScssPreprocessorOptions({
        bemPath: path.join(srcDir, 'styles/tools/bem'),
      }),
    },
  },
  test: {
    environment: 'jsdom',
    root: pkgRoot,
    globals: true,
    exclude: [...configDefaults.exclude],
    css: true,
    server: {
      deps: {
        inline: ['element-plus', '@element-plus/icons-vue'],
      },
    },
  },
})
