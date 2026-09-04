<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  Activity,
  Check,
  ChevronDown,
  CircleDollarSign,
  Eye,
  KeyRound,
  LayoutDashboard,
  Layers3,
  Languages,
  Link,
  LoaderCircle,
  LogOut,
  MapPinned,
  Network,
  Palette,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  UsersRound,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-vue-next";
import { getMerchants, type Merchant } from "./modules/merchant/api";
import { getActiveCurrencies, type Currency } from "./modules/master-data/api";
import { getProducts, type Product } from "./modules/product/api";
import { getRoles, getUsers, type AdminUser } from "./modules/user/api";
import { getPermissionCatalog, getRolePermissions, type AdminRole, type PermissionCatalog } from "./modules/permission/api";
import { cancelOrder, createOrder, getOrder, getOrderHealth, getOrderPage, getOrderStatistics, resendOrderNotification, type CreateOrderRequest, type Order, type OrderPage } from "./modules/order/api";
import { getChannelHealth, getOverview, getSnapshot, type DashboardOverview } from "./modules/dashboard/api";
import { authState, hasPermission, signOut } from "./auth";
import { changePassword } from "./modules/auth/api";
import { preferences, setLocale, setTheme, type AppLocale, type AppTheme } from "./preferences";
import MerchantDetailView from "./modules/merchant/MerchantDetailView.vue";
import MerchantManagementView from "./modules/merchant/MerchantManagementView.vue";
import MerchantProductManagementView from "./modules/merchant/MerchantProductManagementView.vue";
import UserManagementView from "./modules/user/UserManagementView.vue";
import ProductManagementView from "./modules/product/ProductManagementView.vue";
import PermissionManagementView from "./modules/permission/PermissionManagementView.vue";
import RefundView from "./modules/refund/RefundView.vue";
import OperationsView from "./modules/operations/OperationsView.vue";
import ConfigurationCenterView from "./modules/configuration/ConfigurationCenterView.vue";
import ReleaseManagementView from "./modules/configuration/ReleaseManagementView.vue";
import MenuManagementView from "./modules/menu/MenuManagementView.vue";
import RoutingRuleManagementView from "./modules/routing/RoutingRuleManagementView.vue";
import PricingRuleManagementView from "./modules/pricing/PricingRuleManagementView.vue";
import MasterDataView from "./modules/master-data/MasterDataView.vue";
import RiskWorkspaceView from "./modules/risk/RiskWorkspaceView.vue";
import AppDrawer from "./components/AppDrawer.vue";

const active = ref<string | null>(null);
const busy = ref(false);
const notice = ref("");
const accountMenuOpen = ref(false);
const accountDrawer = ref<"password" | null>(null);
const passwordSaving = ref(false);
const passwordForm = ref({ currentPassword: "", newPassword: "", confirmPassword: "" });
const queryId = ref("");
const selectedOrder = ref<Order | null>(null);
const orderDrawer = ref<"create" | "detail" | null>(null);
const orderForm = ref<CreateOrderRequest>({
  merchantId: "merchant-demo",
  merchantOrderNo: `web-${Date.now()}`,
  productCode: "CARD-US-USD",
  paymentMethod: "CARD",
  country: "US",
  currency: "USD",
  amount: 100,
});
const overview = ref<DashboardOverview | null>(null);
const selectedMerchant = ref<Merchant | null>(null);
const selectedMerchantSection = ref<"profile" | "contacts" | "credentials">("profile");
const products = ref<Product[]>([]);
const productPage = ref({ page: 1, pageSize: 20, total: 0 });
const permissionCatalog = ref<PermissionCatalog | null>(null);
const selectedRole = ref("ADMIN");
const selectedMenuCodes = ref<string[]>([]);
const selectedPermissionCodes = ref<string[]>([]);
const users = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const orderPage = ref<OrderPage>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
});
const orderFilters = ref({ merchantId: "", status: "", currency: "", orderType: "" as "" | "PAYIN" | "PAYOUT" });
const orderFilterMerchants = ref<Merchant[]>([]);
const orderFilterCurrencies = ref<Currency[]>([]);
const listLoading = ref(false);
const snapshotForm = ref({
  merchantId: "merchant-demo",
  productCode: "CARD-US-USD",
  paymentMethod: "CARD",
  currency: "USD",
});
const snapshot = ref<Record<string, unknown> | null>(null);
const channelHealth = ref("检查中");
const serviceOnline = ref(true);
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
const accountCopy = computed(() =>
  preferences.locale === "en-US"
    ? {
        account: "Account",
        changePassword: "Change password",
        language: "Language",
        appearance: "Appearance",
        signOut: "Sign out",
        passwordTitle: "Change password",
        passwordDescription: "ACCOUNT SECURITY",
        currentPassword: "Current password",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        savePassword: "Update password",
        passwordRule: "Use 12 to 128 characters.",
      }
    : {
        account: "账户设置",
        changePassword: "修改密码",
        language: "语言",
        appearance: "界面颜色",
        signOut: "退出登录",
        passwordTitle: "修改密码",
        passwordDescription: "账户安全",
        currentPassword: "当前密码",
        newPassword: "新密码",
        confirmPassword: "确认新密码",
        savePassword: "保存新密码",
        passwordRule: "密码长度为 12 至 128 位。",
      },
);
const accountInitial = computed(() => authState.user?.displayName?.slice(0, 1) || "U");
const openPasswordDrawer = () => {
  accountMenuOpen.value = false;
  passwordForm.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
  accountDrawer.value = "password";
};
const savePassword = async () => {
  if (passwordForm.value.newPassword.length < 12) {
    notice.value = preferences.locale === "en-US" ? "New password must be at least 12 characters." : "新密码至少需要 12 位。";
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    notice.value = preferences.locale === "en-US" ? "New passwords do not match." : "两次输入的新密码不一致。";
    return;
  }
  passwordSaving.value = true;
  notice.value = "";
  try {
    await changePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword);
    passwordForm.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
    accountDrawer.value = null;
    notice.value = preferences.locale === "en-US" ? "Password updated." : "密码已修改，请妥善保管新密码。";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "密码修改失败";
  } finally {
    passwordSaving.value = false;
  }
};
const selectLocale = (locale: AppLocale) => setLocale(locale);
const selectTheme = (theme: AppTheme) => setTheme(theme);
const handleSignOut = () => {
  accountMenuOpen.value = false;
  signOut();
};
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
const isOverview = computed(() => active.value === "总览");
const canManageOrders = computed(() => hasPermission("order:manage"));
const canNotifyOrders = computed(() => hasPermission("order:notify"));
const isTerminalOrder = (status: string) => ["SUCCESS", "FAILED", "CANCELED"].includes(status);
const cancelOrderDisabledReason = computed(() => {
  if (!selectedOrder.value) return "未选择订单";
  if (!canManageOrders.value) return "当前账号没有订单处置权限";
  if (isTerminalOrder(selectedOrder.value.status)) return "终态订单不能取消";
  return "";
});
const notificationDisabledReason = computed(() => {
  if (!selectedOrder.value) return "未选择订单";
  if (!canNotifyOrders.value) return "当前账号没有商户通知权限，请重新登录以刷新权限后重试";
  if (selectedOrder.value.status !== "SUCCESS") return "仅支付成功的订单可以通知商户";
  if (!selectedOrder.value.notifyUrl) return "该订单未配置异步通知地址";
  return "";
});
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(notice, (message) => {
  if (noticeTimer) clearTimeout(noticeTimer);
  if (message) noticeTimer = setTimeout(() => (notice.value = ""), 6000);
});
const run = async <T,>(action: () => Promise<T>, success = "") => {
  busy.value = true;
  notice.value = "";
  try {
    const result = await action();
    notice.value = success;
    return result;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "请求失败";
  } finally {
    busy.value = false;
  }
};
const loadOverview = async () => {
  const result = await run(async () => {
    const [platformOverview, orderStatistics] = await Promise.all([
      getOverview(),
      getOrderStatistics(),
    ]);
    return {
      ...platformOverview,
      paymentSuccessRate: orderStatistics.paymentSuccessRate,
      paymentVolume: orderStatistics.paymentVolume,
      activeMerchants: orderStatistics.activeMerchants,
    };
  });
  if (result) overview.value = result;
};
const loadPage = async (label: string) => {
  active.value = label;
  if (label === "总览") {
    await loadOverview();
    return;
  }
  if (label === "订单管理") {
    await Promise.all([loadOrderFilterOptions(), loadOrders()]);
    return;
  }
  if (label === "用户管理") {
    await loadUsers();
    return;
  }
  if (label === "角色权限") {
    await loadRolePermissions();
    return;
  }
  if (label === "商户管理") {
    return;
  }
  if (label === "产品管理") {
    await loadProducts();
    return;
  }
  if (["路由与渠道", "费率管理", "版本发布", "风控工作台"].includes(label)) return;
};
watch(
  menuGroups,
  (groups) => {
    if (active.value === "商户详情") return;
    const pages = groups.flatMap((group) => group.items);
    if (pages.some((item) => item.page === active.value)) return;
    const firstPage = pages[0];
    active.value = firstPage?.page ?? null;
    if (firstPage) void loadPage(firstPage.page);
  },
  { immediate: true },
);
const loadRolePermissions = async () => {
  listLoading.value = true;
  try {
    const [roleList, catalog] = await Promise.all([
      getRoles(),
      getPermissionCatalog(),
    ]);
    roles.value = roleList.items;
    permissionCatalog.value = catalog;
    await selectRole(selectedRole.value || roleList.items[0]?.roleCode);
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "角色权限加载失败";
  } finally {
    listLoading.value = false;
  }
};
const selectRole = async (roleCode: string) => {
  selectedRole.value = roleCode;
  const permissions = await getRolePermissions(roleCode);
  selectedMenuCodes.value = permissions.menuCodes;
  selectedPermissionCodes.value = permissions.permissionCodes;
};
const openMerchantDetail = async (
  merchant: Merchant,
  section: "profile" | "contacts" | "credentials" = "profile",
) => {
  selectedMerchant.value = merchant;
  selectedMerchantSection.value = section;
  active.value = "商户详情";
};
const loadProducts = async (page = productPage.value.page) => {
  listLoading.value = true;
  try {
    const result = await getProducts({
      page,
      pageSize: productPage.value.pageSize,
    });
    products.value = result.items;
    productPage.value = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "产品加载失败";
  } finally {
    listLoading.value = false;
  }
};
const loadUsers = async () => {
  listLoading.value = true;
  try {
    const [userPage, roleList] = await Promise.all([getUsers(), getRoles()]);
    users.value = userPage.items;
    roles.value = roleList.items;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "用户加载失败";
  } finally {
    listLoading.value = false;
  }
};
const loadOrders = async (page = 1) => {
  listLoading.value = true;
  try {
    const result = await getOrderPage({
      ...orderFilters.value,
      page,
      pageSize: orderPage.value.pageSize,
    });
    orderPage.value = result;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "订单列表加载失败";
  } finally {
    listLoading.value = false;
  }
};
const loadOrderFilterOptions = async () => {
  if (orderFilterMerchants.value.length && orderFilterCurrencies.value.length) return;
  try {
    const [merchantPage, currencies] = await Promise.all([
      getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getActiveCurrencies(),
    ]);
    orderFilterMerchants.value = merchantPage.items;
    orderFilterCurrencies.value = currencies;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "订单筛选项加载失败";
  }
};
const resetOrderFilters = async () => {
  orderFilters.value = { merchantId: "", status: "", currency: "", orderType: "" };
  await loadOrders(1);
};
const findOrder = async () => {
  if (!queryId.value.trim()) return;
  const result = await run(() => getOrder(queryId.value.trim()));
  if (result) selectedOrder.value = result;
};
const createNewOrder = async () => {
  if (
    !orderForm.value.merchantId.trim() ||
    !orderForm.value.merchantOrderNo.trim() ||
    !orderForm.value.productCode.trim() ||
    !orderForm.value.paymentMethod.trim() ||
    !orderForm.value.country.trim() ||
    !orderForm.value.currency.trim() ||
    !Number.isFinite(orderForm.value.amount) ||
    orderForm.value.amount <= 0
  ) {
    notice.value = "请完整填写订单的商户、产品、支付方式、国家、币种和金额";
    return;
  }
  const expireAt = orderForm.value.expireAt?.trim();
  const parsedExpireAt = expireAt ? new Date(expireAt) : null;
  if (parsedExpireAt && Number.isNaN(parsedExpireAt.getTime())) {
    notice.value = "请输入有效的订单过期时间";
    return;
  }
  const payload: CreateOrderRequest = {
    ...orderForm.value,
    merchantId: orderForm.value.merchantId.trim(),
    merchantOrderNo: orderForm.value.merchantOrderNo.trim(),
    productCode: orderForm.value.productCode.trim().toUpperCase(),
    paymentMethod: orderForm.value.paymentMethod.trim().toUpperCase(),
    country: orderForm.value.country.trim().toUpperCase(),
    currency: orderForm.value.currency.trim().toUpperCase(),
    expireAt: parsedExpireAt?.toISOString(),
    notifyUrl: orderForm.value.notifyUrl?.trim() || undefined,
    returnUrl: orderForm.value.returnUrl?.trim() || undefined,
    customerReference: orderForm.value.customerReference?.trim() || undefined,
    payoutDestinationRef: orderForm.value.payoutDestinationRef?.trim() || undefined,
    description: orderForm.value.description?.trim() || undefined,
  };
  const key = crypto.randomUUID();
  const result = await run(
    () => createOrder(payload, key),
    "订单创建成功",
  );
  if (result) {
    selectedOrder.value = result;
    queryId.value = result.orderId;
    orderDrawer.value = "detail";
  }
};
const openCreateOrder = () => {
  orderForm.value = {
    merchantId: orderForm.value.merchantId || "merchant-demo",
    merchantOrderNo: `web-${Date.now()}`,
    productCode: orderForm.value.productCode || "CARD-US-USD",
    paymentMethod: orderForm.value.paymentMethod || "CARD",
    country: orderForm.value.country || "US",
    currency: orderForm.value.currency || "USD",
    amount: orderForm.value.amount || 100,
  };
  orderDrawer.value = "create";
};
const formatOrderTime = (value?: string) => value?.replace("T", " ").replace(/\.\d+Z?$/, "") || "--";
const inspectOrder = async (order: Order) => {
  selectedOrder.value = order;
  queryId.value = order.orderId;
  orderDrawer.value = "detail";
  const result = await run(() => getOrder(order.orderId));
  if (result) selectedOrder.value = result;
};
const refreshOrderStatus = async () => {
  if (!selectedOrder.value) return;
  const result = await run(
    () => getOrder(selectedOrder.value!.orderId),
    "订单状态已刷新",
  );
  if (result) selectedOrder.value = result;
};
const cancelSelectedOrder = async () => {
  if (!selectedOrder.value || cancelOrderDisabledReason.value) return;
  const result = await run(() => cancelOrder(selectedOrder.value!.orderId), "订单已取消");
  if (result) selectedOrder.value = result;
};
const resendNotification = async () => {
  if (!selectedOrder.value || notificationDisabledReason.value) return;
  const result = await run(
    () => resendOrderNotification(selectedOrder.value!.orderId, "后台人工再次通知"),
    "商户通知已重新入队",
  );
  if (result) selectedOrder.value = result;
};
const loadSnapshot = async () => {
  const result = await run(() => getSnapshot(snapshotForm.value));
  if (result) snapshot.value = result;
};
const checkHealth = async () => {
  const result = await run(() => getChannelHealth("simulated-channel"));
  if (result) channelHealth.value = result.status;
};
const refresh = async () => {
  if (active.value !== "总览") return;
  await loadOverview();
  await checkHealth();
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
      <div class="account-area">
        <button
          class="operator"
          :aria-expanded="accountMenuOpen"
          :title="accountCopy.account"
          @click="accountMenuOpen = !accountMenuOpen"
        >
          <span class="account-avatar"><UserRound :size="16" /></span>
          <span class="operator-info">
            <strong>{{ authState.user?.displayName }}</strong>
            <small>{{ authState.user?.roles.join(" · ") }} · {{ authState.user?.username }}</small>
          </span>
          <ChevronDown class="account-chevron" :size="16" :class="{ open: accountMenuOpen }" />
        </button>
        <div v-if="accountMenuOpen" class="account-menu" role="menu">
          <div class="account-summary">
            <span class="account-avatar"><UserRound :size="16" /></span>
            <div><strong>{{ authState.user?.displayName }}</strong><small>{{ authState.user?.username }}</small></div>
          </div>
          <button class="account-action" role="menuitem" @click="openPasswordDrawer">
            <KeyRound :size="16" /><span>{{ accountCopy.changePassword }}</span>
          </button>
          <div class="account-setting">
            <span class="account-setting-label"><Languages :size="16" />{{ accountCopy.language }}</span>
            <div class="account-segmented" :aria-label="accountCopy.language">
              <button :class="{ active: preferences.locale === 'zh-CN' }" title="简体中文" @click="selectLocale('zh-CN')">中</button>
              <button :class="{ active: preferences.locale === 'en-US' }" title="English" @click="selectLocale('en-US')">EN</button>
            </div>
          </div>
          <div class="account-setting">
            <span class="account-setting-label"><Palette :size="16" />{{ accountCopy.appearance }}</span>
            <div class="theme-swatches" :aria-label="accountCopy.appearance">
              <button class="theme-swatch indigo" :class="{ active: preferences.theme === 'indigo' }" title="Indigo" @click="selectTheme('indigo')"><Check v-if="preferences.theme === 'indigo'" :size="13" /></button>
              <button class="theme-swatch blue" :class="{ active: preferences.theme === 'blue' }" title="Blue" @click="selectTheme('blue')"><Check v-if="preferences.theme === 'blue'" :size="13" /></button>
              <button class="theme-swatch emerald" :class="{ active: preferences.theme === 'emerald' }" title="Emerald" @click="selectTheme('emerald')"><Check v-if="preferences.theme === 'emerald'" :size="13" /></button>
              <button class="theme-swatch midnight" :class="{ active: preferences.theme === 'midnight' }" :title="preferences.locale === 'en-US' ? 'Tech dark' : '科技暗色'" @click="selectTheme('midnight')"><Check v-if="preferences.theme === 'midnight'" :size="13" /></button>
            </div>
          </div>
          <button class="account-action account-signout" role="menuitem" @click="handleSignOut">
            <LogOut :size="16" /><span>{{ accountCopy.signOut }}</span>
          </button>
        </div>
      </div>
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
      <template v-if="isOverview">
        <section class="metrics">
          <article>
            <div class="metric-head"><span>支付成功率</span><i class="metric-icon success"><Activity :size="16" /></i></div>
            <strong>{{ overview?.paymentSuccessRate ?? "--" }}<small>%</small></strong>
            <em>累计订单口径</em>
          </article>
          <article>
            <div class="metric-head"><span>订单名义金额</span><i class="metric-icon accent"><CircleDollarSign :size="16" /></i></div>
            <strong>{{ overview?.paymentVolume?.toLocaleString() ?? "--" }}</strong>
            <em>全币种累计</em>
          </article>
          <article>
            <div class="metric-head"><span>交易商户</span><i class="metric-icon blue"><Store :size="16" /></i></div>
            <strong>{{ overview?.activeMerchants ?? "--" }}</strong>
            <em>历史去重</em>
          </article>
          <article>
            <div class="metric-head"><span>待发布配置</span><i class="metric-icon warning"><Settings2 :size="16" /></i></div>
            <strong>{{ overview?.pendingReleases ?? "--" }}</strong>
            <em>需要关注</em>
          </article>
        </section>
        <section class="content-grid">
          <article class="panel">
            <div class="panel-title">
              <div>
                <span class="eyebrow">CHANNEL HEALTH</span>
                <h3>渠道健康度</h3>
              </div>
              <button class="icon-btn" @click="checkHealth">
                <RefreshCw :size="16" />
              </button>
            </div>
            <div
              v-for="channel in overview?.channelHealth || []"
              :key="channel.channelId"
              class="health-row"
            >
              <span
                class="status-dot"
                :class="channel.status.toLowerCase()"
              ></span>
              <div>
                <strong>{{ channel.name }}</strong
                ><small>{{ channel.channelId }}</small>
              </div>
              <b>{{ channel.successRate }}%</b
              ><span class="health-status">{{ channel.status }}</span>
            </div>
          </article>
          <article class="panel">
            <div class="panel-title">
              <div>
                <span class="eyebrow">QUICK CHECK</span>
                <h3>配置快照验证</h3>
              </div>
            </div>
            <div class="form-grid">
              <input
                v-model="snapshotForm.merchantId"
                placeholder="商户 ID"
              /><input
                v-model="snapshotForm.productCode"
                placeholder="产品编码"
              /><input
                v-model="snapshotForm.paymentMethod"
                placeholder="支付方式"
              /><input v-model="snapshotForm.currency" placeholder="币种" />
            </div>
            <button class="primary-btn" :disabled="busy" @click="loadSnapshot">
              {{ busy ? "查询中…" : "查询已发布快照" }}
            </button>
            <pre v-if="snapshot">{{ JSON.stringify(snapshot, null, 2) }}</pre>
          </article>
        </section>
      </template>
      <section
        v-else-if="active === '订单管理'"
        class="panel workspace-panel order-management-panel"
      >
        <div class="panel-title">
          <div>
            <span class="eyebrow">TRADE OPERATIONS</span>
            <h3>订单列表</h3>
          </div>
        </div>
        <form class="order-list-filter" @submit.prevent="loadOrders(1)">
          <div class="order-filter-fields">
            <label class="management-form-item"><span>商户</span><select v-model="orderFilters.merchantId"><option value="">全部商户</option><option v-for="merchant in orderFilterMerchants" :key="merchant.merchantId" :value="merchant.merchantId">{{ merchant.name }} · {{ merchant.merchantId }}</option></select></label>
            <label class="management-form-item"><span>订单类型</span><select v-model="orderFilters.orderType"><option value="">全部类型</option><option value="PAYIN">收单</option><option value="PAYOUT">出款</option></select></label>
            <label class="management-form-item"><span>订单状态</span><select v-model="orderFilters.status"><option value="">全部状态</option><option value="CREATED">已创建</option><option value="PAYING">处理中</option><option value="SUCCESS">成功</option><option value="FAILED">失败</option><option value="UNKNOWN">待确认</option><option value="CANCELED">已取消</option></select></label>
            <label class="management-form-item"><span>交易币种</span><select v-model="orderFilters.currency"><option value="">全部币种</option><option v-for="currency in orderFilterCurrencies" :key="currency.code" :value="currency.code">{{ currency.code }} · {{ currency.name }}</option></select></label>
          </div>
          <div class="order-filter-actions"><span class="toolbar-summary">共 {{ orderPage.total }} 笔订单</span><button class="outline-btn" type="button" @click="resetOrderFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button class="primary-btn" type="button" @click="openCreateOrder">创建订单</button></div>
        </form>
        <div v-if="!listLoading && orderPage.items.length" class="table-wrap order-list">
          <table class="data-table">
            <thead>
              <tr><th>商户订单号</th><th>订单 ID</th><th>商户</th><th class="num">订单金额</th><th class="num">付款实付</th><th class="num">商户净额</th><th>承担方</th><th>状态</th><th class="actions">操作</th></tr>
            </thead>
            <tbody>
              <tr
                v-for="order in orderPage.items"
                :key="order.orderId"
                :class="{ selected: selectedOrder?.orderId === order.orderId }"
              >
                <td><strong>{{ order.merchantOrderNo }}</strong><small class="order-type-label" :class="order.orderType === 'PAYOUT' ? 'payout' : 'payin'">{{ order.orderType === "PAYOUT" ? "出款" : "收单" }}</small></td>
                <td class="mono">{{ order.orderId }}</td>
                <td class="mono">{{ order.merchantId }}</td>
                <td class="num mono">{{ order.amount }} {{ order.currency }}</td>
                <td class="num mono">{{ order.payerPayableAmount ?? order.amount }} {{ order.currency }}</td>
                <td class="num mono">{{ order.netAmount ?? order.amount }} {{ order.currency }}</td>
                <td>{{ order.feeBearer === "PAYER" ? "付款方" : "商户" }}</td>
                <td><span class="status-badge" :class="'st-' + order.status.toLowerCase()">{{ order.status }}</span></td>
                <td class="actions"><button class="icon-btn" title="查看订单详情" @click.stop="inspectOrder(order)"><Eye :size="16" /></button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="listLoading" class="empty">
          <LoaderCircle class="spin" :size="22" />加载中…
        </div>
        <div v-else class="empty">暂无订单数据</div>
        <div v-if="orderPage.total" class="pagination">
          <button
            class="outline-btn"
            :disabled="orderPage.page <= 1"
            @click="loadOrders(orderPage.page - 1)"
          >
            上一页</button
          ><span
            >第 {{ orderPage.page }} 页 / 共
            {{ Math.ceil(orderPage.total / orderPage.pageSize) }} 页（{{
              orderPage.total
            }}
            条）</span
          ><button
            class="outline-btn"
            :disabled="
              orderPage.page >= Math.ceil(orderPage.total / orderPage.pageSize)
            "
            @click="loadOrders(orderPage.page + 1)"
          >
            下一页
          </button>
        </div>
        <AppDrawer
          v-if="orderDrawer"
          :title="orderDrawer === 'create' ? '创建支付订单' : '订单详情与处置'"
          :description="orderDrawer === 'create' ? 'PAYMENT ORDER' : 'ORDER OPERATIONS'"
          @close="orderDrawer = null"
        >
          <form v-if="orderDrawer === 'create'" class="order-create-form" @submit.prevent="createNewOrder">
            <section class="drawer-section">
              <div class="drawer-section-heading"><div><h4>交易主体</h4><small>订单会按商户、产品、支付方式、国家和币种匹配已发布路由与费率。</small></div></div>
              <div class="drawer-form-grid">
                <label class="form-field"><span>商户 ID <b>*</b></span><input v-model="orderForm.merchantId" maxlength="64" placeholder="例如 merchant-demo" /></label>
                <label class="form-field"><span>商户订单号 <b>*</b></span><input v-model="orderForm.merchantOrderNo" maxlength="128" placeholder="商户侧唯一订单号" /></label>
                <label class="form-field"><span>产品编码 <b>*</b></span><input v-model="orderForm.productCode" maxlength="64" placeholder="例如 CARD-US-USD" @input="orderForm.productCode = orderForm.productCode.toUpperCase()" /></label>
                <label class="form-field"><span>支付方式 <b>*</b></span><input v-model="orderForm.paymentMethod" maxlength="64" placeholder="例如 CARD" @input="orderForm.paymentMethod = orderForm.paymentMethod.toUpperCase()" /></label>
                <label class="form-field"><span>国家/地区 <b>*</b></span><input v-model="orderForm.country" maxlength="8" placeholder="例如 US" @input="orderForm.country = orderForm.country.toUpperCase()" /></label>
                <label class="form-field"><span>币种 <b>*</b></span><input v-model="orderForm.currency" maxlength="8" placeholder="例如 USD" @input="orderForm.currency = orderForm.currency.toUpperCase()" /></label>
              </div>
            </section>
            <section class="drawer-section">
              <div class="drawer-section-heading"><div><h4>金额与时效</h4><small>实付金额和商户净额将在订单创建后按当前费率规则计算并固化。</small></div></div>
              <div class="drawer-form-grid">
                <label class="form-field"><span>订单金额 <b>*</b></span><input v-model.number="orderForm.amount" type="number" min="0.01" step="0.01" placeholder="0.00" /></label>
                <label class="form-field"><span>过期时间</span><input v-model="orderForm.expireAt" type="datetime-local" /></label>
              </div>
            </section>
            <section class="drawer-section">
              <div class="drawer-section-heading"><div><h4>通知与附加信息</h4><small>通知与跳转地址须为有效的 HTTP(S) 绝对地址。</small></div></div>
              <div class="drawer-form-grid">
                <label class="form-field"><span>异步通知地址</span><input v-model="orderForm.notifyUrl" type="url" maxlength="1024" placeholder="https://merchant.example/notify" /></label>
                <label class="form-field"><span>支付完成跳转地址</span><input v-model="orderForm.returnUrl" type="url" maxlength="1024" placeholder="https://merchant.example/return" /></label>
                <label class="form-field"><span>付款人引用</span><input v-model="orderForm.customerReference" maxlength="128" placeholder="内部可识别的付款人引用" /></label>
                <label class="form-field"><span>收款方引用</span><input v-model="orderForm.payoutDestinationRef" maxlength="128" placeholder="出款产品必填；仅填写脱敏内部引用" /></label>
                <label class="form-field"><span>订单描述</span><input v-model="orderForm.description" maxlength="1000" placeholder="订单说明（可选）" /></label>
              </div>
            </section>
            <div class="drawer-actions"><button type="button" class="outline-btn" @click="orderDrawer = null">取消</button><button class="primary-btn" type="submit" :disabled="busy">{{ busy ? "创建中" : "创建订单" }}</button></div>
          </form>
          <template v-else>
            <div v-if="!selectedOrder" class="drawer-section">
              <p class="drawer-copy">输入订单 ID 后可查看状态、支付尝试和退款信息。</p>
              <div class="search-row drawer-search">
                <input v-model="queryId" placeholder="输入订单 ID" autofocus @keyup.enter="findOrder" />
                <button class="primary-btn" @click="findOrder"><Search :size="16" />查询</button>
              </div>
            </div>
            <template v-else>
              <div class="order-detail-hero">
                <div><span class="eyebrow">{{ selectedOrder.orderId }}</span><h4>{{ selectedOrder.merchantOrderNo }} <small class="order-type-label" :class="selectedOrder.orderType === 'PAYOUT' ? 'payout' : 'payin'">{{ selectedOrder.orderType === "PAYOUT" ? "出款订单" : "收单订单" }}</small></h4><p>{{ selectedOrder.merchantId }} · {{ selectedOrder.productCode }} · {{ selectedOrder.paymentMethod }}</p></div>
                <span class="status-badge" :class="'st-' + selectedOrder.status.toLowerCase()">{{ selectedOrder.status }}</span>
              </div>
              <div class="order-amount-grid">
                <div><span>订单金额</span><strong>{{ selectedOrder.amount }} {{ selectedOrder.currency }}</strong></div>
                <div><span>付款实付</span><strong>{{ selectedOrder.payerPayableAmount ?? selectedOrder.amount }} {{ selectedOrder.currency }}</strong></div>
                <div><span>商户净额</span><strong>{{ selectedOrder.netAmount ?? selectedOrder.amount }} {{ selectedOrder.currency }}</strong></div>
              </div>
              <section class="drawer-section order-detail-section">
                <h4>交易信息</h4>
                <dl class="order-detail-list"><div><dt>国家/地区</dt><dd>{{ selectedOrder.country || "--" }}</dd></div><div><dt>创建时间</dt><dd>{{ formatOrderTime(selectedOrder.createdAt) }}</dd></div><div><dt>过期时间</dt><dd>{{ formatOrderTime(selectedOrder.expireAt) }}</dd></div><div><dt>支付完成时间</dt><dd>{{ formatOrderTime(selectedOrder.paidAt) }}</dd></div><div><dt>支付令牌</dt><dd class="mono breakable">{{ selectedOrder.paymentToken || "--" }}</dd></div><div><dt>付款人引用</dt><dd>{{ selectedOrder.customerReference || "--" }}</dd></div><div v-if="selectedOrder.orderType === 'PAYOUT'"><dt>收款方引用</dt><dd>{{ selectedOrder.payoutDestinationRef || "--" }}</dd></div></dl>
              </section>
              <section class="drawer-section order-detail-section">
                <h4>费用与通知</h4>
                <dl class="order-detail-list"><div><dt>费用承担</dt><dd>{{ selectedOrder.feeBearer === "PAYER" ? "付款方承担" : "商户承担" }}</dd></div><div><dt>手续费</dt><dd>{{ selectedOrder.feeAmount ?? 0 }} {{ selectedOrder.currency }}</dd></div><div><dt>异步通知</dt><dd class="breakable">{{ selectedOrder.notifyUrl || "--" }}</dd></div><div><dt>通知状态</dt><dd>{{ selectedOrder.callbackStatus || "NOT_CONFIGURED" }}<small v-if="selectedOrder.callbackAttemptCount"> · {{ selectedOrder.callbackAttemptCount }} 次</small></dd></div><div><dt>最近投递</dt><dd>{{ formatOrderTime(selectedOrder.callbackLastNotifiedAt) }}</dd></div><div><dt>完成跳转</dt><dd class="breakable">{{ selectedOrder.returnUrl || "--" }}</dd></div></dl>
                <p v-if="selectedOrder.callbackLastError" class="order-notification-error">{{ selectedOrder.callbackLastError }}</p>
                <p v-if="selectedOrder.description" class="order-description">{{ selectedOrder.description }}</p>
              </section>
              <section class="drawer-section order-detail-section">
                <h4>路由与费率快照</h4>
                <pre class="snapshot-preview">{{ selectedOrder.routeSnapshot || "--" }}\n{{ selectedOrder.pricingSnapshot || "--" }}</pre>
              </section>
              <section class="drawer-section order-detail-section">
                <h4>商户请求参数</h4>
                <pre class="snapshot-preview">{{ selectedOrder.merchantRequestSnapshot || "历史订单未记录" }}</pre>
              </section>
              <section class="drawer-section order-detail-section">
                <h4>渠道处理结果</h4>
                <dl class="order-detail-list"><div><dt>渠道</dt><dd>{{ selectedOrder.channelId || "--" }}</dd></div><div><dt>渠道订单号</dt><dd class="mono breakable">{{ selectedOrder.channelOrderId || "--" }}</dd></div><div><dt>渠道状态</dt><dd>{{ selectedOrder.channelStatus || "--" }}</dd></div></dl>
                <pre class="snapshot-preview">{{ selectedOrder.channelResponseSnapshot || "暂未收到渠道返回" }}</pre>
              </section>
              <div class="drawer-section">
                <h4>订单处置</h4>
                <div class="button-row drawer-actions">
                  <button class="outline-btn" :disabled="busy" title="重新读取订单最新状态" @click="refreshOrderStatus"><RefreshCw :size="16" />刷新状态</button>
                  <button class="danger-btn" :disabled="busy || !!cancelOrderDisabledReason" :title="cancelOrderDisabledReason || '取消未完成订单'" @click="cancelSelectedOrder"><XCircle :size="16" />取消订单</button>
                  <button class="outline-btn" :disabled="busy || !!notificationDisabledReason" :title="notificationDisabledReason || '将成功订单的通知重新加入投递队列'" @click="resendNotification">再次通知商户</button>
                </div>
                <p v-if="cancelOrderDisabledReason" class="order-action-hint">取消订单不可用：{{ cancelOrderDisabledReason }}</p>
                <p v-if="notificationDisabledReason" class="order-action-hint">再次通知不可用：{{ notificationDisabledReason }}</p>
              </div>
              <RefundView v-if="selectedOrder.orderType === 'PAYIN' && selectedOrder.status === 'SUCCESS'" :order="selectedOrder" @notice="notice = $event" />
            </template>
          </template>
        </AppDrawer>
      </section>
      <PermissionManagementView
        v-else-if="active === '角色权限'"
        @notice="notice = $event"
      />
      <!--
        <div class="panel-title">
          <div>
            <span class="eyebrow">ACCESS CONTROL</span>
            <h3>角色权限配置</h3>
          </div>
          <button class="outline-btn" @click="loadRolePermissions">刷新</button>
        </div>
        <div class="split-panel">
          <div class="role-list">
            <button
              v-for="role in roles"
              :key="role.roleCode"
              :class="{ active: selectedRole === role.roleCode }"
              @click="selectRole(role.roleCode)"
            >
              {{ role.roleName }}<small>{{ role.roleCode }}</small>
            </button>
          </div>
          <div>
            <h4>菜单权限</h4>
            <div class="check-grid">
              <label
                v-for="item in permissionCatalog?.menus || []"
                :key="item.menuCode"
                ><input
                  v-model="selectedMenuCodes"
                  type="checkbox"
                  :value="item.menuCode"
                />{{ item.menuName }}</label
              >
            </div>
            <h4>操作权限</h4>
            <div class="check-grid">
              <label
                v-for="item in permissionCatalog?.permissions || []"
                :key="item.permissionCode"
                ><input
                  v-model="selectedPermissionCodes"
                  type="checkbox"
                  :value="item.permissionCode"
                />{{ item.permissionName
                }}<small>{{ item.permissionCode }}</small></label
              >
            </div>
            <button
              v-if="hasPermission('system:role:update')"
              class="primary-btn"
              @click="saveRolePermissions"
            >
              保存权限配置
            </button>
          </div>
        </div>
      </section> -->
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
      <!--
        <div class="panel-title">
          <div>
            <span class="eyebrow">PRODUCTS</span>
            <h3>产品管理</h3>
          </div>
          <button class="outline-btn" @click="loadProducts">刷新</button>
        </div>
        <div class="form-grid">
          <input
            v-model="productForm.productCode"
            :disabled="!!editingProduct"
            placeholder="产品编码"
          /><input v-model="productForm.name" placeholder="产品名称" /><button
            v-if="
              hasPermission(
                editingProduct ? 'product:update' : 'product:create',
              )
            "
            class="primary-btn"
            @click="saveProduct"
          >
            {{ editingProduct ? "保存编辑" : "新增产品" }}
          </button>
        </div>
        <div v-if="listLoading" class="empty">加载中…</div>
        <div v-else class="record-list">
          <div
            v-for="product in products"
            :key="product.productCode"
            class="record-row"
          >
            <div>
              <strong>{{ product.name }}</strong
              ><small>{{ product.productCode }}</small>
            </div>
            <span class="status-badge">{{ product.status }}</span
            ><button
              v-if="hasPermission('product:update')"
              class="outline-btn"
              @click="editProduct(product)"
            >
              编辑</button
            ><button
              v-if="hasPermission('product:status')"
              class="outline-btn"
              @click="toggleProduct(product)"
            >
              {{ product.status === "ACTIVE" ? "停用" : "启用" }}
            </button>
          </div>
        </div>
        <div v-if="editingProduct" class="detail-panel">
          <h4>产品能力（{{ editingProduct.productCode }}）</h4>
          <div
            v-for="capability in capabilities"
            :key="capability.capabilityId"
            class="record-row"
          >
            <div>
              <strong
                >{{ capability.paymentMethod }} · {{ capability.country }}/{{
                  capability.currency
                }}</strong
              ><small
                >{{ capability.minAmount }} - {{ capability.maxAmount }}</small
              >
            </div>
            <span class="status-badge">{{ capability.status }}</span>
          </div>
        </div>
      </section> -->
      <UserManagementView
        v-else-if="active === '用户管理'"
        @notice="notice = $event"
      />
      <!--
        <div class="panel-title">
          <div>
            <span class="eyebrow">SYSTEM USERS</span>
            <h3>用户管理</h3>
          </div>
          <button class="outline-btn" @click="loadUsers">
            <RefreshCw :size="16" />刷新
          </button>
        </div>
        <div class="form-grid binding-form">
          <input v-model="userForm.username" placeholder="用户名" /><input
            v-model="userForm.displayName"
            placeholder="显示名"
          /><input
            v-model="userForm.password"
            type="password"
            placeholder="初始密码（至少 12 位）"
          /><select v-model="userForm.roles">
            <option
              v-for="role in roles"
              :key="role.roleCode"
              :value="role.roleCode"
            >
              {{ role.roleName }}（{{ role.roleCode }}）
            </option></select
          ><button class="primary-btn" @click="createNewUser">创建用户</button>
        </div>
        <div v-if="listLoading" class="empty">
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
      </section> -->
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
        @notice="notice = $event"
      />
      <ConfigurationCenterView
        v-else-if="active === '费率管理'"
        section="pricing"
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
      <MenuManagementView
        v-else-if="active === '菜单管理'"
        @notice="notice = $event"
      />
      <section v-else-if="!active" class="panel workspace-panel">
        <div class="empty">当前账号未获授权菜单，请联系管理员。</div>
      </section>
    </main>
    <AppDrawer
      v-if="accountDrawer === 'password'"
      :title="accountCopy.passwordTitle"
      :description="accountCopy.passwordDescription"
      @close="accountDrawer = null"
    >
      <form class="drawer-section password-form" @submit.prevent="savePassword">
        <p class="drawer-copy">{{ accountCopy.passwordRule }}</p>
        <label>
          <span>{{ accountCopy.currentPassword }}</span>
          <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required />
        </label>
        <label>
          <span>{{ accountCopy.newPassword }}</span>
          <input v-model="passwordForm.newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
        </label>
        <label>
          <span>{{ accountCopy.confirmPassword }}</span>
          <input v-model="passwordForm.confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
        </label>
        <button class="primary-btn drawer-submit" type="submit" :disabled="passwordSaving">
          {{ accountCopy.savePassword }}
        </button>
      </form>
    </AppDrawer>
  </div>
</template>
