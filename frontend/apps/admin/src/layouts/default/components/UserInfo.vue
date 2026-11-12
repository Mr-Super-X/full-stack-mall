<script setup lang="ts">
/**
 * 头部用户信息下拉：字母头像 + 用户名 + 退出登录。
 *
 * 复刻参考仓 UserInfo 的交互（头像 + 下拉退出），差异：
 * - 项目无头像图片资产，用姓名首字母圆形头像（与 portal 布局头部一致）
 * - 退出流程走项目 useLogout().confirmLogout（二次确认 + loading 统一处理）
 *
 * @see `@vv/ui/composables/useLogout` 退出登录流程
 * @see `@vv/shared` store/modules/user —— 用户登录态
 * @group 布局：Default
 */
import { ArrowDown, SwitchButton } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@vv/shared'

const bem = createNamespace('user-info')

const userStore = useUserStore()
const { loggingOut, confirmLogout } = useLogout()
const { t } = useI18n()

/** 面板展开态 —— el-dropdown 无 trigger 状态 class，须手动同步以驱动箭头旋转 */
const open = ref(false)

const userName = computed(() => userStore.profile?.name ?? '游客')
const avatarText = computed(() => userStore.profile?.name?.charAt(0) ?? '?')

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
    @command="confirmLogout"
    @visible-change="onVisibleChange"
  >
    <button :class="bem.e('trigger')" type="button" aria-haspopup="menu">
      <span :class="bem.e('avatar')">{{ avatarText }}</span>
      <span :class="bem.e('name')">{{ userName }}</span>
      <el-icon :class="[bem.e('caret'), bem.is('open', open)]" :size="12"><ArrowDown /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="logout" :disabled="loggingOut">
          <el-icon><SwitchButton /></el-icon>
          <span>{{ loggingOut ? t('header.loggingOut') : t('header.logout') }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-user-info {
  height: 100%;

  &__trigger {
    display: flex;
    gap: 8px;
    align-items: center;
    height: 100%;
    padding: 0 12px;
    color: var(--top-header-text-color);
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover,
    &:focus-visible {
      background: var(--top-header-hover-color);
      outline: none;
    }
  }

  &__avatar {
    display: grid;
    width: 26px;
    height: 26px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-color-white);
    background: var(--el-color-primary);
    border-radius: 50%;
    place-items: center;
  }

  &__name {
    font-size: 13px;
  }

  &__caret {
    color: var(--el-text-color-secondary);
    transition: transform 160ms ease;

    &.is-open {
      transform: rotate(180deg);
    }
  }
}
</style>
