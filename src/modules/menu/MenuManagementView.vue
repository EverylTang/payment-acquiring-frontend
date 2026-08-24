<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Plus, RefreshCw, ToggleLeft } from "lucide-vue-next";
import { changeMenuStatus, createMenu, getMenus, type AdminMenu } from "./api";

const emit = defineEmits<{ notice: [message: string] }>();
const menus = ref<AdminMenu[]>([]);
const loading = ref(false);
const saving = ref(false);
const form = ref({
  menuCode: "",
  menuName: "",
  menuType: "PAGE" as "DIRECTORY" | "PAGE",
  parentMenuCode: "",
  routePath: "",
  componentKey: "",
  icon: "Settings2",
  sortOrder: 100,
  visible: true,
});

const load = async () => {
  loading.value = true;
  try {
    menus.value = (await getMenus()).items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "菜单加载失败");
  } finally {
    loading.value = false;
  }
};
const save = async () => {
  saving.value = true;
  try {
    const created = await createMenu({
      ...form.value,
      parentMenuCode: form.value.parentMenuCode || undefined,
    });
    menus.value = [...menus.value, created].sort((a, b) => a.sortOrder - b.sortOrder);
    form.value = {
      menuCode: "",
      menuName: "",
      menuType: "PAGE",
      parentMenuCode: "",
      routePath: "",
      componentKey: "",
      icon: "Settings2",
      sortOrder: 100,
      visible: true,
    };
    emit("notice", "菜单已新增，可在角色权限页分配给角色");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "菜单新增失败");
  } finally {
    saving.value = false;
  }
};
const toggle = async (menu: AdminMenu) => {
  try {
    Object.assign(
      menu,
      await changeMenuStatus(
        menu.menuCode,
        menu.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      ),
    );
    emit("notice", "菜单状态已更新，重新登录后对目标角色生效");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "菜单状态更新失败");
  }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div><span class="eyebrow">SYSTEM MENU</span><h3>菜单管理</h3></div>
      <button class="outline-btn" :disabled="loading" @click="load"><RefreshCw :class="{ spin: loading }" :size="16" />刷新</button>
    </div>
    <div class="menu-form">
      <input v-model="form.menuCode" placeholder="菜单编码，如 system:report" /><input v-model="form.menuName" placeholder="菜单名称" /><select v-model="form.menuType"><option>PAGE</option><option>DIRECTORY</option></select><input v-model="form.parentMenuCode" placeholder="父级菜单编码（可选）" />
      <input v-model="form.routePath" placeholder="路由路径，如 /reports" /><input v-model="form.componentKey" placeholder="组件标识，如 reports" /><input v-model="form.icon" placeholder="Lucide 图标名称" /><input v-model.number="form.sortOrder" type="number" min="0" placeholder="排序" />
      <label class="menu-visible"><input v-model="form.visible" type="checkbox" />在侧边栏显示</label><button class="primary-btn" :disabled="saving" @click="save"><Plus :size="16" />新增菜单</button>
    </div>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!menus.length" class="empty">暂无菜单</div>
    <div v-else class="record-list">
      <div v-for="menu in menus" :key="menu.menuCode" class="record-row">
        <div><strong>{{ menu.menuName }}</strong><small>{{ menu.menuCode }} · {{ menu.menuType }} · {{ menu.routePath || "无路由" }} · 排序 {{ menu.sortOrder }}</small></div>
        <span class="status-badge">{{ menu.status }} / {{ menu.visible ? "VISIBLE" : "HIDDEN" }}</span><button class="icon-btn" title="切换菜单状态" @click="toggle(menu)"><ToggleLeft :size="17" /></button>
      </div>
    </div>
  </section>
</template>
