<script setup lang="ts">
import { ref } from 'vue';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-vue-next';
import { signIn } from './auth';

const username = ref('admin');
const password = ref('');
const busy = ref(false);
const error = ref('');

const submit = async () => {
  busy.value = true;
  error.value = '';
  try { await signIn(username.value, password.value); }
  catch { error.value = '用户名或密码错误'; }
  finally { busy.value = false; }
};
</script>

<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="brand login-brand"><span class="brand-mark">P</span><div><strong>PAYMENT OS</strong><small>ACQUIRING CONTROL</small></div></div>
      <div><span class="eyebrow">SECURE OPERATIONS</span><h1>让每一笔交易，<br />都在掌控之中。</h1><p>统一管理支付配置、渠道路由、风险策略与资金流向。</p></div>
      <div class="security-note"><ShieldCheck :size="18" /><span>受 JWT 与角色权限保护</span></div>
    </section>
    <section class="login-panel">
      <form @submit.prevent="submit">
        <span class="eyebrow">OPERATOR ACCESS</span><h2>登录运营控制台</h2><p>请输入管理员账号继续。</p>
        <label>账号<input v-model="username" autocomplete="username" required /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button class="primary-btn login-submit" :disabled="busy"><LoaderCircle v-if="busy" class="spin" :size="17" /><template v-else>安全登录<ArrowRight :size="17" /></template></button>
      </form>
    </section>
  </main>
</template>
