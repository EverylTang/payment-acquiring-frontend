<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { LoaderCircle, Pencil, Plus, Save, Search, ToggleLeft } from "lucide-vue-next";
import { ElOption, ElPagination, ElSelect } from "element-plus";
import {
  bindMerchantProduct,
  changeMerchantProductStatus,
  getMerchants,
  getMerchantProducts,
  updateMerchantProduct,
  type Merchant,
  type MerchantProduct,
} from "./api";
import { getProducts, type Product } from "../product/api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const products = ref<MerchantProduct[]>([]);
const loading = ref(false);
const saving = ref(false);
const drawerOpen = ref(false);
const editing = ref<MerchantProduct | null>(null);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const filters = ref({ merchantId: "", productCode: "", status: "" });
const form = ref({ merchantId: "", productCode: "" });
const merchants = ref<Merchant[]>([]);
const selectableProducts = ref<Product[]>([]);
const existingBindings = ref<MerchantProduct[]>([]);
const referenceLoading = ref(false);

const activeCount = computed(() => products.value.filter((item) => item.status === "ACTIVE").length);
const disabledCount = computed(() => products.value.filter((item) => item.status === "DISABLED").length);
const availableProducts = computed(() => {
  if (!form.value.merchantId || editing.value) return selectableProducts.value;
  return selectableProducts.value.filter(
    (product) => !existingBindings.value.some(
      (binding) => binding.merchantId === form.value.merchantId && binding.productCode === product.productCode,
    ),
  );
});
const notifyError = (error: unknown, fallback: string) =>
  emit("notice", error instanceof Error ? error.message : fallback);

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getMerchantProducts({ page: current, pageSize: page.value.pageSize, ...filters.value });
    products.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    notifyError(error, "商户产品加载失败");
  } finally {
    loading.value = false;
  }
};

const loadReferenceOptions = async () => {
  referenceLoading.value = true;
  try {
    const [merchantResult, productResult, bindingResult] = await Promise.allSettled([
      getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getProducts({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getMerchantProducts({ page: 1, pageSize: 100 }),
    ]);
    if (merchantResult.status === "fulfilled") merchants.value = merchantResult.value.items;
    else notifyError(merchantResult.reason, "商户下拉数据加载失败");
    if (productResult.status === "fulfilled") selectableProducts.value = productResult.value.items;
    else notifyError(productResult.reason, "产品下拉数据加载失败");
    if (bindingResult.status === "fulfilled") existingBindings.value = bindingResult.value.items;
    else notifyError(bindingResult.reason, "已有商户产品绑定加载失败");
  } finally {
    referenceLoading.value = false;
  }
};

const search = () => load(1);
const resetFilters = () => {
  filters.value = { merchantId: "", productCode: "", status: "" };
  load(1);
};
const changePageSize = (pageSize: number) => {
  page.value.pageSize = pageSize;
  load(1);
};
const openCreate = () => {
  editing.value = null;
  form.value = { merchantId: "", productCode: "" };
  drawerOpen.value = true;
};
const openEdit = (binding: MerchantProduct) => {
  editing.value = binding;
  form.value = { merchantId: binding.merchantId, productCode: binding.productCode };
  drawerOpen.value = true;
};
const closeDrawer = () => {
  if (!saving.value) drawerOpen.value = false;
};
const save = async () => {
  if (!editing.value && existingBindings.value.some(
    (binding) => binding.merchantId === form.value.merchantId && binding.productCode === form.value.productCode,
  )) {
    emit("notice", "该商户已绑定此产品，请选择其他产品");
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updateMerchantProduct(editing.value.bindingId, form.value);
      emit("notice", "商户产品绑定已更新");
    } else {
      await bindMerchantProduct(form.value);
      emit("notice", "商户产品绑定成功");
    }
    drawerOpen.value = false;
    await load();
    await loadReferenceOptions();
  } catch (error) {
    notifyError(error, editing.value ? "商户产品更新失败" : "商户产品绑定失败");
  } finally {
    saving.value = false;
  }
};
const toggleStatus = async (binding: MerchantProduct) => {
  try {
    await changeMerchantProductStatus(binding.bindingId, binding.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    emit("notice", "商户产品状态已更新");
    await load();
  } catch (error) {
    notifyError(error, "商户产品状态更新失败");
  }
};
const formatTime = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });

onMounted(() => { void Promise.all([load(), loadReferenceOptions()]); });
</script>

<template>
  <section class="workspace-panel management-list-page merchant-product-management-page">
    <form class="management-filter-form" @submit.prevent="search">
      <div class="management-filter-fields">
        <label class="management-form-item"><span>商户 ID</span><ElSelect v-model="filters.merchantId" clearable filterable :loading="referenceLoading" placeholder="选择商户 ID"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label>
        <label class="management-form-item"><span>产品编码</span><ElSelect v-model="filters.productCode" clearable filterable :loading="referenceLoading" placeholder="选择产品编码"><ElOption v-for="product in selectableProducts" :key="product.productCode" :label="`${product.name} · ${product.productCode}`" :value="product.productCode" /></ElSelect></label>
        <label class="management-form-item"><span>绑定状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label>
      </div>
      <div class="management-filter-actions">
        <button class="outline-btn" type="button" @click="resetFilters">重置</button>
        <button class="primary-btn" type="submit"><Search :size="16" />查询</button>
        <button v-if="hasPermission('merchant-product:bind')" class="primary-btn" type="button" @click="openCreate"><Plus :size="16" />新增绑定</button>
      </div>
    </form>
    <div class="management-list-summary"><span>商户产品</span><small>共 {{ page.total }} 条绑定 · 当前页启用 {{ activeCount }} 条、已停用 {{ disabledCount }} 条</small></div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="table-wrap management-table-wrap">
      <table class="data-table merchant-product-table">
        <colgroup><col class="merchant-product-merchant-column" /><col class="merchant-product-product-column" /><col class="merchant-product-method-column" /><col class="merchant-product-status-column" /><col class="merchant-product-time-column" /><col class="management-actions-column" /></colgroup>
        <thead><tr><th>商户</th><th>产品</th><th>可用支付方式</th><th>状态</th><th>绑定 / 更新时间</th><th class="actions">操作</th></tr></thead>
        <tbody>
          <tr v-for="item in products" :key="item.bindingId">
            <td><strong>{{ item.merchantName }}</strong><small class="mono">{{ item.merchantId }}</small></td>
            <td><strong>{{ item.productName }}</strong><small class="mono">{{ item.productCode }}</small></td>
            <td>{{ item.supportedPaymentMethods || "未配置" }}</td>
            <td><span class="status-badge" :class="`st-${item.status.toLowerCase()}`">{{ item.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td>
            <td><small>{{ formatTime(item.createdAt) }}</small><small>更新 {{ formatTime(item.updatedAt) }}</small></td>
            <td class="actions"><div class="management-row-actions"><button v-if="hasPermission('merchant-product:update')" class="outline-btn" type="button" title="编辑商户产品绑定" @click="openEdit(item)"><Pencil :size="16" />编辑</button><button v-if="hasPermission('merchant-product:status')" class="outline-btn" type="button" title="切换绑定状态" @click="toggleStatus(item)"><ToggleLeft :size="16" />{{ item.status === "ACTIVE" ? "停用" : "启用" }}</button></div></td>
          </tr>
          <tr v-if="!products.length"><td colspan="6" class="empty">暂无符合筛选条件的商户产品绑定</td></tr>
        </tbody>
      </table>
    </div>
    <div class="management-pagination"><ElPagination background layout="sizes, total, prev, pager, next" :current-page="page.current" :page-size="page.pageSize" :page-sizes="[20, 50, 100]" :total="page.total" :hide-on-single-page="false" @current-change="load" @size-change="changePageSize" /></div>
  </section>
  <AppDrawer v-if="drawerOpen" :title="editing ? '编辑商户产品绑定' : '新增商户产品绑定'" description="MERCHANT PRODUCT" @close="closeDrawer">
    <form class="merchant-product-drawer-form" @submit.prevent="save">
      <section class="drawer-section"><h4>绑定信息</h4><p class="drawer-copy">仅可选择启用中的商户与产品；已绑定的产品不会在新增时重复显示。</p><div class="drawer-form-grid"><label class="form-field"><span>商户 ID <b>*</b></span><ElSelect v-model="form.merchantId" filterable :loading="referenceLoading" placeholder="选择商户" @change="form.productCode = ''"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label><label class="form-field"><span>产品编码 <b>*</b></span><ElSelect v-model="form.productCode" filterable :loading="referenceLoading" :disabled="!form.merchantId" placeholder="先选择商户"><ElOption v-for="product in availableProducts" :key="product.productCode" :label="`${product.name} · ${product.productCode}`" :value="product.productCode" /></ElSelect><small v-if="form.merchantId && !availableProducts.length && !editing">该商户已绑定全部启用产品</small></label></div></section>
      <div class="drawer-actions"><button class="outline-btn" type="button" :disabled="saving" @click="closeDrawer">取消</button><button class="primary-btn" type="submit" :disabled="saving || referenceLoading || !form.merchantId || !form.productCode"><Save :size="16" />{{ saving ? "保存中" : editing ? "保存绑定" : "创建绑定" }}</button></div>
    </form>
  </AppDrawer>
</template>
