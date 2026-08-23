<script setup lang="ts">
import { ref } from "vue";
import { createRefund, getRefund, type Refund } from "./api";
import type { Order } from "../order/api";
const props = defineProps<{ order: Order }>();
const emit = defineEmits<{ notice: [message: string] }>();
const amount = ref(String(props.order.amount));
const reason = ref("");
const refundId = ref("");
const result = ref<Refund | null>(null);
const loading = ref(false);
const submit = async () => {
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
  if (!refundId.value) return;
  try {
    result.value = await getRefund(props.order.orderId, refundId.value);
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "退款查询失败");
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
    <div class="form-grid">
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
    <div class="form-grid">
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
      ><b>{{ result.status }}</b>
    </div>
  </section>
</template>
