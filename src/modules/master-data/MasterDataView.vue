<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Link2, LoaderCircle, Pencil, Plus, Save, Search, ToggleLeft } from "lucide-vue-next";
import { changeCountryCurrencyStatus, changeCountryStatus, createCountry, createCountryCurrency, createCurrencyForCountry, getActiveCurrencies, getCountries, getCountryCurrencies, updateCountry, type Country, type CountryCurrency, type Currency } from "./api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const countries = ref<Country[]>([]), loading = ref(false), saving = ref(false), error = ref("");
const filters = ref({ status: "", keyword: "" }), countryTotal = ref(0), drawer = ref(false);
const countryPage = ref({ current: 1, pageSize: 10 });
const countryEditing = ref<Country | null>(null);
const countryForm = ref({ code: "", name: "", region: "" });
const countryCurrencyDrawer = ref(false), currencyDrawer = ref(false), managedCountry = ref<Country | null>(null);
const managedRelations = ref<CountryCurrency[]>([]), managing = ref(false);
const currencyForm = ref({ code: "", name: "", symbol: "", decimalPlaces: 2 });
const currencyMode = ref<"create" | "associate">("create");
const existingCurrencies = ref<Currency[]>([]), selectedCurrency = ref(""), loadingCurrencies = ref(false);
const availableCurrencies = computed(() => existingCurrencies.value.filter((currency) => !managedRelations.value.some((relation) => relation.currencyCode === currency.code)));

const visibleCountries = computed(() => countries.value.filter((item) => `${item.code} ${item.name} ${item.region || ""}`.toLowerCase().includes(filters.value.keyword.trim().toLowerCase())));
const emptyCountry = () => ({ code: "", name: "", region: "" });
const emptyCurrency = () => ({ code: "", name: "", symbol: "", decimalPlaces: 2 });

async function load(page = countryPage.value.current) {
  loading.value = true; error.value = "";
  try {
    const result = await getCountries({ page, pageSize: countryPage.value.pageSize, status: filters.value.status });
    countries.value = result.items; countryTotal.value = result.total; countryPage.value.current = result.page;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "国家/地区加载失败";
    emit("notice", error.value);
  } finally { loading.value = false; }
}
const search = () => load(1);
const resetFilters = () => { filters.value = { status: "", keyword: "" }; load(1); };
const changePageSize = (pageSize: number) => { countryPage.value.pageSize = pageSize; load(1); };
function openCountryCreate() { countryEditing.value = null; countryForm.value = emptyCountry(); drawer.value = true; }
function editCountry(item: Country) { countryEditing.value = item; countryForm.value = { code: item.code, name: item.name, region: item.region || "" }; drawer.value = true; }
async function saveCountry() {
  saving.value = true;
  try {
    if (countryEditing.value) await updateCountry(countryEditing.value.code, countryForm.value);
    else await createCountry(countryForm.value);
    drawer.value = false; await load(); emit("notice", "国家/地区已保存");
  } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "国家/地区保存失败"); }
  finally { saving.value = false; }
}
async function toggleCountry(item: Country) { try { await changeCountryStatus(item.code, item.status === "ACTIVE" ? "DISABLED" : "ACTIVE"); await load(); } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "状态更新失败"); } }
async function loadManagedRelations() {
  if (!managedCountry.value) return;
  const countryCode = managedCountry.value.code;
  const items: CountryCurrency[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getCountryCurrencies({ page, pageSize: 100, countryCode });
    items.push(...result.items);
    if (items.length >= result.total) break;
    if (!result.items.length) throw new Error("关联币种加载不完整，请重试");
  }
  if (managedCountry.value?.code === countryCode) managedRelations.value = items;
}
async function manageCountryCurrencies(country: Country) {
  managedCountry.value = country; managedRelations.value = []; countryCurrencyDrawer.value = true; managing.value = true;
  try { await loadManagedRelations(); }
  catch (cause) { emit("notice", cause instanceof Error ? cause.message : "关联币种加载失败"); }
  finally { managing.value = false; }
}
function openCurrencyCreate(country: Country) { managedCountry.value = country; currencyForm.value = emptyCurrency(); currencyMode.value = "create"; currencyDrawer.value = true; }
async function openCurrencyAssociate(country: Country) {
  managedCountry.value = country; selectedCurrency.value = ""; existingCurrencies.value = [];
  currencyMode.value = "associate"; currencyDrawer.value = true; loadingCurrencies.value = true;
  try {
    const [currencies] = await Promise.all([getActiveCurrencies(), loadManagedRelations()]);
    existingCurrencies.value = currencies;
  } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "可关联币种加载失败"); }
  finally { loadingCurrencies.value = false; }
}
async function associateCurrency() {
  if (saving.value || loadingCurrencies.value || !hasPermission("master-data:create") || !managedCountry.value || !availableCurrencies.value.some((currency) => currency.code === selectedCurrency.value)) return;
  saving.value = true;
  try {
    await createCountryCurrency({ countryCode: managedCountry.value.code, currencyCode: selectedCurrency.value });
    currencyDrawer.value = false;
    emit("notice", "现有币种已关联到当前国家/地区");
    await loadManagedRelations();
  } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "币种关联失败"); }
  finally { saving.value = false; }
}
async function createCurrencyAndAssociate() {
  if (!managedCountry.value) return;
  saving.value = true;
  try {
    await createCurrencyForCountry(managedCountry.value.code, currencyForm.value);
    currencyDrawer.value = false; await loadManagedRelations(); emit("notice", "币种已创建并关联到当前国家/地区");
  } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "币种创建失败"); }
  finally { saving.value = false; }
}
async function toggleManagedRelation(item: CountryCurrency) {
  saving.value = true;
  try {
    await changeCountryCurrencyStatus(item.countryCode, item.currencyCode, item.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    await loadManagedRelations(); emit("notice", "关联状态已更新");
  } catch (cause) { emit("notice", cause instanceof Error ? cause.message : "关联状态更新失败"); }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="workspace-panel master-data-view management-list-page">
    <form class="management-filter-form" @submit.prevent="search"><div class="management-filter-fields"><label class="management-form-item"><span>国家/地区</span><div class="management-input"><Search :size="16" /><input v-model="filters.keyword" placeholder="名称、代码或区域" /></div></label><label class="management-form-item"><span>状态</span><select v-model="filters.status"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label></div><div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetFilters">重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button><button v-if="hasPermission('master-data:create')" class="primary-btn" type="button" @click="openCountryCreate"><Plus :size="16" />新增国家/地区</button></div></form>
    <div class="management-list-summary"><span>国家与币种</span><small>共 {{ countryTotal }} 个国家/地区</small></div>
    <p v-if="error" class="master-error">{{ error }}</p>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="20" />加载中…</div>
    <div v-else class="table-wrap management-table-wrap"><table class="data-table master-management-table"><colgroup><col class="country-name-column" /><col class="country-code-column" /><col class="country-region-column" /><col class="country-status-column" /><col class="management-actions-column" /></colgroup><thead><tr><th>国家/地区</th><th>二位代码</th><th>区域</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in visibleCountries" :key="item.code"><td><strong>{{ item.name }}</strong></td><td><span class="code-pill">{{ item.code }}</span></td><td>{{ item.region || '--' }}</td><td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '已启用' : '已停用' }}</span></td><td class="actions"><div class="management-row-actions"><button v-if="hasPermission('master-data:list')" class="outline-btn" title="管理关联币种" @click="manageCountryCurrencies(item)"><Link2 :size="16" />币种</button><button v-if="hasPermission('master-data:create')" class="outline-btn" title="新增币种并关联" :disabled="item.status !== 'ACTIVE'" @click="openCurrencyCreate(item)"><Plus :size="16" />新增币种</button><button v-if="hasPermission('master-data:update')" class="outline-btn" title="编辑国家/地区" @click="editCountry(item)"><Pencil :size="16" />编辑</button><button v-if="hasPermission('master-data:status')" class="outline-btn" title="切换状态" @click="toggleCountry(item)"><ToggleLeft :size="16" />{{ item.status === 'ACTIVE' ? '停用' : '启用' }}</button></div></td></tr><tr v-if="!visibleCountries.length"><td colspan="5" class="master-empty">没有符合筛选条件的国家/地区</td></tr></tbody></table></div>
    <AppPagination :page="countryPage.current" :page-size="countryPage.pageSize" :total="countryTotal" @change="load" @size-change="changePageSize" />
    <AppDrawer v-if="drawer" :title="countryEditing ? '编辑国家/地区' : '新增国家/地区'" description="COUNTRY / REGION" contained @close="drawer = false"><form class="master-data-form" @submit.prevent="saveCountry"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>国家/地区信息</h4><small>编码创建后不可修改；停用后不能用于新产品和新关联。</small></div></div><div class="drawer-form-grid"><label class="form-field"><span>二位代码 <b>*</b></span><input v-model="countryForm.code" maxlength="2" :disabled="!!countryEditing" placeholder="US" @input="countryForm.code = countryForm.code.toUpperCase()" /></label><label class="form-field"><span>国家/地区名称 <b>*</b></span><input v-model="countryForm.name" maxlength="128" placeholder="例如 美国" /></label><label class="form-field"><span>区域</span><input v-model="countryForm.region" maxlength="64" placeholder="例如 北美" /></label></div></section><div class="product-drawer-actions"><button class="outline-btn" type="button" @click="drawer = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || !countryForm.code || !countryForm.name"><Save :size="16" />{{ saving ? '保存中' : '保存' }}</button></div></form></AppDrawer>
    <AppDrawer v-if="countryCurrencyDrawer && managedCountry" :title="`${managedCountry.name} · 币种管理`" :description="`${managedCountry.code} / COUNTRY CURRENCIES`" contained @close="countryCurrencyDrawer = false"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>已关联币种</h4><small>查看并编辑该国家/地区可用于产品和支付能力的币种。</small></div><span class="code-pill">{{ managedRelations.length }} 项</span></div><div v-if="hasPermission('master-data:create') && managedCountry.status === 'ACTIVE'" class="button-row currency-link-actions"><button class="outline-btn" type="button" :disabled="managing || saving" @click="openCurrencyAssociate(managedCountry)"><Link2 :size="16" />关联现有币种</button><button class="outline-btn" type="button" :disabled="managing || saving" @click="openCurrencyCreate(managedCountry)"><Plus :size="16" />新增币种</button></div><div v-if="managing" class="empty"><LoaderCircle class="spin" :size="18" />加载中…</div><div v-else class="currency-relation-list"><article v-for="item in managedRelations" :key="item.currencyCode"><div><strong>{{ item.currencyName }}</strong><small>{{ item.currencyCode }}</small></div><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '已启用' : '已停用' }}</span><button v-if="hasPermission('master-data:status')" class="icon-btn" :title="item.status === 'ACTIVE' ? '停用关联' : '启用关联'" :disabled="saving" @click="toggleManagedRelation(item)"><ToggleLeft :size="16" /></button></article><p v-if="!managedRelations.length" class="master-empty">暂未关联币种</p></div></section></AppDrawer>
    <AppDrawer v-if="currencyDrawer && managedCountry && currencyMode === 'associate'" :title="`${managedCountry.name} · 关联现有币种`" description="ASSOCIATE CURRENCY" contained @close="!saving && (currencyDrawer = false)"><form class="master-data-form" @submit.prevent="associateCurrency"><section class="drawer-section"><p class="form-help">关联已有币种，不会重复创建币种。已有的停用关联请在币种管理中启用。</p><div v-if="loadingCurrencies" class="empty">加载中…</div><label v-else class="form-field"><span>现有币种</span><select v-model="selectedCurrency"><option value="" disabled>请选择币种</option><option v-for="currency in availableCurrencies" :key="currency.code" :value="currency.code">{{ currency.code }} · {{ currency.name }}</option></select><small v-if="!availableCurrencies.length">暂无可关联的已启用币种</small></label></section><div class="product-drawer-actions"><button class="outline-btn" type="button" :disabled="saving" @click="currencyDrawer = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || loadingCurrencies || !selectedCurrency"><Link2 :size="16" />{{ saving ? '关联中' : '确认关联' }}</button></div></form></AppDrawer>
    <AppDrawer v-if="currencyDrawer && managedCountry && currencyMode === 'create'" :title="`${managedCountry.name} · 新增币种`" description="CREATE AND ASSOCIATE" contained @close="currencyDrawer = false"><form class="master-data-form" @submit.prevent="createCurrencyAndAssociate"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>币种信息</h4><small>保存后自动关联至 {{ managedCountry.name }}，无需额外配置。</small></div></div><div class="drawer-form-grid"><label class="form-field"><span>币种代码 <b>*</b></span><input v-model="currencyForm.code" maxlength="3" placeholder="USD" @input="currencyForm.code = currencyForm.code.toUpperCase()" /></label><label class="form-field"><span>币种名称 <b>*</b></span><input v-model="currencyForm.name" maxlength="128" placeholder="例如 美元" /></label><label class="form-field"><span>币种符号</span><input v-model="currencyForm.symbol" maxlength="16" placeholder="$" /></label><label class="form-field"><span>金额小数位 <b>*</b></span><input v-model.number="currencyForm.decimalPlaces" type="number" min="0" max="6" /></label></div></section><div class="product-drawer-actions"><button class="outline-btn" type="button" @click="currencyDrawer = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || !currencyForm.code || !currencyForm.name"><Save :size="16" />{{ saving ? '创建中' : '创建并关联' }}</button></div></form></AppDrawer>
  </section>
</template>

<style scoped>
.master-data-view { position: relative; }
.master-data-view :deep(.app-drawer-contained) { height: 100%; max-height: 100%; }
.product-drawer-actions { position: absolute; right: 0; bottom: 0; left: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--line); background: var(--elevated); }
.master-data-view .panel-title small { display: block; margin-top: 5px; color: var(--muted); font-size: 12px; font-weight: 400; }
.code-pill { display: inline-flex; min-width: 38px; justify-content: center; padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 4px; color: var(--accent-dark); background: var(--accent-soft); font: 600 11px "DM Mono", monospace; }
.master-empty { height: 180px; color: var(--muted); text-align: center; }
.master-error { margin: 0 0 14px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); border-radius: 6px; color: var(--danger); background: color-mix(in srgb, var(--danger) 7%, transparent); font-size: 12px; }
.master-data-form { padding-bottom: 70px; }
.currency-link-actions { flex-wrap: wrap; margin-bottom: 16px; }
.currency-relation-list { display: grid; gap: 8px; }
.currency-relation-list article { display: grid; grid-template-columns: minmax(0, 1fr) auto 32px; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); }
.currency-relation-list article div { display: grid; gap: 3px; min-width: 0; }
.currency-relation-list article strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.currency-relation-list article small { color: var(--muted); font: 600 11px "DM Mono", monospace; }
@media (max-width: 560px) {
  .product-drawer-actions { padding-inline: 16px; } .product-drawer-actions button { flex: 1; }
}
.country-name-column { width: 25%; }.country-code-column { width: 14%; }.country-region-column { width: 24%; }.country-status-column { width: 14%; }
</style>
