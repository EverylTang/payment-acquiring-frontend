<script setup lang="ts">
import { computed, ref } from "vue";
import { hasPermission } from "../../auth";
import { createRefund, executeRefund, getRefund, type Refund } from "./api";
import type { Order } from "../order/api";
const props = defineProps<{ order: Order; canCreate: boolean }>();
const canReadRefund = computed(() => hasPermission("order:list"));
const canManageRefund = computed(() => hasPermission("order:manage"));
const emit = defineEmits<{ notice: [message: string] }>();
const amount = ref(String(props.order.amount));
const reason = ref("");
const refundId = ref("");
const result = ref<Refund | null>(null);
const loading = ref(false);
const submit = async () => {
  if (!canManageRefund.value || !props.canCreate || loading.value || props.order.status !== "SUCCESS") return;
  if (!Number.isFinite(Number(amount.value)) || Number(amount.value) < 0.01 || !reason.value.trim()) return emit("notice", "请输入有效退款金额和退款原因");
  loading.value = true;
  try {
    result.value = await createRefund(
      props.order.orderId,
      { amount: Number(amount.value), reason: reason.value },
      `refund-${props.order.orderId}-${Date.now()}`,
    );
    emit("notice", "退款已提交");
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "退款提交失败");
  } finally {
    loading.value = false;
  }
};
const query = async () => {
  if (!canReadRefund.value || !refundId.value.trim()) return;
  try {
    result.value = await getRefund(props.order.orderId, refundId.value.trim());
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "退款查询失败");
  }
};
const execute = async () => {
  if (!canManageRefund.value || loading.value || !result.value || !['CREATED', 'FAILED', 'UNKNOWN'].includes(result.value.status)) return;
  loading.value = true;
  try {
    result.value = await executeRefund(props.order.orderId, result.value.refundId);
    emit("notice", "退款已执行");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "退款执行失败");
  } finally {
    loading.value = false;
  }
};
</script>
<template>
  <section class="detail-panel refund-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">REFUND</span>
        <h4>订单退款</h4>
      </div>
    </div>
    <div v-if="canManageRefund && canCreate" class="form-grid">
      <input
        v-model="amount"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="退款金额"
      /><input v-model="reason" placeholder="退款原因" /><button
        class="danger-btn"
        :disabled="loading || order.status !== 'SUCCESS' || !reason"
        @click="submit"
      >
        提交退款
      </button>
    </div>
    <div v-if="canReadRefund" class="form-grid">
      <input v-model="refundId" placeholder="退款 ID" /><button
        class="outline-btn"
        @click="query"
      >
        查询退款
      </button>
    </div>
    <div v-if="result" class="record-row">
      <strong>{{ result.refundId }}</strong
      ><span>{{ result.amount }} {{ result.currency }}</span
      ><span class="status-badge" :class="'st-' + result.status.toLowerCase()">{{ result.status }}</span><button v-if="canManageRefund && ['CREATED', 'FAILED', 'UNKNOWN'].includes(result.status)" class="outline-btn" :disabled="loading" @click="execute">执行退款</button>
    </div>
  </section>
</template>

<style scoped>
.detail-panel { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 18px; }
.detail-panel h4 { color: var(--ink); }
.refund-panel .form-grid { grid-template-columns: minmax(140px, .6fr) minmax(180px, 1fr) auto; margin-bottom: 10px; }
.refund-panel .record-row { margin-top: 12px; border: 1px solid var(--line); border-radius: 8px; }
.refund-panel .record-row strong { font: 500 12px 'DM Mono', monospace; color: var(--accent-dark); }
.app-drawer .refund-panel { margin-top: 24px; }
</style>
