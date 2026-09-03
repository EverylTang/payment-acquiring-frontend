<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ToggleLeft,
  UserRoundPen,
} from "lucide-vue-next";
import {
  changeUserStatus,
  createUser,
  getRoles,
  getUserDataScope,
  getUsers,
  resetUserPassword,
  updateUser,
  updateUserDataScope,
  type AdminUser,
} from "./api";
import type { AdminRole } from "../permission/api";
import AppDrawer from "../../components/AppDrawer.vue";

const users = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const selected = ref<AdminUser | null>(null);
const createDrawerOpen = ref(false);
const editDrawerOpen = ref(false);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const assignedMerchants = ref("");
const resetPassword = ref("");
const loading = ref(false);
const saving = ref(false);
const form = ref({
  username: "",
  password: "",
  displayName: "",
  roles: ["OPS"] as string[],
});
const emit = defineEmits<{ notice: [message: string] }>();

const resetCreateForm = () => {
  form.value = { username: "", password: "", displayName: "", roles: ["OPS"] };
};

const openCreateDrawer = () => {
  resetCreateForm();
  createDrawerOpen.value = true;
};

const closeCreateDrawer = () => {
  if (saving.value) return;
  createDrawerOpen.value = false;
  resetCreateForm();
};

const closeEditDrawer = () => {
  if (saving.value) return;
  editDrawerOpen.value = false;
  selected.value = null;
  assignedMerchants.value = "";
  resetPassword.value = "";
};

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const [userPage, rolePage] = await Promise.all([
      getUsers({ page: current, pageSize: page.value.pageSize }),
      getRoles(),
    ]);
    users.value = userPage.items;
    page.value = {
      current: userPage.page,
      pageSize: userPage.pageSize,
      total: userPage.total,
    };
    roles.value = rolePage.items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户加载失败");
  } finally {
    loading.value = false;
  }
};
const create = async () => {
  saving.value = true;
  try {
    const user = await createUser(form.value);
    users.value = [user, ...users.value];
    createDrawerOpen.value = false;
    resetCreateForm();
    emit("notice", "用户创建成功");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户创建失败");
  } finally {
    saving.value = false;
  }
};
const select = async (user: AdminUser) => {
  selected.value = { ...user, roles: [...user.roles] };
  resetPassword.value = "";
  assignedMerchants.value = "";
  editDrawerOpen.value = true;
  try {
    assignedMerchants.value = (await getUserDataScope(user.id)).merchantIds.join(", ");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户数据范围加载失败");
  }
};
const saveUser = async () => {
  if (!selected.value) return;
  saving.value = true;
  try {
    const user = await updateUser(selected.value.id, {
      displayName: selected.value.displayName,
      roles: selected.value.roles,
    });
    selected.value = user;
    users.value = users.value.map((item) => (item.id === user.id ? user : item));
    emit("notice", "用户资料与角色已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户保存失败");
  } finally {
    saving.value = false;
  }
};
const saveScope = async () => {
  if (!selected.value) return;
  saving.value = true;
  try {
    const merchantIds = assignedMerchants.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    await updateUserDataScope(selected.value.id, merchantIds);
    emit("notice", "用户商户数据范围已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "数据范围保存失败");
  } finally {
    saving.value = false;
  }
};
const updateStatus = async (user: AdminUser) => {
  try {
    const result = await changeUserStatus(
      user.id,
      user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
    );
    users.value = users.value.map((item) => (item.id === result.id ? result : item));
    if (selected.value?.id === result.id) selected.value = result;
    emit("notice", "用户状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "用户状态更新失败");
  }
};
const savePassword = async () => {
  if (!selected.value || !resetPassword.value) return;
  saving.value = true;
  try {
    await resetUserPassword(selected.value.id, resetPassword.value);
    resetPassword.value = "";
    emit("notice", "密码已重置");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "密码重置失败");
  } finally {
    saving.value = false;
  }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div><span class="eyebrow">SYSTEM USERS</span><h3>用户管理</h3></div>
      <div class="button-row">
        <button class="outline-btn" @click="load()"><RefreshCw :size="16" />刷新</button>
        <button class="primary-btn" @click="openCreateDrawer"><Plus :size="16" />新增用户</button>
      </div>
    </div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else-if="!users.length" class="empty">暂无用户</div>
    <div v-else class="record-list">
      <div v-for="user in users" :key="user.id" class="record-row">
        <div><strong>{{ user.displayName }} · {{ user.username }}</strong><small>{{ user.roles.join(" · ") }}</small></div>
        <span class="status-badge" :class="'st-' + user.status.toLowerCase()">{{ user.status }}</span>
        <div class="button-row"><button class="icon-btn" title="编辑用户" @click="select(user)"><UserRoundPen :size="16" /></button><button class="icon-btn" title="切换用户状态" @click="updateStatus(user)"><ToggleLeft :size="16" /></button></div>
      </div>
    </div>
    <div v-if="page.total > page.pageSize" class="pagination"><button class="outline-btn" :disabled="page.current <= 1" @click="load(page.current - 1)">上一页</button><span>第 {{ page.current }} / {{ Math.ceil(page.total / page.pageSize) }} 页，共 {{ page.total }} 人</span><button class="outline-btn" :disabled="page.current >= Math.ceil(page.total / page.pageSize)" @click="load(page.current + 1)">下一页</button></div>
  </section>
  <AppDrawer v-if="createDrawerOpen" title="新增用户" description="SYSTEM USERS" @close="closeCreateDrawer">
    <form class="drawer-section user-form" @submit.prevent="create">
      <div class="user-form-fields">
        <label class="form-field"><span>用户名</span><input v-model="form.username" autocomplete="username" placeholder="请输入用户名" /></label>
        <label class="form-field"><span>显示名称</span><input v-model="form.displayName" placeholder="请输入显示名称" /></label>
        <label class="form-field form-field-full"><span>初始密码</span><input v-model="form.password" autocomplete="new-password" type="password" placeholder="至少 12 位" /></label>
      </div>
      <fieldset class="user-form-section">
        <legend>角色</legend>
        <div class="role-choice">
          <label v-for="role in roles" :key="role.roleCode"><input v-model="form.roles" type="checkbox" :value="role.roleCode" />{{ role.roleName }}</label>
        </div>
      </fieldset>
      <button class="primary-btn drawer-submit" type="submit" :disabled="saving || !form.username || !form.displayName || form.password.length < 12 || !form.roles.length"><Save :size="16" />创建用户</button>
    </form>
  </AppDrawer>
  <AppDrawer v-if="editDrawerOpen && selected" title="编辑用户" :description="selected.username" @close="closeEditDrawer">
    <form class="drawer-section user-form" @submit.prevent="saveUser">
      <div class="user-form-fields">
        <label class="form-field"><span>用户名</span><input :value="selected.username" disabled /></label>
        <label class="form-field"><span>显示名称</span><input v-model="selected.displayName" placeholder="请输入显示名称" /></label>
      </div>
      <fieldset class="user-form-section">
        <legend>角色</legend>
        <div class="role-choice">
          <label v-for="role in roles" :key="role.roleCode"><input v-model="selected.roles" type="checkbox" :value="role.roleCode" />{{ role.roleName }}</label>
        </div>
      </fieldset>
      <button class="primary-btn drawer-submit" type="submit" :disabled="saving || !selected.displayName || !selected.roles.length"><Save :size="16" />保存用户</button>
    </form>
    <section class="drawer-section user-form-section">
      <h4>商户数据范围</h4>
      <label class="form-field"><span>商户 ID</span><input v-model="assignedMerchants" placeholder="多个 ID 请用逗号分隔；留空表示可查看全部商户" /></label>
      <button class="outline-btn drawer-submit" :disabled="saving" @click="saveScope">保存商户范围</button>
    </section>
    <section class="drawer-section user-form-section">
      <h4>重置密码</h4>
      <label class="form-field"><span>新密码</span><input v-model="resetPassword" autocomplete="new-password" type="password" placeholder="至少 12 位" /></label>
      <button class="danger-btn drawer-submit" :disabled="saving || resetPassword.length < 12" @click="savePassword"><KeyRound :size="16" />重置密码</button>
    </section>
  </AppDrawer>
</template>
