<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import {
  ChevronDown,
  CircleDollarSign,
  Layers3,
  LayoutDashboard,
  Link,
  MapPinned,
  Network,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-vue-next";
import type { Merchant } from "./modules/merchant/api";
import { getOrderHealth } from "./modules/order/api";
import { authState } from "./auth";
import { preferences } from "./preferences";
import AccountSettingsView from "./modules/account/AccountSettingsView.vue";

const DashboardView = defineAsyncComponent(() => import("./modules/dashboard/DashboardView.vue"));
const OrderManagementView = defineAsyncComponent(() => import("./modules/order/OrderManagementView.vue"));
const MerchantDetailView = defineAsyncComponent(() => import("./modules/merchant/MerchantDetailView.vue"));
const MerchantManagementView = defineAsyncComponent(() => import("./modules/merchant/MerchantManagementView.vue"));
const MerchantProductManagementView = defineAsyncComponent(() => import("./modules/merchant/MerchantProductManagementView.vue"));
const UserManagementView = defineAsyncComponent(() => import("./modules/user/UserManagementView.vue"));
const ProductManagementView = defineAsyncComponent(() => import("./modules/product/ProductManagementView.vue"));
const PermissionManagementView = defineAsyncComponent(() => import("./modules/permission/PermissionManagementView.vue"));
const OperationsView = defineAsyncComponent(() => import("./modules/operations/OperationsView.vue"));
const ConfigurationCenterView = defineAsyncComponent(() => import("./modules/configuration/ConfigurationCenterView.vue"));
const ReleaseManagementView = defineAsyncComponent(() => import("./modules/configuration/ReleaseManagementView.vue"));
const MenuManagementView = defineAsyncComponent(() => import("./modules/menu/MenuManagementView.vue"));
const RoutingRuleManagementView = defineAsyncComponent(() => import("./modules/routing/RoutingRuleManagementView.vue"));
const PricingRuleManagementView = defineAsyncComponent(() => import("./modules/pricing/PricingRuleManagementView.vue"));
const MasterDataView = defineAsyncComponent(() => import("./modules/master-data/MasterDataView.vue"));
const RiskWorkspaceView = defineAsyncComponent(() => import("./modules/risk/RiskWorkspaceView.vue"));
const SettlementManagementView = defineAsyncComponent(() => import("./modules/settlement/SettlementManagementView.vue"));
const MerchantFundManagementView = defineAsyncComponent(() => import("./modules/merchant-funds/MerchantFundManagementView.vue"));

const active = ref<string | null>(null);
const notice = ref("");
const dashboardReload = ref(0);
const dashboardRefresh = ref(0);
const orderReload = ref(0);
const selectedMerchant = ref<Merchant | null>(null);
const selectedMerchantSection = ref<"profile" | "contacts" | "credentials">("profile");
const serviceOnline = ref(true);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(notice, (message) => {
  if (noticeTimer) clearTimeout(noticeTimer);
  if (message) noticeTimer = setTimeout(() => (notice.value = ""), 6000);
});
const isOverview = computed(() => active.value === "总览");
const loadPage = (label: string) => {
  if (active.value === label) {
    if (label === "总览") dashboardReload.value += 1;
    else if (label === "订单管理") orderReload.value += 1;
    return;
  }
  active.value = label;
};
const refresh = () => {
  if (active.value !== "总览") return;
  dashboardRefresh.value += 1;
};
const iconMap = {
  LayoutDashboard,
  WalletCards,
  Store,
  Layers3,
  Link,
  Network,
  CircleDollarSign,
  ShieldCheck,
  Settings2,
  Users,
  UsersRound,
  MapPinned,
};
type NavigationItem = {
  code: string;
  parentId: number;
  label: string;
  page: string;
  icon: typeof Store;
};
type NavigationDirectory = {
  code: string;
  label: string;
  icon: typeof Store;
};
type NavigationGroup = { key: string; directory: NavigationDirectory | null; items: NavigationItem[] };
const pageByComponent: Record<string, string> = {
  dashboard: "总览",
  orders: "订单管理",
  trade: "订单管理",
  merchants: "商户管理",
  merchant: "商户管理",
  products: "产品管理",
  product: "产品管理",
  "merchant-products": "商户产品",
  "merchant-product": "商户产品",
  "master-data": "国家与币种",
  routing: "路由与渠道",
  "routing-rules": "路由规则管理",
  pricing: "费率管理",
  settlement: "结算管理",
  "merchant-funds": "商户资金",
  releases: "版本发布",
  "pricing-rules": "费率规则管理",
  risk: "风控工作台",
  users: "用户管理",
  "system:user": "用户管理",
  roles: "角色权限",
  "system:role": "角色权限",
  menus: "菜单管理",
  "system:menu": "菜单管理",
  operations: "运营处置",
};
const englishMenuLabels: Record<string, string> = {
  dashboard: "Overview",
  trade: "Payments",
  merchant: "Merchants",
  product: "Products",
  "merchant-product": "Merchant products",
  "master-data": "Countries & currencies",
  routing: "Routing & channels",
  "routing-rules": "Routing rules",
  pricing: "Pricing",
  "merchant-funds": "Merchant funds",
  releases: "Releases",
  "pricing-rules": "Pricing rules",
  risk: "Risk workspace",
  system: "System",
  "system:user": "Users",
  "system:role": "Roles & permissions",
  "system:menu": "Menu management",
  operations: "Operations",
};
const englishPageLabels: Record<string, string> = {
  总览: "Overview",
  订单管理: "Order management",
  商户管理: "Merchants",
  产品管理: "Products",
  商户产品: "Merchant products",
  国家与币种: "Countries & currencies",
  路由与渠道: "Routing & channels",
  路由规则管理: "Routing rules management",
  费率管理: "Pricing",
  商户资金: "Merchant funds",
  版本发布: "Releases",
  费率规则管理: "Pricing rules management",
  风控工作台: "Risk workspace",
  用户管理: "Users",
  角色权限: "Roles & permissions",
  菜单管理: "Menu management",
  运营处置: "Operations",
  商户详情: "Merchant details",
};
const displayMenuLabel = (code: string, label: string) =>
  preferences.locale === "en-US" ? englishMenuLabels[code] || englishPageLabels[label] || label : label;
const displayPageLabel = (label: string | null) => {
  if (!label) return preferences.locale === "en-US" ? "No authorized menu" : "未授权菜单";
  return preferences.locale === "en-US" ? englishPageLabels[label] || label : label;
};
const accountInitial = computed(() => authState.user?.displayName?.slice(0, 1) || "U");
const menuGroups = computed<NavigationGroup[]>(() => {
  const items = authState.access?.menus || [];
  const pages = items
    .filter((item) => item.menuType === "PAGE")
    .flatMap((item): NavigationItem[] => {
      const page = pageByComponent[item.componentKey || item.menuCode];
      if (!page) return [];
      return [{
        code: item.menuCode,
        parentId: item.parentId,
        label: item.menuName,
        page,
        icon: iconMap[item.icon as keyof typeof iconMap] || Store,
      }];
    });
  const directories = items.filter((item) => item.menuType === "DIRECTORY");
  const groups: NavigationGroup[] = [];
  const grouped = new Set<string>();
  for (const dir of directories) {
    const children = pages.filter((p) => p.parentId === dir.id);
    if (children.length) {
      children.forEach((c) => grouped.add(c.code));
      groups.push({
        key: dir.menuCode,
        directory: {
          code: dir.menuCode,
          label: dir.menuName,
          icon: iconMap[dir.icon as keyof typeof iconMap] || Settings2,
        },
        items: children,
      });
    }
  }
  const top = pages.filter((p) => !grouped.has(p.code));
  if (top.length) groups.unshift({ key: "main", directory: null, items: top });
  return groups;
});
const expandedMenuGroups = ref<string[]>([]);
const isMenuGroupExpanded = (key: string) => expandedMenuGroups.value.includes(key);
const toggleMenuGroup = (key: string) => {
  expandedMenuGroups.value = isMenuGroupExpanded(key)
    ? expandedMenuGroups.value.filter((value) => value !== key)
    : [...expandedMenuGroups.value, key];
};
watch(
  [menuGroups, active],
  ([groups, currentPage]) => {
    const activeGroup = groups.find(
      (group) => group.directory && group.items.some((item) => item.page === currentPage),
    );
    if (activeGroup && !isMenuGroupExpanded(activeGroup.key)) {
      expandedMenuGroups.value = [...expandedMenuGroups.value, activeGroup.key];
    }
  },
  { immediate: true },
);
watch(
  menuGroups,
  (groups) => {
    if (active.value === "商户详情") return;
    const pages = groups.flatMap((group) => group.items);
    if (pages.some((item) => item.page === active.value)) return;
    const firstPage = pages[0];
    if (firstPage) loadPage(firstPage.page);
    else active.value = null;
  },
  { immediate: true },
);
const openMerchantDetail = async (
  merchant: Merchant,
  section: "profile" | "contacts" | "credentials" = "profile",
) => {
  selectedMerchant.value = merchant;
  selectedMerchantSection.value = section;
  active.value = "商户详情";
};
onMounted(async () => {
  try {
    await getOrderHealth();
  } catch {
    serviceOnline.value = false;
  }
});
</script>

<template>
  <div class="app-shell">
    <div v-if="notice" class="app-notice" role="status" aria-live="polite">
      <span>{{ notice }}</span>
      <button class="app-notice-close" type="button" title="关闭提示" aria-label="关闭提示" @click="notice = ''">
        <XCircle :size="16" />
      </button>
    </div>
    <aside>
      <div class="brand">
        <span class="brand-mark">P</span>
        <div><strong>PAYMENT OS</strong><small>ACQUIRING CONTROL</small></div>
      </div>
      <nav>
        <div v-for="group in menuGroups" :key="group.key" class="nav-group">
          <template v-if="group.directory">
            <button
              class="nav-directory"
              :class="{ active: group.items.some((item) => item.page === active) }"
              :aria-expanded="isMenuGroupExpanded(group.key)"
              @click="toggleMenuGroup(group.key)"
            >
              <component :is="group.directory.icon" :size="17" />
              <span>{{ displayMenuLabel(group.directory.code, group.directory.label) }}</span>
              <ChevronDown class="nav-chevron" :size="16" :class="{ open: isMenuGroupExpanded(group.key) }" />
            </button>
            <div v-show="isMenuGroupExpanded(group.key)" class="nav-children">
              <button
                v-for="item in group.items"
                :key="item.page"
                class="nav-child"
                :class="{ active: active === item.page }"
                @click="loadPage(item.page)"
              >
                <component :is="item.icon" :size="16" /><span>{{ displayMenuLabel(item.code, item.label) }}</span>
              </button>
            </div>
          </template>
          <template v-else>
            <button
              v-for="item in group.items"
              :key="item.page"
              :class="{ active: active === item.page }"
              @click="loadPage(item.page)"
            >
              <component :is="item.icon" :size="17" /><span>{{ displayMenuLabel(item.code, item.label) }}</span>
            </button>
          </template>
        </div>
      </nav>
      <AccountSettingsView @notice="notice = $event" />
    </aside>
    <main>
      <MerchantDetailView
        v-if="active === '商户详情' && selectedMerchant"
        :merchant="selectedMerchant"
        :section="selectedMerchantSection"
        @back="
          active = '商户管理';
        "
        @notice="notice = $event"
      />
      <header>
        <div>
          <nav class="breadcrumb" aria-label="breadcrumb">
            <span>{{ preferences.locale === "en-US" ? "Operations console" : "运营控制台" }}</span><i>/</i><b>{{ displayPageLabel(active) }}</b>
          </nav>
        </div>
        <div class="header-actions">
          <span class="live"
            ><i :class="{ offline: !serviceOnline }"></i
            >{{ serviceOnline ? "交易服务正常" : "交易服务不可用" }}</span
          ><button class="icon-btn" title="刷新数据" :disabled="!isOverview" @click="refresh">
            <RefreshCw :size="18" /></button
          ><span class="avatar">{{ accountInitial }}</span>
        </div>
      </header>
      <DashboardView
        v-if="isOverview"
        :reload="dashboardReload"
        :refresh="dashboardRefresh"
        @notice="notice = $event"
      />
      <OrderManagementView
        v-else-if="active === '订单管理'"
        :reload="orderReload"
        @notice="notice = $event"
      />
      <PermissionManagementView
        v-else-if="active === '角色权限'"
        @notice="notice = $event"
      />
      <MerchantManagementView
        v-else-if="active === '商户管理'"
        @detail="openMerchantDetail"
        @notice="notice = $event"
      />
      <ProductManagementView
        v-else-if="active === '产品管理'"
        @notice="notice = $event"
      />
      <MasterDataView
        v-else-if="active === '国家与币种'"
        @notice="notice = $event"
      />
      <UserManagementView
        v-else-if="active === '用户管理'"
        @notice="notice = $event"
      />
      <MerchantProductManagementView
        v-else-if="active === '商户产品'"
        @notice="notice = $event"
      />
      <OperationsView
        v-else-if="active === '运营处置'"
        @notice="notice = $event"
      />
      <RoutingRuleManagementView
        v-else-if="active === '路由规则管理'"
        @notice="notice = $event"
      />
      <PricingRuleManagementView
        v-else-if="active === '费率规则管理'"
        @notice="notice = $event"
      />
      <ConfigurationCenterView
        v-else-if="active === '路由与渠道'"
        section="routing"
        contained-drawer
        @notice="notice = $event"
      />
      <ConfigurationCenterView
        v-else-if="active === '费率管理'"
        section="pricing"
        contained-drawer
        @notice="notice = $event"
      />
      <ReleaseManagementView
        v-else-if="active === '版本发布'"
        @notice="notice = $event"
      />
      <RiskWorkspaceView
        v-else-if="active === '风控工作台'"
        @notice="notice = $event"
      />
      <SettlementManagementView v-else-if="active === '结算管理'" @notice="notice = $event" />
      <MerchantFundManagementView v-else-if="active === '商户资金'" @notice="notice = $event" />
      <MenuManagementView
        v-else-if="active === '菜单管理'"
        @notice="notice = $event"
      />
      <section v-else-if="!active" class="panel workspace-panel">
        <div class="empty">当前账号未获授权菜单，请联系管理员。</div>
      </section>
    </main>
  </div>
</template>
