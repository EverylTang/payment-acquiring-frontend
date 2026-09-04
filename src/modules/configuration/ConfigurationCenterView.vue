<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Pencil, Plus, RefreshCw, Save, ToggleLeft, Trash2 } from "lucide-vue-next";
import { ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElPagination, ElSelect } from "element-plus";
import { authState } from "../../auth";
import {
  changeChannelStatus,
  changePricingRuleStatus,
  changeRiskPolicyStatus,
  changeRoutingRuleStatus,
  createChannel,
  createPricingRule,
  createRiskPolicy,
  createRoutingRule,
  getChannelCredentialBindings,
  getChannels,
  getPricingRules,
  getReleases,
  getRiskPolicies,
  getRoutingRules,
  updateChannel,
  updatePricingRule,
  updateRoutingRule,
  type Channel,
  type ConfigRelease,
  type PricingRule,
  type RiskPolicy,
  type RoutingRule,
} from "./api";
import AppPagination from "../../components/AppPagination.vue";
import AppDrawer from "../../components/AppDrawer.vue";
import { getProducts, type Product } from "../product/api";
import { getMerchants, type Merchant } from "../merchant/api";
import { getActiveCurrencies, type Currency } from "../master-data/api";

const props = defineProps<{ section: "routing" | "pricing" | "risk" }>();
const emit = defineEmits<{ notice: [message: string] }>();

const loading = ref(false);
const saving = ref(false);
const channels = ref<Channel[]>([]);
const products = ref<Product[]>([]);
const merchants = ref<Merchant[]>([]);
const currencies = ref<Currency[]>([]);
const routes = ref<RoutingRule[]>([]);
const pricing = ref<PricingRule[]>([]);
const policies = ref<RiskPolicy[]>([]);
const releases = ref<ConfigRelease[]>([]);
const channelPage = ref({ current: 1, pageSize: 20, total: 0 });
const routePage = ref({ current: 1, pageSize: 20, total: 0 });
const pricingPage = ref({ current: 1, pageSize: 20, total: 0 });
const policyPage = ref({ current: 1, pageSize: 20, total: 0 });
const routingView = ref<"channels" | "routes">("channels");
const drawer = ref<"config" | "route" | null>(null);
const editingChannel = ref<Channel | null>(null);
const editingRoute = ref<RoutingRule | null>(null);
const editingPricing = ref<PricingRule | null>(null);
const channelForm = ref({ channelId: "", name: "", provider: "", requestUrl: "", signatureProfile: "DEFAULT", country: "US", currency: "USD", paymentMethod: "CARD", minAmount: 0.01, maxAmount: 100000 });
const channelConfigEntries = ref<Array<{ key: string; value: string }>>([]);
const channelCredentialEntries = ref<Array<{ credentialRole: string; secretRef: string; keyVersion: string }>>([]);
const signatureProfiles = [
  { value: "NONE", label: "不签名（仅限受信通道）" },
  { value: "MD5_KEY_SUFFIX_V1", label: "MD5 参数排序 + Key 后缀" },
  { value: "SHA256_KEY_SUFFIX_V1", label: "SHA-256 参数排序 + Key 后缀" },
  { value: "HMAC_SHA256_V1", label: "HMAC-SHA256" },
  { value: "HMAC_SHA512_V1", label: "HMAC-SHA512" },
  { value: "RSA_SHA256_V1", label: "RSA-SHA256" },
  { value: "SIMULATED_SHA256_PREFIX_V1", label: "模拟渠道 SHA-256 前缀" },
  { value: "DEFAULT", label: "兼容旧模拟渠道" },
];
const routeForm = ref({ ruleId: "", releaseId: "", productCode: "", merchantId: "", paymentMethod: "CARD", country: "US", currency: "USD", channelId: "", priority: 100, weight: 100 });
type PricingTierDraft = { minAmount: number; maxAmount: number; feeRate: number; fixedFee: number };
type PricingForm = { ruleId: string; releaseId: string; productCode: string; merchantId: string; channelId: string; currency: string; feeType: PricingRule["feeType"]; feeRate: number; fixedFee: number; extraFee: number; minFee?: number; maxFee?: number; tiers: PricingTierDraft[]; feeMode: PricingRule["feeMode"]; minAmount: number; maxAmount: number };
const newPricingForm = (): PricingForm => ({ ruleId: "", releaseId: "", productCode: "", merchantId: "", channelId: "", currency: "USD", feeType: "PERCENTAGE", feeRate: 0, fixedFee: 0, extraFee: 0, minFee: undefined, maxFee: undefined, tiers: [], feeMode: "PAYER_BEAR", minAmount: 0.01, maxAmount: 100000 });
const pricingForm = ref(newPricingForm());
const riskForm = ref({ policyId: "", releaseId: "", name: "", priority: 100, decision: "REVIEW", condition: "{}" });

const canOperate = computed(() => {
  const roles = authState.user?.roles || [];
  if (roles.includes("ADMIN")) return true;
  if (props.section === "routing") return roles.includes("OPS");
  if (props.section === "pricing") return roles.includes("OPS") || roles.includes("FINANCE");
  return roles.includes("RISK");
});
const canApprove = computed(() => authState.user?.roles.includes("ADMIN") ?? false);
const title = computed(() => ({ routing: "路由与渠道", pricing: "费率管理", risk: "风控工作台" })[props.section]);
const createLabel = computed(() => ({ routing: routingView.value === "channels" ? "新增渠道" : "新增路由规则", pricing: "新增费率规则", risk: "新增风控策略" })[props.section]);
const configDrawerTitle = computed(() => editingChannel.value ? "编辑渠道" : "新增渠道");
const routeDrawerTitle = computed(() => editingRoute.value ? "编辑路由规则" : "新增路由规则");
const pricingDrawerTitle = computed(() => editingPricing.value ? "编辑费率规则" : "新增费率规则");
const draftReleases = computed(() => releases.value.filter((item) => item.status === "DRAFT"));
const activeChannels = computed(() => channels.value.filter((item) => item.status === "ACTIVE").length);
const activeRoutes = computed(() => routes.value.filter((item) => item.status === "ACTIVE").length);
const merchantRoutes = computed(() => routes.value.filter((item) => item.merchantId).length);
const activePricingRules = computed(() => pricing.value.filter((item) => item.status === "ACTIVE").length);
const activeProducts = computed(() => products.value.filter((item) => item.status === "ACTIVE"));
const activeMerchants = computed(() => merchants.value.filter((item) => item.status === "ACTIVE"));
const activeChannelOptions = computed(() => channels.value.filter((item) => item.status === "ACTIVE"));
const hasSelectedProduct = computed(() => activeProducts.value.some((item) => item.productCode === pricingForm.value.productCode));
const hasSelectedMerchant = computed(() => activeMerchants.value.some((item) => item.merchantId === pricingForm.value.merchantId));
const hasSelectedChannel = computed(() => activeChannelOptions.value.some((item) => item.channelId === pricingForm.value.channelId));
const hasSelectedPricingCurrency = computed(() => currencies.value.some((item) => item.code === pricingForm.value.currency));
const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0)) + ` ${currency}`;
const formatRate = (rate: number) => `${(Number(rate || 0) * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
const pricingStructure = (rule: PricingRule) => {
  if (rule.feeType === "FIXED") return `固定 ${formatAmount(rule.fixedFee, rule.currency)}`;
  if (rule.feeType === "PERCENTAGE") return `比例 ${formatRate(rule.feeRate)}`;
  if (rule.feeType === "TIERED") return `阶梯 ${rule.tiers?.length || 0} 档`;
  return `${formatRate(rule.feeRate)} + ${formatAmount(rule.fixedFee, rule.currency)}`;
};
const pricingLimits = (rule: PricingRule) => [
  rule.extraFee ? `额外 ${formatAmount(rule.extraFee, rule.currency)}` : "无额外手续费",
  rule.minFee != null ? `最低 ${formatAmount(rule.minFee, rule.currency)}` : "无最低限制",
  rule.maxFee != null ? `最高 ${formatAmount(rule.maxFee, rule.currency)}` : "无最高限制",
].join(" · ");

const parseObject = (value: string, field: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${field}必须是 JSON 对象`);
  }
};
const channelConfiguration = () => {
  const configuration: Record<string, string> = {};
  for (const entry of channelConfigEntries.value) {
    const key = entry.key.trim();
    if (!key && !entry.value.trim()) continue;
    if (!key || !entry.value.trim()) throw new Error("请完整填写渠道接入参数");
    if (Object.hasOwn(configuration, key)) throw new Error(`渠道接入参数重复：${key}`);
    configuration[key] = entry.value.trim();
  }
  return configuration;
};
const channelCredentialBindings = () => {
  const roles = new Set<string>();
  return channelCredentialEntries.value.flatMap((entry) => {
    const credentialRole = entry.credentialRole.trim();
    const secretRef = entry.secretRef.trim();
    const keyVersion = entry.keyVersion.trim();
    if (!credentialRole && !secretRef && !keyVersion) return [];
    if (!credentialRole || !secretRef) throw new Error("请完整填写凭据角色和密钥引用");
    if (!/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(secretRef)) throw new Error("密钥引用必须是 KMS URI，例如 vault://payment/channel/api-secret");
    if (roles.has(credentialRole)) throw new Error(`渠道凭据角色重复：${credentialRole}`);
    roles.add(credentialRole);
    return [{ credentialRole, secretRef, keyVersion: keyVersion || undefined }];
  });
};
const load = async () => {
  loading.value = true;
  try {
    const requests: Promise<unknown>[] = [getReleases({ page: 1, pageSize: 100 })];
    if (props.section === "routing") requests.push(
      getChannels({ page: channelPage.value.current, pageSize: channelPage.value.pageSize }),
      getRoutingRules({ page: routePage.value.current, pageSize: routePage.value.pageSize }),
    );
    if (props.section === "pricing") requests.push(
      getPricingRules({ page: pricingPage.value.current, pageSize: pricingPage.value.pageSize }),
      getProducts({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }),
      getChannels({ page: 1, pageSize: 100 }),
      getActiveCurrencies(),
    );
    if (props.section === "risk") requests.push(getRiskPolicies({ page: policyPage.value.current, pageSize: policyPage.value.pageSize }));
    const values = await Promise.all(requests);
    releases.value = (values[0] as { items: ConfigRelease[] }).items;
    if (props.section === "routing") {
      const channelResult = values[1] as { items: Channel[]; page: number; pageSize: number; total: number };
      const routeResult = values[2] as { items: RoutingRule[]; page: number; pageSize: number; total: number };
      channels.value = channelResult.items;
      routes.value = routeResult.items;
      channelPage.value = { current: channelResult.page, pageSize: channelResult.pageSize, total: channelResult.total };
      routePage.value = { current: routeResult.page, pageSize: routeResult.pageSize, total: routeResult.total };
    }
    if (props.section === "pricing") {
      const pricingResult = values[1] as { items: PricingRule[]; page: number; pageSize: number; total: number };
      const productResult = values[2] as { items: Product[] };
      const merchantResult = values[3] as { items: Merchant[] };
      const channelResult = values[4] as { items: Channel[] };
      const currencyResult = values[5] as Currency[];
      pricing.value = pricingResult.items;
      pricingPage.value = { current: pricingResult.page, pageSize: pricingResult.pageSize, total: pricingResult.total };
      products.value = productResult.items;
      merchants.value = merchantResult.items;
      channels.value = channelResult.items;
      currencies.value = currencyResult;
    }
    if (props.section === "risk") {
      const policyResult = values[1] as { items: RiskPolicy[]; page: number; pageSize: number; total: number };
      policies.value = policyResult.items;
      policyPage.value = { current: policyResult.page, pageSize: policyResult.pageSize, total: policyResult.total };
    }
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "运营配置加载失败");
  } finally {
    loading.value = false;
  }
};
const changePage = (kind: "channel" | "route" | "pricing" | "policy", current: number) => {
  const pages = { channel: channelPage, route: routePage, pricing: pricingPage, policy: policyPage };
  pages[kind].value.current = current;
  return load();
};
const changePageSize = (kind: "channel" | "route", pageSize: number) => {
  const pages = { channel: channelPage, route: routePage };
  pages[kind].value.pageSize = pageSize;
  pages[kind].value.current = 1;
  return load();
};
const perform = async (action: () => Promise<unknown>, success?: string) => {
  saving.value = true;
  try {
    await action();
    if (success) emit("notice", success);
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "操作失败");
  } finally {
    saving.value = false;
  }
};
const createConfigItem = () => perform(async () => {
  if (props.section === "routing") {
    const configuration = channelConfiguration();
    const credentialBindings = channelCredentialBindings();
    if (editingChannel.value) {
      await updateChannel(editingChannel.value.channelId, {
        name: channelForm.value.name,
        provider: channelForm.value.provider,
        requestUrl: channelForm.value.requestUrl,
        signatureProfile: channelForm.value.signatureProfile,
        configuration,
        credentialBindings,
      });
      drawer.value = null;
      editingChannel.value = null;
      return;
    }
    await createChannel({ ...channelForm.value, configuration, credentialBindings });
    resetChannelForm();
    drawer.value = null;
    return;
  }
  if (props.section === "pricing") {
    if (editingPricing.value) {
      await updatePricingRule(editingPricing.value.ruleId, {
        productCode: pricingForm.value.productCode,
        merchantId: pricingForm.value.merchantId || null,
        channelId: pricingForm.value.channelId || null,
        currency: pricingForm.value.currency,
        feeRate: pricingForm.value.feeRate,
        fixedFee: pricingForm.value.fixedFee,
        extraFee: pricingForm.value.extraFee,
        minFee: pricingForm.value.minFee ?? null,
        maxFee: pricingForm.value.maxFee ?? null,
        feeType: pricingForm.value.feeType,
        tiers: pricingForm.value.feeType === "TIERED" ? pricingForm.value.tiers : [],
        feeMode: pricingForm.value.feeMode,
        minAmount: pricingForm.value.minAmount,
        maxAmount: pricingForm.value.maxAmount,
      });
      editingPricing.value = null;
      drawer.value = null;
      return;
    }
    if (!pricingForm.value.releaseId) throw new Error("请选择草稿版本");
    await createPricingRule({ ...pricingForm.value, merchantId: pricingForm.value.merchantId || null, channelId: pricingForm.value.channelId || null, tiers: pricingForm.value.feeType === "TIERED" ? pricingForm.value.tiers : [] });
    resetPricingForm();
    drawer.value = null;
    return;
  }
  if (!riskForm.value.releaseId) throw new Error("请选择草稿版本");
  await createRiskPolicy({ ...riskForm.value, condition: parseObject(riskForm.value.condition, "策略条件") });
  riskForm.value.policyId = "";
}, "配置已保存到草稿版本");
const createRoute = () => perform(async () => {
  if (editingRoute.value) {
    await updateRoutingRule(editingRoute.value.ruleId, {
      productCode: routeForm.value.productCode,
      merchantId: routeForm.value.merchantId || null,
      paymentMethod: routeForm.value.paymentMethod,
      country: routeForm.value.country || null,
      currency: routeForm.value.currency,
      channelId: routeForm.value.channelId,
      priority: routeForm.value.priority,
      weight: routeForm.value.weight,
    });
    drawer.value = null;
    editingRoute.value = null;
    return;
  }
  if (!routeForm.value.releaseId) throw new Error("请选择草稿版本");
  await createRoutingRule({ ...routeForm.value, merchantId: routeForm.value.merchantId || null, country: routeForm.value.country || null });
  resetRouteForm();
  drawer.value = null;
}, "路由规则已保存到草稿版本");
const resetChannelForm = () => {
  channelForm.value = { channelId: "", name: "", provider: "", requestUrl: "", signatureProfile: "DEFAULT", country: "US", currency: "USD", paymentMethod: "CARD", minAmount: 0.01, maxAmount: 100000 };
  channelConfigEntries.value = [];
  channelCredentialEntries.value = [];
};
const resetRouteForm = () => {
  routeForm.value = { ruleId: "", releaseId: "", productCode: "", merchantId: "", paymentMethod: "CARD", country: "US", currency: "USD", channelId: "", priority: 100, weight: 100 };
};
const resetPricingForm = () => {
  pricingForm.value = newPricingForm();
};
const changePricingFeeType = () => {
  if (pricingForm.value.feeType === "FIXED") pricingForm.value.feeRate = 0;
  if (pricingForm.value.feeType === "PERCENTAGE") pricingForm.value.fixedFee = 0;
  if (pricingForm.value.feeType === "TIERED") {
    pricingForm.value.feeRate = 0;
    pricingForm.value.fixedFee = 0;
    if (!pricingForm.value.tiers.length) pricingForm.value.tiers.push({ minAmount: pricingForm.value.minAmount, maxAmount: pricingForm.value.maxAmount, feeRate: 0, fixedFee: 0 });
  }
};
const openChannelCreate = () => {
  editingChannel.value = null;
  resetChannelForm();
  drawer.value = "config";
};
const editChannel = async (channel: Channel) => {
  editingChannel.value = channel;
  channelForm.value = { ...channelForm.value, channelId: channel.channelId, name: channel.name, provider: channel.provider, requestUrl: channel.requestUrl, signatureProfile: channel.signatureProfile };
  channelConfigEntries.value = Object.entries(channel.configuration || {}).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }));
  channelCredentialEntries.value = [];
  drawer.value = "config";
  try {
    channelCredentialEntries.value = (await getChannelCredentialBindings(channel.channelId)).map((binding) => ({
      credentialRole: binding.credentialRole,
      secretRef: binding.secretRef,
      keyVersion: binding.keyVersion || "",
    }));
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "渠道凭据引用加载失败");
  }
};
const openRouteCreate = () => {
  editingRoute.value = null;
  resetRouteForm();
  drawer.value = "route";
};
const openPricingCreate = () => {
  editingPricing.value = null;
  resetPricingForm();
  drawer.value = "config";
};
const editPricing = (rule: PricingRule) => {
  editingPricing.value = rule;
  pricingForm.value = {
    ruleId: rule.ruleId,
    releaseId: "",
    productCode: rule.productCode,
    merchantId: rule.merchantId || "",
    channelId: rule.channelId || "",
    currency: rule.currency,
    feeType: rule.feeType,
    feeRate: rule.feeRate,
    fixedFee: rule.fixedFee,
    extraFee: rule.extraFee || 0,
    minFee: rule.minFee ?? undefined,
    maxFee: rule.maxFee ?? undefined,
    tiers: rule.tiers || [],
    feeMode: rule.feeMode,
    minAmount: rule.minAmount,
    maxAmount: rule.maxAmount,
  };
  drawer.value = "config";
};
const editRoute = (route: RoutingRule) => {
  editingRoute.value = route;
  routeForm.value = { ruleId: route.ruleId, releaseId: "", productCode: route.productCode, merchantId: route.merchantId || "", paymentMethod: route.paymentMethod, country: route.country || "", currency: route.currency, channelId: route.channelId, priority: route.priority, weight: route.weight };
  drawer.value = "route";
};
const toggle = (kind: "channel" | "route" | "pricing" | "risk", id: string, status: string) =>
  perform(() => {
    const target = status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (kind === "channel") return changeChannelStatus(id, target);
    if (kind === "route") return changeRoutingRuleStatus(id, target);
    if (kind === "pricing") return changePricingRuleStatus(id, target);
    return changeRiskPolicyStatus(id, target);
  }, "状态已更新");
onMounted(load);
</script>

<template>
  <section class="workspace-panel configuration-center">
    <div class="panel-title">
      <div><span class="eyebrow">CONFIGURATION CENTER</span><h3>{{ title }}</h3></div>
      <div class="button-row">
        <button v-if="canOperate" class="primary-btn" @click="section === 'routing' ? (routingView === 'routes' ? openRouteCreate() : openChannelCreate()) : section === 'pricing' ? openPricingCreate() : (drawer = 'config')">{{ createLabel }}</button>
        <button class="icon-btn" title="刷新" :disabled="loading" @click="load"><RefreshCw :class="{ spin: loading }" :size="16" /></button>
      </div>
    </div>
    <section class="configuration-subpage">
      <div v-if="section === 'routing'" class="configuration-summary-grid">
        <article class="configuration-summary-card"><span>可用渠道</span><strong>{{ activeChannels }}</strong><small>当前页 {{ channels.length }} 个渠道</small></article>
        <article class="configuration-summary-card"><span>生效路由</span><strong>{{ activeRoutes }}</strong><small>当前页 {{ routes.length }} 条规则</small></article>
        <article class="configuration-summary-card"><span>商户专属</span><strong>{{ merchantRoutes }}</strong><small>优先覆盖默认路由</small></article>
        <article class="configuration-summary-card"><span>发布控制</span><strong>{{ draftReleases.length }}</strong><small>待发布草稿版本</small></article>
      </div>
      <div v-else-if="section === 'pricing'" class="configuration-summary-grid">
        <article class="configuration-summary-card"><span>生效费率</span><strong>{{ activePricingRules }}</strong><small>当前页 {{ pricing.length }} 条规则</small></article>
      </div>
      <div v-if="section === 'routing'" class="workspace-tabs workspace-tabs-compact" role="tablist">
        <button :class="{ active: routingView === 'channels' }" @click="routingView = 'channels'">渠道</button>
        <button :class="{ active: routingView === 'routes' }" @click="routingView = 'routes'">路由规则</button>
      </div>
      <template v-if="section === 'routing' && routingView === 'channels'">
        <div class="section-heading"><div><span class="eyebrow">CHANNEL DIRECTORY</span><h4>渠道列表</h4></div><span>{{ channelPage.total }} 个渠道</span></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!channels.length" class="empty">暂无渠道配置</div>
        <div v-else class="configuration-table-wrap">
          <table class="data-table configuration-table">
            <thead><tr><th>渠道</th><th>服务商 / 请求地址</th><th>签名与接入配置</th><th>状态</th><th class="actions">操作</th></tr></thead>
            <tbody>
              <tr v-for="item in channels" :key="item.channelId">
                <td><strong>{{ item.name }}</strong><small class="table-subtext mono">{{ item.channelId }}</small></td>
                <td>{{ item.provider || "--" }}<small class="table-subtext url-text" :title="item.requestUrl">{{ item.requestUrl || "--" }}</small></td>
                <td><strong class="mono">{{ item.signatureProfile }}</strong><small class="table-subtext"><span class="configuration-count">{{ Object.keys(item.configuration || {}).length }} 项参数 · {{ item.credentialBindings.length }} 个凭据引用</span> · 编辑时可回显凭据引用</small></td>
                <td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status }}</span></td>
                <td class="actions"><button v-if="canOperate" class="icon-btn" title="编辑渠道" @click="editChannel(item)"><Pencil :size="16" /></button><button v-if="canApprove" class="icon-btn" title="切换渠道状态" @click="toggle('channel', item.channelId, item.status)"><ToggleLeft :size="17" /></button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="management-pagination configuration-pagination"><ElPagination background layout="sizes, total, prev, pager, next" :current-page="channelPage.current" :page-size="channelPage.pageSize" :page-sizes="[20, 50, 100]" :total="channelPage.total" :hide-on-single-page="false" @current-change="(current) => changePage('channel', current)" @size-change="(size) => changePageSize('channel', size)" /></div>
      </template>
      <template v-else-if="section === 'routing'">
        <div class="section-heading"><div><span class="eyebrow">ROUTING POLICY</span><h4>路由规则</h4></div><span>{{ routePage.total }} 条规则</span></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!routes.length" class="empty">暂无路由规则</div>
        <div v-else class="configuration-table-wrap"><table class="data-table configuration-table"><thead><tr><th>适用条件</th><th>目标渠道</th><th>优先级 / 流量权重</th><th>作用范围</th><th>版本</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in routes" :key="item.ruleId"><td><strong>{{ item.productCode }}</strong><small class="table-subtext">{{ item.paymentMethod }} · {{ item.currency }}</small></td><td><strong class="mono">{{ item.channelId }}</strong></td><td><strong>{{ item.priority }} / {{ item.weight }}</strong><small class="table-subtext">同优先级内按比例分流</small></td><td>{{ item.merchantId || "默认商户池" }}<small class="table-subtext">{{ item.country || "全球" }}</small></td><td><span class="mono">v{{ item.releaseVersion }} · {{ item.ruleId }}</span></td><td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status }}</span></td><td class="actions"><button v-if="canOperate" class="icon-btn" title="编辑路由规则" @click="editRoute(item)"><Pencil :size="16" /></button><button v-if="canApprove" class="icon-btn" title="切换规则状态" @click="toggle('route', item.ruleId, item.status)"><ToggleLeft :size="17" /></button></td></tr></tbody></table></div>
        <div class="management-pagination configuration-pagination"><ElPagination background layout="sizes, total, prev, pager, next" :current-page="routePage.current" :page-size="routePage.pageSize" :page-sizes="[20, 50, 100]" :total="routePage.total" :hide-on-single-page="false" @current-change="(current) => changePage('route', current)" @size-change="(size) => changePageSize('route', size)" /></div>
      </template>
      <template v-else-if="section === 'pricing'">
        <template>
          <div class="section-heading"><div><span class="eyebrow">PRICING CONTROL</span><h4>费率规则</h4></div><span>{{ pricingPage.total }} 条规则</span></div>
          <div v-if="loading" class="empty">加载中…</div>
          <div v-else-if="!pricing.length" class="empty">暂无费率规则</div>
          <div v-else class="configuration-table-wrap"><table class="data-table configuration-table"><thead><tr><th>适用范围</th><th>费率结构</th><th>交易金额限制</th><th>版本</th><th>状态</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in pricing" :key="item.ruleId"><td><strong>{{ item.productCode }}</strong><small class="table-subtext">{{ item.merchantId || "全商户" }} · {{ item.channelId || "全部渠道" }} · {{ item.currency }}</small></td><td><strong>{{ pricingStructure(item) }}</strong><small class="table-subtext">{{ pricingLimits(item) }} · {{ item.feeMode }}</small></td><td>{{ formatAmount(item.minAmount, item.currency) }} - {{ formatAmount(item.maxAmount, item.currency) }}</td><td><span class="mono">v{{ item.releaseVersion }} · {{ item.ruleId }}</span></td><td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status }}</span></td><td class="actions"><button v-if="canOperate" class="icon-btn" title="编辑费率规则" @click="editPricing(item)"><Pencil :size="16" /></button><button v-if="canApprove" class="icon-btn" title="切换规则状态" @click="toggle('pricing', item.ruleId, item.status)"><ToggleLeft :size="17" /></button></td></tr></tbody></table></div>
          <AppPagination :page="pricingPage.current" :page-size="pricingPage.pageSize" :total="pricingPage.total" noun="条规则" @change="(current) => changePage('pricing', current)" />
        </template>
      </template>
      <template v-else>
        <div class="section-heading"><h4>风控策略</h4><span>{{ policyPage.total }} 条策略</span></div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!policies.length" class="empty">暂无风控策略</div>
        <div v-else class="record-list"><div v-for="item in policies" :key="item.policyId" class="record-row"><div><strong>{{ item.name }} · {{ item.decision }}</strong><small>{{ item.policyId }} · v{{ item.releaseVersion }} · 优先级 {{ item.priority }} · {{ JSON.stringify(item.condition) }}</small></div><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status }}</span><button v-if="canApprove" class="icon-btn" title="切换策略状态" @click="toggle('risk', item.policyId, item.status)"><ToggleLeft :size="17" /></button></div></div>
        <AppPagination :page="policyPage.current" :page-size="policyPage.pageSize" :total="policyPage.total" noun="条策略" @change="(current) => changePage('policy', current)" />
      </template>
    </section>

    <AppDrawer v-if="drawer" :title="drawer === 'route' ? routeDrawerTitle : drawer === 'config' && section === 'routing' ? configDrawerTitle : drawer === 'config' && section === 'pricing' ? pricingDrawerTitle : createLabel" description="CONFIGURATION" @close="drawer = null">
      <div v-if="drawer === 'config'" class="drawer-section">
        <ElForm v-if="section === 'routing'" :model="channelForm" label-position="top" class="configuration-element-form">
          <div class="drawer-section-heading"><div><h4>{{ editingChannel ? '渠道基础配置' : '渠道与接入能力' }}</h4><small>{{ editingChannel ? '渠道标识和接入范围创建后保持不变；此处更新服务商、请求地址、签名方案和运行参数。' : '创建后即可在路由规则中选择该渠道。' }}</small></div></div>
          <div class="drawer-form-grid">
            <ElFormItem label="渠道 ID" required><ElInput v-model="channelForm.channelId" :disabled="!!editingChannel" placeholder="例如 PP_CARD_US" /></ElFormItem>
            <ElFormItem label="渠道名称" required><ElInput v-model="channelForm.name" placeholder="例如 PingPong Card US" /></ElFormItem>
            <ElFormItem label="服务商" required><ElInput v-model="channelForm.provider" placeholder="例如 PingPong" /></ElFormItem>
            <ElFormItem label="请求 URL" required><ElInput v-model="channelForm.requestUrl" placeholder="https://api.example.com/payments" /></ElFormItem>
            <ElFormItem label="签名方案" required><ElSelect v-model="channelForm.signatureProfile" placeholder="选择签名方案"><ElOption v-for="profile in signatureProfiles" :key="profile.value" :label="profile.label" :value="profile.value" /></ElSelect></ElFormItem>
            <template v-if="!editingChannel">
              <ElFormItem label="国家 / 地区" required><ElInput v-model="channelForm.country" maxlength="8" placeholder="US" @input="channelForm.country = channelForm.country.toUpperCase()" /></ElFormItem>
              <ElFormItem label="结算币种" required><ElInput v-model="channelForm.currency" maxlength="3" placeholder="USD" @input="channelForm.currency = channelForm.currency.toUpperCase()" /></ElFormItem>
              <ElFormItem label="支付方式" required><ElInput v-model="channelForm.paymentMethod" placeholder="CARD" /></ElFormItem>
              <ElFormItem label="单笔最小金额" required><ElInputNumber v-model="channelForm.minAmount" :min="0.01" :precision="2" :step="1" controls-position="right" /></ElFormItem>
              <ElFormItem label="单笔最大金额" required><ElInputNumber v-model="channelForm.maxAmount" :min="0.01" :precision="2" :step="100" controls-position="right" /></ElFormItem>
            </template>
          </div>
          <section class="channel-parameter-section"><div class="drawer-section-heading"><div><h4>非敏感接入参数</h4><small>例如终端标识、产品代码或 appId。密钥、令牌和私钥不在此录入。</small></div><button class="icon-btn" type="button" title="新增接入参数" @click="channelConfigEntries.push({ key: '', value: '' })"><Plus :size="16" /></button></div><div v-if="!channelConfigEntries.length" class="compact-empty">暂无接入参数</div><div v-else class="channel-parameter-list"><div v-for="(entry, index) in channelConfigEntries" :key="index" class="channel-parameter-row"><ElInput v-model="entry.key" placeholder="参数名，例如 terminalId" /><ElInput v-model="entry.value" placeholder="参数值" /><button class="icon-btn danger" type="button" title="移除接入参数" @click="channelConfigEntries.splice(index, 1)"><Trash2 :size="16" /></button></div></div></section>
          <section class="channel-parameter-section"><div class="drawer-section-heading"><div><h4>安全凭据引用</h4><small>录入并回显 KMS URI，例如 env://PINGPONG_API_SECRET 或 vault://payment/channels/pingpong/api-secret；密钥原文不保存、不回显。保存以当前列表为准，删除全部行即清空绑定。</small></div><button class="icon-btn" type="button" title="新增凭据引用" @click="channelCredentialEntries.push({ credentialRole: '', secretRef: '', keyVersion: '' })"><Plus :size="16" /></button></div><div v-if="!channelCredentialEntries.length" class="compact-empty">{{ editingChannel ? '暂无安全凭据引用；保存将清空已有绑定' : '暂无安全凭据引用' }}</div><div v-else class="channel-parameter-list"><div v-for="(entry, index) in channelCredentialEntries" :key="index" class="channel-credential-row"><ElInput v-model="entry.credentialRole" placeholder="角色，例如 requestSigningKey" /><ElInput v-model="entry.secretRef" placeholder="KMS URI" /><ElInput v-model="entry.keyVersion" placeholder="版本（可选）" /><button class="icon-btn danger" type="button" title="移除凭据引用" @click="channelCredentialEntries.splice(index, 1)"><Trash2 :size="16" /></button></div></div></section>
          <button class="primary-btn drawer-submit" type="button" :disabled="saving || !channelForm.channelId || !channelForm.name || !channelForm.provider || !channelForm.requestUrl || !channelForm.signatureProfile" @click="createConfigItem"><Save :size="16" />{{ saving ? '保存中' : editingChannel ? '保存渠道' : '创建渠道' }}</button>
        </ElForm>
        <ElForm v-else-if="section === 'pricing'" :model="pricingForm" label-position="top" class="configuration-element-form">
          <div class="drawer-section-heading"><div><h4>{{ editingPricing ? '费率规则编辑' : '渠道费率定义' }}</h4><small>{{ editingPricing ? `正在编辑 ${editingPricing.ruleId}，仅草稿版本允许变更。` : '渠道范围可留空作为默认费率；指定渠道优先匹配 PayerMax、PingPong、Antom 等路由渠道。' }}</small></div></div>
          <div class="drawer-form-grid">
            <ElFormItem label="规则 ID" required><ElInput v-model="pricingForm.ruleId" :disabled="!!editingPricing" placeholder="例如 PRICE_PAYERMAX_USD_001" /></ElFormItem>
            <ElFormItem v-if="!editingPricing" label="草稿版本" required><ElSelect v-model="pricingForm.releaseId" placeholder="选择草稿版本"><ElOption v-for="item in draftReleases" :key="item.releaseId" :label="`v${item.versionNo} · ${item.releaseId}`" :value="item.releaseId" /></ElSelect></ElFormItem>
            <ElFormItem label="产品" required><ElSelect v-model="pricingForm.productCode" filterable placeholder="选择产品"><ElOption v-if="pricingForm.productCode && !hasSelectedProduct" :label="`${pricingForm.productCode} · 当前已关联`" :value="pricingForm.productCode" /><ElOption v-for="item in activeProducts" :key="item.productCode" :label="`${item.productCode} · ${item.name}`" :value="item.productCode" /></ElSelect></ElFormItem>
            <ElFormItem label="商户"><ElSelect v-model="pricingForm.merchantId" clearable filterable placeholder="全部商户"><ElOption v-if="pricingForm.merchantId && !hasSelectedMerchant" :label="`${pricingForm.merchantId} · 当前已关联`" :value="pricingForm.merchantId" /><ElOption v-for="item in activeMerchants" :key="item.merchantId" :label="`${item.merchantId} · ${item.name}`" :value="item.merchantId" /></ElSelect><small class="form-help">留空表示全部商户。</small></ElFormItem>
            <ElFormItem label="渠道"><ElSelect v-model="pricingForm.channelId" clearable filterable placeholder="全部渠道"><ElOption v-if="pricingForm.channelId && !hasSelectedChannel" :label="`${pricingForm.channelId} · 当前已关联`" :value="pricingForm.channelId" /><ElOption v-for="item in activeChannelOptions" :key="item.channelId" :label="`${item.channelId} · ${item.name} / ${item.provider}`" :value="item.channelId" /></ElSelect><small class="form-help">留空表示全部渠道。</small></ElFormItem>
            <ElFormItem label="交易币种" required><ElSelect v-model="pricingForm.currency" filterable placeholder="选择交易币种"><ElOption v-if="pricingForm.currency && !hasSelectedPricingCurrency" :label="`${pricingForm.currency} · 当前已关联`" :value="pricingForm.currency" /><ElOption v-for="item in currencies" :key="item.code" :label="`${item.code} · ${item.name}`" :value="item.code" /></ElSelect></ElFormItem>
            <ElFormItem label="手续费类型" required><ElSelect v-model="pricingForm.feeType" @change="changePricingFeeType"><ElOption label="固定手续费" value="FIXED" /><ElOption label="比例手续费" value="PERCENTAGE" /><ElOption label="阶梯手续费" value="TIERED" /><ElOption v-if="pricingForm.feeType === 'COMBINED'" label="历史组合手续费" value="COMBINED" /></ElSelect></ElFormItem>
            <ElFormItem v-if="pricingForm.feeType === 'PERCENTAGE' || pricingForm.feeType === 'COMBINED'" label="比例费率" required><ElInputNumber v-model="pricingForm.feeRate" :min="0" :max="1" :precision="6" :step="0.001" controls-position="right" /><small class="form-help">0.02 代表 2%。</small></ElFormItem>
            <ElFormItem v-if="pricingForm.feeType === 'FIXED' || pricingForm.feeType === 'COMBINED'" label="固定手续费" required><ElInputNumber v-model="pricingForm.fixedFee" :min="0" :precision="2" :step="0.1" controls-position="right" /></ElFormItem>
            <section v-if="pricingForm.feeType === 'TIERED'" class="fee-tier-section"><div class="drawer-section-heading"><div><h4>阶梯手续费</h4><small>每笔交易仅命中一个阶梯：起始和结束金额定义交易金额范围，随后按该档的比例手续费与固定手续费计算。</small></div><button class="icon-btn" type="button" title="新增阶梯" @click="pricingForm.tiers.push({ minAmount: 0, maxAmount: 0, feeRate: 0, fixedFee: 0 })"><Plus :size="16" /></button></div><div class="fee-tier-labels"><span>阶梯起始交易金额</span><span>阶梯结束交易金额</span><span>该档比例手续费</span><span>该档固定手续费</span></div><div class="fee-tier-list"><div v-for="(tier, index) in pricingForm.tiers" :key="index" class="fee-tier-row"><ElInputNumber v-model="tier.minAmount" :min="0" :precision="2" placeholder="起始金额" controls-position="right" /><ElInputNumber v-model="tier.maxAmount" :min="0" :precision="2" placeholder="结束金额" controls-position="right" /><ElInputNumber v-model="tier.feeRate" :min="0" :max="1" :precision="6" :step="0.001" placeholder="如 0.02" controls-position="right" /><ElInputNumber v-model="tier.fixedFee" :min="0" :precision="2" placeholder="固定金额" controls-position="right" /><button class="icon-btn danger" type="button" title="删除阶梯" @click="pricingForm.tiers.splice(index, 1)"><Trash2 :size="16" /></button></div></div></section>
            <ElFormItem label="额外手续费" required><ElInputNumber v-model="pricingForm.extraFee" :min="0" :precision="2" :step="0.1" controls-position="right" /><small class="form-help">在基础手续费后统一叠加。</small></ElFormItem>
            <ElFormItem label="最小手续费"><ElInputNumber v-model="pricingForm.minFee" :min="0" :precision="2" :step="0.1" clearable controls-position="right" /><small class="form-help">为空时不设下限。</small></ElFormItem>
            <ElFormItem label="最大手续费"><ElInputNumber v-model="pricingForm.maxFee" :min="0" :precision="2" :step="0.1" clearable controls-position="right" /><small class="form-help">为空时不设上限。</small></ElFormItem>
            <ElFormItem label="收取方式" required><ElSelect v-model="pricingForm.feeMode"><ElOption label="付款方承担（交易金额外加手续费）" value="PAYER_BEAR" /><ElOption label="商户承担（从交易金额中扣除手续费）" value="MERCHANT_BEAR" /><ElOption v-if="pricingForm.feeMode === 'EXCLUSIVE'" label="历史：手续费另计" value="EXCLUSIVE" /><ElOption v-if="pricingForm.feeMode === 'INCLUSIVE'" label="历史：手续费内含" value="INCLUSIVE" /></ElSelect></ElFormItem>
            <ElFormItem label="最小交易金额" required><ElInputNumber v-model="pricingForm.minAmount" :min="0.01" :precision="2" :step="1" controls-position="right" /><small class="form-help">低于此金额的交易不可使用本规则。</small></ElFormItem>
            <ElFormItem label="最大交易金额" required><ElInputNumber v-model="pricingForm.maxAmount" :min="0.01" :precision="2" :step="100" controls-position="right" /><small class="form-help">高于此金额的交易不可使用本规则。</small></ElFormItem>
          </div>
          <button class="primary-btn drawer-submit" type="button" :disabled="saving || !pricingForm.ruleId || !pricingForm.productCode || !pricingForm.currency || !pricingForm.releaseId && !editingPricing" @click="createConfigItem"><Save :size="16" />{{ saving ? '保存中' : editingPricing ? '保存费率规则' : '创建费率规则' }}</button>
        </ElForm>
        <template v-else><div class="form-grid drawer-form-grid"><input v-model="riskForm.policyId" placeholder="策略 ID" /><select v-model="riskForm.releaseId"><option value="">选择草稿版本</option><option v-for="item in draftReleases" :key="item.releaseId" :value="item.releaseId">v{{ item.versionNo }} · {{ item.releaseId }}</option></select><input v-model="riskForm.name" placeholder="策略名称" /><input v-model.number="riskForm.priority" type="number" min="1" placeholder="优先级" /><select v-model="riskForm.decision"><option>REVIEW</option><option>PASS</option><option>REJECT</option></select><input v-model="riskForm.condition" placeholder='条件 JSON，如 {"amountGt":1000}' /></div></template>
        <button v-if="section !== 'routing' && section !== 'pricing'" class="primary-btn drawer-submit" :disabled="saving" @click="createConfigItem">{{ createLabel }}</button>
      </div>
      <div v-else-if="drawer === 'route'" class="drawer-section"><ElForm :model="routeForm" label-position="top" class="configuration-element-form"><div class="drawer-section-heading"><div><h4>{{ editingRoute ? '路由策略编辑' : '路由策略定义' }}</h4><small>{{ editingRoute ? `正在编辑 ${editingRoute.ruleId}，保持发布版本 v${editingRoute.releaseVersion} 不变。` : '规则仅可关联至草稿版本，发布后按版本统一生效。' }}</small></div></div><div class="drawer-form-grid"><ElFormItem label="规则 ID" required><ElInput v-model="routeForm.ruleId" :disabled="!!editingRoute" placeholder="例如 ROUTE_CARD_US_001" /></ElFormItem><ElFormItem v-if="!editingRoute" label="草稿版本" required><ElSelect v-model="routeForm.releaseId" placeholder="选择草稿版本"><ElOption v-for="item in draftReleases" :key="item.releaseId" :label="`v${item.versionNo} · ${item.releaseId}`" :value="item.releaseId" /></ElSelect></ElFormItem><ElFormItem label="产品编码" required><ElInput v-model="routeForm.productCode" placeholder="产品编码" /></ElFormItem><ElFormItem label="商户 ID"><ElInput v-model="routeForm.merchantId" placeholder="留空表示默认商户池" /></ElFormItem><ElFormItem label="目标渠道 ID" required><ElInput v-model="routeForm.channelId" placeholder="从渠道列表复制 ID" /></ElFormItem><ElFormItem label="支付方式" required><ElInput v-model="routeForm.paymentMethod" placeholder="CARD" /></ElFormItem><ElFormItem label="国家 / 地区"><ElInput v-model="routeForm.country" maxlength="8" placeholder="US，留空表示全区域" @input="routeForm.country = routeForm.country.toUpperCase()" /></ElFormItem><ElFormItem label="交易币种" required><ElInput v-model="routeForm.currency" maxlength="3" placeholder="USD" @input="routeForm.currency = routeForm.currency.toUpperCase()" /></ElFormItem><ElFormItem label="优先级" required><ElInputNumber v-model="routeForm.priority" :min="1" :max="100000" controls-position="right" /><small class="form-help">数值越小越优先；仅在本层无可用渠道时才会切换下一优先级。</small></ElFormItem><ElFormItem label="流量权重" required><ElInputNumber v-model="routeForm.weight" :min="1" :max="100000" controls-position="right" /><small class="form-help">仅与相同商户作用域、相同优先级的规则比较，按权重比例分配流量。</small></ElFormItem></div><button class="primary-btn drawer-submit" type="button" :disabled="saving || !routeForm.ruleId || !routeForm.productCode || !routeForm.channelId || !routeForm.paymentMethod || !routeForm.currency || (!editingRoute && !routeForm.releaseId)" @click="createRoute"><Save :size="16" />{{ saving ? '保存中' : editingRoute ? '保存路由规则' : '创建路由规则' }}</button></ElForm></div>
    </AppDrawer>
  </section>
</template>
