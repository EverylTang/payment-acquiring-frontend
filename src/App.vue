<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Activity,
  CircleDollarSign,
  LayoutDashboard,
  Layers3,
  Link,
  LoaderCircle,
  Network,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  WalletCards,
  XCircle,
} from "lucide-vue-next";
import {
  bindMerchantProduct,
  callbackOrder,
  cancelOrder,
  changeMerchantStatus,
  changeProductStatus,
  createMerchant,
  createOrder,
  createProduct,
  createUser,
  getAdminList,
  getChannelHealth,
  getMerchant,
  getMerchantCallback,
  getMerchantContacts,
  getMerchantCredentials,
  getMerchantProfile,
  getMerchantProducts,
  getMerchants,
  getOrder,
  getOrderHealth,
  getOrderPage,
  getOrderStatistics,
  getOverview,
  getPermissionCatalog,
  getProductCapabilities,
  getProducts,
  getRolePermissions,
  getRoles,
  getSnapshot,
  getUsers,
  revokeMerchantCredential,
  rotateMerchantCredential,
  updateMerchant,
  updateMerchantProduct,
  updateProduct,
  updateRolePermissions,
  type AdminRecord,
  type AdminRole,
  type AdminUser,
  type CreateOrderRequest,
  type DashboardOverview,
  type Merchant,
  type MerchantCallback,
  type MerchantContact,
  type MerchantCredential,
  type MerchantProduct,
  type MerchantProfile,
  type Order,
  type OrderPage,
  type PermissionCatalog,
  type Product,
  type ProductCapability,
} from "./api";
import { authState, hasPermission, signOut } from "./auth";
import MerchantDetailView from "./MerchantDetailView.vue";
import UserManagementView from "./UserManagementView.vue";
import ProductManagementView from "./ProductManagementView.vue";
import PermissionManagementView from "./PermissionManagementView.vue";
import RefundView from "./RefundView.vue";
import OperationsView from "./OperationsView.vue";

const active = ref("总览");
const busy = ref(false);
const notice = ref("");
const queryId = ref("");
const selectedOrder = ref<Order | null>(null);
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
const records = ref<AdminRecord[]>([]);
const merchants = ref<Merchant[]>([]);
const merchantPage = ref({ page: 1, pageSize: 20, total: 0 });
const selectedMerchant = ref<Merchant | null>(null);
const merchantProfile = ref<MerchantProfile | null>(null);
const merchantContacts = ref<MerchantContact[]>([]);
const merchantCallback = ref<MerchantCallback | null>(null);
const merchantCredentials = ref<MerchantCredential[]>([]);
const products = ref<Product[]>([]);
const productPage = ref({ page: 1, pageSize: 20, total: 0 });
const capabilities = ref<ProductCapability[]>([]);
const editingMerchant = ref<Merchant | null>(null);
const editingProduct = ref<Product | null>(null);
const merchantForm = ref({
  merchantId: "",
  name: "",
  settlementCurrency: "USD",
});
const productForm = ref({ productCode: "", name: "" });
const rolesPermissions = ref<
  Record<string, { menuCodes: string[]; permissionCodes: string[] }>
>({});
const permissionCatalog = ref<PermissionCatalog | null>(null);
const selectedRole = ref("ADMIN");
const selectedMenuCodes = ref<string[]>([]);
const selectedPermissionCodes = ref<string[]>([]);
const merchantProducts = ref<MerchantProduct[]>([]);
const merchantProductPage = ref({ page: 1, pageSize: 20, total: 0 });
const editingMerchantProduct = ref<MerchantProduct | null>(null);
const users = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const userForm = ref({
  username: "",
  password: "",
  displayName: "",
  roles: "OPS",
});
const bindingForm = ref({
  merchantId: "merchant-demo",
  productCode: "CARD-US-USD",
});
const orderPage = ref<OrderPage>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
});
const orderFilters = ref({ merchantId: "", status: "", currency: "" });
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
};
const menu = computed(() => {
  const accessMenu = (authState.access?.menus || [])
    .filter((item) => item.menuType === "PAGE")
    .map((item) => ({
      label: item.menuName,
      icon: iconMap[item.icon as keyof typeof iconMap] || Store,
    }));
  return accessMenu.length ? accessMenu : fallbackMenu;
});
const fallbackMenu = [
  { label: "总览", icon: LayoutDashboard },
  { label: "订单与支付", icon: WalletCards },
  { label: "商户管理", icon: Store },
  { label: "产品管理", icon: Layers3 },
  { label: "商户产品", icon: Link },
  { label: "运营处置", icon: ShieldCheck },
];
const resourceMap: Record<string, string> = {
  商户管理: "merchants",
  产品管理: "products",
  路由与渠道: "channels",
  费率与结算: "pricing-rules",
  风控工作台: "risk-policies",
};
const isOverview = computed(() => active.value === "总览");
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
  if (label === "订单与支付") {
    await loadOrders();
    return;
  }
  if (label === "商户产品") {
    await loadMerchantProducts();
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
    await loadMerchants();
    return;
  }
  if (label === "产品管理") {
    await loadProducts();
    return;
  }
  const resource = resourceMap[label];
  if (!resource) return;
  listLoading.value = true;
  try {
    records.value = (await getAdminList(resource)).items;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "列表加载失败";
  } finally {
    listLoading.value = false;
  }
};
const loadRolePermissions = async () => {
  listLoading.value = true;
  try {
    const [roleList, catalog] = await Promise.all([
      getRoles(),
      getPermissionCatalog(),
    ]);
    roles.value = roleList.items;
    permissionCatalog.value = catalog;
    await selectRole(selectedRole.value || roleList[0]?.roleCode);
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
const saveRolePermissions = async () => {
  const result = await run(
    () =>
      updateRolePermissions(selectedRole.value, {
        menuCodes: selectedMenuCodes.value,
        permissionCodes: selectedPermissionCodes.value,
      }),
    "角色权限已保存",
  );
  if (result) rolesPermissions.value[selectedRole.value] = result;
};
const loadMerchants = async (page = merchantPage.value.page) => {
  listLoading.value = true;
  try {
    const result = await getMerchants({
      page,
      pageSize: merchantPage.value.pageSize,
    });
    merchants.value = result.items;
    merchantPage.value = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "商户加载失败";
  } finally {
    listLoading.value = false;
  }
};
const openMerchantDetail = async (merchant: Merchant) => {
  selectedMerchant.value = merchant;
  active.value = "商户详情";
  listLoading.value = true;
  try {
    const [detail, profile, contacts, callback, credentials] =
      await Promise.all([
        getMerchant(merchant.merchantId),
        getMerchantProfile(merchant.merchantId),
        getMerchantContacts(merchant.merchantId),
        getMerchantCallback(merchant.merchantId),
        getMerchantCredentials(merchant.merchantId),
      ]);
    selectedMerchant.value = detail;
    merchantProfile.value = profile;
    merchantContacts.value = contacts;
    merchantCallback.value = callback;
    merchantCredentials.value = credentials;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "商户详情加载失败";
  } finally {
    listLoading.value = false;
  }
};
const rotateCredential = async (type: "API" | "WEBHOOK") => {
  if (!selectedMerchant.value) return;
  const result = await run(
    () => rotateMerchantCredential(selectedMerchant.value!.merchantId, type),
    "凭证已轮换，请立即保存新密钥",
  );
  if (result) {
    notice.value = `${notice.value} 新密钥：${result.secret}`;
    merchantCredentials.value = await getMerchantCredentials(
      selectedMerchant.value.merchantId,
    );
  }
};
const revokeCredential = async (credential: MerchantCredential) => {
  if (!selectedMerchant.value) return;
  const result = await run(
    () =>
      revokeMerchantCredential(
        selectedMerchant.value!.merchantId,
        credential.credentialId,
      ),
    "凭证已撤销",
  );
  if (result === undefined) credential.status = "REVOKED";
};
const saveMerchant = async () => {
  const result = editingMerchant.value
    ? await run(
        () =>
          updateMerchant(editingMerchant.value!.merchantId, {
            name: merchantForm.value.name,
            settlementCurrency: merchantForm.value.settlementCurrency,
          }),
        "商户已更新",
      )
    : await run(() => createMerchant(merchantForm.value), "商户创建成功");
  if (result) {
    editingMerchant.value = null;
    merchantForm.value = {
      merchantId: "",
      name: "",
      settlementCurrency: "USD",
    };
    await loadMerchants();
  }
};
const editMerchant = (merchant: Merchant) => {
  openMerchantDetail(merchant);
};
const toggleMerchant = async (merchant: Merchant) => {
  const result = await run(
    () =>
      changeMerchantStatus(
        merchant.merchantId,
        merchant.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      ),
    "商户状态已更新",
  );
  if (result) Object.assign(merchant, result);
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
const saveProduct = async () => {
  const result = editingProduct.value
    ? await run(
        () =>
          updateProduct(editingProduct.value!.productCode, {
            name: productForm.value.name,
          }),
        "产品已更新",
      )
    : await run(() => createProduct(productForm.value), "产品创建成功");
  if (result) {
    editingProduct.value = null;
    productForm.value = { productCode: "", name: "" };
    await loadProducts();
  }
};
const editProduct = async (product: Product) => {
  editingProduct.value = product;
  productForm.value = { productCode: product.productCode, name: product.name };
  capabilities.value = (
    await getProductCapabilities(product.productCode)
  ).items;
};
const toggleProduct = async (product: Product) => {
  const result = await run(
    () =>
      changeProductStatus(
        product.productCode,
        product.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      ),
    "产品状态已更新",
  );
  if (result) Object.assign(product, result);
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
const createNewUser = async () => {
  const result = await run(
    () =>
      createUser({
        ...userForm.value,
        roles: userForm.value.roles
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean),
      }),
    "用户创建成功",
  );
  if (result) {
    users.value = [result, ...users.value];
    userForm.value = {
      username: "",
      password: "",
      displayName: "",
      roles: "OPS",
    };
  }
};
const loadMerchantProducts = async () => {
  listLoading.value = true;
  try {
    const result = await getMerchantProducts({
      page: merchantProductPage.value.page,
      pageSize: merchantProductPage.value.pageSize,
    });
    merchantProducts.value = result.items;
    merchantProductPage.value = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "商户产品加载失败";
  } finally {
    listLoading.value = false;
  }
};
const bindProduct = async () => {
  const result = editingMerchantProduct.value
    ? await run(
        () =>
          updateMerchantProduct(
            editingMerchantProduct.value!.bindingId,
            bindingForm.value,
          ),
        "商户产品已更新",
      )
    : await run(
        () => bindMerchantProduct(bindingForm.value),
        "商户产品绑定成功",
      );
  if (result) {
    merchantProducts.value = editingMerchantProduct.value
      ? merchantProducts.value.map((item) =>
          item.bindingId === result.bindingId ? result : item,
        )
      : [result, ...merchantProducts.value];
    editingMerchantProduct.value = null;
  }
};
const editMerchantProduct = (item: MerchantProduct) => {
  editingMerchantProduct.value = item;
  bindingForm.value = {
    merchantId: item.merchantId,
    productCode: item.productCode,
  };
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
const findOrder = async () => {
  if (queryId.value.trim())
    selectedOrder.value = await run(() => getOrder(queryId.value.trim()));
};
const createNewOrder = async () => {
  const key = crypto.randomUUID();
  const result = await run(
    () => createOrder(orderForm.value, key),
    "订单创建成功",
  );
  if (result) {
    selectedOrder.value = result;
    queryId.value = result.orderId;
  }
};
const refreshOrderStatus = async () => {
  if (!selectedOrder.value) return;
  const result = await run(
    () => getOrder(selectedOrder.value!.orderId),
    "订单状态已刷新",
  );
  if (result) selectedOrder.value = result;
};
const mutateOrder = async (kind: "cancel" | "success" | "failed") => {
  if (!selectedOrder.value) return;
  const action =
    kind === "cancel"
      ? cancelOrder(selectedOrder.value.orderId)
      : callbackOrder(selectedOrder.value.orderId, kind.toUpperCase());
  const result = await run(() => action, "订单状态已更新");
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
  await loadOverview();
  await checkHealth();
};
onMounted(async () => {
  try {
    await getOrderHealth();
  } catch {
    serviceOnline.value = false;
  }
  await refresh();
});
</script>

<template>
  <div class="app-shell">
    <aside>
      <div class="brand">
        <span class="brand-mark">P</span>
        <div><strong>PAYMENT OS</strong><small>ACQUIRING CONTROL</small></div>
      </div>
      <div class="workspace">
        <span class="eyebrow">WORKSPACE</span><strong>运营控制台</strong
        ><small>Production / Asia Pacific</small>
      </div>
      <nav>
        <button
          v-for="item in menu"
          :key="item.label"
          :class="{ active: active === item.label }"
          @click="loadPage(item.label)"
        >
          <component :is="item.icon" :size="17" />{{ item.label }}
        </button>
      </nav>
      <button class="operator" title="退出登录" @click="signOut">
        <span class="avatar">{{
          authState.user?.displayName.slice(0, 1)
        }}</span>
        <div>
          <strong>{{ authState.user?.displayName }}</strong
          ><small>{{ authState.user?.roles.join(" · ") }}</small>
        </div>
      </button>
    </aside>
    <main>
      <MerchantDetailView
        v-if="active === '商户详情' && selectedMerchant"
        :merchant="selectedMerchant"
        @back="
          active = '商户管理';
          loadMerchants();
        "
        @notice="notice = $event"
      />
      <header>
        <div>
          <span class="eyebrow">FRIDAY · 21 AUG 2026</span>
          <h1>{{ active }}</h1>
        </div>
        <div class="header-actions">
          <span class="live"
            ><i :class="{ offline: !serviceOnline }"></i
            >{{ serviceOnline ? "交易服务正常" : "交易服务不可用" }}</span
          ><button class="icon-btn" title="刷新数据" @click="refresh">
            <RefreshCw :size="18" /></button
          ><span class="avatar">JP</span>
        </div>
      </header>
      <div v-if="notice" class="notice">{{ notice }}</div>
      <template v-if="isOverview">
        <section class="hero-row">
          <div>
            <p class="eyebrow">实时业务概览 / 累计数据</p>
            <h2>交易脉搏，清晰可见。</h2>
            <p class="subline">所有关键决策都已记录，所有资金流向都可追溯。</p>
          </div>
          <button class="outline-btn" :disabled="busy" @click="refresh">
            <RefreshCw :class="{ spin: busy }" :size="16" /> 刷新数据
          </button>
        </section>
        <section class="metrics">
          <article>
            <span>支付成功率</span
            ><strong
              >{{ overview?.paymentSuccessRate ?? "--"
              }}<small>%</small></strong
            ><em><Activity :size="15" />累计订单</em>
          </article>
          <article>
            <span>订单名义金额</span
            ><strong>{{
              overview?.paymentVolume?.toLocaleString() ?? "--"
            }}</strong
            ><em>全币种累计</em>
          </article>
          <article>
            <span>交易商户</span
            ><strong>{{ overview?.activeMerchants ?? "--" }}</strong
            ><em>历史去重</em>
          </article>
          <article>
            <span>待发布配置</span
            ><strong>{{ overview?.pendingReleases ?? "--" }}</strong
            ><em>需要关注</em>
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
        v-else-if="active === '订单与支付'"
        class="panel workspace-panel"
      >
        <div class="panel-title">
          <div>
            <span class="eyebrow">TRADE OPERATIONS</span>
            <h3>订单查询与处置</h3>
          </div>
          <button class="outline-btn" @click="loadOrders(orderPage.page)">
            <RefreshCw :size="16" />刷新订单
          </button>
        </div>
        <div class="order-filters">
          <input
            v-model="orderFilters.merchantId"
            placeholder="商户 ID"
          /><select v-model="orderFilters.status">
            <option value="">全部状态</option>
            <option value="CREATED">CREATED</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="CANCELED">CANCELED</option></select
          ><input v-model="orderFilters.currency" placeholder="币种" /><button
            class="primary-btn"
            @click="loadOrders(1)"
          >
            <Search :size="16" />筛选
          </button>
        </div>
        <div
          v-if="!listLoading && orderPage.items.length"
          class="record-list order-list"
        >
          <button
            v-for="order in orderPage.items"
            :key="order.orderId"
            class="record-row"
            @click="
              selectedOrder = order;
              queryId = order.orderId;
            "
          >
            <div>
              <strong>{{ order.merchantOrderNo }}</strong
              ><small>{{ order.orderId }} · {{ order.merchantId }}</small>
            </div>
            <b>{{ order.amount }} {{ order.currency }} · {{ order.status }}</b>
          </button>
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
        <div class="order-create">
          <span class="eyebrow">CREATE PAYMENT ORDER</span>
          <div class="form-grid">
            <input v-model="orderForm.merchantId" placeholder="商户 ID" /><input
              v-model="orderForm.merchantOrderNo"
              placeholder="商户订单号"
            /><input
              v-model="orderForm.productCode"
              placeholder="产品编码"
            /><input
              v-model="orderForm.paymentMethod"
              placeholder="支付方式"
            /><input v-model="orderForm.country" placeholder="国家" /><input
              v-model="orderForm.currency"
              placeholder="币种"
            /><input
              v-model.number="orderForm.amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="金额"
            />
          </div>
          <button class="primary-btn" :disabled="busy" @click="createNewOrder">
            创建真实订单
          </button>
        </div>
        <div class="search-row">
          <input
            v-model="queryId"
            placeholder="输入订单 ID"
            @keyup.enter="findOrder"
          /><button class="primary-btn" @click="findOrder">
            <Search :size="16" />查询订单
          </button>
        </div>
        <div v-if="selectedOrder" class="order-card">
          <div>
            <span class="eyebrow">{{ selectedOrder.orderId }}</span>
            <h3>{{ selectedOrder.merchantOrderNo }}</h3>
            <p>
              {{ selectedOrder.amount }} {{ selectedOrder.currency }} ·
              {{ selectedOrder.status }}
            </p>
            <small
              >创建时间：{{ selectedOrder.createdAt || "--" }} · 过期时间：{{
                selectedOrder.expireAt || "--"
              }}</small
            >
          </div>
          <div class="button-row">
            <button class="outline-btn" @click="refreshOrderStatus">
              <RefreshCw :size="16" />刷新状态</button
            ><button
              class="danger-btn"
              @click="mutateOrder('cancel')"
              :disabled="
                ['SUCCESS', 'FAILED', 'CANCELED'].includes(selectedOrder.status)
              "
            >
              <XCircle :size="16" />取消订单</button
            ><button class="primary-btn" @click="mutateOrder('success')">
              回调成功</button
            ><button class="outline-btn" @click="mutateOrder('failed')">
              回调失败
            </button>
          </div>
          <RefundView
            v-if="selectedOrder.status === 'SUCCESS'"
            :order="selectedOrder"
            @notice="notice = $event"
          />
        </div>
        <p v-else class="empty">可创建订单，或输入真实订单 ID 后查询详情。</p>
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
      <section v-else-if="active === '商户管理'" class="panel workspace-panel">
        <div class="panel-title">
          <div>
            <span class="eyebrow">MERCHANTS</span>
            <h3>商户管理</h3>
          </div>
          <button class="outline-btn" @click="loadMerchants">刷新</button>
        </div>
        <div class="form-grid">
          <input
            v-model="merchantForm.merchantId"
            :disabled="!!editingMerchant"
            placeholder="商户 ID"
          /><input v-model="merchantForm.name" placeholder="商户名称" /><input
            v-model="merchantForm.settlementCurrency"
            maxlength="3"
            placeholder="结算币种"
          /><button
            v-if="
              hasPermission(
                editingMerchant ? 'merchant:update' : 'merchant:create',
              )
            "
            class="primary-btn"
            @click="saveMerchant"
          >
            {{ editingMerchant ? "保存编辑" : "新增商户" }}
          </button>
        </div>
        <div v-if="listLoading" class="empty">加载中…</div>
        <div v-else class="record-list">
          <div
            v-for="merchant in merchants"
            :key="merchant.merchantId"
            class="record-row"
          >
            <div>
              <strong>{{ merchant.name }}</strong
              ><small
                >{{ merchant.merchantId }} ·
                {{ merchant.settlementCurrency }}</small
              >
            </div>
            <span class="status-badge">{{ merchant.status }}</span
            ><button
              v-if="hasPermission('merchant:update')"
              class="outline-btn"
              @click="editMerchant(merchant)"
            >
              编辑</button
            ><button
              v-if="hasPermission('merchant:status')"
              class="outline-btn"
              @click="toggleMerchant(merchant)"
            >
              {{ merchant.status === "ACTIVE" ? "停用" : "启用" }}
            </button>
          </div>
        </div>
      </section>
      <ProductManagementView
        v-else-if="active === '产品管理'"
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
      <section v-else-if="active === '商户产品'" class="panel workspace-panel">
        <div class="panel-title">
          <div>
            <span class="eyebrow">MERCHANT PRODUCT</span>
            <h3>商户产品绑定</h3>
          </div>
          <button class="outline-btn" @click="loadMerchantProducts">
            <RefreshCw :size="16" />刷新
          </button>
        </div>
        <div class="form-grid binding-form">
          <input v-model="bindingForm.merchantId" placeholder="商户 ID" /><input
            v-model="bindingForm.productCode"
            placeholder="产品编码"
          /><button class="primary-btn" @click="bindProduct">绑定产品</button>
        </div>
        <div v-if="listLoading" class="empty">
          <LoaderCircle class="spin" :size="22" />加载中…
        </div>
        <div v-else-if="!merchantProducts.length" class="empty">
          暂无商户产品绑定
        </div>
        <div v-else class="record-list">
          <div
            v-for="item in merchantProducts"
            :key="item.bindingId"
            class="record-row"
          >
            <div>
              <strong>{{ item.merchantName }} · {{ item.productName }}</strong
              ><small>{{ item.merchantId }} / {{ item.productCode }}</small>
            </div>
            <b>{{ item.status }}</b>
          </div>
        </div>
      </section>
      <OperationsView
        v-else-if="active === '运营处置'"
        @notice="notice = $event"
      />
      <section v-else-if="active !== '商户详情'" class="panel workspace-panel">
        <div class="panel-title">
          <div>
            <span class="eyebrow">{{ active.toUpperCase() }}</span>
            <h3>{{ active }}列表</h3>
          </div>
          <button class="outline-btn" @click="loadPage(active)">
            <RefreshCw :size="16" />刷新
          </button>
        </div>
        <div v-if="listLoading" class="empty">
          <LoaderCircle class="spin" :size="22" />加载中…
        </div>
        <div v-else-if="!records.length" class="empty">暂无数据</div>
        <div v-else class="record-list">
          <div
            v-for="record in records"
            :key="
              String(
                record.merchantId ||
                  record.productCode ||
                  record.channelId ||
                  record.ruleId ||
                  record.policyId,
              )
            "
            class="record-row"
          >
            <div>
              <strong>{{
                record.name ||
                record.productCode ||
                record.channelId ||
                record.ruleId ||
                record.policyId
              }}</strong
              ><small>{{
                record.status || record.scope || record.currency
              }}</small>
            </div>
            <b>{{
              record.health ||
              record.feeRate ||
              record.decision ||
              record.weight ||
              ""
            }}</b>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
