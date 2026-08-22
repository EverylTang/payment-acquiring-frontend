<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, RefreshCw } from "lucide-vue-next";
import {
  createUser,
  getRoles,
  getUsers,
  type AdminRole,
  type AdminUser,
} from "../../api";
const users = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const loading = ref(false);
const form = ref({ username: "", password: "", displayName: "", roles: "OPS" });
const emit = defineEmits<{ notice: [message: string] }>();
const load = async () => {
  loading.value = true;
  try {
    const [userPage, rolePage] = await Promise.all([getUsers(), getRoles()]);
    users.value = userPage.items;
    roles.value = rolePage.items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户加载失败");
  } finally {
    loading.value = false;
  }
};
const create = async () => {
  try {
    const user = await createUser({
      ...form.value,
      roles: form.value.roles
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
    });
    users.value = [user, ...users.value];
    form.value = { username: "", password: "", displayName: "", roles: "OPS" };
    emit("notice", "用户创建成功");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户创建失败");
  }
};
onMounted(load);
</script>
<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">SYSTEM USERS</span>
        <h3>用户管理</h3>
      </div>
      <button class="outline-btn" @click="load">
        <RefreshCw :size="16" />刷新
      </button>
    </div>
    <div class="form-grid binding-form">
      <input v-model="form.username" placeholder="用户名" /><input
        v-model="form.displayName"
        placeholder="显示名"
      /><input
        v-model="form.password"
        type="password"
        placeholder="初始密码（至少 12 位）"
      /><select v-model="form.roles">
        <option
          v-for="role in roles"
          :key="role.roleCode"
          :value="role.roleCode"
        >
          {{ role.roleName }}（{{ role.roleCode }}）
        </option></select
      ><button class="primary-btn" @click="create">创建用户</button>
    </div>
    <div v-if="loading" class="empty">
      <LoaderCircle class="spin" :size="22" />加载中…
    </div>
    <div v-else-if="!users.length" class="empty">暂无用户</div>
    <div v-else class="record-list">
      <div v-for="user in users" :key="user.id" class="record-row">
        <div>
          <strong>{{ user.displayName }} · {{ user.username }}</strong
          ><small>{{ user.roles.join(" · ") }}</small>
        </div>
        <b>{{ user.status }}</b>
      </div>
    </div>
  </section>
</template>
