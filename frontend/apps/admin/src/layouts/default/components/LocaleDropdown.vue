<script setup lang="ts">
/**
 * 头部语言切换下拉（复刻参考仓 LocaleDropdown，接项目 appStore.locale）。
 *
 * 项目 i18n 实例由 App.vue watch appStore.locale 统一同步（含 <html lang> 与
 * 刷新后回灌），本组件只负责写入 setLocale。
 *
 * @see `@vv/shared` store/modules/app —— locale / setLocale
 * @group 布局：Default
 */
import { ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@vv/shared'

const bem = createNamespace('locale-dropdown')

const appStore = useAppStore()
const { t } = useI18n()

/** 面板展开态 —— el-dropdown 无 trigger 状态 class，须手动同步以驱动箭头旋转 */
const open = ref(false)

const OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
] as const

function onCommand(value: string) {
  if (value === 'zh-CN' || value === 'en-US') {
    appStore.setLocale(value)
  }
}

function onVisibleChange(visible: boolean) {
  open.value = visible
}
</script>

<template>
  <!-- @vue-ignore element-plus popper-class 的 EpProp 构造器联合（ClassValue）在 Vue 3.6.0-beta.17 + EP 2.14 下字面量 assignability 失败（运行时正确，type-check 实证）；官方元素级豁免，不依赖 @ts-expect-error 的生成代码行映射 -->
  <el-dropdown
    :class="bem.b()"
    trigger="click"
    popper-class="vv-default-header-popper"
    @command="onCommand"
    @visible-change="onVisibleChange"
  >
    <button :class="bem.e('trigger')" type="button" :aria-label="t('header.switchLanguage')">
      <span :class="bem.e('current')">{{ appStore.locale === 'zh-CN' ? '中文' : 'En' }}</span>
      <el-icon :class="[bem.e('caret'), bem.is('open', open)]" :size="12"><ArrowDown /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="opt in OPTIONS"
          :key="opt.value"
          :command="opt.value"
          :class="bem.is('selected', appStore.locale === opt.value)"
        >
          {{ opt.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-locale-dropdown {
  height: 100%;

  &__trigger {
    display: flex;
    gap: 4px;
    align-items: center;
    height: 100%;
    padding: 0 10px;
    color: var(--top-header-text-color);
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover,
    &:focus-visible {
      color: var(--el-color-primary);
      background: var(--top-header-hover-color);
      outline: none;
    }
  }

  &__current {
    font-size: 13px;
  }

  // 箭头随面板展开旋转 180°
  &__caret {
    transition: transform 160ms ease;

    &.is-open {
      transform: rotate(180deg);
    }
  }
}
</style>
