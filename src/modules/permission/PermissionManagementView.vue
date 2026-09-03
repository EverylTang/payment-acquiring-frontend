<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import {
  getPermissionCatalog,
  getRoleDataScope,
  getRolePermissions,
  getRoles,
  updateRolePermissions,
  updateRoleDataScope,
  type AdminRole,
  type PermissionCatalog,
} from "./api";
import { hasPermission } from "../../auth";
import AppPagination from "../../components/AppPagination.vue";
const emit = defineEmits<{ notice: [message: string] }>();
const roles = ref<AdminRole[]>([]);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const catalog = ref<PermissionCatalog | null>(null);
const selectedRole = ref("");
const menus = ref<string[]>([]);
const permissions = ref<string[]>([]);
const scopeTypes = ref<string[]>([]);
const load = async (current = page.value.current) => {
  try {
    const [rolePage, value] = await Promise.all([
      getRoles({ page: current, pageSize: page.value.pageSize }),
      getPermissionCatalog(),
    ]);
    roles.value = rolePage.items;
    page.value = { current: rolePage.page, pageSize: rolePage.pageSize, total: rolePage.total };
    catalog.value = value;
    await select(roles.value[0]?.roleCode || "");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "权限加载失败");
  }
};
const select = async (role: string) => {
  if (!role) return;
  selectedRole.value = role;
  const [value, scope] = await Promise.all([
    getRolePermissions(role),
    getRoleDataScope(role),
  ]);
  menus.value = value.menuCodes;
  permissions.value = value.permissionCodes;
  scopeTypes.value = scope.scopeTypes;
};
const saveScope = async () => {
  try {
    await updateRoleDataScope(selectedRole.value, scopeTypes.value);
    emit("notice", "角色数据范围已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "数据范围保存失败");
  }
};
const save = async () => {
  try {
    await updateRolePermissions(selectedRole.value, {
      menuCodes: menus.value,
      permissionCodes: permissions.value,
    });
    emit("notice", "角色权限已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "权限保存失败");
  }
};
onMounted(load);
</script>
<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">ACCESS CONTROL</span>
        <h3>角色权限配置</h3>
      </div>
      <button class="outline-btn" @click="() => load()">
        <RefreshCw :size="16" />刷新
      </button>
    </div>
    <div class="split-panel">
      <div class="role-list">
        <button
          v-for="role in roles"
          :key="role.roleCode"
          :class="{ active: selectedRole === role.roleCode }"
          @click="select(role.roleCode)"
        >
          {{ role.roleName }}<small>{{ role.roleCode }}</small>
        </button>
        <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" noun="个角色" @change="load" />
      </div>
      <div>
        <h4>菜单权限</h4>
        <div class="check-grid">
          <label v-for="item in catalog?.menus || []" :key="item.menuCode"
            ><input v-model="menus" type="checkbox" :value="item.menuCode" />{{
              item.menuName
            }}</label
          >
        </div>
        <h4>操作权限</h4>
        <div class="check-grid">
          <label
            v-for="item in catalog?.permissions || []"
            :key="item.permissionCode"
            ><input
              v-model="permissions"
              type="checkbox"
              :value="item.permissionCode"
            />{{ item.permissionName
            }}<small>{{ item.permissionCode }}</small></label
          >
        </div>
        <button
          v-if="hasPermission('system:role:update')"
          class="primary-btn"
          @click="save"
        >
          保存权限配置
        </button>
        <div class="data-scope-panel">
          <h4>数据范围</h4>
          <p>决定该角色可读取的商户数据范围，最终仍由后端数据权限校验。</p>
          <div class="check-grid data-scope-options">
            <label><input v-model="scopeTypes" type="checkbox" value="ALL" />全部商户数据</label>
            <label><input v-model="scopeTypes" type="checkbox" value="ASSIGNED" />已分配商户数据</label>
            <label><input v-model="scopeTypes" type="checkbox" value="SELF" />本人负责商户数据</label>
          </div>
          <button v-if="hasPermission('system:role:update')" class="outline-btn" @click="saveScope">保存数据范围</button>
        </div>
      </div>
    </div>
  </section>
</template>
