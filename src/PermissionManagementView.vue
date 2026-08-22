<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import {
  getPermissionCatalog,
  getRolePermissions,
  getRoles,
  updateRolePermissions,
  type AdminRole,
  type PermissionCatalog,
} from "./api";
import { hasPermission } from "./auth";
const emit = defineEmits<{ notice: [message: string] }>();
const roles = ref<AdminRole[]>([]);
const catalog = ref<PermissionCatalog | null>(null);
const selectedRole = ref("");
const menus = ref<string[]>([]);
const permissions = ref<string[]>([]);
const load = async () => {
  try {
    const [rolePage, value] = await Promise.all([
      getRoles(),
      getPermissionCatalog(),
    ]);
    roles.value = rolePage.items;
    catalog.value = value;
    await select(roles.value[0]?.roleCode || "");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "权限加载失败");
  }
};
const select = async (role: string) => {
  if (!role) return;
  selectedRole.value = role;
  const value = await getRolePermissions(role);
  menus.value = value.menuCodes;
  permissions.value = value.permissionCodes;
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
      <button class="outline-btn" @click="load">
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
      </div>
    </div>
  </section>
</template>
