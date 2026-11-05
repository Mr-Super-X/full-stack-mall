<script setup lang="ts">
/**
 * SVG 线稿符号库（stroke 继承 currentColor，颜色一律走模块 token）。
 *
 * 全页唯一 sprite：各区块组件经 `<use href="#mall-i-xxx" />` / `#mall-g-xxx` 引用，
 * id 前缀 mall- 防跨模块撞名；商品线稿（g-）为 96 视箱，图标（i-）为 24 视箱。
 */
const bem = createNamespace('mall-sprite')
</script>

<template>
  <svg :class="bem.b()" width="0" height="0" aria-hidden="true">
    <defs>
      <!-- 通用图标（24 视箱） -->
      <symbol id="mall-i-search" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M16.5 16.5 21 21"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="mall-i-bell" viewBox="0 0 24 24">
        <path
          d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M10.5 19.5a1.8 1.8 0 0 0 3 0"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="mall-i-heart" viewBox="0 0 24 24">
        <path
          d="M12 20s-7-4.5-9-9c-1.3-3 1-7 4.5-7 2 0 3.5 1 4.5 3 1-2 2.5-3 4.5-3C20.3 4 22.6 8 21.3 11c-2 4.5-9.3 9-9.3 9z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-home" viewBox="0 0 24 24">
        <path
          d="M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-grid" viewBox="0 0 24 24">
        <g fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </g>
      </symbol>
      <symbol id="mall-i-bag" viewBox="0 0 24 24">
        <path
          d="M6.5 8h11l1.2 12H5.3z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="mall-i-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M4.5 20.5c1.4-3.6 4.6-5 7.5-5s6.1 1.4 7.5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="mall-i-truck" viewBox="0 0 24 24">
        <path
          d="M2.5 7h11v9h-11zM13.5 10h4.5l3 3.2V16h-7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <circle cx="6.5" cy="18" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5" />
        <circle cx="17" cy="18" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5" />
      </symbol>
      <symbol id="mall-i-return" viewBox="0 0 24 24">
        <path
          d="M4.5 10a8 8 0 0 1 14.2-2.8M19.5 14a8 8 0 0 1-14.2 2.8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M18.9 3.5v3.8h-3.8M5.1 20.5v-3.8h3.8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-shield" viewBox="0 0 24 24">
        <path
          d="M12 3l7 2.8V12c0 4.8-3.3 7.4-7 9-3.7-1.6-7-4.2-7-9V5.8z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M9 11.5l2.2 2.2L15.5 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-arrow" viewBox="0 0 24 24">
        <path
          d="M5 12h13M13 6.5 18.5 12 13 17.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M8 12.2l2.8 2.8L16.5 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <!-- 金刚区小图标 -->
      <symbol id="mall-i-spark" viewBox="0 0 24 24">
        <path
          d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-dress-s" viewBox="0 0 24 24">
        <path
          d="M9.5 3.5 12 5.8 14.5 3.5l1.7 3.4-1.7 1.8 1.4 11.3H8.1L9.5 8.7 7.8 6.9z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-coat-s" viewBox="0 0 24 24">
        <path
          d="M9 4h6l4.5 3.5-2.6 3-1.4-1V20H8.5V9.5l-1.4 1-2.6-3z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M12 4l-1.8 3.5L12 10l1.8-2.5z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="mall-i-shoe-s" viewBox="0 0 24 24">
        <path
          d="M3 16.5c0-2 1.4-3 3.3-3.2l3.7-3.3c1.5 2 4 3.2 6.5 3.2 2.6 0 4.5 1.6 4.5 3.5v1.8H3z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path d="M3 18.5h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </symbol>
      <symbol id="mall-i-gem-s" viewBox="0 0 24 24">
        <path
          d="M7.5 9 10 5h4l2.5 4L12 19z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path d="M7.5 9h9" stroke="currentColor" stroke-width="1.5" />
      </symbol>
      <!-- 商品线稿（96 视箱） -->
      <symbol id="mall-g-shirt" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M36 20h24l14 9-7 10-7-4v45H36V35l-7 4-7-10z" />
          <path d="M42 20l6 9 6-9" />
          <path d="M48 32v48" />
          <circle cx="48" cy="42" r="1.3" />
          <circle cx="48" cy="54" r="1.3" />
          <circle cx="48" cy="66" r="1.3" />
        </g>
      </symbol>
      <symbol id="mall-g-sweater" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M34 22h28l14 10-8 11-6-4v39H34V39l-6 4-8-11z" />
          <path d="M41 22a7 5 0 0 0 14 0" />
          <path d="M34 70h28" />
        </g>
      </symbol>
      <symbol id="mall-g-trench" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M37 16l11 10 11-10 12 7-7 13v44H32V36l-7-13z" />
          <path d="M37 16l11 10-9 9M59 16 48 26l9 9" />
          <path d="M32 50h32" />
          <path d="M48 38v42" />
        </g>
      </symbol>
      <symbol id="mall-g-skirt" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M33 28h30v8H33z" />
          <path d="M33 36l-7 38c14 6 30 6 44 0l-7-38z" />
          <path d="M43 38l-2 34M53 38l2 34" />
        </g>
      </symbol>
      <symbol id="mall-g-tshirt" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M32 22h32l14 10-8 11-6-4v31H32V39l-6 4-8-11z" />
          <path d="M41 22a7 6 0 0 0 14 0" />
        </g>
      </symbol>
      <symbol id="mall-g-pants" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M34 20h28l2 60H52l-4-44-4 44H32z" />
          <path d="M34 28h28" />
        </g>
      </symbol>
      <symbol id="mall-g-shoe" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M14 64c0-7 5-11 13-12l13-10c6 6 14 9 23 9 11 0 19 5 19 13v4H14z" />
          <path d="M14 68h68" />
          <path d="M44 46l7 6" />
        </g>
      </symbol>
      <symbol id="mall-g-tote" viewBox="0 0 96 96">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          <path d="M28 34h40l5 44H23z" />
          <path d="M38 34v-5a10 9 0 0 1 20 0v5" />
          <path d="M30 52h36" />
        </g>
      </symbol>
    </defs>
  </svg>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-sprite {
  position: absolute;
}
</style>
