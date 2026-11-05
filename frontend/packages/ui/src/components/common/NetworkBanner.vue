<script setup lang="ts">
/**
 * NetworkBanner —— 全局「网络连接异常」横幅（纯展示层，无业务逻辑）。
 *
 * 数据源是 useNetworkBanner.ts 的模块级单例 state（全局横幅本就单例，不走 props）：
 * 持续故障计数（count > 1 时 ×N 徽标）；任意请求成功后经 http.ts 恢复信号自动隐藏；
 * 关闭按钮进入 30s 冷却（细节见控制器头注）。Teleport 到 body 顶置，z-index 低于
 * EP ElMessage——错误提示优先级高于常驻横幅。
 *
 * @see [`../../composables/useNetworkBanner.ts`](../../composables/useNetworkBanner.ts) 控制器
 * @group 全局组件
 */
// i18n 在脱离宿主组件树渲染时依赖 appContext 注入（initNetworkBanner 挂载时挂接）
import { useI18n } from 'vue-i18n'
import { dismissNetworkBanner, networkBannerState } from '../../composables/useNetworkBanner'

const bem = createNamespace('network-banner')
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition name="network-banner-fade">
      <div v-if="networkBannerState.visible" :class="bem.b()" role="alert" aria-live="assertive">
        <i-ep-warning-filled :class="bem.e('icon')" aria-hidden="true" />
        <span :class="bem.e('text')">{{ t('error.networkBanner.title') }}</span>
        <span v-if="networkBannerState.count > 1" :class="bem.e('count')">
          ×{{ networkBannerState.count }}
        </span>
        <button
          type="button"
          :class="bem.e('close')"
          :aria-label="t('error.networkBanner.dismiss')"
          @click="dismissNetworkBanner"
        >
          <i-ep-close aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-network-banner {
  /* 层级走全局 token：贴 EP ElMessage(2000+) 之下——瞬时错误提示优先于常驻横幅 */
  position: fixed;
  inset: 0 0 auto 0;
  z-index: var(--z-index-banner);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  /* 色板走 EP warning 系变量：主色变更经 theme-vars.scss 联动，不再硬编码 */
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  border-bottom: 1px solid var(--el-color-warning-light-7);
  font-size: 13px;
  line-height: 1.5;

  &__icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--el-color-warning);
  }

  &__text {
    flex: 1;
  }

  &__count {
    font-weight: 600;
    opacity: 0.8;
  }

  &__close {
    display: inline-flex;
    flex-shrink: 0;
    padding: 2px;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 14px;
    cursor: pointer;

    &:hover {
      opacity: 0.7;
    }
  }
}

/* 具名过渡（防与项目其它 fade 过渡类名冲突）；顶置横幅用「上滑收起」 */
.network-banner-fade-enter-active,
.network-banner-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.network-banner-fade-enter-from,
.network-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
