<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import { reactive } from 'vue'
import { useAuthForm } from '../composables/useAuthForm'

/**
 * 注册页：用户名/密码/昵称注册，成功后跳转登录页（不自动登录）。
 */
const bem = createNamespace('mall-register')

// 项目 composable @vv/shared（vite 自动注入）
const { replaceByName, back } = useAppRouter()

const form = reactive({
  username: '',
  password: '',
  nickname: '',
})

const { loading, error, submit } = useAuthForm('register', form)

async function onSubmit(): Promise<void> {
  await submit()
  if (!error.value) {
    // 注册成功：跳登录页
    await replaceByName('H5MallLogin')
  }
}
</script>

<template>
  <div :class="bem.b()">
    <van-nav-bar title="注册" left-arrow @click-left="back()" />

    <van-form :class="bem.e('form')" @submit="onSubmit">
      <van-cell-group inset>
        <van-field
          v-model="form.username"
          name="username"
          label="用户名"
          placeholder="4~20 位字母、数字或下划线"
          :rules="[{ required: true, message: '请输入用户名' }]"
        />
        <van-field
          v-model="form.password"
          type="password"
          name="password"
          label="密码"
          placeholder="6~20 位"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
        <van-field
          v-model="form.nickname"
          name="nickname"
          label="昵称"
          placeholder="选填，最长 20 字"
        />
      </van-cell-group>

      <!-- 错误提示 -->
      <div v-if="error" :class="bem.e('error')">{{ error.message }}</div>

      <div :class="bem.e('actions')">
        <van-button
          round
          block
          type="primary"
          native-type="submit"
          :loading="loading"
          :disabled="loading"
        >
          注册
        </van-button>
        <van-button round block plain type="primary" to="/h5-mall/login">
          已有账号，去登录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-mall-register {
  min-height: 100vh;
  min-height: 100dvh;
  font-family: var(--mall-font-body);
  background: var(--mall-bg-page);

  &__form {
    margin-top: 53px;
  }

  &__error {
    margin: 26px 53px 0;
    padding: 18px 26px;
    font-size: 26px;
    color: #c0392b;
    background: #fdf2f0;
    border-radius: var(--mall-r-sm);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 26px;
    margin: 53px;
  }
}
</style>
