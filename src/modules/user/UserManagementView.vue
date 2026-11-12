<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { KeyRound, LoaderCircle, Plus, Save, Search, ToggleLeft, UserRoundPen } from "lucide-vue-next";
import { changeUserStatus, createUser, getRoles, getUserDataScope, getUsers, resetUserPassword, updateUser, updateUserDataScope, updateUserRoles, type AdminUser } from "./api";
import type { AdminRole } from "../permission/api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const users = ref<AdminUser[]>([]), roles = ref<AdminRole[]>([]);
const selected = ref<AdminUser | null>(null);
const createDrawerOpen = ref(false), editDrawerOpen = ref(false);
const page = ref({ current: 1, pageSize: 10, total: 0 });
const filters = ref({ username: "", displayName: "", status: "", roleCode: "" });
const assignedMerchants = ref(""), resetPassword = ref("");
const loading = ref(false), saving = ref(false), rolesLoading = ref(false), scopeLoading = ref(false);
const loadError = ref(""), rolesError = ref(""), scopeError = ref("");
const scopeLoaded = ref(false);
const emptyForm = () => ({ username: "", password: "", displayName: "", roles: [] as string[] });
const form = ref(emptyForm());
const canEditUser = computed(() => hasPermission("system:user:update"));
const canEditRoles = computed(() => canEditUser.value || hasPermission("system:user:role:update"));
const canReadScope = computed(() => hasPermission("system:data-scope:user:list"));
const canWriteScope = computed(() => hasPermission("system:data-scope:user:update"));
const canViewScope = computed(() => canReadScope.value || canWriteScope.value);
const canResetPassword = computed(() => hasPermission("system:user:password:reset"));
const splitCodes = (value: string) => [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))];
const createRoleCodes = ref(""), editRoleCodes = ref("");
watch(createRoleCodes, value => { form.value.roles = splitCodes(value); });
watch(editRoleCodes, value => { if (selected.value) selected.value.roles = splitCodes(value); });
const selectableRoles = computed(() => {
  const items = [...roles.value];
  for (const code of selected.value?.roles || []) {
    if (!items.some(item => item.roleCode === code)) items.push({ id: 0, roleCode: code, roleName: code });
  }
  return items;
});
const validPassword = (value: string) => !!value.trim() && value.length >= 12 && value.length <= 128;
let listRequest = 0, selectionRequest = 0;

const load = async (current = page.value.current) => {
  if (!hasPermission("system:user:list")) return;
  const request = ++listRequest;
  loading.value = true; loadError.value = "";
  try {
    const result = await getUsers({ page: current, pageSize: page.value.pageSize, ...filters.value });
    if (request !== listRequest) return;
    users.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    if (request !== listRequest) return;
    loadError.value = error instanceof Error ? error.message : "用户加载失败";
    emit("notice", loadError.value);
  } finally { if (request === listRequest) loading.value = false; }
};
const loadRoles = async () => {
  if (!hasPermission("system:role:list")) return;
  rolesLoading.value = true; rolesError.value = "";
  try {
    const items: AdminRole[] = [];
    for (let current = 1; ; current += 1) {
      const result = await getRoles({ page: current, pageSize: 100 });
      items.push(...result.items);
      if (items.length >= result.total) break;
      if (!result.items.length) throw new Error("角色目录加载不完整，请重试");
    }
    roles.value = items;
  } catch (error) {
    rolesError.value = error instanceof Error ? error.message : "角色目录加载失败";
    emit("notice", rolesError.value);
  } finally { rolesLoading.value = false; }
};
const search = () => load(1);
const resetFilters = () => { filters.value = { username: "", displayName: "", status: "", roleCode: "" }; void load(1); };
const changePageSize = (pageSize: number) => { page.value.pageSize = pageSize; void load(1); };
const openCreateDrawer = () => {
  if (saving.value || !hasPermission("system:user:create")) return;
  form.value = emptyForm(); createRoleCodes.value = ""; createDrawerOpen.value = true;
};
const closeCreateDrawer = () => {
  if (saving.value) return;
  createDrawerOpen.value = false; form.value = emptyForm(); createRoleCodes.value = "";
};
const closeEditDrawer = () => {
  if (saving.value) return;
  selectionRequest += 1;
  editDrawerOpen.value = false; selected.value = null;
  assignedMerchants.value = ""; resetPassword.value = "";
  scopeLoaded.value = false; scopeLoading.value = false; scopeError.value = "";
};
const create = async () => {
  if (saving.value || !hasPermission("system:user:create") || !form.value.username.trim() || !form.value.displayName.trim() || !validPassword(form.value.password) || !form.value.roles.length) return;
  saving.value = true;
  try {
    await createUser({ ...form.value, username: form.value.username.trim(), displayName: form.value.displayName.trim() });
    createDrawerOpen.value = false; form.value = emptyForm(); createRoleCodes.value = "";
    emit("notice", "用户创建成功");
    await load(1);
  } catch (error) { emit("notice", error instanceof Error ? error.message : "用户创建失败"); }
  finally { saving.value = false; }
};
const select = async (user: AdminUser) => {
  if (saving.value || !(canEditRoles.value || canViewScope.value || canResetPassword.value)) return;
  const request = ++selectionRequest;
  selected.value = { ...user, roles: [...user.roles] };
  editRoleCodes.value = user.roles.join(", ");
  resetPassword.value = ""; assignedMerchants.value = "";
  scopeLoaded.value = false; scopeLoading.value = false; scopeError.value = "";
  editDrawerOpen.value = true;
  if (!canReadScope.value) return;
  scopeLoading.value = true;
  try {
    const result = await getUserDataScope(user.id);
    if (request !== selectionRequest) return;
    assignedMerchants.value = result.merchantIds.join(", "); scopeLoaded.value = true;
  } catch (error) {
    if (request !== selectionRequest) return;
    scopeError.value = error instanceof Error ? error.message : "用户数据范围加载失败";
    emit("notice", scopeError.value);
  } finally { if (request === selectionRequest) scopeLoading.value = false; }
};
const applyUser = (user: AdminUser) => {
  selected.value = { ...user, roles: [...user.roles] };
  editRoleCodes.value = user.roles.join(", ");
  users.value = users.value.map(item => item.id === user.id ? user : item);
};
const saveUser = async () => {
  if (!selected.value || saving.value || !canEditUser.value || !selected.value.displayName.trim() || !selected.value.roles.length) return;
  saving.value = true;
  try {
    applyUser(await updateUser(selected.value.id, { displayName: selected.value.displayName.trim(), roles: selected.value.roles }));
    emit("notice", "用户资料与角色已保存");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "用户保存失败"); }
  finally { saving.value = false; }
};
const saveRoles = async () => {
  if (!selected.value || saving.value || !hasPermission("system:user:role:update") || !selected.value.roles.length) return;
  saving.value = true;
  try { applyUser(await updateUserRoles(selected.value.id, selected.value.roles)); emit("notice", "用户角色已保存"); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "用户角色保存失败"); }
  finally { saving.value = false; }
};
const saveScope = async () => {
  if (!selected.value || saving.value || !canWriteScope.value || scopeLoading.value || scopeError.value || (canReadScope.value && !scopeLoaded.value)) return;
  const merchantIds = splitCodes(assignedMerchants.value);
  const warnings = [];
  if (!canReadScope.value) warnings.push("当前账号不能读取原配置，本次保存会完整替换该用户的商户数据范围。");
  if (!merchantIds.length) warnings.push("商户范围为空将允许查看全部商户。");
  if (warnings.length && !window.confirm(`${warnings.join("\n")}\n确认保存？`)) return;
  saving.value = true;
  try {
    const result = await updateUserDataScope(selected.value.id, merchantIds);
    assignedMerchants.value = result.merchantIds.join(", ");
    emit("notice", "用户商户数据范围已保存");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "数据范围保存失败"); }
  finally { saving.value = false; }
};
const updateStatus = async (user: AdminUser) => {
  if (saving.value || !hasPermission("system:user:status")) return;
  saving.value = true;
  try {
    const result = await changeUserStatus(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    users.value = users.value.map(item => item.id === result.id ? result : item);
    if (selected.value?.id === result.id) selected.value.status = result.status;
    emit("notice", "用户状态已更新");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "用户状态更新失败"); }
  finally { saving.value = false; }
};
const savePassword = async () => {
  if (!selected.value || saving.value || !canResetPassword.value || !validPassword(resetPassword.value)) return;
  saving.value = true;
  try { await resetUserPassword(selected.value.id, resetPassword.value); resetPassword.value = ""; emit("notice", "密码已重置"); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "密码重置失败"); }
  finally { saving.value = false; }
};
onMounted(() => { void load(); void loadRoles(); });
</script>

<template>
  <section class="panel workspace-panel management-list-page">
    <form class="management-filter-form" @submit.prevent="search">
      <div class="management-filter-fields">
        <label class="management-form-item"><span>账号</span><div class="management-input"><Search :size="16" /><input v-model="filters.username" placeholder="输入用户名" /></div></label>
        <label class="management-form-item"><span>显示名称</span><input v-model="filters.displayName" placeholder="输入显示名称" /></label>
        <label class="management-form-item"><span>状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label>
        <label class="management-form-item"><span>角色</span><select v-if="roles.length" v-model="filters.roleCode"><option value="">全部角色</option><option v-for="role in roles" :key="role.roleCode" :value="role.roleCode">{{ role.roleName }}</option></select><input v-else v-model.trim="filters.roleCode" placeholder="输入角色编码" /></label>
      </div>
      <div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button v-if="hasPermission('system:user:create')" class="primary-btn" type="button" :disabled="saving" @click="openCreateDrawer"><Plus :size="16" />新增用户</button></div>
    </form>
    <div class="management-list-summary"><span>用户列表</span><small>共 {{ page.total }} 个用户</small></div>
    <p v-if="loadError" class="user-error" role="alert">{{ loadError }}；下方如有数据为上次加载结果。</p>
    <p v-if="rolesError" class="user-error" role="alert">角色目录：{{ rolesError }}，不影响用户列表；可使用角色编码。</p>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="table-wrap management-table-wrap"><table class="data-table user-management-table"><colgroup><col class="user-name-column" /><col class="user-account-column" /><col class="user-role-column" /><col class="user-status-column" /><col class="management-actions-column" /></colgroup><thead><tr><th>显示名称</th><th>账号</th><th>角色</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="user in users" :key="user.id"><td><strong>{{ user.displayName }}</strong></td><td class="mono">{{ user.username }}</td><td>{{ user.roles.join(" · ") || "--" }}</td><td><span class="status-badge" :class="'st-' + user.status.toLowerCase()">{{ user.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td><td class="actions"><div class="management-row-actions"><button v-if="canEditRoles" class="outline-btn" type="button" :disabled="saving" @click="select(user)"><UserRoundPen :size="16" />{{ canEditUser ? '编辑' : '配置角色' }}</button><button v-if="canViewScope" class="outline-btn" type="button" :disabled="saving" @click="select(user)">数据范围</button><button v-if="canResetPassword" class="outline-btn" type="button" :disabled="saving" @click="select(user)"><KeyRound :size="16" />重置密码</button><button v-if="hasPermission('system:user:status')" class="outline-btn" type="button" :disabled="saving" @click="updateStatus(user)"><ToggleLeft :size="16" />{{ user.status === "ACTIVE" ? "停用" : "启用" }}</button></div></td></tr><tr v-if="!users.length && !loadError"><td colspan="5" class="empty">暂无符合条件的用户</td></tr></tbody></table></div>
    <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" @change="load" @size-change="changePageSize" />
  </section>
  <AppDrawer v-if="createDrawerOpen" title="新增用户" description="SYSTEM USERS" @close="closeCreateDrawer">
    <form class="drawer-section user-form" @submit.prevent="create">
      <fieldset class="user-form-fields" :disabled="saving">
        <label class="form-field"><span>用户名</span><input v-model="form.username" maxlength="64" autocomplete="username" placeholder="请输入用户名" /></label>
        <label class="form-field"><span>显示名称</span><input v-model="form.displayName" placeholder="请输入显示名称" /></label>
        <label class="form-field form-field-full"><span>初始密码</span><input v-model="form.password" maxlength="128" autocomplete="new-password" type="password" placeholder="12–128 位" /></label>
      </fieldset>
      <fieldset class="user-form-section" :disabled="saving || rolesLoading">
        <legend>角色</legend>
        <p v-if="rolesLoading" class="form-help">角色目录加载中…</p>
        <div v-else-if="roles.length" class="role-choice"><label v-for="role in roles" :key="role.roleCode"><input v-model="form.roles" type="checkbox" :value="role.roleCode" />{{ role.roleName }}</label></div>
        <label v-else class="form-field"><span>初始角色编码</span><input v-model="createRoleCodes" placeholder="多个角色编码请用逗号分隔" /><small>角色目录不可用，请明确填写已知角色编码；不会默认授予 OPS。</small></label>
      </fieldset>
      <button v-if="hasPermission('system:user:create')" class="primary-btn drawer-submit" type="submit" :disabled="saving || rolesLoading || !form.username.trim() || !form.displayName.trim() || !validPassword(form.password) || !form.roles.length"><Save :size="16" />创建用户</button>
    </form>
  </AppDrawer>
  <AppDrawer v-if="editDrawerOpen && selected" title="编辑用户" :description="selected.username" @close="closeEditDrawer">
    <form v-if="canEditRoles" class="drawer-section user-form" @submit.prevent="canEditUser ? saveUser() : saveRoles()">
      <fieldset class="user-form-fields" :disabled="saving">
        <label class="form-field"><span>用户名</span><input :value="selected.username" disabled /></label>
        <label class="form-field"><span>显示名称</span><input v-model="selected.displayName" :disabled="!canEditUser" placeholder="请输入显示名称" /></label>
      </fieldset>
      <fieldset class="user-form-section" :disabled="saving || rolesLoading">
        <legend>角色</legend>
        <div v-if="roles.length" class="role-choice"><label v-for="role in selectableRoles" :key="role.roleCode"><input v-model="selected.roles" type="checkbox" :value="role.roleCode" />{{ role.roleName }}</label></div>
        <label v-else class="form-field"><span>角色编码</span><input v-model="editRoleCodes" placeholder="多个角色编码请用逗号分隔" /><small>保留当前角色编码；修改时请确认完整角色集合。</small></label>
      </fieldset>
      <button v-if="canEditUser" class="primary-btn drawer-submit" type="submit" :disabled="saving || !selected.displayName.trim() || !selected.roles.length"><Save :size="16" />保存用户</button>
      <button v-else class="primary-btn drawer-submit" type="submit" :disabled="saving || !selected.roles.length"><Save :size="16" />保存用户角色</button>
    </form>
    <section v-if="canViewScope" class="drawer-section user-form-section">
      <h4>商户数据范围</h4>
      <p v-if="scopeLoading" class="form-help">商户数据范围加载中…</p>
      <p v-if="scopeError" class="user-error" role="alert">{{ scopeError }}；已禁止覆盖保存，请关闭后重试。</p>
      <p v-if="!canReadScope" class="form-help">无原配置查看权限；保存将完整替换范围，需确认。</p>
      <label class="form-field"><span>商户 ID</span><input v-model="assignedMerchants" :disabled="saving || scopeLoading || !!scopeError || !canWriteScope" placeholder="多个 ID 请用逗号分隔；留空表示可查看全部商户" /></label>
      <button v-if="canWriteScope" class="outline-btn drawer-submit" :disabled="saving || scopeLoading || !!scopeError || (canReadScope && !scopeLoaded)" @click="saveScope">保存商户范围</button>
    </section>
    <section v-if="canResetPassword" class="drawer-section user-form-section">
      <h4>重置密码</h4>
      <label class="form-field"><span>新密码</span><input v-model="resetPassword" :disabled="saving" maxlength="128" autocomplete="new-password" type="password" placeholder="12–128 位" /></label>
      <button class="danger-btn drawer-submit" :disabled="saving || !validPassword(resetPassword)" @click="savePassword"><KeyRound :size="16" />重置密码</button>
    </section>
  </AppDrawer>
</template>

<style scoped>
.role-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-height: 42px; }
.role-choice label { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-soft); font-size: 12px; white-space: nowrap; }
.role-choice input { width: auto; height: auto; accent-color: var(--accent); }
.user-form { display: grid; gap: 20px; }
.user-form-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 0; padding: 0; border: 0; min-width: 0; }
.user-form-section { min-width: 0; margin: 0; padding: 20px 0 0; border: 0; border-top: 1px solid var(--line); }
.user-form-section legend, .user-form-section h4 { margin: 0 0 12px; padding: 0; color: var(--ink); font-size: 13px; font-weight: 600; }
.user-form-section .form-field + .drawer-submit { margin-top: 14px; }
.user-error { color: var(--danger); font-size: 12px; }
@media (max-width: 560px) { .user-form-fields { grid-template-columns: 1fr; } }
.user-name-column { width: 20%; }.user-account-column { width: 19%; }.user-role-column { width: 24%; }.user-status-column { width: 12%; }
</style>
