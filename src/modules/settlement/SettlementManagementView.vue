<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Eye, Pencil, Play, Plus, RefreshCw, RotateCcw, Save, Search, ToggleLeft, ToggleRight } from "lucide-vue-next";
import { ElOption, ElSelect, ElTable, ElTableColumn, vLoading } from "element-plus";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";
import { hasPermission } from "../../auth";
import { getMerchants, getMerchantProducts, type Merchant, type MerchantProduct } from "../merchant/api";
import { getProducts, type Product } from "../product/api";
import { changeSettlementRuleStatus, getSettlementBatch, getSettlementRules, runSettlementBatch, saveSettlementRule, type SettlementRule } from "./api";

const emit = defineEmits<{ notice: [message: string] }>();
const merchants = ref<Merchant[]>([]), products = ref<Product[]>([]), boundProducts = ref<MerchantProduct[]>([]), rules = ref<SettlementRule[]>([]);
const loading = ref(false), saving = ref(false), running = ref(false), inspecting = ref(false), bindingLoading = ref(false);
const filters = ref({ merchantId: "", productCode: "", currency: "", status: "" });
const drawer = ref<"form" | "detail" | "batch" | null>(null);
const selected = ref<SettlementRule | null>(null), batchId = ref(""), date = ref(new Date().toISOString().slice(0, 10));
const batch = ref<Record<string, unknown> | null>(null), details = ref<Record<string, unknown>[]>([]), editingId = ref<number | null>(null);
const page = ref({ current: 1, pageSize: 10, total: 0 });
const cycleOptions = [
  { value: "NATURAL_DAY", label: "自然日结算" }, { value: "WORKING_DAY", label: "工作日结算" },
  { value: "WEEKLY", label: "周结" }, { value: "MULTI_WEEKLY", label: "多周结算" },
  { value: "MONTHLY", label: "月结" }, { value: "MANUAL", label: "手工结算" },
];
const weekDays = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const newRule = (): SettlementRule => ({ merchantId: "", productCode: "", currency: "", settlementCycle: "NATURAL_DAY", cycleDays: 1, settlementDay: null, cycleInterval: 1, minSettlementAmount: 0, feeRate: 0, autoSettlement: true, status: "ACTIVE", effectiveDate: new Date().toISOString().slice(0, 10), expireDate: null });
const form = ref<SettlementRule>(newRule());
const editing = computed(() => editingId.value !== null);
const selectedProduct = computed(() => products.value.find((item) => item.productCode === form.value.productCode));
const formProducts = computed(() => {
  if (!form.value.merchantId) return [];
  const codes = new Set(boundProducts.value.filter((item) => item.status === "ACTIVE").map((item) => item.productCode));
  return products.value.filter((item) => codes.has(item.productCode));
});
const showsDelayDays = computed(() => ["NATURAL_DAY", "WORKING_DAY"].includes(form.value.settlementCycle));
const showsWeekday = computed(() => ["WEEKLY", "MULTI_WEEKLY"].includes(form.value.settlementCycle));
const showsMonthDay = computed(() => form.value.settlementCycle === "MONTHLY");

const cycleLabel = (cycle: string) => cycleOptions.find((item) => item.value === cycle)?.label || cycle;
const cycleSummary = (rule: SettlementRule) => {
  if (rule.settlementCycle === "NATURAL_DAY") return `自然日 T+${rule.cycleDays}`;
  if (rule.settlementCycle === "WORKING_DAY") return `工作日 T+${rule.cycleDays}`;
  if (rule.settlementCycle === "WEEKLY") return `每${weekDays[rule.settlementDay || 0] || "--"}`;
  if (rule.settlementCycle === "MULTI_WEEKLY") return `每 ${rule.cycleInterval || 2} 周 ${weekDays[rule.settlementDay || 0] || "--"}`;
  if (rule.settlementCycle === "MONTHLY") return `每月 ${rule.settlementDay || "--"} 日`;
  return "手工执行";
};
const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getSettlementRules({ page: current, pageSize: page.value.pageSize, ...filters.value });
    rules.value = result.items ?? [];
    page.value = { current: result.page ?? current, pageSize: result.pageSize ?? page.value.pageSize, total: result.total ?? 0 };
  } catch (error) { emit("notice", error instanceof Error ? error.message : "结算规则加载失败"); }
  finally { loading.value = false; }
};
const loadBoundProducts = async (merchantId: string) => {
  if (!merchantId) { boundProducts.value = []; return; }
  bindingLoading.value = true;
  try { boundProducts.value = (await getMerchantProducts({ merchantId, status: "ACTIVE", page: 1, pageSize: 100 })).items; }
  catch (error) { emit("notice", error instanceof Error ? error.message : "商户产品加载失败"); }
  finally { bindingLoading.value = false; }
};
const selectFormMerchant = async () => { form.value.productCode = ""; form.value.currency = ""; await loadBoundProducts(form.value.merchantId); };
const selectProduct = () => { form.value.currency = selectedProduct.value?.defaultCurrency || ""; };
const openCreate = () => { editingId.value = null; boundProducts.value = []; form.value = newRule(); drawer.value = "form"; };
const openEdit = async (rule: SettlementRule) => { selected.value = rule; editingId.value = rule.id ?? null; form.value = { ...rule, cycleInterval: rule.cycleInterval || 1, settlementDay: rule.settlementDay || null }; await loadBoundProducts(rule.merchantId); drawer.value = "form"; };
const openDetail = (rule: SettlementRule) => { selected.value = rule; drawer.value = "detail"; };
const reset = () => { filters.value = { merchantId: "", productCode: "", currency: "", status: "" }; void load(1); };
const changePageSize = (size: number) => { page.value.pageSize = size; void load(1); };
const save = async () => {
  const rule = { ...form.value, productCode: form.value.productCode.trim(), currency: selectedProduct.value?.defaultCurrency || form.value.currency, expireDate: form.value.expireDate || null };
  if (!rule.merchantId || !rule.productCode || !rule.currency) return emit("notice", "请选择商户产品，结算币种将使用产品默认币种");
  if (rule.minSettlementAmount < 0 || rule.feeRate < 0 || rule.feeRate > 1 || rule.cycleDays < 0 || rule.cycleDays > 365) return emit("notice", "结算参数范围无效");
  if (!rule.effectiveDate || (rule.expireDate && rule.expireDate < rule.effectiveDate)) return emit("notice", "失效日期不能早于生效日期");
  if (showsWeekday.value && (!rule.settlementDay || rule.settlementDay < 1 || rule.settlementDay > 7)) return emit("notice", "请选择结算星期");
  if (showsMonthDay.value && (!rule.settlementDay || rule.settlementDay < 1 || rule.settlementDay > 31)) return emit("notice", "请选择每月结算日");
  if (rule.settlementCycle === "MULTI_WEEKLY" && (rule.cycleInterval || 0) < 2) return emit("notice", "多周结算间隔至少为 2 周");
  saving.value = true;
  try { await saveSettlementRule(rule); emit("notice", editing.value ? "结算规则已更新" : "结算规则已创建"); drawer.value = null; await load(); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "结算规则保存失败"); }
  finally { saving.value = false; }
};
const toggleRule = async (rule: SettlementRule) => { if (!rule.id) return; saving.value = true; try { await changeSettlementRuleStatus(rule.id, rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE"); emit("notice", rule.status === "ACTIVE" ? "结算规则已停用" : "结算规则已启用"); await load(); } catch (error) { emit("notice", error instanceof Error ? error.message : "结算规则状态更新失败"); } finally { saving.value = false; } };
const openBatch = () => { batch.value = null; details.value = []; batchId.value = ""; drawer.value = "batch"; };
const inspect = async () => { if (!batchId.value.trim()) return; inspecting.value = true; try { const result = await getSettlementBatch(batchId.value.trim()); batch.value = result.batch; details.value = result.details; } catch (error) { emit("notice", error instanceof Error ? error.message : "结算批次加载失败"); } finally { inspecting.value = false; } };
const run = async () => { running.value = true; try { const result = await runSettlementBatch(date.value); batchId.value = result.batchId; await inspect(); emit("notice", `结算批次 ${result.batchId} 已执行`); } catch (error) { emit("notice", error instanceof Error ? error.message : "结算批次执行失败"); } finally { running.value = false; } };
watch(() => form.value.settlementCycle, (cycle) => { if (["NATURAL_DAY", "WORKING_DAY", "MANUAL"].includes(cycle)) form.value.settlementDay = null; if (cycle !== "MULTI_WEEKLY") form.value.cycleInterval = 1; });
onMounted(async () => { try { const [merchantResult, productResult] = await Promise.all([getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }), getProducts({ page: 1, pageSize: 100, status: "ACTIVE", productType: "PAYIN" })]); merchants.value = merchantResult.items; products.value = productResult.items; await load(1); } catch (error) { emit("notice", error instanceof Error ? error.message : "结算数据加载失败"); } });
</script>

<template>
  <section class="workspace-panel configuration-center management-list-page settlement-management">
    <div class="panel-title"><div><span class="eyebrow">SETTLEMENT CONTROL</span><h3>结算管理</h3></div><div class="button-row"><button v-if="hasPermission('settlement:rule:manage')" class="primary-btn" type="button" @click="openCreate"><Plus :size="16" />新增规则</button><button v-if="hasPermission('settlement:batch:run')" class="outline-btn" type="button" @click="openBatch"><Play :size="16" />手动执行</button><button class="icon-btn" type="button" title="刷新" :disabled="loading" @click="load()"><RefreshCw :class="{ spin: loading }" :size="16" /></button></div></div>
    <form class="management-filter-form" @submit.prevent="load(1)"><div class="management-filter-fields"><label class="management-form-item"><span>商户</span><ElSelect v-model="filters.merchantId" clearable filterable placeholder="全部商户"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label><label class="management-form-item"><span>产品</span><ElSelect v-model="filters.productCode" clearable filterable placeholder="全部产品"><ElOption v-for="product in products" :key="product.productCode" :label="`${product.name} · ${product.productCode}`" :value="product.productCode" /></ElSelect></label><label class="management-form-item"><span>结算币种</span><ElSelect v-model="filters.currency" clearable placeholder="全部币种"><ElOption v-for="product in products" :key="`currency-${product.productCode}`" :label="product.defaultCurrency" :value="product.defaultCurrency" /></ElSelect></label><label class="management-form-item"><span>状态</span><ElSelect v-model="filters.status" clearable placeholder="全部状态"><ElOption label="已启用" value="ACTIVE" /><ElOption label="已停用" value="DISABLED" /></ElSelect></label></div><div class="management-filter-actions"><button class="outline-btn" type="button" @click="reset"><RotateCcw :size="16" />重置</button><button class="primary-btn" type="submit" :disabled="loading"><Search :size="16" />查询</button></div></form>
    <div class="settlement-table-shell"><ElTable v-loading="loading" :data="rules" empty-text="暂无结算规则" border stripe table-layout="fixed" row-key="id"><ElTableColumn label="商户 / 产品" min-width="220"><template #default="scope"><strong>{{ scope.row.merchantId }}</strong><small class="table-subtext mono">{{ scope.row.productCode || "历史通用规则" }}</small></template></ElTableColumn><ElTableColumn label="币种 / 周期" min-width="180"><template #default="scope"><strong>{{ scope.row.currency }}</strong><small class="table-subtext">{{ cycleSummary(scope.row as SettlementRule) }}</small></template></ElTableColumn><ElTableColumn label="结算门槛" min-width="145"><template #default="scope"><span class="settlement-amount">{{ scope.row.minSettlementAmount }}</span><small class="table-subtext">费率 {{ scope.row.feeRate }}</small></template></ElTableColumn><ElTableColumn label="生效时间" min-width="155"><template #default="scope">{{ scope.row.effectiveDate }}<small class="table-subtext">{{ scope.row.expireDate || "长期有效" }}</small></template></ElTableColumn><ElTableColumn label="状态" width="110"><template #default="scope"><span class="status-badge" :class="'st-' + scope.row.status.toLowerCase()">{{ scope.row.status }}</span></template></ElTableColumn><ElTableColumn label="操作" width="150" align="right"><template #default="scope"><div class="settlement-row-actions"><button class="icon-btn" type="button" title="查看规则详情" @click="openDetail(scope.row as SettlementRule)"><Eye :size="16" /></button><button v-if="hasPermission('settlement:rule:manage')" class="icon-btn" type="button" title="编辑规则" :disabled="saving" @click="openEdit(scope.row as SettlementRule)"><Pencil :size="16" /></button><button v-if="hasPermission('settlement:rule:manage')" class="icon-btn" type="button" :title="scope.row.status === 'ACTIVE' ? '停用规则' : '启用规则'" :disabled="saving" @click="toggleRule(scope.row as SettlementRule)"><ToggleRight v-if="scope.row.status === 'ACTIVE'" :size="16" /><ToggleLeft v-else :size="16" /></button></div></template></ElTableColumn></ElTable></div>
    <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" @change="load" @size-change="changePageSize" />
    <AppDrawer v-if="drawer === 'form' && hasPermission('settlement:rule:manage')" :title="editing ? '编辑结算规则' : '新增结算规则'" description="MERCHANT PRODUCT SETTLEMENT" @close="drawer = null"><form class="drawer-section settlement-drawer-form" @submit.prevent="save"><div class="drawer-section-heading"><h4>{{ editing ? `规则 #${editingId}` : "规则参数" }}</h4><small>规则绑定至商户产品，结算币种自动采用该产品的默认币种。</small></div><div class="drawer-form-grid"><label class="form-field"><span>商户 <b>*</b></span><ElSelect v-model="form.merchantId" filterable placeholder="选择商户" @change="selectFormMerchant"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label><label class="form-field"><span>商户产品 <b>*</b></span><ElSelect v-model="form.productCode" filterable :loading="bindingLoading" :disabled="!form.merchantId" placeholder="先选择商户" @change="selectProduct"><ElOption v-for="product in formProducts" :key="product.productCode" :label="`${product.name} · ${product.productCode}`" :value="product.productCode" /></ElSelect></label><label class="form-field"><span>结算币种</span><input :value="selectedProduct?.defaultCurrency || form.currency || '选择产品后自动填充'" readonly /></label><label class="form-field"><span>结算周期</span><ElSelect v-model="form.settlementCycle"><ElOption v-for="cycle in cycleOptions" :key="cycle.value" :label="cycle.label" :value="cycle.value" /></ElSelect></label><label v-if="showsDelayDays" class="form-field"><span>{{ form.settlementCycle === 'WORKING_DAY' ? '延迟工作日' : '延迟自然日' }}</span><input v-model.number="form.cycleDays" type="number" min="0" max="365" /></label><label v-if="showsWeekday" class="form-field"><span>结算星期</span><ElSelect v-model="form.settlementDay" placeholder="选择星期"><ElOption v-for="day in [1,2,3,4,5,6,7]" :key="day" :label="weekDays[day]" :value="day" /></ElSelect></label><label v-if="form.settlementCycle === 'MULTI_WEEKLY'" class="form-field"><span>间隔周数</span><input v-model.number="form.cycleInterval" type="number" min="2" max="52" /></label><label v-if="showsMonthDay" class="form-field"><span>每月结算日</span><input v-model.number="form.settlementDay" type="number" min="1" max="31" /></label><label class="form-field"><span>最低结算金额</span><input v-model.number="form.minSettlementAmount" type="number" min="0" step="0.0001" /></label><label class="form-field"><span>费率</span><input v-model.number="form.feeRate" type="number" min="0" max="1" step="0.0001" /></label><label class="form-field"><span>生效日期</span><input v-model="form.effectiveDate" type="date" required /></label><label class="form-field"><span>失效日期</span><input v-model="form.expireDate" type="date" /></label><label class="form-field checkbox-field"><span>自动结算</span><input v-model="form.autoSettlement" type="checkbox" />启用</label></div><button class="primary-btn drawer-submit" type="submit" :disabled="saving"><Save :size="16" />{{ saving ? "保存中" : editing ? "更新规则" : "保存规则" }}</button></form></AppDrawer>
    <AppDrawer v-if="drawer === 'detail' && selected" title="结算规则详情" :description="`${selected.merchantId} · ${selected.productCode || '历史通用规则'}`" @close="drawer = null"><section class="drawer-section settlement-detail-drawer"><div class="settlement-detail-status"><span class="status-badge" :class="'st-' + selected.status.toLowerCase()">{{ selected.status }}</span><button v-if="hasPermission('settlement:rule:manage')" class="outline-btn" type="button" @click="openEdit(selected)"><Pencil :size="15" />编辑规则</button></div><dl class="settlement-detail-list"><div><dt>商户 ID</dt><dd>{{ selected.merchantId }}</dd></div><div><dt>产品编码</dt><dd class="mono">{{ selected.productCode || "历史通用规则" }}</dd></div><div><dt>结算币种</dt><dd>{{ selected.currency }}</dd></div><div><dt>结算周期</dt><dd>{{ cycleLabel(selected.settlementCycle) }} · {{ cycleSummary(selected) }}</dd></div><div><dt>最低结算金额</dt><dd>{{ selected.minSettlementAmount }}</dd></div><div><dt>费率</dt><dd>{{ selected.feeRate }}</dd></div><div><dt>自动结算</dt><dd>{{ selected.autoSettlement ? "已启用" : "已停用" }}</dd></div><div><dt>生效日期</dt><dd>{{ selected.effectiveDate }}</dd></div><div><dt>失效日期</dt><dd>{{ selected.expireDate || "长期有效" }}</dd></div></dl></section></AppDrawer>
    <AppDrawer v-if="drawer === 'batch'" title="手动执行结算" description="SETTLEMENT BATCH" @close="drawer = null"><section class="drawer-section settlement-drawer-form"><div class="drawer-section-heading"><h4>执行或查询批次</h4><small>执行指定日期的待结算明细，也可以输入已有批次 ID 查看结果。</small></div><div class="drawer-form-grid"><label class="form-field"><span>结算日期</span><input v-model="date" type="date" /></label><label class="form-field form-field-full"><span>批次 ID</span><input v-model="batchId" placeholder="输入批次 ID 查询" @keyup.enter="inspect" /></label></div><div class="drawer-actions"><button v-if="hasPermission('settlement:batch:read')" class="outline-btn" type="button" :disabled="inspecting || !batchId.trim()" @click="inspect"><Search :size="16" />查询批次</button><button v-if="hasPermission('settlement:batch:run')" class="primary-btn" type="button" :disabled="running" @click="run"><Play :size="16" />{{ running ? "执行中" : "执行批次" }}</button></div><div v-if="batch" class="settlement-detail-metrics"><div><span>批次 ID</span><strong>{{ batch.batchId }}</strong></div><div><span>结算日期</span><strong>{{ batch.settlementDate }}</strong></div><div><span>订单数</span><strong>{{ batch.totalOrders }}</strong></div><div><span>商户数</span><strong>{{ batch.totalMerchants }}</strong></div><div><span>结算总额</span><strong>{{ batch.totalAmount }}</strong></div><div><span>状态</span><strong>{{ batch.status }}</strong></div></div><div v-if="details.length" class="settlement-line-table-wrap"><table class="data-table settlement-line-table"><thead><tr><th>明细 ID</th><th>订单 ID</th><th>商户</th><th>币种</th><th>结算金额</th><th>状态</th></tr></thead><tbody><tr v-for="detail in details" :key="String(detail.detailId)"><td class="mono">{{ detail.detailId }}</td><td class="mono">{{ detail.orderId }}</td><td>{{ detail.merchantId }}</td><td>{{ detail.currency }}</td><td>{{ detail.settlementAmount }}</td><td>{{ detail.status }}</td></tr></tbody></table></div></section></AppDrawer>
  </section>
</template>
