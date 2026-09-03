<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, Pencil, RefreshCw, Save, ToggleLeft, Trash2 } from "lucide-vue-next";
import {
  changeRoutingRuleStatus,
  createRoutingRule,
  deleteRoutingRule,
  getRoutingRules,
  updateRoutingRule,
  type RoutingRule,
} from "./api";
import { hasPermission } from "../../auth";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const rules = ref<RoutingRule[]>([]);
const editing = ref<RoutingRule | null>(null);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const saving = ref(false);
const form = ref({
  releaseVersion: 1,
  productCode: "",
  merchantId: "",
  country: "",
  currency: "USD",
  paymentMethod: "",
  channelId: "",
  priority: 100,
  weight: 100,
});

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getRoutingRules({ page: current, pageSize: page.value.pageSize });
    rules.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "路由规则加载失败");
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
      country: form.value.country,
      currency: form.value.currency,
      paymentMethod: form.value.paymentMethod,
      channelId: form.value.channelId,
      priority: form.value.priority,
      weight: form.value.weight,
    };

    if (editing.value) {
      await updateRoutingRule(editing.value.ruleId, payload);
      emit("notice", "路由规则已更新");
    } else {
      await createRoutingRule(payload);
      emit("notice", "路由规则已创建");
    }

    editing.value = null;
    resetForm();
    await load(1);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "路由规则保存失败");
  } finally {
    saving.value = false;
  }
};

const edit = (rule: RoutingRule) => {
  editing.value = rule;
  form.value = {
    releaseVersion: rule.releaseVersion,
    productCode: rule.productCode,
    merchantId: rule.merchantId || "",
    country: rule.country,
    currency: rule.currency,
    paymentMethod: rule.paymentMethod,
    channelId: rule.channelId,
    priority: rule.priority,
    weight: rule.weight,
  };
};

const toggle = async (rule: RoutingRule) => {
  try {
    const newStatus = rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await changeRoutingRuleStatus(rule.ruleId, newStatus);
    rule.status = newStatus;
    emit("notice", "路由规则状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "路由规则状态更新失败");
  }
};

const remove = async (rule: RoutingRule) => {
  if (!confirm(`确定要删除路由规则 ${rule.ruleId} 吗？此操作无法撤销。`)) return;
  try {
    await deleteRoutingRule(rule.ruleId);
    emit("notice", "路由规则已删除");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "路由规则删除失败");
  }
};

const resetForm = () => {
  form.value = {
    releaseVersion: 1,
    productCode: "",
    merchantId: "",
    country: "",
    currency: "USD",
    paymentMethod: "",
    channelId: "",
    priority: 100,
    weight: 100,
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
      <div><span class="eyebrow">ROUTING RULES</span><h3>路由规则管理</h3></div>
      <button class="outline-btn" @click="load()"><RefreshCw :size="16" />刷新</button>
    </div>

    <div class="form-grid">
      <input v-model.number="form.releaseVersion" type="number" min="1" placeholder="发布版本" />
      <input v-model="form.productCode" placeholder="产品编码" />
      <input v-model="form.merchantId" placeholder="商户ID（可选）" />
      <input v-model="form.country" placeholder="国家" />
      <input v-model="form.paymentMethod" placeholder="支付方式" />
      <input v-model="form.currency" maxlength="3" placeholder="币种" />
      <input v-model="form.channelId" placeholder="渠道 ID" />
      <input v-model.number="form.priority" type="number" min="0" placeholder="优先级" />
      <input v-model.number="form.weight" type="number" min="1" placeholder="规则权重" />
      <button v-if="hasPermission(editing ? 'routing:update' : 'routing:create')" class="primary-btn" :disabled="saving" @click="save">
        <Save :size="16" />{{ editing ? "保存规则" : "新增规则" }}
      </button>
      <button v-if="editing" class="outline-btn" @click="cancel">取消</button>
    </div>

    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="record-list">
      <div v-for="rule in rules" :key="rule.ruleId" class="record-row">
        <div>
          <strong>{{ rule.productCode }} → {{ rule.channelId }}</strong>
          <small>{{ rule.country }} / {{ rule.currency }} · {{ rule.paymentMethod }} · 优先级 {{ rule.priority }} · 权重 {{ rule.weight }}{{ rule.merchantId ? ` · 商户 ${rule.merchantId}` : "" }}</small>
        </div>
        <span class="status-badge" :class="'st-' + rule.status.toLowerCase()">{{ rule.status }}</span>
        <div class="button-row">
          <button v-if="hasPermission('routing:update')" class="icon-btn" title="编辑规则" @click="edit(rule)">
            <Pencil :size="16" />
          </button>
          <button v-if="hasPermission('routing:status')" class="icon-btn" title="切换规则状态" @click="toggle(rule)">
            <ToggleLeft :size="16" />
          </button>
          <button v-if="hasPermission('routing:delete')" class="icon-btn" title="删除规则" @click="remove(rule)">
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
