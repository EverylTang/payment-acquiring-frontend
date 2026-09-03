<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Globe2,
  Eraser,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-vue-next";
import {
  createRole,
  getPermissionCatalog,
  getRoleDataScope,
  getRolePermissions,
  getRoles,
  updateRolePermissions,
  updateRoleDataScope,
  updateRole,
  type AdminRole,
  type PermissionCatalog,
} from "./api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";

type Section = "access" | "scope";
type PermissionTreeNode = PermissionCatalog["menus"][number] & {
  children: PermissionTreeNode[];
  permissions: PermissionCatalog["permissions"];
};
type PermissionTreeRow =
  | { kind: "menu"; node: PermissionTreeNode; depth: number }
  | { kind: "permission"; permission: PermissionCatalog["permissions"][number]; depth: number };

const emit = defineEmits<{ notice: [message: string] }>();
const roles = ref<AdminRole[]>([]);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const catalog = ref<PermissionCatalog | null>(null);
const selectedRole = ref("");
const activeSection = ref<Section>("access");
const menus = ref<string[]>([]);
const permissions = ref<string[]>([]);
const scopeTypes = ref<string[]>([]);
const loading = ref(false);
const catalogError = ref("");
const selectionLoading = ref(false);
const saving = ref(false);
const createDrawerOpen = ref(false);
const creating = ref(false);
const roleEditDrawerOpen = ref(false);
const authorizationDrawerOpen = ref(false);
const editingRole = ref<AdminRole | null>(null);
const editingRoleName = ref("");
const updatingRole = ref(false);
const expandedMenuCodes = ref<string[]>([]);
const scopeOptions = [
  { code: "ALL", label: "全部商户数据", description: "可查看所有商户", icon: Globe2 },
  { code: "ASSIGNED", label: "已分配商户数据", description: "仅查看已分配商户", icon: UsersRound },
  { code: "SELF", label: "本人负责商户数据", description: "仅查看本人负责商户", icon: UserRound },
];
const newRole = ref({
  roleCode: "",
  roleName: "",
  menuCodes: [] as string[],
  permissionCodes: [] as string[],
  scopeTypes: ["ASSIGNED"] as string[],
});

const selectedRoleDetail = computed(() =>
  roles.value.find((role) => role.roleCode === selectedRole.value),
);
const selectedCount = computed(() => {
  if (activeSection.value === "access") return menus.value.length + permissions.value.length;
  return scopeTypes.value.length;
});
const saveLabel = computed(() =>
  activeSection.value === "scope" ? "保存数据范围" : "保存权限配置",
);
const permissionTree = computed(() => {
  const menuItems = catalog.value?.menus || [];
  const nodes = new Map<number, PermissionTreeNode>();
  menuItems.forEach((menu) => nodes.set(menu.id, { ...menu, children: [], permissions: [] }));
  const menuByPrefix = [...menuItems].sort(
    (left, right) => right.menuCode.length - left.menuCode.length,
  );
  (catalog.value?.permissions || []).forEach((permission) => {
    const owner = menuByPrefix.find((menu) =>
      permission.permissionCode.startsWith(`${menu.menuCode}:`),
    );
    if (owner) nodes.get(owner.id)?.permissions.push(permission);
  });
  const roots: PermissionTreeNode[] = [];
  nodes.forEach((node) => {
    const parent = nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sortNodes = (items: PermissionTreeNode[]) => {
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
});
const unmatchedPermissions = computed(() => {
  const claimed = new Set(
    permissionTree.value.flatMap((node) => collectAccessCodes(node).permissionCodes),
  );
  return (catalog.value?.permissions || []).filter(
    (permission) => !claimed.has(permission.permissionCode),
  );
});
const permissionRows = computed(() => {
  const rows: PermissionTreeRow[] = [];
  const visit = (nodes: PermissionTreeNode[], depth: number) => {
    nodes.forEach((node) => {
      rows.push({ kind: "menu", node, depth });
      if (!expandedMenuCodes.value.includes(node.menuCode)) return;
      node.permissions.forEach((permission) =>
        rows.push({ kind: "permission", permission, depth: depth + 1 }),
      );
      visit(node.children, depth + 1);
    });
  };
  visit(permissionTree.value, 0);
  return rows;
});

const isExpanded = (node: PermissionTreeNode) => expandedMenuCodes.value.includes(node.menuCode);

const toggleExpanded = (node: PermissionTreeNode) => {
  expandedMenuCodes.value = isExpanded(node)
    ? expandedMenuCodes.value.filter((code) => code !== node.menuCode)
    : [...expandedMenuCodes.value, node.menuCode];
};

function collectAccessCodes(
  node: PermissionTreeNode,
): { menuCodes: string[]; permissionCodes: string[] } {
  return node.children.reduce(
    (result, child) => {
      const childCodes = collectAccessCodes(child);
      return {
        menuCodes: [...result.menuCodes, ...childCodes.menuCodes],
        permissionCodes: [...result.permissionCodes, ...childCodes.permissionCodes],
      };
    },
    {
      menuCodes: [node.menuCode],
      permissionCodes: node.permissions.map((permission) => permission.permissionCode),
    },
  );
}

const isAccessNodeChecked = (
  node: PermissionTreeNode,
  selectedMenus: string[],
  selectedPermissions: string[],
) => {
  const codes = collectAccessCodes(node);
  return (
    codes.menuCodes.every((code) => selectedMenus.includes(code)) &&
    codes.permissionCodes.every((code) => selectedPermissions.includes(code))
  );
};

const isAccessNodeIndeterminate = (
  node: PermissionTreeNode,
  selectedMenus: string[],
  selectedPermissions: string[],
) => {
  const codes = collectAccessCodes(node);
  const selected = [
    ...codes.menuCodes.filter((code) => selectedMenus.includes(code)),
    ...codes.permissionCodes.filter((code) => selectedPermissions.includes(code)),
  ].length;
  return selected > 0 && selected < codes.menuCodes.length + codes.permissionCodes.length;
};

const toggleAccessNode = (node: PermissionTreeNode, isNewRole = false) => {
  const codes = collectAccessCodes(node);
  const currentMenus = isNewRole ? newRole.value.menuCodes : menus.value;
  const currentPermissions = isNewRole ? newRole.value.permissionCodes : permissions.value;
  const shouldSelect = !isAccessNodeChecked(node, currentMenus, currentPermissions);
  const nextMenus = shouldSelect
    ? [...new Set([...currentMenus, ...codes.menuCodes])]
    : currentMenus.filter((code) => !codes.menuCodes.includes(code));
  const nextPermissions = shouldSelect
    ? [...new Set([...currentPermissions, ...codes.permissionCodes])]
    : currentPermissions.filter((code) => !codes.permissionCodes.includes(code));
  if (isNewRole) {
    newRole.value.menuCodes = nextMenus;
    newRole.value.permissionCodes = nextPermissions;
    return;
  }
  menus.value = nextMenus;
  permissions.value = nextPermissions;
};

const resetNewRole = () => {
  newRole.value = {
    roleCode: "",
    roleName: "",
    menuCodes: [],
    permissionCodes: [],
    scopeTypes: ["ASSIGNED"],
  };
};

const openCreateDrawer = () => {
  resetNewRole();
  createDrawerOpen.value = true;
};

const closeCreateDrawer = () => {
  if (creating.value) return;
  createDrawerOpen.value = false;
  resetNewRole();
};

const openEditRole = (role: AdminRole) => {
  editingRole.value = role;
  editingRoleName.value = role.roleName;
  roleEditDrawerOpen.value = true;
};

const openAuthorization = async (role: AdminRole) => {
  await select(role.roleCode);
  authorizationDrawerOpen.value = true;
};

const closeAuthorization = () => {
  if (saving.value) return;
  authorizationDrawerOpen.value = false;
};

const closeEditRole = () => {
  if (updatingRole.value) return;
  roleEditDrawerOpen.value = false;
  editingRole.value = null;
  editingRoleName.value = "";
};

const saveRoleName = async () => {
  if (!editingRole.value || !editingRoleName.value.trim()) return;
  updatingRole.value = true;
  try {
    const role = await updateRole(editingRole.value.roleCode, {
      roleName: editingRoleName.value.trim(),
    });
    roles.value = roles.value.map((item) =>
      item.roleCode === role.roleCode ? role : item,
    );
    roleEditDrawerOpen.value = false;
    editingRole.value = null;
    editingRoleName.value = "";
    emit("notice", "角色名称已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "角色名称保存失败");
  } finally {
    updatingRole.value = false;
  }
};

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const [rolePage, value] = await Promise.all([
      getRoles({ page: current, pageSize: page.value.pageSize }),
      getPermissionCatalog().catch((error: unknown) => {
        catalogError.value = error instanceof Error ? error.message : "权限目录加载失败";
        return null;
      }),
    ]);
    roles.value = rolePage.items;
    page.value = {
      current: rolePage.page,
      pageSize: rolePage.pageSize,
      total: rolePage.total,
    };
    catalog.value = value;
    if (value) {
      catalogError.value = "";
      expandedMenuCodes.value = value.menus.map((menu) => menu.menuCode);
    }
    const roleCode = roles.value.some((role) => role.roleCode === selectedRole.value)
      ? selectedRole.value
      : roles.value[0]?.roleCode;
    await select(roleCode || "");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "权限加载失败");
  } finally {
    loading.value = false;
  }
};

const select = async (roleCode: string) => {
  if (!roleCode || (roleCode === selectedRole.value && selectionLoading.value)) return;
  selectedRole.value = roleCode;
  selectionLoading.value = true;
  try {
    const [value, scope] = await Promise.all([
      getRolePermissions(roleCode),
      getRoleDataScope(roleCode),
    ]);
    if (selectedRole.value !== roleCode) return;
    menus.value = value.menuCodes;
    permissions.value = value.permissionCodes;
    scopeTypes.value = scope.scopeTypes;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "角色配置加载失败");
  } finally {
    if (selectedRole.value === roleCode) selectionLoading.value = false;
  }
};

const selectAll = () => {
  if (activeSection.value === "access") {
    menus.value = (catalog.value?.menus || []).map((item) => item.menuCode);
    permissions.value = (catalog.value?.permissions || []).map((item) => item.permissionCode);
  }
  if (activeSection.value === "scope") scopeTypes.value = ["ALL"];
};

const clearSelection = () => {
  if (activeSection.value === "access") {
    menus.value = [];
    permissions.value = [];
  }
  if (activeSection.value === "scope") scopeTypes.value = [];
};

const updateScope = (scope: string) => {
  if (scope === "ALL" && scopeTypes.value.includes("ALL")) {
    scopeTypes.value = ["ALL"];
    return;
  }
  if (scope !== "ALL") scopeTypes.value = scopeTypes.value.filter((item) => item !== "ALL");
};

const updateNewRoleScope = (scope: string) => {
  if (scope === "ALL" && newRole.value.scopeTypes.includes("ALL")) {
    newRole.value.scopeTypes = ["ALL"];
    return;
  }
  if (scope !== "ALL") {
    newRole.value.scopeTypes = newRole.value.scopeTypes.filter((item) => item !== "ALL");
  }
};

const create = async () => {
  creating.value = true;
  try {
    const role = await createRole({
      ...newRole.value,
      roleCode: newRole.value.roleCode.trim().toUpperCase(),
      roleName: newRole.value.roleName.trim(),
    });
    createDrawerOpen.value = false;
    resetNewRole();
    await load(1);
    await select(role.roleCode);
    emit("notice", "角色已创建并完成初始授权");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "角色创建失败");
  } finally {
    creating.value = false;
  }
};

const save = async () => {
  if (!selectedRole.value) return;
  saving.value = true;
  try {
    if (activeSection.value === "scope") {
      await updateRoleDataScope(selectedRole.value, scopeTypes.value);
      emit("notice", "数据范围已保存");
    } else {
      await updateRolePermissions(selectedRole.value, {
        menuCodes: menus.value,
        permissionCodes: permissions.value,
      });
      emit("notice", "角色权限已保存");
    }
    authorizationDrawerOpen.value = false;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "角色配置保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <section class="panel workspace-panel role-access-page">
    <div class="panel-title">
      <div><span class="eyebrow">ACCESS CONTROL</span><h3>角色列表</h3></div>
      <div class="button-row">
        <button class="outline-btn" :disabled="loading" @click="load()"><RefreshCw :class="{ spin: loading }" :size="16" />刷新</button>
        <button v-if="hasPermission('system:role:update')" class="primary-btn" @click="openCreateDrawer"><Plus :size="16" />新增角色</button>
      </div>
    </div>

    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="table-wrap"><table class="data-table role-table"><thead><tr><th>角色名称</th><th>角色编码</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="role in roles" :key="role.roleCode"><td><strong>{{ role.roleName }}</strong></td><td><span class="mono">{{ role.roleCode }}</span></td><td class="actions"><div class="button-row"><button v-if="hasPermission('system:role:update')" class="outline-btn" type="button" @click="openAuthorization(role)"><ShieldCheck :size="16" />授权</button><button v-if="hasPermission('system:role:update')" class="icon-btn" type="button" title="编辑角色名称" @click="openEditRole(role)"><Pencil :size="15" /></button></div></td></tr><tr v-if="!roles.length"><td colspan="3" class="empty">暂无可配置角色</td></tr></tbody></table></div>
    <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" noun="个角色" @change="load" />
  </section>
  <AppDrawer v-if="authorizationDrawerOpen && selectedRoleDetail" title="角色授权" :description="`${selectedRoleDetail.roleName} · ${selectedRoleDetail.roleCode}`" @close="closeAuthorization">
    <section class="drawer-section role-authorization" aria-live="polite">
      <div class="workspace-tabs role-config-tabs" role="tablist" aria-label="角色配置项"><button :class="{ active: activeSection === 'access' }" role="tab" :aria-selected="activeSection === 'access'" @click="activeSection = 'access'">菜单与操作权限</button><button :class="{ active: activeSection === 'scope' }" role="tab" :aria-selected="activeSection === 'scope'" @click="activeSection = 'scope'">数据范围</button></div>
      <div v-if="selectionLoading" class="empty role-config-loading"><LoaderCircle class="spin" :size="20" />加载角色配置…</div>
      <template v-else>
        <div class="role-config-actions"><span class="selection-count">已选 {{ selectedCount }} 项</span><div class="button-row"><button class="icon-btn" title="全选" @click="selectAll"><CheckCheck :size="17" /></button><button class="icon-btn" title="清空选择" @click="clearSelection"><Eraser :size="17" /></button></div></div>
        <div v-if="activeSection === 'access' && catalog?.menus.length" class="permission-tree" role="tree" aria-label="菜单与操作权限"><div v-for="row in permissionRows" :key="row.kind === 'permission' ? row.permission.permissionCode : row.node.menuCode" class="permission-tree-row" :class="[`permission-tree-${row.kind === 'permission' ? 'permission' : 'menu'}`, { nested: row.depth > 0 }]" :style="{ '--tree-depth': row.depth }" role="treeitem"><template v-if="row.kind !== 'permission'"><button v-if="row.node.children.length || row.node.permissions.length" class="tree-expand-btn" type="button" :title="isExpanded(row.node) ? '收起节点' : '展开节点'" @click="toggleExpanded(row.node)"><ChevronDown v-if="isExpanded(row.node)" :size="15" /><ChevronRight v-else :size="15" /></button><span v-else class="tree-expand-spacer"></span><label class="permission-tree-label"><input type="checkbox" :checked="isAccessNodeChecked(row.node, menus, permissions)" :indeterminate="isAccessNodeIndeterminate(row.node, menus, permissions)" @change="toggleAccessNode(row.node)" /><span>{{ row.node.menuName }}<small>{{ row.node.menuCode }}</small></span></label></template><label v-else class="permission-tree-label"><span class="tree-expand-spacer"></span><input v-model="permissions" type="checkbox" :value="row.permission.permissionCode" /><span>{{ row.permission.permissionName }}<small>{{ row.permission.permissionCode }}</small></span></label></div><div v-if="unmatchedPermissions.length" class="permission-tree-unmatched"><span>未归类操作</span><label v-for="permission in unmatchedPermissions" :key="permission.permissionCode" class="permission-tree-label"><span class="tree-expand-spacer"></span><input v-model="permissions" type="checkbox" :value="permission.permissionCode" /><span>{{ permission.permissionName }}<small>{{ permission.permissionCode }}</small></span></label></div></div>
        <div v-else-if="activeSection === 'scope'" class="scope-option-list" role="group" aria-label="数据范围"><label v-for="option in scopeOptions" :key="option.code" class="scope-option" :class="{ selected: scopeTypes.includes(option.code) }"><input v-model="scopeTypes" type="checkbox" :value="option.code" @change="updateScope(option.code)" /><component :is="option.icon" :size="18" /><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><b>{{ option.code }}</b></label></div>
        <div v-else class="empty role-catalog-empty">{{ catalogError || '暂无可授权菜单与操作权限' }}</div>
        <div v-if="hasPermission('system:role:update')" class="role-save-bar"><button class="primary-btn" :disabled="saving" @click="save"><Save :size="16" />{{ saveLabel }}</button></div>
      </template>
    </section>
  </AppDrawer>
  <AppDrawer v-if="createDrawerOpen" title="新增角色" description="ROLE" @close="closeCreateDrawer">
    <form class="drawer-section role-create-form" @submit.prevent="create">
      <div class="form-grid role-form-fields">
        <label class="form-field"><span>角色编码</span><input v-model="newRole.roleCode" maxlength="64" placeholder="例如 RISK_REVIEWER" /></label>
        <label class="form-field"><span>角色名称</span><input v-model="newRole.roleName" maxlength="128" placeholder="请输入角色名称" /></label>
      </div>
      <section class="role-create-selection">
        <h4>初始菜单与操作权限</h4>
        <div v-if="catalog?.menus.length" class="permission-tree permission-tree-create" role="tree" aria-label="初始菜单与操作权限">
          <div v-for="row in permissionRows" :key="row.kind === 'permission' ? row.permission.permissionCode : row.node.menuCode" class="permission-tree-row" :class="[`permission-tree-${row.kind === 'permission' ? 'permission' : 'menu'}`, { nested: row.depth > 0 }]" :style="{ '--tree-depth': row.depth }" role="treeitem">
            <template v-if="row.kind !== 'permission'">
              <button v-if="row.node.children.length || row.node.permissions.length" class="tree-expand-btn" type="button" :title="isExpanded(row.node) ? '收起节点' : '展开节点'" @click="toggleExpanded(row.node)"><ChevronDown v-if="isExpanded(row.node)" :size="15" /><ChevronRight v-else :size="15" /></button>
              <span v-else class="tree-expand-spacer"></span>
              <label class="permission-tree-label"><input type="checkbox" :checked="isAccessNodeChecked(row.node, newRole.menuCodes, newRole.permissionCodes)" :indeterminate="isAccessNodeIndeterminate(row.node, newRole.menuCodes, newRole.permissionCodes)" @change="toggleAccessNode(row.node, true)" /><span>{{ row.node.menuName }}<small>{{ row.node.menuCode }}</small></span></label>
            </template>
            <label v-else class="permission-tree-label"><span class="tree-expand-spacer"></span><input v-model="newRole.permissionCodes" type="checkbox" :value="row.permission.permissionCode" /><span>{{ row.permission.permissionName }}<small>{{ row.permission.permissionCode }}</small></span></label>
          </div>
          <div v-if="unmatchedPermissions.length" class="permission-tree-unmatched">
            <span>未归类操作</span>
            <label v-for="permission in unmatchedPermissions" :key="permission.permissionCode" class="permission-tree-label"><span class="tree-expand-spacer"></span><input v-model="newRole.permissionCodes" type="checkbox" :value="permission.permissionCode" /><span>{{ permission.permissionName }}<small>{{ permission.permissionCode }}</small></span></label>
          </div>
        </div>
        <div v-else class="empty role-catalog-empty">{{ catalogError || '暂无可授权菜单与操作权限' }}</div>
      </section>
      <section class="role-create-selection">
        <h4>数据范围</h4>
        <div class="scope-option-list" role="group" aria-label="初始数据范围">
          <label v-for="option in scopeOptions" :key="option.code" class="scope-option" :class="{ selected: newRole.scopeTypes.includes(option.code) }"><input v-model="newRole.scopeTypes" type="checkbox" :value="option.code" @change="updateNewRoleScope(option.code)" /><component :is="option.icon" :size="18" /><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><b>{{ option.code }}</b></label>
        </div>
      </section>
      <button class="primary-btn drawer-submit" type="submit" :disabled="creating || !newRole.roleCode.trim() || !newRole.roleName.trim() || !newRole.scopeTypes.length"><Save :size="16" />创建并授权</button>
    </form>
  </AppDrawer>
  <AppDrawer v-if="roleEditDrawerOpen && editingRole" title="编辑角色" :description="editingRole.roleCode" @close="closeEditRole">
    <form class="drawer-section role-edit-form" @submit.prevent="saveRoleName">
      <label class="form-field"><span>角色编码</span><input :value="editingRole.roleCode" disabled /></label>
      <label class="form-field"><span>角色名称</span><input v-model="editingRoleName" maxlength="128" placeholder="请输入角色名称" /></label>
      <button class="primary-btn drawer-submit" type="submit" :disabled="updatingRole || !editingRoleName.trim()"><Save :size="16" />保存角色</button>
    </form>
  </AppDrawer>
</template>
