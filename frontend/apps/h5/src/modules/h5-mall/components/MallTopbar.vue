<script setup lang="ts">
import { useAppRouter } from '@vv/shared'

/**
 * 吸顶栏：品牌字标 + 消息/搜索圆形 iconbtn + 搜索框。
 * 搜索框为"伪输入"：点击整区跳商品列表页并进入输入态（focus=1 由 list.vue 消费自动聚焦）——
 * 复用列表页既有搜索面板，避免在首页再维护一套搜索状态机。
 */
const bem = createNamespace('mall-topbar')
const { router } = useAppRouter()

function goSearch(): void {
  void router.push({ path: '/h5-mall/list', query: { focus: '1' } })
}
</script>

<template>
  <header :class="bem.b()">
    <div :class="bem.e('row')">
      <div :class="bem.e('logo')">
        拙衣
        <em>ZHUOYI</em>
      </div>
      <div :class="bem.e('acts')">
        <button type="button" :class="bem.e('iconbtn')" aria-label="消息通知">
          <svg :class="bem.e('ic')" aria-hidden="true"><use href="#mall-i-bell" /></svg>
        </button>
        <button type="button" :class="bem.e('iconbtn')" aria-label="搜索" @click="goSearch">
          <svg :class="bem.e('ic')" aria-hidden="true"><use href="#mall-i-search" /></svg>
        </button>
      </div>
    </div>
    <!-- 整区可点（含只读 input）：点击跳搜索页；readonly 防键盘弹起，role=button 保证可访问性 -->
    <div :class="bem.e('search')" role="button" tabindex="0" aria-label="搜索商品" @click="goSearch" @keydown.enter="goSearch">
      <svg :class="bem.e('searchic')" aria-hidden="true"><use href="#mall-i-search" /></svg>
      <input
        type="search"
        :class="bem.e('input')"
        placeholder="搜一搜：棉麻 · 陶土色 · 秋风衣"
        aria-label="搜索商品"
        readonly
        tabindex="-1"
      />
      <span :class="bem.e('go')">搜索</span>
    </div>
  </header>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 31px 53px 26px;
  background: var(--mall-bg-page);
  border-bottom: 1px solid var(--mall-line);

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 26px;
  }

  &__logo {
    font-family: var(--mall-font-head);
    font-size: 46px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--mall-ink-1);

    em {
      margin-left: 13px;
      font-family: var(--mall-font-body);
      font-size: 24px;
      font-weight: 400;
      letter-spacing: 7px;
      color: var(--mall-ink-3);
    }
  }

  &__acts {
    display: flex;
    gap: 18px;
  }

  &__iconbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 79px;
    height: 79px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: 50%;
    transition:
      color var(--mall-dur) var(--mall-ease),
      border-color var(--mall-dur) var(--mall-ease);

    &:active {
      color: var(--mall-brand-deep);
      border-color: var(--mall-line-strong);
    }
  }

  &__ic {
    width: 42px;
    height: 42px;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 22px;
    height: 97px;
    padding: 0 35px;
    color: var(--mall-ink-3);
    background: var(--mall-bg-field);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-lg);
  }

  &__searchic {
    flex: none;
    width: 37px;
    height: 37px;
    color: var(--mall-ink-3);
  }

  &__input {
    flex: 1;
    min-width: 0;
    font-family: inherit;
    font-size: 31px;
    color: var(--mall-ink-1);
    background: transparent;
    border: 0;
    outline: 0;

    &::placeholder {
      color: var(--mall-ink-3);
    }
  }

  &__go {
    flex: none;
    padding-left: 26px;
    font-size: 29px;
    letter-spacing: 2px;
    color: var(--mall-brand-deep);
    border-left: 1px solid var(--mall-line-strong);
  }
}
</style>
