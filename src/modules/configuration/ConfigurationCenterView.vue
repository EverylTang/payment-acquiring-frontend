<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Check, FileDiff, Plus, RefreshCw, RotateCcw, Send, ToggleLeft } from "lucide-vue-next";
import { authState } from "../../auth";
import {
  changeChannelStatus,
  changePricingRuleStatus,
  changeRiskPolicyStatus,
  changeRoutingRuleStatus,
  createChannel,
  createPricingRule,
  createRelease,
  createRiskPolicy,
  createRoutingRule,
  getChannels,
  getPricingRules,
  getReleaseDiff,
  getReleases,
  getRiskPolicies,
  getRoutingRules,
  transitionRelease,
  type Channel,
  type ConfigRelease,
  type PricingRule,
  type RiskPolicy,
  type RoutingRule,
} from "./api";

const props = defineProps<{ section: "routing" | "pricing" | "risk" }>();
const emit = defineEmits<{ notice: [message: string] }>();

const loading = ref(false);
const saving = ref(false);
const channels = ref<Channel[]>([]);
const routes = ref<RoutingRule[]>([]);
const pricing = ref<PricingRule[]>([]);
const policies = ref<RiskPolicy[]>([]);
const releases = ref<ConfigRelease[]>([]);
const selectedDiff = ref<Record<string, unknown> | null>(null);
const releaseConfig = ref("{}");
const releaseReason = ref("");
const channelForm = ref({ channelId: "", name: "", provider: "", weight: 100, country: "US", currency: "USD", paymentMethod: "CARD", minAmount: 0.01, maxAmount: 100000, configuration: "{}" });
const routeForm = ref({ ruleId: "", releaseId: "", productCode: "", merchantId: "", paymentMethod: "CARD", country: "US", currency: "USD", channelId: "", priority: 100, weight: 100 });
const pricingForm = ref({ ruleId: "", releaseId: "", productCode: "", merchantId: "", currency: "USD", feeRate: 0, fixedFee: 0, feeMode: "EXCLUSIVE", minAmount: 0.01, maxAmount: 100000 });
const riskForm = ref({ policyId: "", releaseId: "", name: "", priority: 100, decision: "REVIEW", condition: "{}" });

const canOperate = computed(() => {
  const roles = authState.user?.roles || [];
  if (roles.includes("ADMIN")) return true;
  if (props.section === "routing") return roles.includes("OPS");
  if (props.section === "pricing") return roles.includes("OPS") || roles.includes("FINANCE");
  return roles.includes("RISK");
});
const canCreateRelease = computed(() =>
  authState.user?.roles.some((role) => ["ADMIN", "OPS"].includes(role)) ?? false,
);
const canApprove = computed(() => authState.user?.roles.includes("ADMIN") ?? false);
const title = computed(() => ({ routing: "路由与渠道", pricing: "费率与结算", risk: "风控工作台" })[props.section]);
const draftReleases = computed(() => releases.value.filter((item) => item.status === "DRAFT"));

const parseObject = (value: string, field: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${field}必须是 JSON 对象`);
  }
};
const load = async () => {
  loading.value = true;
  try {
    const requests: Promise<unknown>[] = [getReleases()];
    if (props.section === "routing") requests.push(getChannels(), getRoutingRules());
    if (props.section === "pricing") requests.push(getPricingRules());
    if (props.section === "risk") requests.push(getRiskPolicies());
    const values = await Promise.all(requests);
    releases.value = (values[0] as { items: ConfigRelease[] }).items;
    if (props.section === "routing") {
      channels.value = (values[1] as { items: Channel[] }).items;
      routes.value = (values[2] as { items: RoutingRule[] }).items;
    }
    if (props.section === "pricing") pricing.value = (values[1] as { items: PricingRule[] }).items;
    if (props.section === "risk") policies.value = (values[1] as { items: RiskPolicy[] }).items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "运营配置加载失败");
  } finally {
    loading.value = false;
  }
};
const perform = async (action: () => Promise<unknown>, success: string) => {
  saving.value = true;
  try {
    await action();
    emit("notice", success);
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "操作失败");
  } finally {
    saving.value = false;
  }
};
const createConfigRelease = () => perform(async () => {
  if (!releaseReason.value.trim()) throw new Error("请填写创建原因");
  await createRelease(parseObject(releaseConfig.value, "发布配置"), releaseReason.value.trim());
  releaseReason.value = "";
}, "草稿版本已创建，可继续添加规则");
const createConfigItem = () => perform(async () => {
  if (props.section === "routing") {
    await createChannel({ ...channelForm.value, configuration: parseObject(channelForm.value.configuration, "渠道配置") });
    channelForm.value.channelId = "";
    channelForm.value.name = "";
    return;
  }
  if (props.section === "pricing") {
    if (!pricingForm.value.releaseId) throw new Error("请选择草稿版本");
    await createPricingRule({ ...pricingForm.value, merchantId: pricingForm.value.merchantId || null });
    pricingForm.value.ruleId = "";
    return;
  }
  if (!riskForm.value.releaseId) throw new Error("请选择草稿版本");
  await createRiskPolicy({ ...riskForm.value, condition: parseObject(riskForm.value.condition, "策略条件") });
  riskForm.value.policyId = "";
}, "配置已保存到草稿版本");
const createRoute = () => perform(async () => {
  if (!routeForm.value.releaseId) throw new Error("请选择草稿版本");
  await createRoutingRule({ ...routeForm.value, merchantId: routeForm.value.merchantId || null, country: routeForm.value.country || null });
  routeForm.value.ruleId = "";
}, "路由规则已保存到草稿版本");
const toggle = (kind: "channel" | "route" | "pricing" | "risk", id: string, status: string) =>
  perform(() => {
    const target = status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (kind === "channel") return changeChannelStatus(id, target);
    if (kind === "route") return changeRoutingRuleStatus(id, target);
    if (kind === "pricing") return changePricingRuleStatus(id, target);
    return changeRiskPolicyStatus(id, target);
  }, "状态已更新");
const releaseAction = (release: ConfigRelease, action: "submit" | "approve" | "publish" | "rollback") => {
  const label = { submit: "提交审核", approve: "审核通过", publish: "正式发布", rollback: "回滚生成草稿" }[action];
  const reason = window.prompt(`请输入${label}原因`, "运营后台操作")?.trim();
  if (!reason) return;
  return perform(() => transitionRelease(release.releaseId, action, reason), `${label}完成`);
};
const showDiff = async (release: ConfigRelease) => {
  try {
    selectedDiff.value = await getReleaseDiff(release.releaseId);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "差异加载失败");
  }
};
onMounted(load);
</script>

<template>
  <section class="workspace-panel configuration-center">
    <div class="panel-title">
      <div><span class="eyebrow">CONFIGURATION CENTER</span><h3>{{ title }}</h3></div>
      <button class="outline-btn" :disabled="loading" @click="load"><RefreshCw :class="{ spin: loading }" :size="16" />刷新</button>
    </div>
    <p class="configuration-summary">配置先进入草稿版本，再提交审核和发布；页面仅展示已由后端授权的操作。</p>

    <div v-if="canOperate" class="configuration-form">
      <template v-if="section === 'routing'">
        <h4>新增渠道</h4>
        <div class="form-grid config-form-grid">
          <input v-model="channelForm.channelId" placeholder="渠道 ID" /><input v-model="channelForm.name" placeholder="渠道名称" /><input v-model="channelForm.provider" placeholder="服务商" /><input v-model.number="channelForm.weight" type="number" min="1" placeholder="渠道权重" />
          <input v-model="channelForm.country" placeholder="国家" /><input v-model="channelForm.currency" maxlength="3" placeholder="币种" /><input v-model="channelForm.paymentMethod" placeholder="支付方式" /><input v-model.number="channelForm.minAmount" type="number" min="0.01" step="0.01" placeholder="最小金额" /><input v-model.number="channelForm.maxAmount" type="number" min="0.01" step="0.01" placeholder="最大金额" /><input v-model="channelForm.configuration" placeholder='渠道配置 JSON，如 {"terminal":"..."}' />
        </div>
        <button class="primary-btn" :disabled="saving" @click="createConfigItem"><Plus :size="16" />新增渠道</button>
      </template>
      <template v-else-if="section === 'pricing'">
        <h4>新增费率规则</h4>
        <div class="form-grid config-form-grid">
          <input v-model="pricingForm.ruleId" placeholder="规则 ID" /><select v-model="pricingForm.releaseId"><option value="">选择草稿版本</option><option v-for="item in draftReleases" :key="item.releaseId" :value="item.releaseId">v{{ item.versionNo }} · {{ item.releaseId }}</option></select><input v-model="pricingForm.productCode" placeholder="产品编码" /><input v-model="pricingForm.merchantId" placeholder="商户 ID（可选）" />
          <input v-model="pricingForm.currency" maxlength="3" placeholder="币种" /><input v-model.number="pricingForm.feeRate" type="number" min="0" step="0.000001" placeholder="费率" /><input v-model.number="pricingForm.fixedFee" type="number" min="0" step="0.01" placeholder="固定费用" /><select v-model="pricingForm.feeMode"><option>EXCLUSIVE</option><option>INCLUSIVE</option></select><input v-model.number="pricingForm.minAmount" type="number" min="0.01" step="0.01" placeholder="最小金额" /><input v-model.number="pricingForm.maxAmount" type="number" min="0.01" step="0.01" placeholder="最大金额" />
        </div>
        <button class="primary-btn" :disabled="saving" @click="createConfigItem"><Plus :size="16" />新增费率规则</button>
      </template>
      <template v-else>
        <h4>新增风控策略</h4>
        <div class="form-grid config-form-grid">
          <input v-model="riskForm.policyId" placeholder="策略 ID" /><select v-model="riskForm.releaseId"><option value="">选择草稿版本</option><option v-for="item in draftReleases" :key="item.releaseId" :value="item.releaseId">v{{ item.versionNo }} · {{ item.releaseId }}</option></select><input v-model="riskForm.name" placeholder="策略名称" /><input v-model.number="riskForm.priority" type="number" min="1" placeholder="优先级" />
          <select v-model="riskForm.decision"><option>REVIEW</option><option>PASS</option><option>REJECT</option></select><input v-model="riskForm.condition" placeholder='条件 JSON，如 {"amountGt":1000}' />
        </div>
        <button class="primary-btn" :disabled="saving" @click="createConfigItem"><Plus :size="16" />新增风控策略</button>
      </template>
    </div>

    <div v-if="section === 'routing'" class="configuration-section">
      <div class="section-heading"><h4>渠道列表</h4><span>{{ channels.length }} 个渠道</span></div>
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="!channels.length" class="empty">暂无渠道配置</div>
      <div v-else class="record-list"><div v-for="item in channels" :key="item.channelId" class="record-row"><div><strong>{{ item.name }}</strong><small>{{ item.channelId }} · {{ item.provider }} · 权重 {{ item.weight }}</small></div><span class="status-badge">{{ item.status }}</span><button v-if="canApprove" class="icon-btn" title="切换渠道状态" @click="toggle('channel', item.channelId, item.status)"><ToggleLeft :size="17" /></button></div></div>
      <div v-if="canOperate" class="configuration-form compact-form"><h4>新增路由规则</h4><div class="form-grid config-form-grid"><input v-model="routeForm.ruleId" placeholder="规则 ID" /><select v-model="routeForm.releaseId"><option value="">选择草稿版本</option><option v-for="item in draftReleases" :key="item.releaseId" :value="item.releaseId">v{{ item.versionNo }}</option></select><input v-model="routeForm.productCode" placeholder="产品编码" /><input v-model="routeForm.merchantId" placeholder="商户 ID（可选）" /><input v-model="routeForm.channelId" placeholder="渠道 ID" /><input v-model="routeForm.paymentMethod" placeholder="支付方式" /><input v-model="routeForm.country" placeholder="国家" /><input v-model="routeForm.currency" maxlength="3" placeholder="币种" /><input v-model.number="routeForm.priority" type="number" min="1" placeholder="优先级" /><input v-model.number="routeForm.weight" type="number" min="1" placeholder="规则权重" /></div><button class="primary-btn" :disabled="saving" @click="createRoute"><Plus :size="16" />新增路由规则</button></div>
      <div class="section-heading"><h4>路由规则</h4><span>{{ routes.length }} 条规则</span></div>
      <div v-if="!loading && !routes.length" class="empty">暂无路由规则</div>
      <div v-else class="record-list"><div v-for="item in routes" :key="item.ruleId" class="record-row"><div><strong>{{ item.productCode }} → {{ item.channelId }}</strong><small>{{ item.ruleId }} · v{{ item.releaseVersion }} · {{ item.paymentMethod }} / {{ item.currency }} · 优先级 {{ item.priority }}</small></div><span class="status-badge">{{ item.status }}</span><button v-if="canApprove" class="icon-btn" title="切换规则状态" @click="toggle('route', item.ruleId, item.status)"><ToggleLeft :size="17" /></button></div></div>
    </div>

    <div v-if="section === 'pricing'" class="configuration-section"><div class="section-heading"><h4>费率规则</h4><span>{{ pricing.length }} 条规则</span></div><div v-if="loading" class="empty">加载中…</div><div v-else-if="!pricing.length" class="empty">暂无费率规则</div><div v-else class="record-list"><div v-for="item in pricing" :key="item.ruleId" class="record-row"><div><strong>{{ item.productCode }} · {{ item.feeRate }} + {{ item.fixedFee }} {{ item.currency }}</strong><small>{{ item.ruleId }} · v{{ item.releaseVersion }} · {{ item.feeMode }} · {{ item.merchantId || "全商户" }}</small></div><span class="status-badge">{{ item.status }}</span><button v-if="canApprove" class="icon-btn" title="切换规则状态" @click="toggle('pricing', item.ruleId, item.status)"><ToggleLeft :size="17" /></button></div></div></div>
    <div v-if="section === 'risk'" class="configuration-section"><div class="section-heading"><h4>风控策略</h4><span>{{ policies.length }} 条策略</span></div><div v-if="loading" class="empty">加载中…</div><div v-else-if="!policies.length" class="empty">暂无风控策略</div><div v-else class="record-list"><div v-for="item in policies" :key="item.policyId" class="record-row"><div><strong>{{ item.name }} · {{ item.decision }}</strong><small>{{ item.policyId }} · v{{ item.releaseVersion }} · 优先级 {{ item.priority }} · {{ JSON.stringify(item.condition) }}</small></div><span class="status-badge">{{ item.status }}</span><button v-if="canApprove" class="icon-btn" title="切换策略状态" @click="toggle('risk', item.policyId, item.status)"><ToggleLeft :size="17" /></button></div></div></div>

    <div class="configuration-section release-section">
      <div class="section-heading"><div><span class="eyebrow">RELEASE CONTROL</span><h4>配置版本与发布</h4></div><span>{{ releases.length }} 个版本</span></div>
      <div v-if="canCreateRelease" class="release-create"><input v-model="releaseReason" placeholder="创建草稿原因" /><input v-model="releaseConfig" placeholder='发布配置 JSON，如 {"description":"..."}' /><button class="primary-btn" :disabled="saving" @click="createConfigRelease"><Plus :size="16" />创建草稿</button></div>
      <div v-if="!loading && !releases.length" class="empty">暂无发布版本</div>
      <div v-else class="record-list"><div v-for="item in releases" :key="item.releaseId" class="release-row"><div><strong>版本 v{{ item.versionNo }}</strong><small>{{ item.releaseId }} · 创建人 {{ item.createdBy }} · {{ item.createdAt }}</small></div><span class="status-badge">{{ item.status }}</span><div class="button-row"><button class="icon-btn" title="查看版本差异" @click="showDiff(item)"><FileDiff :size="16" /></button><button v-if="canCreateRelease && item.status === 'DRAFT'" class="icon-btn" title="提交审核" @click="releaseAction(item, 'submit')"><Send :size="16" /></button><button v-if="canApprove && item.status === 'IN_REVIEW'" class="icon-btn" title="审核通过" @click="releaseAction(item, 'approve')"><Check :size="16" /></button><button v-if="canApprove && item.status === 'APPROVED'" class="icon-btn" title="正式发布" @click="releaseAction(item, 'publish')"><Send :size="16" /></button><button v-if="canApprove && item.status === 'PUBLISHED'" class="icon-btn" title="回滚生成草稿" @click="releaseAction(item, 'rollback')"><RotateCcw :size="16" /></button></div></div></div>
      <pre v-if="selectedDiff">{{ JSON.stringify(selectedDiff, null, 2) }}</pre>
    </div>
  </section>
</template>
