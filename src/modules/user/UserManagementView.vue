<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  KeyRound,
  LoaderCircle,
  Plus,
  Save,
  Search,
  ToggleLeft,
  UserRoundPen,
} from "lucide-vue-next";
import { ElPagination } from "element-plus";
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
const filters = ref({ username: "", displayName: "", status: "", roleCode: "" });
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
      getUsers({ page: current, pageSize: page.value.pageSize, ...filters.value }),
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
const search = () => load(1);
const resetFilters = () => {
  filters.value = { username: "", displayName: "", status: "", roleCode: "" };
  load(1);
};
const changePageSize = (pageSize: number) => { page.value.pageSize = pageSize; load(1); };
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
  <section class="panel workspace-panel management-list-page">
    <form class="management-filter-form" @submit.prevent="search">
      <div class="management-filter-fields">
        <label class="management-form-item"><span>账号</span><div class="management-input"><Search :size="16" /><input v-model="filters.username" placeholder="输入用户名" /></div></label>
        <label class="management-form-item"><span>显示名称</span><input v-model="filters.displayName" placeholder="输入显示名称" /></label>
        <label class="management-form-item"><span>状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label>
        <label class="management-form-item"><span>角色</span><select v-model="filters.roleCode"><option value="">全部角色</option><option v-for="role in roles" :key="role.roleCode" :value="role.roleCode">{{ role.roleName }}</option></select></label>
      </div>
      <div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button class="primary-btn" type="button" @click="openCreateDrawer"><Plus :size="16" />新增用户</button></div>
    </form>
    <div class="management-list-summary"><span>用户列表</span><small>共 {{ page.total }} 个用户</small></div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="table-wrap management-table-wrap"><table class="data-table user-management-table"><colgroup><col class="user-name-column" /><col class="user-account-column" /><col class="user-role-column" /><col class="user-status-column" /><col class="management-actions-column" /></colgroup><thead><tr><th>显示名称</th><th>账号</th><th>角色</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="user in users" :key="user.id"><td><strong>{{ user.displayName }}</strong></td><td class="mono">{{ user.username }}</td><td>{{ user.roles.join(" · ") || "--" }}</td><td><span class="status-badge" :class="'st-' + user.status.toLowerCase()">{{ user.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td><td class="actions"><div class="management-row-actions"><button class="outline-btn" type="button" @click="select(user)"><UserRoundPen :size="16" />编辑</button><button class="outline-btn" type="button" @click="updateStatus(user)"><ToggleLeft :size="16" />{{ user.status === "ACTIVE" ? "停用" : "启用" }}</button></div></td></tr><tr v-if="!users.length"><td colspan="5" class="empty">暂无符合条件的用户</td></tr></tbody></table></div>
    <div class="management-pagination"><ElPagination background layout="sizes, total, prev, pager, next" :current-page="page.current" :page-size="page.pageSize" :page-sizes="[20, 50, 100]" :total="page.total" :hide-on-single-page="false" @current-change="load" @size-change="changePageSize" /></div>
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
