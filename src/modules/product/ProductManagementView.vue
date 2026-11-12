<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { LoaderCircle, Pencil, Plus, Save, Search, ToggleLeft, Trash2 } from "lucide-vue-next";
import { changeProductStatus, createProduct, createProductCapability, deleteProductCapability, getProductCapabilities, getProducts, updateProduct, updateProductCapability, type Product, type ProductCapability, type ProductPayload } from "./api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";
import { getActiveCountries, getActiveCurrencies, type Country, type Currency } from "../master-data/api";

type CapabilityDraft = Omit<ProductCapability, "capabilityId" | "productCode" | "status"> & { capabilityId?: string };
const emit = defineEmits<{ notice: [message: string] }>();
const customerPaymentMethods = [{ value: "CARD", label: "银行卡" }, { value: "APPLE_PAY", label: "Apple Pay" }, { value: "GOOGLE_PAY", label: "Google Pay" }, { value: "ALIPAY", label: "支付宝" }, { value: "WECHAT_PAY", label: "微信支付" }, { value: "BANK_TRANSFER", label: "银行转账" }, { value: "PIX", label: "PIX" }, { value: "UPI", label: "UPI" }];
const channelPaymentMethods = [{ value: "CARD", label: "银行卡通用" }, { value: "CARD_CREDIT", label: "信用卡" }, { value: "CARD_DEBIT", label: "借记卡" }, { value: "APPLE_PAY", label: "Apple Pay" }, { value: "ALIPAY_WAP", label: "支付宝 WAP" }, { value: "WECHAT_H5", label: "微信 H5" }, { value: "BANK_TRANSFER", label: "银行转账" }, { value: "PIX", label: "PIX" }, { value: "UPI", label: "UPI" }];
const products = ref<Product[]>([]), selected = ref<Product | null>(null), loading = ref(false), saving = ref(false), productDrawerOpen = ref(false);
const filters = ref({ status: "", productType: "" });
const page = ref({ current: 1, pageSize: 10, total: 0 });
const blankProduct = (): ProductPayload & { productCode: string } => ({ productCode: "", name: "", productType: "PAYIN", accessMode: "DIRECT", defaultCountry: "US", defaultCurrency: "USD", description: "", statementDescriptor: "" });
const form = ref(blankProduct());
const blankCapability = (): CapabilityDraft => ({ customerPaymentMethod: "CARD", channelPaymentMethod: "CARD", minAmount: 1, maxAmount: 10000, supportsRefund: true });
const capabilityDrafts = ref<CapabilityDraft[]>([]), originalCapabilityIds = ref<string[]>([]);
const savedCapabilities = ref<Record<string, string>>({});
const savedProduct = ref("");
const capabilitiesReady = ref(true);
const saveError = ref("");
const canEditProduct = computed(() => hasPermission(selected.value ? "product:update" : "product:create"));
const canListCapabilities = computed(() => hasPermission("product-capability:list"));
const canCreateCapability = computed(() => capabilitiesReady.value && hasPermission("product-capability:create"));
const canUpdateCapability = computed(() => capabilitiesReady.value && hasPermission("product-capability:update"));
const canSave = computed(() => canEditProduct.value || (!!selected.value && (canCreateCapability.value || canUpdateCapability.value)));
const productPayload = () => { const { productCode: _, ...payload } = form.value; return payload; };
const capabilityPayload = (item: CapabilityDraft) => ({ customerPaymentMethod: item.customerPaymentMethod.trim(), channelPaymentMethod: item.channelPaymentMethod.trim(), minAmount: item.minAmount, maxAmount: item.maxAmount, supportsRefund: item.supportsRefund });
const canEditCapability = (item: CapabilityDraft) => item.capabilityId ? canUpdateCapability.value : canCreateCapability.value;
const countries = ref<Country[]>([]), defaultCurrencies = ref<Currency[]>([]), currenciesByCountry = ref<Record<string, Currency[]>>({});
const activeCapabilities = computed(() => products.value.reduce((sum, item) => sum + item.activeCapabilityCount, 0));
const alert = (error: unknown, fallback: string) => emit("notice", error instanceof Error ? error.message : fallback);

async function load(current = page.value.current) { loading.value = true; try { const result = await getProducts({ page: current, pageSize: page.value.pageSize, ...filters.value }); products.value = result.items; page.value = { current: result.page, pageSize: result.pageSize, total: result.total }; } catch (error) { alert(error, "产品加载失败"); } finally { loading.value = false; } }
function resetFilters() { filters.value = { status: "", productType: "" }; load(1); }
function changePageSize(pageSize: number) { page.value.pageSize = pageSize; load(1); }
async function currenciesFor(country: string) { if (!currenciesByCountry.value[country]) currenciesByCountry.value[country] = await getActiveCurrencies(country); return currenciesByCountry.value[country]; }
async function loadCapabilities(productCode: string) {
  const items: ProductCapability[] = [];
  let current = 1;
  // Load the entire editable collection; never treat the first 100 rows as all rows.
  while (true) {
    const result = await getProductCapabilities(productCode, { page: current, pageSize: 100 });
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) break;
    current += 1;
  }
  capabilityDrafts.value = items.map(({ capabilityId, productCode: _, status: __, ...item }) => ({ ...item, capabilityId }));
  originalCapabilityIds.value = items.map((item) => item.capabilityId);
  savedCapabilities.value = Object.fromEntries(capabilityDrafts.value.map((item) => [item.capabilityId!, JSON.stringify(capabilityPayload(item))]));
  capabilitiesReady.value = true;
}
function openProductCreate() {
  if (saving.value) return;
  selected.value = null; form.value = blankProduct(); saveError.value = ""; savedProduct.value = "";
  capabilitiesReady.value = true;
  capabilityDrafts.value = canCreateCapability.value ? [blankCapability()] : [];
  originalCapabilityIds.value = []; savedCapabilities.value = {}; productDrawerOpen.value = true;
}
async function openProductEdit(product: Product) {
  if (saving.value) return;
  selected.value = product; saveError.value = "";
  form.value = { productCode: product.productCode, name: product.name, productType: product.productType, accessMode: product.accessMode, defaultCountry: product.defaultCountry, defaultCurrency: product.defaultCurrency, description: product.description || "", statementDescriptor: product.statementDescriptor || "" };
  savedProduct.value = JSON.stringify(productPayload());
  capabilityDrafts.value = []; originalCapabilityIds.value = []; savedCapabilities.value = {}; capabilitiesReady.value = false;
  productDrawerOpen.value = true;
  if (!canListCapabilities.value) return;
  saving.value = true;
  try { await loadCapabilities(product.productCode); }
  catch (error) { saveError.value = `支付方式未加载，本次只能维护产品基础信息：${error instanceof Error ? error.message : "加载失败"}`; }
  finally { saving.value = false; }
}
function addCapability() { if (!saving.value && canCreateCapability.value) capabilityDrafts.value.push(blankCapability()); }
function removeCapability(index: number) { const item = capabilityDrafts.value[index]; if (item && !saving.value && canEditCapability(item)) capabilityDrafts.value.splice(index, 1); }
function validCapabilities() { return capabilityDrafts.value.every((item) => !canEditCapability(item) || (item.customerPaymentMethod.trim() && item.channelPaymentMethod.trim() && Number.isFinite(item.minAmount) && item.minAmount > 0 && Number.isFinite(item.maxAmount) && item.maxAmount >= item.minAmount)); }
async function saveProduct() {
  if (saving.value || !canSave.value || !validCapabilities()) return;
  saving.value = true; saveError.value = "";
  let savedAnyStep = false;
  try {
    let product = selected.value;
    const payload = productPayload();
    if (!product) {
      product = await createProduct({ productCode: form.value.productCode, ...payload });
      selected.value = product;
      form.value.productCode = product.productCode;
      savedProduct.value = JSON.stringify(payload);
      savedAnyStep = true;
    } else if (canEditProduct.value && savedProduct.value !== JSON.stringify(payload)) {
      product = await updateProduct(product.productCode, payload);
      selected.value = product;
      savedProduct.value = JSON.stringify(payload);
      savedAnyStep = true;
    }
    if (capabilitiesReady.value) {
      const retained = new Set(capabilityDrafts.value.flatMap((item) => item.capabilityId ? [item.capabilityId] : []));
      if (canUpdateCapability.value) {
        for (const id of [...originalCapabilityIds.value]) {
          if (retained.has(id)) continue;
          await deleteProductCapability(product.productCode, id);
          originalCapabilityIds.value = originalCapabilityIds.value.filter((item) => item !== id);
          delete savedCapabilities.value[id];
          savedAnyStep = true;
        }
      }
      // Persist each returned ID immediately; a later failure must not recreate earlier rows.
      for (const item of capabilityDrafts.value) {
        if (!canEditCapability(item)) continue;
        const payload = capabilityPayload(item);
        if (item.capabilityId) {
          if (savedCapabilities.value[item.capabilityId] === JSON.stringify(payload)) continue;
          await updateProductCapability(product.productCode, item.capabilityId, payload);
        } else {
          const created = await createProductCapability(product.productCode, payload);
          item.capabilityId = created.capabilityId;
          originalCapabilityIds.value.push(created.capabilityId);
        }
        savedCapabilities.value[item.capabilityId] = JSON.stringify(payload);
        savedAnyStep = true;
      }
    }
    productDrawerOpen.value = false;
    emit("notice", capabilitiesReady.value && (canCreateCapability.value || canUpdateCapability.value) ? "产品及已提交的支付方式已保存" : "产品基础信息已保存（未修改支付方式）");
    await load();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "产品保存失败";
    saveError.value = selected.value && savedAnyStep
      ? `产品 ${selected.value.productCode} 的部分步骤已保存，后续保存失败：${reason}。已保留产品及支付方式 ID，可重试，不会重复创建。`
      : reason;
    emit("notice", saveError.value);
  } finally { saving.value = false; }
}
async function toggleProduct(product: Product) { try { Object.assign(product, await changeProductStatus(product.productCode, product.status === "ACTIVE" ? "DISABLED" : "ACTIVE")); emit("notice", "产品状态已更新"); } catch (error) { alert(error, "产品状态更新失败"); } }
async function refreshCurrencies(countryCode: string, replaceInvalid = false) {
  if (!countryCode || !hasPermission("master-data:list")) return;
  try {
    const items = await currenciesFor(countryCode);
    if (countryCode !== form.value.defaultCountry) return;
    defaultCurrencies.value = items;
    if (replaceInvalid && !items.some((item) => item.code === form.value.defaultCurrency)) form.value.defaultCurrency = items[0]?.code || "";
  } catch (error) { alert(error, "币种基础数据加载失败，已保留当前币种"); }
}
watch(() => form.value.defaultCountry, (countryCode) => { void refreshCurrencies(countryCode); });
onMounted(async () => {
  await load();
  if (!hasPermission("master-data:list")) return;
  try { countries.value = await getActiveCountries(); await refreshCurrencies(form.value.defaultCountry); }
  catch (error) { alert(error, "国家基础数据加载失败，已保留当前国家代码"); }
});
</script>

<template>
  <section class="workspace-panel product-workspace management-list-page">
    <form class="management-filter-form" @submit.prevent="load(1)"><div class="management-filter-fields"><label class="management-form-item"><span>产品状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label><label class="management-form-item"><span>产品类型</span><select v-model="filters.productType"><option value="">全部类型</option><option value="PAYIN">收款 PAYIN</option><option value="PAYOUT">出款 PAYOUT</option></select></label></div><div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button v-if="hasPermission('product:create')" class="primary-btn" type="button" @click="openProductCreate"><Plus :size="16" />新建产品</button></div></form>
    <div class="management-list-summary"><span>产品列表</span><small>共 {{ page.total }} 个产品 · 启用支付能力 {{ activeCapabilities }}</small></div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="table-wrap management-table-wrap"><table class="data-table product-table"><colgroup><col class="product-name-column" /><col class="product-type-column" /><col class="product-market-column" /><col class="product-method-column" /><col class="product-capability-column" /><col class="product-status-column" /><col class="management-actions-column" /></colgroup><thead><tr><th>产品</th><th>类型 / 接入</th><th>默认市场</th><th>已配置对客支付方式</th><th class="num">启用能力</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="product in products" :key="product.productCode"><td><strong>{{ product.name }}</strong><small class="mono">{{ product.productCode }}</small></td><td><strong>{{ product.productType }}</strong><small>{{ product.accessMode || "不适用" }}</small></td><td><strong>{{ product.defaultCountry }}/{{ product.defaultCurrency }}</strong></td><td>{{ product.supportedPaymentMethods || "未配置" }}</td><td class="num">{{ product.activeCapabilityCount }}</td><td><span class="status-badge" :class="'st-' + product.status.toLowerCase()">{{ product.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td><td class="actions"><div class="management-row-actions"><button v-if="hasPermission('product:update') || (canListCapabilities && (hasPermission('product-capability:create') || hasPermission('product-capability:update')))" class="outline-btn" title="编辑产品和支付方式" @click="openProductEdit(product)"><Pencil :size="16" />编辑</button><button v-if="hasPermission('product:status')" class="outline-btn" title="切换产品状态" @click="toggleProduct(product)"><ToggleLeft :size="16" />{{ product.status === "ACTIVE" ? "停用" : "启用" }}</button></div></td></tr><tr v-if="!products.length"><td colspan="7" class="empty">暂无产品</td></tr></tbody></table></div>
    <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" @change="load" @size-change="changePageSize" />
    <AppDrawer v-if="productDrawerOpen" :title="selected ? '编辑产品' : '新建产品'" description="产品与支付方式" contained @close="!saving && (productDrawerOpen = false)"><form class="product-drawer-form" @submit.prevent="saveProduct"><fieldset class="drawer-section" :disabled="saving || !canEditProduct"><h4>基础信息</h4><div class="drawer-form-grid"><label v-if="!selected" class="form-field"><span>产品编码 <b>*</b></span><input v-model="form.productCode" maxlength="64" placeholder="例如 CARD-US-USD" @input="form.productCode = form.productCode.toUpperCase()" /></label><label class="form-field"><span>产品名称 <b>*</b></span><input v-model="form.name" maxlength="128" placeholder="例如 美国卡支付" /></label><label class="form-field"><span>产品类型 <b>*</b></span><select v-model="form.productType"><option value="PAYIN">收款 PAYIN</option><option value="PAYOUT">出款 PAYOUT</option></select></label><label class="form-field"><span>接入模式 <b>*</b></span><select v-model="form.accessMode"><option value="DIRECT">直连 DIRECT</option><option value="AGGREGATED">聚合 AGGREGATED</option></select></label></div></fieldset><fieldset class="drawer-section" :disabled="saving || !canEditProduct"><h4>默认市场</h4><div class="drawer-form-grid"><label class="form-field"><span>国家/地区 <b>*</b></span><select v-model="form.defaultCountry" @change="refreshCurrencies(form.defaultCountry, true)"><option v-if="form.defaultCountry && !countries.some(item => item.code === form.defaultCountry)" :value="form.defaultCountry">{{ form.defaultCountry }}</option><option v-for="item in countries" :key="item.code" :value="item.code">{{ item.name }} · {{ item.code }}</option></select></label><label class="form-field"><span>币种 <b>*</b></span><select v-model="form.defaultCurrency"><option v-if="form.defaultCurrency && !defaultCurrencies.some(item => item.code === form.defaultCurrency)" :value="form.defaultCurrency">{{ form.defaultCurrency }}</option><option v-for="item in defaultCurrencies" :key="item.code" :value="item.code">{{ item.name }} · {{ item.code }}</option></select></label></div></fieldset><section class="drawer-section"><div class="section-heading"><div><h4>支付方式配置</h4><small>对客方式用于商户接入，渠道方式用于渠道调用。</small></div><button v-if="canCreateCapability" type="button" class="outline-btn" :disabled="saving" @click="addCapability"><Plus :size="16" />新增支付方式</button></div><fieldset v-for="(item, index) in capabilityDrafts" :key="item.capabilityId || index" class="capability-editor" :disabled="saving || !canEditCapability(item)"><div class="capability-editor-head"><strong>支付方式 {{ index + 1 }}</strong><button v-if="canEditCapability(item)" type="button" class="icon-btn danger" title="移除支付方式" @click="removeCapability(index)"><Trash2 :size="16" /></button></div><div class="drawer-form-grid"><label class="form-field"><span>对客支付方式 <b>*</b></span><input v-model="item.customerPaymentMethod" list="customer-payment-method-options" maxlength="64" placeholder="输入或选择支付方式编码" /></label><label class="form-field"><span>渠道支付方式 <b>*</b></span><input v-model="item.channelPaymentMethod" list="channel-payment-method-options" maxlength="64" placeholder="输入或选择渠道方式编码" /></label><label class="form-field"><span>最小金额 <b>*</b></span><input v-model.number="item.minAmount" type="number" min="0.01" step="0.01" /></label><label class="form-field"><span>最大金额 <b>*</b></span><input v-model.number="item.maxAmount" type="number" min="0.01" step="0.01" /></label><label class="form-field checkbox-field"><span>退款能力</span><input v-model="item.supportsRefund" type="checkbox" />支持退款</label></div></fieldset><div v-if="!capabilitiesReady" class="empty compact-empty">支付方式未加载或缺少查看权限，本次不会提交支付方式变更。</div><div v-else-if="!capabilityDrafts.length" class="empty compact-empty">暂无支付方式；拥有支付方式新增权限后可配置。</div></section><fieldset class="drawer-section" :disabled="saving || !canEditProduct"><h4>展示信息</h4><div class="drawer-form-grid"><label class="form-field"><span>账单描述符</span><input v-model="form.statementDescriptor" maxlength="22" placeholder="例如 DEMO PAYMENT" /></label><label class="form-field form-field-full"><span>产品描述</span><input v-model="form.description" maxlength="1000" placeholder="填写适用商户、商品或服务说明" /></label></div></fieldset><p v-if="saveError" class="product-save-error" role="alert">{{ saveError }}</p><div class="drawer-actions"><button class="outline-btn" type="button" :disabled="saving" @click="productDrawerOpen = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || !canSave || !form.name.trim() || (!selected && !form.productCode.trim()) || !form.defaultCountry || !form.defaultCurrency || !form.accessMode || !validCapabilities()"><Save :size="16" />{{ saving ? "保存中" : "保存产品" }}</button></div><datalist id="customer-payment-method-options"><option v-for="method in customerPaymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></datalist><datalist id="channel-payment-method-options"><option v-for="method in channelPaymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></datalist></form></AppDrawer>
  </section>
</template>

<style scoped>
.product-workspace { position: relative; }
.product-workspace :deep(.app-drawer-contained) { height: 100%; max-height: 100%; }
.product-workspace .panel-title > div:first-child small { display: block; margin-top: 5px; color: var(--muted); font-size: 12px; font-weight: 400; }
.product-table tbody tr { cursor: pointer; }
.product-table td small { display: block; margin-top: 4px; color: var(--muted-light); font-size: 11px; }
.product-drawer-form { display: grid; gap: 0; padding-bottom: 76px; }
.product-drawer-form .drawer-section { min-width: 0; margin: 0; padding: 0; border: 0; }
.product-save-error { color: var(--danger); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.product-drawer-form fieldset:disabled { opacity: .8; }
.product-drawer-form .drawer-section + .drawer-section { margin-top: 22px; padding-top: 22px; }
.product-drawer-form .drawer-section-heading { align-items: flex-start; margin-bottom: 14px; }
.product-drawer-form .drawer-section-heading h4 { margin-bottom: 5px; }
.product-drawer-form .drawer-section-heading small { max-width: 390px; color: var(--muted); font-size: 11px; line-height: 1.55; }
.product-drawer-form .form-field { gap: 6px; }
.product-drawer-form .form-field > span { color: var(--ink); font-weight: 600; }
.product-drawer-form .form-field > span b { color: var(--danger); }
.product-drawer-form .form-field > small { min-height: 17px; color: var(--muted); font-size: 10px; font-weight: 400; line-height: 1.45; }
.capability-editor { margin-top: 12px; padding: 16px; border: 1px solid var(--line-dark); border-radius: 4px; background: var(--surface-2); }
.capability-editor-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; color: var(--ink); font-size: 13px; }
.compact-empty { margin-top: 12px; padding: 18px; border: 1px dashed var(--line-dark); background: var(--surface-2); }
.product-name-column { width: 17%; }.product-type-column { width: 12%; }.product-market-column { width: 12%; }.product-method-column { width: 18%; }.product-capability-column { width: 8%; }.product-status-column { width: 10%; }
</style>
