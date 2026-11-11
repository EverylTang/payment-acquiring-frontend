<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Eye, LoaderCircle, RefreshCw, Search, XCircle } from "lucide-vue-next";
import { ElDatePicker } from "element-plus";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";
import { hasPermission } from "../../auth";
import { getMerchantProducts, getMerchants, type Merchant, type MerchantProduct } from "../merchant/api";
import { getActiveCountries, getActiveCurrencies, type Country, type Currency } from "../master-data/api";
import { getProductCapabilities, getProducts, type Product, type ProductCapability } from "../product/api";
import { cancelOrder, createOrder, getOrder, getOrderPage, resendOrderNotification, type CreateOrderRequest, type Order, type OrderPage } from "../order/api";
import RefundView from "../refund/RefundView.vue";

const props = defineProps<{ reload?: number }>();
const emit = defineEmits<{ notice: [message: string] }>();
const busy = ref(false);
const listLoading = ref(false);
const queryId = ref("");
const selectedOrder = ref<Order | null>(null);
const orderDrawer = ref<"create" | "detail" | null>(null);
const orderForm = ref<CreateOrderRequest>({
  merchantId: "",
  merchantOrderNo: `web-${Date.now()}`,
  appId: "",
  payModel: "CARD",
  country: "US",
  currency: "USD",
  amount: 100,
});
const orderPage = ref<OrderPage>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
});
const orderFilters = ref({ merchantId: "", merchantOrderNo: "", orderId: "", productCode: "", status: "", currency: "", orderType: "" as "" | "PAYIN" | "PAYOUT", createdRange: [] as string[], paidRange: [] as string[] });
const orderFilterMerchants = ref<Merchant[]>([]);
const orderFilterCurrencies = ref<Currency[]>([]);
const orderFilterProducts = ref<Product[]>([]);
const orderCreateMerchants = ref<Merchant[]>([]);
const orderCreateProducts = ref<Product[]>([]);
const orderCreateMerchantProducts = ref<MerchantProduct[]>([]);
const orderCreateCountries = ref<Country[]>([]);
const orderCreateCurrencies = ref<Currency[]>([]);
const orderCreateCapabilities = ref<ProductCapability[]>([]);
const orderCreateLoading = ref(false);
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
const supportsRefund = (order: Order) => {
  if (!order.pricingSnapshot) return false;
  try {
    const pricing = JSON.parse(order.pricingSnapshot) as { supportsRefund?: unknown };
    return pricing.supportsRefund === true;
  } catch {
    return false;
  }
};
const canRefundSelectedOrder = computed(
  () =>
    !!selectedOrder.value &&
    selectedOrder.value.orderType === "PAYIN" &&
    selectedOrder.value.status === "SUCCESS" &&
    supportsRefund(selectedOrder.value) &&
    hasPermission("order:manage"),
);
const orderSelectableProducts = computed(() => {
  const boundCodes = new Set(
    orderCreateMerchantProducts.value
      .filter((binding) => binding.status === "ACTIVE")
      .map((binding) => binding.productCode),
  );
  return orderCreateMerchantProducts.value
    .filter((binding) => binding.status === "ACTIVE" && boundCodes.has(binding.productCode))
    .map((binding) => ({
      ...orderCreateProducts.value.find((product) => product.productCode === binding.productCode),
      appId: binding.appId,
      productCode: binding.productCode,
      productName: binding.productName,
    })) as Array<Product & { appId: string; productName: string }>;
});
const orderPaymentMethods = computed(() =>
  [...new Set(
    orderCreateCapabilities.value
      .filter((capability) => capability.status === "ACTIVE")
      .map((capability) => capability.customerPaymentMethod),
  )],
);
const run = async <T,>(action: () => Promise<T>, success = "") => {
  busy.value = true;
  emit("notice", "");
  try {
    const result = await action();
    emit("notice", success);
    return result;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "请求失败");
  } finally {
    busy.value = false;
  }
};
const loadOrders = async (page = 1) => {
  listLoading.value = true;
  try {
    const { createdRange, paidRange, ...filters } = orderFilters.value;
    const result = await getOrderPage({
      ...filters,
      orderType: filters.orderType || undefined,
      createdFrom: createdRange[0] || undefined,
      createdTo: createdRange[1] || undefined,
      paidFrom: paidRange[0] || undefined,
      paidTo: paidRange[1] || undefined,
      page,
      pageSize: orderPage.value.pageSize,
    });
    orderPage.value = result;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "订单列表加载失败");
  } finally {
    listLoading.value = false;
  }
};
const changeOrderPageSize = (pageSize: number) => {
  orderPage.value.pageSize = pageSize;
  void loadOrders(1);
};
const loadOrderFilterOptions = async () => {
  if (orderFilterMerchants.value.length && orderFilterCurrencies.value.length && orderFilterProducts.value.length) return;
  try {
    const [merchantPage, currencies, productPageResult] = await Promise.all([
      getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getActiveCurrencies(),
      getProducts({ page: 1, pageSize: 100, status: "ACTIVE" }),
    ]);
    orderFilterMerchants.value = merchantPage.items;
    orderFilterCurrencies.value = currencies;
    orderFilterProducts.value = productPageResult.items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "订单筛选项加载失败");
  }
};
const loadOrderCreateCurrencies = async (countryCode: string, preferredCurrency = "") => {
  orderCreateCurrencies.value = countryCode ? await getActiveCurrencies(countryCode) : [];
  const selectedCurrency =
    preferredCurrency && orderCreateCurrencies.value.some((currency) => currency.code === preferredCurrency)
      ? preferredCurrency
      : orderCreateCurrencies.value.some((currency) => currency.code === orderForm.value.currency)
        ? orderForm.value.currency
        : orderCreateCurrencies.value[0]?.code || "";
  orderForm.value.currency = selectedCurrency;
};
const selectOrderProduct = async () => {
  const product = orderSelectableProducts.value.find(
    (item) => String(item.appId) === orderForm.value.appId,
  );
  orderForm.value.payModel = "";
  orderCreateCapabilities.value = [];
  if (!product) {
    orderForm.value.country = "";
    orderForm.value.currency = "";
    orderCreateCurrencies.value = [];
    return;
  }
  const [capabilities] = await Promise.all([
    getProductCapabilities(product.productCode, { page: 1, pageSize: 100 }),
    loadOrderCreateCurrencies(product.defaultCountry, product.defaultCurrency),
  ]);
  orderCreateCapabilities.value = capabilities.items;
  orderForm.value.country = product.defaultCountry;
  orderForm.value.payModel = orderPaymentMethods.value[0] || "";
};
const selectOrderMerchant = async () => {
  orderCreateMerchantProducts.value = orderForm.value.merchantId
    ? (await getMerchantProducts({ merchantId: orderForm.value.merchantId, status: "ACTIVE", page: 1, pageSize: 100 })).items
    : [];
  const currentProductIsBound = orderSelectableProducts.value.some(
    (product) => String(product.appId) === orderForm.value.appId,
  );
  orderForm.value.appId = currentProductIsBound
    ? orderForm.value.appId
    : orderSelectableProducts.value[0] ? String(orderSelectableProducts.value[0].appId) : "";
  await selectOrderProduct();
};
const selectOrderCountry = async () => {
  await loadOrderCreateCurrencies(orderForm.value.country);
};
const loadOrderCreateReferences = async () => {
  orderCreateLoading.value = true;
  try {
    const [merchantPage, productPageResult, countries] = await Promise.all([
      getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getProducts({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getActiveCountries(),
    ]);
    orderCreateMerchants.value = merchantPage.items;
    orderCreateProducts.value = productPageResult.items;
    orderCreateCountries.value = countries;
    orderForm.value.merchantId = orderCreateMerchants.value[0]?.merchantId || "";
    await selectOrderMerchant();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "订单创建选项加载失败");
  } finally {
    orderCreateLoading.value = false;
  }
};
const resetOrderFilters = async () => {
  orderFilters.value = { merchantId: "", merchantOrderNo: "", orderId: "", productCode: "", status: "", currency: "", orderType: "", createdRange: [], paidRange: [] };
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
    !orderForm.value.appId.trim() ||
    !orderForm.value.payModel.trim() ||
    !orderForm.value.country.trim() ||
    !orderForm.value.currency.trim() ||
    !Number.isFinite(orderForm.value.amount) ||
    orderForm.value.amount <= 0
  ) {
    emit("notice", "请完整填写订单的商户、产品、支付方式、国家、币种和金额");
    return;
  }
  const expireAt = orderForm.value.expireAt?.trim();
  const parsedExpireAt = expireAt ? new Date(expireAt) : null;
  if (parsedExpireAt && Number.isNaN(parsedExpireAt.getTime())) {
    emit("notice", "请输入有效的订单过期时间");
    return;
  }
  const payload: CreateOrderRequest = {
    ...orderForm.value,
    merchantId: orderForm.value.merchantId.trim(),
    merchantOrderNo: orderForm.value.merchantOrderNo.trim(),
    appId: orderForm.value.appId.trim(),
    payModel: orderForm.value.payModel.trim().toUpperCase(),
    country: orderForm.value.country.trim().toUpperCase(),
    currency: orderForm.value.currency.trim().toUpperCase(),
    expireAt: parsedExpireAt?.toISOString(),
    notifyUrl: orderForm.value.notifyUrl?.trim() || undefined,
    returnUrl: orderForm.value.returnUrl?.trim() || undefined,
    customerReference: orderForm.value.customerReference?.trim() || undefined,
    payoutDestinationRef: orderForm.value.payoutDestinationRef?.trim() || undefined,
    description: orderForm.value.description?.trim() || undefined,
    channelParams: orderForm.value.channelParams || {},
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
const openCreateOrder = async () => {
  orderForm.value = {
    merchantId: "",
    merchantOrderNo: `web-${Date.now()}`,
    appId: "",
    payModel: "",
    country: "",
    currency: "",
    amount: orderForm.value.amount || 100,
  };
  orderDrawer.value = "create";
  await loadOrderCreateReferences();
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
const loadPageData = () => void Promise.all([loadOrderFilterOptions(), loadOrders()]);
onMounted(loadPageData);
watch(() => props.reload, loadPageData);
</script>
<template>
  <section class="panel workspace-panel order-management-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">TRADE OPERATIONS</span>
        <h3>订单列表</h3>
      </div>
    </div>
    <form class="order-list-filter" @submit.prevent="loadOrders(1)">
      <div class="order-filter-fields">
        <label class="management-form-item"><span>商户</span><select v-model="orderFilters.merchantId"><option value="">全部商户</option><option v-for="merchant in orderFilterMerchants" :key="merchant.merchantId" :value="merchant.merchantId">{{ merchant.name }} · {{ merchant.merchantId }}</option></select></label>
        <label class="management-form-item"><span>商户订单号</span><input v-model.trim="orderFilters.merchantOrderNo" placeholder="支持模糊匹配" /></label>
        <label class="management-form-item"><span>订单号</span><input v-model.trim="orderFilters.orderId" placeholder="输入平台订单号" /></label>
        <label class="management-form-item"><span>支付产品</span><select v-model="orderFilters.productCode"><option value="">全部产品</option><option v-for="product in orderFilterProducts" :key="product.productCode" :value="product.productCode">{{ product.name }} · {{ product.productCode }}</option></select></label>
        <label class="management-form-item"><span>订单类型</span><select v-model="orderFilters.orderType"><option value="">全部类型</option><option value="PAYIN">收单</option><option value="PAYOUT">出款</option></select></label>
        <label class="management-form-item"><span>订单状态</span><select v-model="orderFilters.status"><option value="">全部状态</option><option value="CREATED">已创建</option><option value="PAYING">处理中</option><option value="SUCCESS">成功</option><option value="FAILED">失败</option><option value="UNKNOWN">待确认</option><option value="CANCELED">已取消</option></select></label>
        <label class="management-form-item"><span>交易币种</span><select v-model="orderFilters.currency"><option value="">全部币种</option><option v-for="currency in orderFilterCurrencies" :key="currency.code" :value="currency.code">{{ currency.code }} · {{ currency.name }}</option></select></label>
        <label class="management-form-item"><span>下单时间</span><ElDatePicker v-model="orderFilters.createdRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss" format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></label>
        <label class="management-form-item"><span>支付时间</span><ElDatePicker v-model="orderFilters.paidRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss" format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></label>
      </div>
      <div class="order-filter-actions"><span class="toolbar-summary">共 {{ orderPage.total }} 笔订单</span><button class="outline-btn" type="button" @click="resetOrderFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button v-if="hasPermission('order:manage')" class="primary-btn" type="button" @click="openCreateOrder">创建订单</button></div>
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
            <td class="actions"><button class="outline-btn action-btn" type="button" title="查看订单详情" @click.stop="inspectOrder(order)"><Eye :size="15" />查看</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="listLoading" class="empty">
      <LoaderCircle class="spin" :size="22" />加载中…
    </div>
    <div v-else class="empty">暂无订单数据</div>
    <AppPagination
      :page="orderPage.page"
      :page-size="orderPage.pageSize"
      :total="orderPage.total"
      noun="条订单"
      @change="loadOrders"
      @size-change="changeOrderPageSize"
    />
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
            <label class="form-field"><span>商户 <b>*</b></span><select v-model="orderForm.merchantId" :disabled="orderCreateLoading" @change="selectOrderMerchant"><option value="">选择商户</option><option v-for="merchant in orderCreateMerchants" :key="merchant.merchantId" :value="merchant.merchantId">{{ merchant.name }} · {{ merchant.merchantId }}</option></select></label>
            <label class="form-field"><span>商户订单号 <b>*</b></span><input v-model="orderForm.merchantOrderNo" maxlength="128" placeholder="商户侧唯一订单号" /></label>
            <label class="form-field"><span>产品 <b>*</b></span><select v-model="orderForm.appId" :disabled="orderCreateLoading || !orderForm.merchantId || !orderSelectableProducts.length" @change="selectOrderProduct"><option value="">选择产品</option><option v-for="product in orderSelectableProducts" :key="product.appId" :value="String(product.appId)">{{ product.productName }} · App {{ product.appId }}</option></select></label>
            <label class="form-field"><span>支付方式 <b>*</b></span><select v-model="orderForm.payModel" :disabled="orderCreateLoading || !orderForm.appId || !orderPaymentMethods.length"><option value="">选择支付方式</option><option v-for="paymentMethod in orderPaymentMethods" :key="paymentMethod" :value="paymentMethod">{{ paymentMethod }}</option></select></label>
            <label class="form-field"><span>国家 / 地区 <b>*</b></span><select v-model="orderForm.country" :disabled="orderCreateLoading || !orderForm.appId" @change="selectOrderCountry"><option value="">选择国家 / 地区</option><option v-for="country in orderCreateCountries" :key="country.code" :value="country.code">{{ country.name }} · {{ country.code }}</option></select></label>
            <label class="form-field"><span>币种 <b>*</b></span><select v-model="orderForm.currency" :disabled="orderCreateLoading || !orderForm.country || !orderCreateCurrencies.length"><option value="">选择币种</option><option v-for="currency in orderCreateCurrencies" :key="currency.code" :value="currency.code">{{ currency.code }} · {{ currency.name }}</option></select></label>
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
          <p class="drawer-copy">输入订单 ID 后可查看状态、渠道处理结果和退款信息。</p>
          <div class="search-row drawer-search">
            <input v-model="queryId" placeholder="输入订单 ID" autofocus @keyup.enter="findOrder" />
            <button class="primary-btn" @click="findOrder"><Search :size="16" />查询</button>
          </div>
        </div>
        <template v-else>
          <div class="order-detail-content">
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
          <RefundView v-if="canRefundSelectedOrder" :order="selectedOrder" @notice="emit('notice', $event)" />
          </div>
        </template>
      </template>
    </AppDrawer>
  </section>
</template>

<style scoped>
.order-list { margin-top: 18px; }
.search-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 9px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line); }
@media (max-width: 560px) {
  .search-row { grid-template-columns: 1fr; }
}
.breakable { overflow-wrap: anywhere; }
.search-row {
  grid-template-columns: minmax(240px, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-2);
}
.search-row .outline-btn, .search-row .primary-btn { min-width: 88px; }
@media (max-width: 560px) {
  .order-filters, .search-row { grid-template-columns: 1fr; padding: 10px; }
  .search-row .outline-btn, .search-row .primary-btn { width: 100%; }
}
.drawer-search { margin-top: 0; }
@media (max-width: 560px) {
  .drawer-search { grid-template-columns: 1fr; }
}
.toolbar-summary { display: inline-flex; align-items: center; gap: 10px; color: var(--ink-soft); font-size: 13px; }
.toolbar-summary i { width: 1px; height: 14px; background: var(--line-dark); }
.order-list .actions { width: 96px; text-align: center; }
.order-list .actions .action-btn { margin: 0; }
.order-management-panel > .panel-title { display: none; }
.order-list-filter { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px 16px; margin-bottom: 16px; padding: 16px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-2); }
.order-filter-fields { display: grid; flex: 1 1 740px; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 14px 16px; }
.order-filter-fields :deep(.el-date-editor) { width: 100%; }
.order-filter-actions { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; min-height: 42px; }
.order-filter-actions .toolbar-summary { margin-right: auto; white-space: nowrap; }
.order-list { margin-top: 0; }
.order-list .data-table { min-width: 1040px; }
.order-list .data-table th:first-child { min-width: 160px; }
.order-list .data-table th:nth-child(2) { min-width: 252px; }
.order-list .data-table th:nth-child(3) { min-width: 138px; }
.order-list .data-table td:first-child strong { display: block; color: var(--ink); font-size: 13px; font-weight: 600; }
.order-list .order-type-label { margin: 5px 0 0; }
.order-create-form .drawer-section { margin: 0; padding: 0; }
.order-create-form .drawer-section + .drawer-section { margin-top: 22px; padding-top: 22px; }
.order-create-form .drawer-section-heading { align-items: flex-start; margin-bottom: 14px; }
.order-create-form .drawer-section-heading h4 { margin-bottom: 4px; }
.order-create-form .drawer-section-heading small { display: block; max-width: 420px; color: var(--muted); font-size: 11px; line-height: 1.55; }
.order-detail-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.order-detail-content { min-height: max-content; padding-bottom: 28px; overflow: visible; }
.order-detail-hero h4 { margin: 5px 0 4px; color: var(--ink); font-size: 17px; }
.order-detail-hero p { margin: 0; color: var(--muted); font-family: 'DM Mono', monospace; font-size: 11px; overflow-wrap: anywhere; }
.order-amount-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 18px 0 2px; }
.order-amount-grid div { min-width: 0; }
.order-amount-grid span { display: block; margin-bottom: 6px; color: var(--muted); font-size: 11px; }
.order-amount-grid strong { display: block; color: var(--ink); font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.order-detail-section { margin-top: 22px; padding-top: 22px; }
.order-detail-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 22px; margin: 0; }
.order-detail-list div { min-width: 0; }
.order-detail-list dt { margin-bottom: 4px; color: var(--muted); font-size: 11px; }
.order-detail-list dd { margin: 0; color: var(--ink-soft); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.order-detail-section .snapshot-preview { max-height: none; overflow: visible; }
.order-description { margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink-soft); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
.order-notification-error { margin: 14px 0 0; padding: 9px 10px; border-left: 3px solid var(--warning); color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.order-action-hint { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.order-type-label { display: inline-block; margin: 3px 0 0 7px; padding: 1px 5px; border-radius: 3px; font-size: 11px; font-weight: 600; line-height: 1.45; vertical-align: middle; }
.order-type-label.payin { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
.order-type-label.payout { color: var(--warning); background: color-mix(in srgb, var(--warning) 22%, transparent); }
@media (max-width: 560px) {
  .order-amount-grid,
  .order-detail-list { grid-template-columns: 1fr; }
  .order-amount-grid { gap: 14px; }
}
@media (max-width: 700px) {
  .order-filter-fields { grid-template-columns: 1fr; flex-basis: 100%; }
  .order-filter-actions { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .order-filter-actions .toolbar-summary { grid-column: 1 / -1; margin: 0; }
}
</style>
