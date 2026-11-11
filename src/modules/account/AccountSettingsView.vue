<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronDown, KeyRound, Languages, LogOut, Palette, UserRound } from "lucide-vue-next";
import AppDrawer from "../../components/AppDrawer.vue";
import { authState, signOut } from "../../auth";
import { changePassword } from "../auth/api";
import { preferences, setLocale, setTheme, type AppLocale, type AppTheme } from "../../preferences";

const emit = defineEmits<{ notice: [message: string] }>();
const accountMenuOpen = ref(false);
const accountDrawer = ref<"password" | null>(null);
const passwordSaving = ref(false);
const passwordForm = ref({ currentPassword: "", newPassword: "", confirmPassword: "" });
const accountCopy = computed(() =>
  preferences.locale === "en-US"
    ? {
        account: "Account",
        changePassword: "Change password",
        language: "Language",
        appearance: "Appearance",
        signOut: "Sign out",
        passwordTitle: "Change password",
        passwordDescription: "ACCOUNT SECURITY",
        currentPassword: "Current password",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        savePassword: "Update password",
        passwordRule: "Use 12 to 128 characters.",
      }
    : {
        account: "账户设置",
        changePassword: "修改密码",
        language: "语言",
        appearance: "界面颜色",
        signOut: "退出登录",
        passwordTitle: "修改密码",
        passwordDescription: "账户安全",
        currentPassword: "当前密码",
        newPassword: "新密码",
        confirmPassword: "确认新密码",
        savePassword: "保存新密码",
        passwordRule: "密码长度为 12 至 128 位。",
      },
);
const openPasswordDrawer = () => {
  accountMenuOpen.value = false;
  passwordForm.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
  accountDrawer.value = "password";
};
const savePassword = async () => {
  if (passwordForm.value.newPassword.length < 12) {
    emit("notice", preferences.locale === "en-US" ? "New password must be at least 12 characters." : "新密码至少需要 12 位。");
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    emit("notice", preferences.locale === "en-US" ? "New passwords do not match." : "两次输入的新密码不一致。");
    return;
  }
  passwordSaving.value = true;
  emit("notice", "");
  try {
    await changePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword);
    passwordForm.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
    accountDrawer.value = null;
    emit("notice", preferences.locale === "en-US" ? "Password updated." : "密码已修改，请妥善保管新密码。");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "密码修改失败");
  } finally {
    passwordSaving.value = false;
  }
};
const selectLocale = (locale: AppLocale) => setLocale(locale);
const selectTheme = (theme: AppTheme) => setTheme(theme);
const handleSignOut = () => {
  accountMenuOpen.value = false;
  signOut();
};
</script>
<template>
  <div class="account-area">
    <button
      class="operator"
      :aria-expanded="accountMenuOpen"
      :title="accountCopy.account"
      @click="accountMenuOpen = !accountMenuOpen"
    >
      <span class="account-avatar"><UserRound :size="16" /></span>
      <span class="operator-info">
        <strong>{{ authState.user?.displayName }}</strong>
        <small>{{ authState.user?.roles.join(" · ") }} · {{ authState.user?.username }}</small>
      </span>
      <ChevronDown class="account-chevron" :size="16" :class="{ open: accountMenuOpen }" />
    </button>
    <div v-if="accountMenuOpen" class="account-menu" role="menu">
      <div class="account-summary">
        <span class="account-avatar"><UserRound :size="16" /></span>
        <div><strong>{{ authState.user?.displayName }}</strong><small>{{ authState.user?.username }}</small></div>
      </div>
      <button class="account-action" role="menuitem" @click="openPasswordDrawer">
        <KeyRound :size="16" /><span>{{ accountCopy.changePassword }}</span>
      </button>
      <div class="account-setting">
        <span class="account-setting-label"><Languages :size="16" />{{ accountCopy.language }}</span>
        <div class="account-segmented" :aria-label="accountCopy.language">
          <button :class="{ active: preferences.locale === 'zh-CN' }" title="简体中文" @click="selectLocale('zh-CN')">中</button>
          <button :class="{ active: preferences.locale === 'en-US' }" title="English" @click="selectLocale('en-US')">EN</button>
        </div>
      </div>
      <div class="account-setting">
        <span class="account-setting-label"><Palette :size="16" />{{ accountCopy.appearance }}</span>
        <div class="theme-swatches" :aria-label="accountCopy.appearance">
          <button class="theme-swatch indigo" :class="{ active: preferences.theme === 'indigo' }" title="Indigo" @click="selectTheme('indigo')"><Check v-if="preferences.theme === 'indigo'" :size="13" /></button>
          <button class="theme-swatch blue" :class="{ active: preferences.theme === 'blue' }" title="Blue" @click="selectTheme('blue')"><Check v-if="preferences.theme === 'blue'" :size="13" /></button>
          <button class="theme-swatch emerald" :class="{ active: preferences.theme === 'emerald' }" title="Emerald" @click="selectTheme('emerald')"><Check v-if="preferences.theme === 'emerald'" :size="13" /></button>
          <button class="theme-swatch midnight" :class="{ active: preferences.theme === 'midnight' }" :title="preferences.locale === 'en-US' ? 'Tech dark' : '科技暗色'" @click="selectTheme('midnight')"><Check v-if="preferences.theme === 'midnight'" :size="13" /></button>
        </div>
      </div>
      <button class="account-action account-signout" role="menuitem" @click="handleSignOut">
        <LogOut :size="16" /><span>{{ accountCopy.signOut }}</span>
      </button>
    </div>
  </div>
  <AppDrawer
    v-if="accountDrawer === 'password'"
    :title="accountCopy.passwordTitle"
    :description="accountCopy.passwordDescription"
    @close="accountDrawer = null"
  >
    <form class="drawer-section password-form" @submit.prevent="savePassword">
      <p class="drawer-copy">{{ accountCopy.passwordRule }}</p>
      <label>
        <span>{{ accountCopy.currentPassword }}</span>
        <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required />
      </label>
      <label>
        <span>{{ accountCopy.newPassword }}</span>
        <input v-model="passwordForm.newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
      </label>
      <label>
        <span>{{ accountCopy.confirmPassword }}</span>
        <input v-model="passwordForm.confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
      </label>
      <button class="primary-btn drawer-submit" type="submit" :disabled="passwordSaving">
        {{ accountCopy.savePassword }}
      </button>
    </form>
  </AppDrawer>
</template>
