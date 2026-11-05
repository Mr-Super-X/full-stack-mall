<script setup lang="ts">
/**
 * 登录页左品牌区：深灰绿渐变 + 柔光 blob + 产品名 + 六端 chips
 * + 纯 CSS 设备插画（显示器/笔记本/手机）+ 三特性行（SSO/多因子/审计）。
 *
 * 纯展示组件，数据由 Login.vue 传入。
 */
interface Props {
  /** 产品名（VITE_APP_TITLE） */
  appTitle: string
}
defineProps<Props>()

const bem = createNamespace('login')
</script>

<template>
  <aside :class="bem.e('brand')">
    <div :class="[bem.e('brand-blob'), bem.em('brand-blob', 'a')]" aria-hidden="true" />
    <div :class="[bem.e('brand-blob'), bem.em('brand-blob', 'b')]" aria-hidden="true" />

    <header :class="bem.e('brand-top')">
      <div :class="bem.e('brand-logo')" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="1.6"
          stroke-linecap="round"
        >
          <circle cx="12" cy="8.6" r="4.6" />
          <circle cx="8.4" cy="15.2" r="4.6" />
          <circle cx="15.6" cy="15.2" r="4.6" />
        </svg>
      </div>
      <div :class="bem.e('brand-name')">
        <strong>{{ appTitle }}</strong>
        <span>UNIFIED IDENTITY PLATFORM</span>
      </div>
    </header>

    <div :class="bem.e('brand-main')">
      <h1 :class="bem.e('brand-title')">
        一次登录
        <br />
        多端通行
      </h1>
      <p :class="bem.e('brand-desc')">
        面向门户、管理后台、数据大屏、组件文档与移动 H5 的企业级统一登录。一处认证，处处可达。
      </p>

      <div :class="bem.e('chips')">
        <span :class="[bem.e('chip'), bem.em('chip', 'portal')]">
          <i :class="bem.e('chip-dot--portal')" />
          门户
        </span>
        <span :class="[bem.e('chip'), bem.em('chip', 'admin')]">
          <i :class="bem.e('chip-dot--admin')" />
          管理后台
        </span>
        <span :class="[bem.e('chip'), bem.em('chip', 'big')]">
          <i :class="bem.e('chip-dot--big')" />
          数据大屏
        </span>
        <span :class="[bem.e('chip'), bem.em('chip', 'docs')]">
          <i :class="bem.e('chip-dot--docs')" />
          组件文档
        </span>
        <span :class="[bem.e('chip'), bem.em('chip', 'h5')]">
          <i :class="bem.e('chip-dot--h5')" />
          移动 H5
        </span>
      </div>

      <!-- 纯 CSS 设备插画 -->
      <div :class="bem.e('mockups')" aria-hidden="true">
        <div :class="[bem.e('device'), bem.em('device', 'monitor')]">
          <div :class="bem.e('mo-screen')">
            <i :class="[bem.e('mo-bar'), bem.em('mo-bar', 'a')]" />
            <i :class="[bem.e('mo-bar'), bem.em('mo-bar', 'b')]" />
            <i :class="[bem.e('mo-bar'), bem.em('mo-bar', 'c')]" />
          </div>
          <div :class="bem.e('mo-stand')" />
          <div :class="bem.e('mo-base')" />
        </div>
        <div :class="[bem.e('device'), bem.em('device', 'laptop')]">
          <div :class="bem.e('la-screen')">
            <i />
            <i />
            <i />
          </div>
          <div :class="bem.e('la-base')" />
        </div>
        <div :class="[bem.e('device'), bem.em('device', 'phone')]">
          <div :class="bem.e('phone-body')">
            <div :class="bem.e('ph-screen')">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer :class="bem.e('brand-foot')">
      <div :class="bem.e('feat')">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" />
          <path d="M9.4 12.2l1.9 1.9 3.6-3.7" />
        </svg>
        <div>
          <strong>单点登录 SSO</strong>
          <span>一次认证，免密通行</span>
        </div>
      </div>
      <div :class="bem.e('feat')">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="5" y="11" width="14" height="9" rx="2.2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <div>
          <strong>多因子认证</strong>
          <span>密码 · Cookie · 白名单</span>
        </div>
      </div>
      <div :class="bem.e('feat')">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
        <div>
          <strong>安全审计</strong>
          <span>登录行为全程可追溯</span>
        </div>
      </div>
    </footer>
  </aside>
</template>
