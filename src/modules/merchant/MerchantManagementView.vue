<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { FileText, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, UsersRound } from "lucide-vue-next";
import AppDrawer from "../../components/AppDrawer.vue";
import { hasPermission } from "../../auth";
import {
  changeMerchantStatus,
  createMerchant,
  getMerchantProfile,
  getMerchants,
  updateMerchant,
  updateMerchantProfile,
  type Merchant,
  type MerchantProfile,
} from "./api";

type MerchantDetailSection = "profile" | "contacts" | "credentials";
const emit = defineEmits<{ detail: [merchant: Merchant, section: MerchantDetailSection]; notice: [message: string] }>();
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const saveError = ref("");
const drawerOpen = ref(false);
const editing = ref<Merchant | null>(null);
const query = ref("");
const statusFilter = ref("");
const merchants = ref<Merchant[]>([]);
const page = ref({ page: 1, pageSize: 20, total: 0 });

type MerchantForm = {
  merchantId: string;
  name: string;
  legalName: string;
  businessType: MerchantProfile["businessType"];
  registeredCountry: string;
  industry: string;
  businessUrl: string;
  productDescription: string;
  statementDescriptor: string;
  supportEmail: string;
  supportPhone: string;
  supportUrl: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  riskLevel: string;
  taxIdentifier: string;
};

const emptyForm = (): MerchantForm => ({
  merchantId: "", name: "", legalName: "", businessType: "COMPANY",
  registeredCountry: "", industry: "", businessUrl: "", productDescription: "", statementDescriptor: "",
  supportEmail: "", supportPhone: "", supportUrl: "", addressLine1: "", addressLine2: "",
  addressCity: "", addressState: "", addressPostalCode: "", riskLevel: "MEDIUM", taxIdentifier: "",
});
const form = ref<MerchantForm>(emptyForm());

const filteredMerchants = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return merchants.value.filter((merchant) => {
    const matchesKeyword = !keyword || merchant.name.toLowerCase().includes(keyword) || merchant.merchantId.toLowerCase().includes(keyword);
    return matchesKeyword && (!statusFilter.value || merchant.status === statusFilter.value);
  });
});

const load = async (targetPage = page.value.page) => {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await getMerchants({ page: targetPage, pageSize: page.value.pageSize });
    merchants.value = result.items;
    page.value = { page: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "商户加载失败";
    emit("notice", loadError.value);
  } finally { loading.value = false; }
};

const openCreate = () => { editing.value = null; saveError.value = ""; form.value = emptyForm(); drawerOpen.value = true; };
const openEdit = async (merchant: Merchant) => {
  editing.value = merchant;
  saveError.value = "";
  form.value = { ...emptyForm(), merchantId: merchant.merchantId, name: merchant.name, legalName: merchant.name };
  drawerOpen.value = true;
  saving.value = true;
  try {
    const profile = await getMerchantProfile(merchant.merchantId);
    form.value = { ...form.value, ...profile, industry: profile.industry || "", businessUrl: profile.businessUrl || "", productDescription: profile.productDescription || "", statementDescriptor: profile.statementDescriptor || "", supportEmail: profile.supportEmail || "", supportPhone: profile.supportPhone || "", supportUrl: profile.supportUrl || "", addressLine1: profile.addressLine1 || "", addressLine2: profile.addressLine2 || "", addressCity: profile.addressCity || "", addressState: profile.addressState || "", addressPostalCode: profile.addressPostalCode || "", taxIdentifier: profile.taxIdentifier || "" };
  } catch (error) { emit("notice", error instanceof Error ? error.message : "商户资料加载失败"); }
  finally { saving.value = false; }
};

const profilePayload = () => ({
  legalName: form.value.legalName || form.value.name, businessType: form.value.businessType,
  registeredCountry: form.value.registeredCountry, industry: form.value.industry, businessUrl: form.value.businessUrl,
  productDescription: form.value.productDescription, statementDescriptor: form.value.statementDescriptor,
  supportEmail: form.value.supportEmail, supportPhone: form.value.supportPhone, supportUrl: form.value.supportUrl,
  addressLine1: form.value.addressLine1, addressLine2: form.value.addressLine2, addressCity: form.value.addressCity,
  addressState: form.value.addressState, addressPostalCode: form.value.addressPostalCode, riskLevel: form.value.riskLevel,
  taxIdentifier: form.value.taxIdentifier,
});
const save = async () => {
  if (!form.value.name.trim() || !form.value.legalName.trim() || !form.value.registeredCountry.trim()) {
    saveError.value = "请填写商户名称、法定名称和注册国家 / 地区";
    emit("notice", saveError.value);
    return;
  }
  saving.value = true;
  saveError.value = "";
  try {
    const merchant = editing.value
      ? await updateMerchant(editing.value.merchantId, { name: form.value.name })
      : await createMerchant({ name: form.value.name });
    await updateMerchantProfile(merchant.merchantId, profilePayload());
    drawerOpen.value = false;
    emit("notice", editing.value ? "商户及账户资料已保存" : "商户已创建并完成资料登记");
    await load(editing.value ? page.value.page : 1);
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : "商户保存失败";
    emit("notice", saveError.value);
  }
  finally { saving.value = false; }
};
const toggleStatus = async (merchant: Merchant) => {
  try {
    const updated = await changeMerchantStatus(merchant.merchantId, merchant.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    Object.assign(merchant, updated); emit("notice", "商户状态已更新");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "商户状态更新失败"); }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel merchant-management">
    <div class="panel-title"><div><span class="eyebrow">MERCHANTS</span><h3>商户管理</h3><small>维护商户账户、客户展示信息和接入状态</small></div><div class="button-row"><button class="icon-btn" title="刷新商户列表" @click="load()"><RefreshCw :size="16" /></button><button v-if="hasPermission('merchant:create')" class="primary-btn" @click="openCreate"><Plus :size="16" />新增商户</button></div></div>
    <div class="merchant-filter-bar"><label class="merchant-search"><Search :size="16" /><input v-model="query" placeholder="按商户名称或 ID 搜索" /></label><select v-model="statusFilter" aria-label="商户状态"><option value="">全部状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已停用</option></select><span class="merchant-count">本页 {{ filteredMerchants.length }} / {{ page.total }} 个商户</span></div>
    <p v-if="loadError" class="merchant-error" role="alert">加载失败：{{ loadError }}</p>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="20" />加载中…</div>
    <div v-else class="table-wrap merchant-table-wrap"><table class="data-table merchant-table"><thead><tr><th>商户</th><th>商户 ID</th><th>状态</th><th>最后更新</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="merchant in filteredMerchants" :key="merchant.merchantId"><td><strong>{{ merchant.name }}</strong><small>账户主体与业务资料</small></td><td class="mono">{{ merchant.merchantId }}</td><td><span class="status-badge" :class="'st-' + merchant.status.toLowerCase()">{{ merchant.status === "ACTIVE" ? "已启用" : "已停用" }}</span></td><td><small>{{ merchant.updatedAt?.replace("T", " ").slice(0, 16) || "--" }}</small></td><td class="actions"><div class="merchant-actions merchant-module-actions"><button v-if="hasPermission('merchant:profile')" class="text-btn" title="商户资料" @click="emit('detail', merchant, 'profile')"><FileText :size="15" />资料</button><button v-if="hasPermission('merchant:contact:list')" class="text-btn" title="商户联系人" @click="emit('detail', merchant, 'contacts')"><UsersRound :size="15" />联系人</button><button v-if="hasPermission('merchant:credential:list')" class="text-btn" title="API 凭证" @click="emit('detail', merchant, 'credentials')"><KeyRound :size="15" />凭证</button><button v-if="hasPermission('merchant:update')" class="text-btn" title="编辑基础账户" @click="openEdit(merchant)"><Pencil :size="15" />编辑</button><button v-if="hasPermission('merchant:status')" class="text-btn danger-text" @click="toggleStatus(merchant)">{{ merchant.status === "ACTIVE" ? "停用" : "启用" }}</button></div></td></tr><tr v-if="!filteredMerchants.length"><td colspan="5" class="merchant-empty">暂无符合条件的商户</td></tr></tbody></table></div>
    <div v-if="page.total > page.pageSize" class="pagination"><button class="outline-btn" :disabled="page.page <= 1" @click="load(page.page - 1)">上一页</button><span>第 {{ page.page }} / {{ Math.ceil(page.total / page.pageSize) }} 页</span><button class="outline-btn" :disabled="page.page >= Math.ceil(page.total / page.pageSize)" @click="load(page.page + 1)">下一页</button></div>
  </section>
  <AppDrawer v-if="drawerOpen" :title="editing ? '编辑商户' : '新增商户'" :description="editing ? editing.merchantId : 'MERCHANT ACCOUNT'" @close="drawerOpen = false"><form class="merchant-drawer-form" @submit.prevent="save"><section class="drawer-section"><div class="drawer-section-heading"><h4>账户基础信息</h4><small>商户 ID 将在保存后由数据库自增主键自动生成；结算币种由已绑定产品的产品能力决定</small></div><div class="drawer-form-grid"><label class="form-field"><span>商户名称 <b>*</b></span><input v-model="form.name" placeholder="例如 Acme Trading" /></label></div></section><section class="drawer-section"><div class="drawer-section-heading"><h4>业务与法定资料</h4><small>支持合规审核和客户账单展示</small></div><div class="drawer-form-grid"><label class="form-field"><span>法定名称 <b>*</b></span><input v-model="form.legalName" placeholder="企业注册名称" /></label><label class="form-field"><span>主体类型</span><select v-model="form.businessType"><option value="COMPANY">公司</option><option value="INDIVIDUAL">个体经营者</option><option value="NON_PROFIT">非营利组织</option><option value="GOVERNMENT">政府机构</option></select></label><label class="form-field"><span>注册国家 / 地区 <b>*</b></span><input v-model="form.registeredCountry" maxlength="8" placeholder="例如 CN" /></label><label class="form-field"><span>行业 / MCC</span><input v-model="form.industry" placeholder="例如 Software" /></label><label class="form-field form-field-full"><span>业务网站</span><input v-model="form.businessUrl" type="url" placeholder="https://example.com" /></label><label class="form-field form-field-full"><span>商品或服务描述</span><input v-model="form.productDescription" placeholder="说明客户购买的商品或服务" /></label><label class="form-field"><span>账单描述符</span><input v-model="form.statementDescriptor" maxlength="22" placeholder="最长 22 字符" /></label><label class="form-field"><span>税务识别号</span><input v-model="form.taxIdentifier" placeholder="可选" /></label><label class="form-field"><span>风险等级</span><select v-model="form.riskLevel"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label></div></section><section class="drawer-section"><div class="drawer-section-heading"><h4>客户支持与注册地址</h4><small>对外支持信息与商户登记地址</small></div><div class="drawer-form-grid"><label class="form-field"><span>支持邮箱</span><input v-model="form.supportEmail" type="email" placeholder="support@example.com" /></label><label class="form-field"><span>支持电话</span><input v-model="form.supportPhone" type="tel" placeholder="+86" /></label><label class="form-field form-field-full"><span>支持网站</span><input v-model="form.supportUrl" type="url" placeholder="https://example.com/support" /></label><label class="form-field form-field-full"><span>注册地址</span><input v-model="form.addressLine1" placeholder="街道与门牌号" /></label><label class="form-field form-field-full"><span>地址补充</span><input v-model="form.addressLine2" placeholder="楼层、房间号（可选）" /></label><label class="form-field"><span>城市</span><input v-model="form.addressCity" /></label><label class="form-field"><span>省 / 州</span><input v-model="form.addressState" /></label><label class="form-field"><span>邮编</span><input v-model="form.addressPostalCode" /></label></div></section><p v-if="saveError" class="merchant-error" role="alert">保存失败：{{ saveError }}</p><button class="primary-btn drawer-submit" type="submit" :disabled="saving"><LoaderCircle v-if="saving" class="spin" :size="16" />{{ editing ? "保存商户资料" : "创建商户" }}</button></form></AppDrawer>
</template>

<style scoped>
.merchant-management { min-height: 620px; }.merchant-filter-bar { display:flex; align-items:center; gap:12px; margin-bottom:18px; padding:12px; border:1px solid var(--line); border-radius:6px; background:var(--surface); }.merchant-search { display:flex; flex:1 1 320px; align-items:center; gap:8px; min-width:0; padding:0 10px; border:1px solid var(--line-dark); border-radius:5px; background:#fff; color:var(--muted); }.merchant-search:focus-within { border-color:var(--accent); box-shadow:0 0 0 3px rgba(8,145,178,.12); }.merchant-search input { height:36px; border:0; box-shadow:none; padding:0; background:transparent; }.merchant-filter-bar > select { width:132px; height:36px; }.merchant-count { color:var(--muted); font-size:12px; white-space:nowrap; }.merchant-error { margin:0 0 14px; padding:10px 12px; border:1px solid rgba(220,38,38,.28); border-radius:5px; color:#b91c1c; background:rgba(220,38,38,.06); font-size:12px; }.merchant-table-wrap { min-height:370px; }.merchant-table td small { display:block; margin-top:4px; color:var(--muted); font-size:11px; }.currency-tag { display:inline-flex; min-width:42px; justify-content:center; padding:3px 7px; border:1px solid var(--line); border-radius:4px; color:var(--ink-soft); background:var(--surface); font:500 11px 'DM Mono',monospace; }.merchant-actions { display:inline-flex; justify-content:flex-end; gap:12px; }.merchant-module-actions { flex-wrap:wrap; max-width:310px; row-gap:7px; }.text-btn { display:inline-flex; align-items:center; gap:4px; padding:3px 0; color:var(--accent-dark); background:transparent; font-size:12px; }.text-btn:hover { color:var(--accent); }.danger-text { color:var(--danger); }.merchant-empty { height:240px; color:var(--muted); text-align:center; }.merchant-drawer-form { display:grid; gap:22px; padding-bottom:18px; }.drawer-section { padding:0; border:0; }.drawer-section + .drawer-section { padding-top:20px; border-top:1px solid var(--line); }.drawer-section-heading { display:flex; justify-content:space-between; gap:16px; margin-bottom:14px; }.drawer-section-heading h4 { margin:0; color:var(--ink); font-size:14px; }.drawer-section-heading small { color:var(--muted); font-size:11px; text-align:right; }.form-field b { color:var(--danger); }@media (max-width:700px) { .merchant-filter-bar { align-items:stretch; flex-direction:column; }.merchant-filter-bar > select { width:100%; }.merchant-count { white-space:normal; }.merchant-actions { gap:9px; }.merchant-module-actions { max-width:none; } }
</style>
