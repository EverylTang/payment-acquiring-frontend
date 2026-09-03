<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Link2, LoaderCircle, Pencil, Plus, RefreshCw, Save, ToggleLeft } from "lucide-vue-next";
import { changeCountryCurrencyStatus, changeCountryStatus, createCountry, createCurrencyForCountry, getCountries, getCountryCurrencies, updateCountry, type Country, type CountryCurrency } from "./api";
import { hasPermission } from "../../auth";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const countries = ref<Country[]>([]), loading = ref(false), saving = ref(false), error = ref("");
const filter = ref(""), keyword = ref(""), countryTotal = ref(0), drawer = ref(false);
const countryPage = ref({ current: 1, pageSize: 10 });
const countryEditing = ref<Country | null>(null);
const countryForm = ref({ code: "", name: "", region: "" });
const countryCurrencyDrawer = ref(false), currencyDrawer = ref(false), managedCountry = ref<Country | null>(null);
const managedRelations = ref<CountryCurrency[]>([]), managing = ref(false);
const currencyForm = ref({ code: "", name: "", symbol: "", decimalPlaces: 2 });

const visibleCountries = computed(() => countries.value.filter((item) => `${item.code} ${item.name} ${item.region || ""}`.toLowerCase().includes(keyword.value.trim().toLowerCase())));
const emptyCountry = () => ({ code: "", name: "", region: "" });
const emptyCurrency = () => ({ code: "", name: "", symbol: "", decimalPlaces: 2 });

async function load(page = countryPage.value.current) {
  loading.value = true; error.value = "";
  try {
    const result = await getCountries({ page, pageSize: countryPage.value.pageSize, status: filter.value });
    countries.value = result.items; countryTotal.value = result.total; countryPage.value.current = result.page;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "国家/地区加载失败";
    emit("notice", error.value);
  } finally { loading.value = false; }
}
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
async function loadManagedRelations() { if (!managedCountry.value) return; const result = await getCountryCurrencies({ page: 1, pageSize: 100, countryCode: managedCountry.value.code }); managedRelations.value = result.items; }
async function manageCountryCurrencies(country: Country) {
  managedCountry.value = country; countryCurrencyDrawer.value = true; managing.value = true;
  try { await loadManagedRelations(); }
  catch (cause) { emit("notice", cause instanceof Error ? cause.message : "关联币种加载失败"); }
  finally { managing.value = false; }
}
function openCurrencyCreate(country: Country) { managedCountry.value = country; currencyForm.value = emptyCurrency(); currencyDrawer.value = true; }
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
watch(filter, () => load(1)); onMounted(load);
</script>

<template>
  <section class="workspace-panel master-data-view">
    <div class="panel-title"><div><span class="eyebrow">MASTER DATA</span><h3>国家与币种</h3><small>通过国家/地区维护其可用币种，产品与支付能力只能选择已启用组合。</small></div><div class="button-row"><button class="outline-btn" :disabled="loading" @click="load()"><RefreshCw :size="16" />刷新</button><button v-if="hasPermission('master-data:create')" class="primary-btn" @click="openCountryCreate"><Plus :size="16" />新增国家/地区</button></div></div>
    <div class="element-filter-bar"><label><span>状态</span><select v-model="filter"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select></label><label class="master-search"><span>搜索</span><input v-model="keyword" placeholder="搜索名称、国家代码或区域" /></label><span>共 {{ countryTotal }} 项</span></div>
    <p v-if="error" class="master-error">{{ error }}</p>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="20" />加载中…</div>
    <div v-else class="table-wrap master-table-wrap"><table class="data-table"><thead><tr><th>国家/地区</th><th>二位代码</th><th>区域</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in visibleCountries" :key="item.code"><td><strong>{{ item.name }}</strong></td><td><span class="code-pill">{{ item.code }}</span></td><td>{{ item.region || '--' }}</td><td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '已启用' : '已停用' }}</span></td><td class="actions"><button v-if="hasPermission('master-data:list')" class="icon-btn" title="管理关联币种" @click="manageCountryCurrencies(item)"><Link2 :size="16" /></button><button v-if="hasPermission('master-data:create')" class="icon-btn" title="新增币种并关联" :disabled="item.status !== 'ACTIVE'" @click="openCurrencyCreate(item)"><Plus :size="16" /></button><button v-if="hasPermission('master-data:update')" class="icon-btn" title="编辑国家/地区" @click="editCountry(item)"><Pencil :size="16" /></button><button v-if="hasPermission('master-data:status')" class="icon-btn" title="切换状态" @click="toggleCountry(item)"><ToggleLeft :size="16" /></button></td></tr><tr v-if="!visibleCountries.length"><td colspan="5" class="master-empty">没有符合筛选条件的国家/地区</td></tr></tbody></table></div>
    <AppPagination :page="countryPage.current" :page-size="countryPage.pageSize" :total="countryTotal" noun="个国家/地区" @change="load" />
  </section>
  <AppDrawer v-if="drawer" :title="countryEditing ? '编辑国家/地区' : '新增国家/地区'" description="COUNTRY / REGION" @close="drawer = false"><form class="master-data-form" @submit.prevent="saveCountry"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>国家/地区信息</h4><small>编码创建后不可修改；停用后不能用于新产品和新关联。</small></div></div><div class="drawer-form-grid"><label class="form-field"><span>二位代码 <b>*</b></span><input v-model="countryForm.code" maxlength="2" :disabled="!!countryEditing" placeholder="US" @input="countryForm.code = countryForm.code.toUpperCase()" /></label><label class="form-field"><span>国家/地区名称 <b>*</b></span><input v-model="countryForm.name" maxlength="128" placeholder="例如 美国" /></label><label class="form-field"><span>区域</span><input v-model="countryForm.region" maxlength="64" placeholder="例如 北美" /></label></div></section><div class="product-drawer-actions"><button class="outline-btn" type="button" @click="drawer = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || !countryForm.code || !countryForm.name"><Save :size="16" />{{ saving ? '保存中' : '保存' }}</button></div></form></AppDrawer>
  <AppDrawer v-if="countryCurrencyDrawer && managedCountry" :title="`${managedCountry.name} · 币种管理`" :description="`${managedCountry.code} / COUNTRY CURRENCIES`" @close="countryCurrencyDrawer = false"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>已关联币种</h4><small>查看并编辑该国家/地区可用于产品和支付能力的币种。</small></div><span class="code-pill">{{ managedRelations.length }} 项</span></div><div v-if="managing" class="empty"><LoaderCircle class="spin" :size="18" />加载中…</div><div v-else class="currency-relation-list"><article v-for="item in managedRelations" :key="item.currencyCode"><div><strong>{{ item.currencyName }}</strong><small>{{ item.currencyCode }}</small></div><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '已启用' : '已停用' }}</span><button v-if="hasPermission('master-data:status')" class="icon-btn" :title="item.status === 'ACTIVE' ? '停用关联' : '启用关联'" :disabled="saving" @click="toggleManagedRelation(item)"><ToggleLeft :size="16" /></button></article><p v-if="!managedRelations.length" class="master-empty">暂未关联币种</p></div></section></AppDrawer>
  <AppDrawer v-if="currencyDrawer && managedCountry" :title="`${managedCountry.name} · 新增币种`" description="CREATE AND ASSOCIATE" @close="currencyDrawer = false"><form class="master-data-form" @submit.prevent="createCurrencyAndAssociate"><section class="drawer-section"><div class="drawer-section-heading"><div><h4>币种信息</h4><small>保存后自动关联至 {{ managedCountry.name }}，无需额外配置。</small></div></div><div class="drawer-form-grid"><label class="form-field"><span>币种代码 <b>*</b></span><input v-model="currencyForm.code" maxlength="3" placeholder="USD" @input="currencyForm.code = currencyForm.code.toUpperCase()" /></label><label class="form-field"><span>币种名称 <b>*</b></span><input v-model="currencyForm.name" maxlength="128" placeholder="例如 美元" /></label><label class="form-field"><span>币种符号</span><input v-model="currencyForm.symbol" maxlength="16" placeholder="$" /></label><label class="form-field"><span>金额小数位 <b>*</b></span><input v-model.number="currencyForm.decimalPlaces" type="number" min="0" max="6" /></label></div></section><div class="product-drawer-actions"><button class="outline-btn" type="button" @click="currencyDrawer = false">取消</button><button class="primary-btn" type="submit" :disabled="saving || !currencyForm.code || !currencyForm.name"><Save :size="16" />{{ saving ? '创建中' : '创建并关联' }}</button></div></form></AppDrawer>
</template>
