<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Pencil, Plus, Save, Search, ShieldCheck, ToggleLeft, Trash2 } from "lucide-vue-next";
import { ElPagination } from "element-plus";
import { changeMenuStatus, createMenu, createMenuPermission, createResourceType, deleteMenu, deleteMenuPermission, getMenuPermissions, getMenuResourceTypes, getMenus, getResourceTypes, updateMenu, updateMenuPermission, type AdminMenu, type MenuPermission, type ResourceType } from "./api";
import AppDrawer from "../../components/AppDrawer.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const menus = ref<AdminMenu[]>([]);
const loading = ref(false);
const saving = ref(false);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const filters = ref({ menuName: "", menuCode: "", menuType: "", status: "" });
const menuDrawerOpen = ref(false);
const editingMenu = ref<AdminMenu | null>(null);
const permissionDrawerMenu = ref<AdminMenu | null>(null);
const permissions = ref<MenuPermission[]>([]);
const permissionsLoading = ref(false);
const editingPermission = ref<MenuPermission | null>(null);
const permissionSaving = ref(false);
const resourceTypes = ref<ResourceType[]>([]);
const menuPermissionTypes = ref<string[]>([]);
const resourceTypeDrawerOpen = ref(false);
const resourceTypeSaving = ref(false);

const emptyMenuForm = () => ({ menuCode: "", menuName: "", menuType: "PAGE" as "DIRECTORY" | "PAGE", parentMenuCode: "", routePath: "", componentKey: "", icon: "Settings2", sortOrder: 100, visible: true, resourceTypes: ["MENU"] as string[] });
const emptyPermissionForm = () => ({ actionCode: "", permissionName: "", resourceType: "" });
const emptyResourceTypeForm = () => ({ resourceType: "", resourceName: "" });
const menuForm = ref(emptyMenuForm());
const permissionForm = ref(emptyPermissionForm());
const resourceTypeForm = ref(emptyResourceTypeForm());
const parentMenus = computed(() => menus.value.filter((menu) => menu.menuCode !== editingMenu.value?.menuCode));
const permissionTitle = computed(() => editingPermission.value ? "编辑操作权限" : "新增操作权限");
const builtinResourceTypeNames: Record<string, string> = {
  MENU: "菜单资源",
  MERCHANT: "商户",
  MERCHANT_PRODUCT: "商户产品",
  PRODUCT: "产品",
  PRODUCT_CAPABILITY: "产品能力",
  ROLE: "角色",
  USER: "用户",
};
const resourceTypeName = (type: ResourceType) => builtinResourceTypeNames[type.resourceType] || type.resourceName || type.resourceType;
const menuPermissionTypeOptions = computed(() =>
  menuPermissionTypes.value.map((resourceType) => {
    const catalogItem = resourceTypes.value.find((item) => item.resourceType === resourceType);
    return { resourceType, resourceName: catalogItem ? resourceTypeName(catalogItem) : resourceType };
  }),
);

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getMenus({ page: current, pageSize: page.value.pageSize, ...filters.value });
    menus.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
    resourceTypes.value = await getResourceTypes();
  } catch (error) { emit("notice", error instanceof Error ? error.message : "菜单加载失败"); }
  finally { loading.value = false; }
};
const search = () => load(1);
const resetFilters = () => {
  filters.value = { menuName: "", menuCode: "", menuType: "", status: "" };
  load(1);
};
const changePageSize = (pageSize: number) => { page.value.pageSize = pageSize; load(1); };
const openCreateMenu = () => { editingMenu.value = null; menuForm.value = emptyMenuForm(); menuDrawerOpen.value = true; };
const openEditMenu = async (menu: AdminMenu) => {
  editingMenu.value = menu;
  menuForm.value = { menuCode: menu.menuCode, menuName: menu.menuName, menuType: menu.menuType, parentMenuCode: menus.value.find((item) => item.id === menu.parentId)?.menuCode || "", routePath: menu.routePath || "", componentKey: menu.componentKey || "", icon: menu.icon || "", sortOrder: menu.sortOrder, visible: menu.visible, resourceTypes: await getMenuResourceTypes(menu.menuCode) };
  menuDrawerOpen.value = true;
};
const closeMenuDrawer = () => { if (!saving.value) { menuDrawerOpen.value = false; editingMenu.value = null; menuForm.value = emptyMenuForm(); } };
const openResourceTypeDrawer = () => { resourceTypeForm.value = emptyResourceTypeForm(); resourceTypeDrawerOpen.value = true; };
const closeResourceTypeDrawer = () => { if (!resourceTypeSaving.value) { resourceTypeDrawerOpen.value = false; resourceTypeForm.value = emptyResourceTypeForm(); } };
const saveResourceType = async () => {
  resourceTypeSaving.value = true;
  try {
    const result = await createResourceType({ resourceType: resourceTypeForm.value.resourceType.trim().toUpperCase(), resourceName: resourceTypeForm.value.resourceName.trim() });
    resourceTypes.value = [...resourceTypes.value, result].sort((a, b) => a.resourceType.localeCompare(b.resourceType));
    if (!menuForm.value.resourceTypes.includes(result.resourceType)) menuForm.value.resourceTypes.push(result.resourceType);
    resourceTypeDrawerOpen.value = false;
    resourceTypeForm.value = emptyResourceTypeForm();
    emit("notice", "资源类型已新增并关联到当前菜单");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "资源类型新增失败"); }
  finally { resourceTypeSaving.value = false; }
};
const saveMenu = async () => {
  saving.value = true;
  try {
    const payload = { ...menuForm.value, parentMenuCode: menuForm.value.parentMenuCode || undefined };
    if (editingMenu.value) {
      const result = await updateMenu(editingMenu.value.menuCode, payload);
      menus.value = menus.value.map((item) => item.menuCode === result.menuCode ? result : item);
      emit("notice", "菜单已保存");
    } else { await createMenu(payload); await load(1); emit("notice", "菜单已新增"); }
    menuDrawerOpen.value = false; editingMenu.value = null;
  } catch (error) { emit("notice", error instanceof Error ? error.message : "菜单保存失败"); }
  finally { saving.value = false; }
};
const toggle = async (menu: AdminMenu) => {
  try {
    const result = await changeMenuStatus(menu.menuCode, menu.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    menus.value = menus.value.map((item) => item.menuCode === result.menuCode ? result : item);
    emit("notice", "菜单状态已更新");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "菜单状态更新失败"); }
};
const removeMenu = async (menu: AdminMenu) => {
  if (!window.confirm(`删除菜单“${menu.menuName}”及其操作权限？`)) return;
  try { await deleteMenu(menu.menuCode); await load(page.value.current); emit("notice", "菜单已删除"); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "菜单删除失败"); }
};
const openPermissionDrawer = async (menu: AdminMenu) => {
  permissionDrawerMenu.value = menu; editingPermission.value = null; permissionForm.value = emptyPermissionForm(); permissionsLoading.value = true;
  try {
    const [items, types, catalog] = await Promise.all([getMenuPermissions(menu.menuCode), getMenuResourceTypes(menu.menuCode), getResourceTypes()]);
    permissions.value = items;
    resourceTypes.value = catalog;
    menuPermissionTypes.value = types;
    permissionForm.value.resourceType = types[0] || "";
  }
  catch (error) { emit("notice", error instanceof Error ? error.message : "操作权限加载失败"); }
  finally { permissionsLoading.value = false; }
};
const closePermissionDrawer = () => { if (!permissionSaving.value) { permissionDrawerMenu.value = null; editingPermission.value = null; permissions.value = []; menuPermissionTypes.value = []; permissionForm.value = emptyPermissionForm(); } };
const editPermission = (permission: MenuPermission) => {
  editingPermission.value = permission;
  permissionForm.value = { actionCode: permission.permissionCode.split(":").at(-1) || "", permissionName: permission.permissionName, resourceType: permission.resourceType };
};
const resetPermissionForm = () => { editingPermission.value = null; permissionForm.value = emptyPermissionForm(); };
const savePermission = async () => {
  if (!permissionDrawerMenu.value) return;
  permissionSaving.value = true;
  try {
    const menuCode = permissionDrawerMenu.value.menuCode;
    if (editingPermission.value) {
      const result = await updateMenuPermission(menuCode, permissionForm.value.actionCode, { permissionName: permissionForm.value.permissionName, resourceType: permissionForm.value.resourceType, status: editingPermission.value.status });
      permissions.value = permissions.value.map((item) => item.permissionCode === result.permissionCode ? result : item);
      emit("notice", "操作权限已保存");
    } else {
      const result = await createMenuPermission(menuCode, permissionForm.value);
      permissions.value = [...permissions.value, result].sort((a, b) => a.permissionCode.localeCompare(b.permissionCode));
      emit("notice", "操作权限已新增");
    }
    resetPermissionForm();
  } catch (error) { emit("notice", error instanceof Error ? error.message : "操作权限保存失败"); }
  finally { permissionSaving.value = false; }
};
const togglePermission = async (permission: MenuPermission) => {
  if (!permissionDrawerMenu.value) return;
  try {
    const result = await updateMenuPermission(permissionDrawerMenu.value.menuCode, permission.permissionCode.split(":").at(-1) || "", { permissionName: permission.permissionName, resourceType: permission.resourceType, status: permission.status === "ACTIVE" ? "DISABLED" : "ACTIVE" });
    permissions.value = permissions.value.map((item) => item.permissionCode === result.permissionCode ? result : item);
  } catch (error) { emit("notice", error instanceof Error ? error.message : "操作权限状态更新失败"); }
};
const removePermission = async (permission: MenuPermission) => {
  if (!permissionDrawerMenu.value || !window.confirm(`删除“${permission.permissionName}”？`)) return;
  try {
    await deleteMenuPermission(permissionDrawerMenu.value.menuCode, permission.permissionCode.split(":").at(-1) || "");
    permissions.value = permissions.value.filter((item) => item.permissionCode !== permission.permissionCode);
    if (editingPermission.value?.permissionCode === permission.permissionCode) resetPermissionForm();
    emit("notice", "操作权限已删除");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "操作权限删除失败"); }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel management-list-page">
    <form class="management-filter-form" @submit.prevent="search">
      <div class="management-filter-fields">
        <label class="management-form-item"><span>菜单名称</span><div class="management-input"><Search :size="16" /><input v-model="filters.menuName" placeholder="输入菜单名称" /></div></label>
        <label class="management-form-item"><span>菜单编码</span><input v-model="filters.menuCode" placeholder="输入菜单编码" /></label>
        <label class="management-form-item"><span>菜单类型</span><select v-model="filters.menuType"><option value="">全部类型</option><option value="PAGE">页面</option><option value="DIRECTORY">目录</option></select></label>
        <label class="management-form-item"><span>状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label>
      </div>
      <div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button class="primary-btn" type="button" @click="openCreateMenu"><Plus :size="16" />新增菜单</button></div>
    </form>
    <div class="management-list-summary"><span>菜单列表</span><small>共 {{ page.total }} 个菜单</small></div>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else class="table-wrap management-table-wrap"><table class="data-table menu-management-table"><colgroup><col class="menu-name-column" /><col class="menu-code-column" /><col class="menu-type-column" /><col class="menu-route-column" /><col class="menu-visible-column" /><col class="menu-status-column" /><col class="management-actions-column" /></colgroup><thead><tr><th>菜单名称</th><th>菜单编码</th><th>类型</th><th>路由</th><th>显示</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="menu in menus" :key="menu.menuCode"><td><strong>{{ menu.menuName }}</strong></td><td class="mono">{{ menu.menuCode }}</td><td>{{ menu.menuType === "PAGE" ? "页面" : "目录" }}</td><td>{{ menu.routePath || "--" }}</td><td><span class="status-badge" :class="menu.visible ? 'st-visible' : 'st-hidden'">{{ menu.visible ? "显示" : "隐藏" }}</span></td><td><span class="status-badge" :class="'st-' + menu.status.toLowerCase()">{{ menu.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td><td class="actions"><div class="management-row-actions"><button class="outline-btn" title="管理操作权限" @click="openPermissionDrawer(menu)"><ShieldCheck :size="16" />权限</button><button class="outline-btn" title="编辑菜单" @click="openEditMenu(menu)"><Pencil :size="16" />编辑</button><button class="outline-btn" title="切换菜单状态" @click="toggle(menu)"><ToggleLeft :size="16" />{{ menu.status === "ACTIVE" ? "停用" : "启用" }}</button><button class="outline-btn danger-outline-btn" title="删除菜单" @click="removeMenu(menu)"><Trash2 :size="16" />删除</button></div></td></tr><tr v-if="!menus.length"><td colspan="7" class="empty">暂无符合条件的菜单</td></tr></tbody></table></div>
    <div class="management-pagination"><ElPagination background layout="sizes, total, prev, pager, next" :current-page="page.current" :page-size="page.pageSize" :page-sizes="[20, 50, 100]" :total="page.total" :hide-on-single-page="false" @current-change="load" @size-change="changePageSize" /></div>
  </section>
  <AppDrawer v-if="menuDrawerOpen" :title="editingMenu ? '编辑菜单' : '新增菜单'" description="SYSTEM MENU" @close="closeMenuDrawer"><form class="drawer-section menu-drawer-form" @submit.prevent="saveMenu"><div class="drawer-form-grid"><label class="form-field"><span>菜单编码</span><input v-model="menuForm.menuCode" :disabled="!!editingMenu" placeholder="例如 system:report" /></label><label class="form-field"><span>菜单名称</span><input v-model="menuForm.menuName" placeholder="请输入菜单名称" /></label><label class="form-field"><span>菜单类型</span><select v-model="menuForm.menuType"><option value="PAGE">页面</option><option value="DIRECTORY">目录</option></select></label><label class="form-field"><span>父级菜单</span><select v-model="menuForm.parentMenuCode"><option value="">顶级菜单</option><option v-for="menu in parentMenus" :key="menu.menuCode" :value="menu.menuCode">{{ menu.menuName }} · {{ menu.menuCode }}</option></select></label><label class="form-field"><span>路由路径</span><input v-model="menuForm.routePath" placeholder="例如 /reports" /></label><label class="form-field"><span>组件标识</span><input v-model="menuForm.componentKey" placeholder="例如 reports" /></label><label class="form-field"><span>图标名称</span><input v-model="menuForm.icon" placeholder="例如 Settings2" /></label><label class="form-field"><span>排序</span><input v-model.number="menuForm.sortOrder" type="number" min="0" /></label></div><fieldset class="menu-resource-types"><legend>关联资源类型</legend><div class="resource-types-toolbar"><button class="outline-btn resource-type-create" type="button" @click="openResourceTypeDrawer"><Plus :size="14" />新增资源类型</button></div><div class="resource-type-grid"><label v-for="type in resourceTypes" :key="type.resourceType" class="resource-type-option" :class="{ selected: menuForm.resourceTypes.includes(type.resourceType) }"><input v-model="menuForm.resourceTypes" type="checkbox" :value="type.resourceType" /><span><b>{{ resourceTypeName(type) }}</b><small>{{ type.resourceType }}</small></span></label></div></fieldset><label class="drawer-check"><input v-model="menuForm.visible" type="checkbox" />在侧边栏显示</label><button class="primary-btn drawer-submit" type="submit" :disabled="saving || !menuForm.menuCode || !menuForm.menuName || !menuForm.resourceTypes.length"><Save :size="16" />{{ editingMenu ? "保存菜单" : "创建菜单" }}</button></form></AppDrawer>
  <AppDrawer v-if="resourceTypeDrawerOpen" title="新增资源类型" description="RESOURCE TYPE" @close="closeResourceTypeDrawer"><form class="drawer-section menu-drawer-form" @submit.prevent="saveResourceType"><div class="drawer-form-grid"><label class="form-field"><span>资源类型编码</span><input v-model="resourceTypeForm.resourceType" maxlength="64" placeholder="例如 REPORT" @input="resourceTypeForm.resourceType = resourceTypeForm.resourceType.toUpperCase()" /></label><label class="form-field"><span>资源类型名称</span><input v-model="resourceTypeForm.resourceName" maxlength="128" placeholder="例如 报表资源" /></label></div><button class="primary-btn drawer-submit" type="submit" :disabled="resourceTypeSaving || !resourceTypeForm.resourceType.trim() || !resourceTypeForm.resourceName.trim()"><Save :size="16" />创建资源类型</button></form></AppDrawer>
  <AppDrawer v-if="permissionDrawerMenu" title="操作权限管理" :description="permissionDrawerMenu.menuName" @close="closePermissionDrawer"><section class="drawer-section permission-form-section"><div class="drawer-section-heading"><h4>{{ permissionTitle }}</h4><button v-if="editingPermission" class="icon-btn" title="取消编辑权限" @click="resetPermissionForm">×</button></div><form class="permission-drawer-form" @submit.prevent="savePermission"><label class="form-field"><span>操作编码</span><div class="permission-code-input"><b>{{ permissionDrawerMenu.menuCode }}:</b><input v-model="permissionForm.actionCode" :disabled="!!editingPermission" placeholder="例如 list" /></div></label><label class="form-field"><span>权限名称</span><input v-model="permissionForm.permissionName" placeholder="例如 查看报表" /></label><label class="form-field"><span>资源类型</span><select v-model="permissionForm.resourceType"><option v-if="!menuPermissionTypeOptions.length" value="" disabled>请先在菜单中关联资源类型</option><option v-for="type in menuPermissionTypeOptions" :key="type.resourceType" :value="type.resourceType">{{ type.resourceName }}（{{ type.resourceType }}）</option></select></label><button class="primary-btn drawer-submit" type="submit" :disabled="permissionSaving || !permissionForm.actionCode || !permissionForm.permissionName || !permissionForm.resourceType"><Save :size="16" />{{ editingPermission ? "保存权限" : "新增权限" }}</button></form></section><section class="drawer-section permission-list-section"><h4>已配置操作</h4><div v-if="permissionsLoading" class="empty">加载中…</div><div v-else-if="!permissions.length" class="empty">暂无操作权限</div><div v-else class="permission-record-list"><div v-for="permission in permissions" :key="permission.permissionCode" class="permission-record-row"><div><strong>{{ permission.permissionName }}</strong><small>{{ permission.permissionCode }} · {{ permission.resourceType }}</small></div><span class="status-badge" :class="'st-' + permission.status.toLowerCase()">{{ permission.status }}</span><div class="button-row"><button class="icon-btn" title="编辑操作权限" @click="editPermission(permission)"><Pencil :size="15" /></button><button class="icon-btn" title="切换操作权限状态" @click="togglePermission(permission)"><ToggleLeft :size="15" /></button><button class="icon-btn danger-icon-btn" title="删除操作权限" @click="removePermission(permission)"><Trash2 :size="15" /></button></div></div></div></section></AppDrawer>
</template>
