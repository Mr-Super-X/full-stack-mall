<script setup lang="ts">
/**
 * 首页视图（公开访问）。
 *
 * 纯静态展示（无请求，无需 Loading/Error/Empty 三态）。
 * 真实场景下常替换为 AsyncState + useRequest 的列表/表单/详情模板，
 * 参考 apps/admin/src/modules/user/views/List.vue。
 *
 * @group 业务模块：Home
 */
const bem = createNamespace('__APP_NAME__')
</script>

<template>
  <div :class="bem.b()">
    <h1 :class="bem.e('title')">__APP_NAME__ 首页</h1>
    <p :class="bem.e('hint')">
      本应用由
      <code>pnpm new-app __APP_NAME__</code>
      生成，请按需扩展。
    </p>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-__APP_NAME__ {
  padding: 16px;

  &__title {
    margin: 0 0 8px;
    font-size: var(--font-size-xl, 20px);
    font-weight: var(--font-weight-semibold, 600);
  }

  &__hint {
    color: var(--text-secondary, #666);

    code {
      padding: 2px 6px;
      background: var(--code-bg, rgba(0, 0, 0, 0.05));
      border-radius: 4px;
      font-family: var(--font-family-mono, monospace);
    }
  }
}
</style>
