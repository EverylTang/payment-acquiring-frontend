<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, Pencil, RefreshCw, Save, ToggleLeft, Trash2 } from "lucide-vue-next";
import {
  changePricingRuleStatus,
  createPricingRule,
  deletePricingRule,
  getPricingRules,
  updatePricingRule,
  type PricingRule,
} from "./api";
import { hasPermission } from "../../auth";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const rules = ref<PricingRule[]>([]);
const editing = ref<PricingRule | null>(null);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const saving = ref(false);
const form = ref({
  releaseVersion: 1,
  productCode: "",
  merchantId: "",
  currency: "",
  feeRate: "",
  fixedFee: "",
  extraFee: "0",
  minFee: "",
  maxFee: "",
  feeType: "PERCENTAGE" as "FIXED" | "PERCENTAGE" | "TIERED" | "COMBINED",
  tiers: "[]",
  feeMode: "PAYER_BEAR",
  minAmount: "0.01",
  maxAmount: "100000",
});

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getPricingRules({ page: current, pageSize: page.value.pageSize });
    rules.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "费率规则加载失败");
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    const payload = {
      releaseVersion: form.value.releaseVersion,
      productCode: form.value.productCode,
      merchantId: form.value.merchantId || undefined,
      currency: form.value.currency,
      feeRate: parseFloat(form.value.feeRate || "0"),
      fixedFee: parseFloat(form.value.fixedFee || "0"),
      extraFee: parseFloat(form.value.extraFee || "0"),
      minFee: form.value.minFee ? parseFloat(form.value.minFee) : undefined,
      maxFee: form.value.maxFee ? parseFloat(form.value.maxFee) : undefined,
      feeType: form.value.feeType,
      tiers: form.value.feeType === "TIERED" ? JSON.parse(form.value.tiers) : [],
      feeMode: form.value.feeMode,
      minAmount: form.value.minAmount ? parseFloat(form.value.minAmount) : undefined,
      maxAmount: form.value.maxAmount ? parseFloat(form.value.maxAmount) : undefined,
    };

    if (editing.value) {
      await updatePricingRule(editing.value.ruleId, payload);
      emit("notice", "费率规则已更新");
    } else {
      await createPricingRule(payload);
      emit("notice", "费率规则已创建");
    }

    editing.value = null;
    resetForm();
    await load(1);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "费率规则保存失败");
  } finally {
    saving.value = false;
  }
};

const edit = (rule: PricingRule) => {
  editing.value = rule;
  form.value = {
    releaseVersion: rule.releaseVersion,
    productCode: rule.productCode,
    merchantId: rule.merchantId || "",
    currency: rule.currency,
    feeRate: rule.feeRate?.toString() || "",
    fixedFee: rule.fixedFee?.toString() || "",
    extraFee: rule.extraFee?.toString() || "0",
    minFee: rule.minFee?.toString() || "",
    maxFee: rule.maxFee?.toString() || "",
    feeType: rule.feeType,
    tiers: JSON.stringify(rule.tiers || []),
    feeMode: rule.feeMode,
    minAmount: rule.minAmount?.toString() || "",
    maxAmount: rule.maxAmount?.toString() || "",
  };
};

const toggle = async (rule: PricingRule) => {
  try {
    const newStatus = rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await changePricingRuleStatus(rule.ruleId, newStatus);
    rule.status = newStatus;
    emit("notice", "费率规则状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "费率规则状态更新失败");
  }
};

const remove = async (rule: PricingRule) => {
  if (!confirm(`确定要删除费率规则 ${rule.ruleId} 吗？此操作无法撤销。`)) return;
  try {
    await deletePricingRule(rule.ruleId);
    emit("notice", "费率规则已删除");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "费率规则删除失败");
  }
};

const resetForm = () => {
  form.value = {
    releaseVersion: 1,
    productCode: "",
    merchantId: "",
    currency: "",
    feeRate: "",
    fixedFee: "",
    extraFee: "0",
    minFee: "",
    maxFee: "",
    feeType: "PERCENTAGE",
    tiers: "[]",
    feeMode: "PAYER_BEAR",
    minAmount: "0.01",
    maxAmount: "100000",
  };
};

const cancel = () => {
  editing.value = null;
  resetForm();
};

onMounted(load);
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div><span class="eyebrow">PRICING RULES</span><h3>费率规则管理</h3></div>
      <button class="outline-btn" @click="load()"><RefreshCw :size="16" />刷新</button>
    </div>

    <div class="form-grid">
      <input v-model.number="form.releaseVersion" type="number" min="1" placeholder="发布版本" />
      <input v-model="form.productCode" placeholder="产品编码" />
      <input v-model="form.merchantId" placeholder="商户ID（可选）" />
      <input v-model="form.currency" placeholder="币种" />
      <select v-model="form.feeMode">
        <option value="PAYER_BEAR">付款方承担</option>
        <option value="MERCHANT_BEAR">商户承担</option>
        <option v-if="form.feeMode === 'INCLUSIVE'" value="INCLUSIVE">历史：手续费内含</option>
        <option v-if="form.feeMode === 'EXCLUSIVE'" value="EXCLUSIVE">历史：手续费另计</option>
      </select>
      <select v-model="form.feeType"><option value="FIXED">固定手续费</option><option value="PERCENTAGE">比例手续费</option><option value="TIERED">阶梯手续费</option><option v-if="form.feeType === 'COMBINED'" value="COMBINED">历史组合手续费</option></select>
      <input v-if="form.feeType === 'PERCENTAGE' || form.feeType === 'COMBINED'" v-model="form.feeRate" type="number" step="0.0001" placeholder="费率（0.02 表示 2%）" />
      <input v-if="form.feeType === 'FIXED' || form.feeType === 'COMBINED'" v-model="form.fixedFee" type="number" step="0.01" placeholder="固定费用" />
      <input v-if="form.feeType === 'TIERED'" v-model="form.tiers" placeholder='阶梯 JSON，例如 [{"minAmount":0,"maxAmount":100,"feeRate":0.02,"fixedFee":0}]' />
      <input v-model="form.extraFee" type="number" step="0.01" placeholder="额外手续费" />
      <input v-model="form.minFee" type="number" step="0.01" placeholder="最小手续费（可选）" />
      <input v-model="form.maxFee" type="number" step="0.01" placeholder="最大手续费（可选）" />
      <input v-model="form.minAmount" type="number" step="0.01" placeholder="最小交易金额" />
      <input v-model="form.maxAmount" type="number" step="0.01" placeholder="最大交易金额" />
      <button v-if="hasPermission(editing ? 'pricing:update' : 'pricing:create')" class="primary-btn" :disabled="saving" @click="save">
        <Save :size="16" />{{ editing ? "保存规则" : "新增规则" }}
      </button>
      <button v-if="editing" class="outline-btn" @click="cancel">取消</button>
    </div>

    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="record-list">
      <div v-for="rule in rules" :key="rule.ruleId" class="record-row">
        <div>
          <strong>{{ rule.productCode }} · {{ rule.currency }}</strong>
          <small>
            {{ rule.feeMode === "INCLUSIVE" ? "手续费内含" : "手续费另计" }} · {{ rule.feeType === "FIXED" ? `固定 ${rule.fixedFee}` : rule.feeType === "PERCENTAGE" ? `比例 ${rule.feeRate}` : rule.feeType === "TIERED" ? `阶梯 ${rule.tiers?.length || 0} 档` : `组合 ${rule.feeRate} + ${rule.fixedFee}` }}
            {{ rule.minAmount || rule.maxAmount ? ` · 金额范围 ${rule.minAmount || "无限"} - ${rule.maxAmount || "无限"}` : "" }}
            {{ rule.merchantId ? ` · 商户 ${rule.merchantId}` : "" }}
          </small>
        </div>
        <span class="status-badge" :class="'st-' + rule.status.toLowerCase()">{{ rule.status }}</span>
        <div class="button-row">
          <button v-if="hasPermission('pricing:update')" class="icon-btn" title="编辑规则" @click="edit(rule)">
            <Pencil :size="16" />
          </button>
          <button v-if="hasPermission('pricing:status')" class="icon-btn" title="切换规则状态" @click="toggle(rule)">
            <ToggleLeft :size="16" />
          </button>
          <button v-if="hasPermission('pricing:delete')" class="icon-btn" title="删除规则" @click="remove(rule)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <AppPagination
      :page="page.current"
      :page-size="page.pageSize"
      :total="page.total"
      noun="条规则"
      @change="(current) => load(current)"
    />
  </section>
</template>
