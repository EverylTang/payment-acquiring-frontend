<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import {
  getDeadOutbox,
  getReconciliationDifferences,
  redriveOutbox,
  resolveReconciliationDifference,
  type OutboxEvent,
  type ReconciliationDifference,
} from "../../api";
const emit = defineEmits<{ notice: [message: string] }>();
const outbox = ref<OutboxEvent[]>([]);
const differences = ref<ReconciliationDifference[]>([]);
const loading = ref(false);
const load = async () => {
  loading.value = true;
  try {
    const [o, d] = await Promise.all([
      getDeadOutbox(),
      getReconciliationDifferences(),
    ]);
    outbox.value = o.items;
    differences.value = d.items;
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "运营数据加载失败");
  } finally {
    loading.value = false;
  }
};
const redrive = async (event: OutboxEvent) => {
  try {
    await redriveOutbox(event.eventId, "运营后台人工重发");
    emit("notice", "消息已重新入队");
    await load();
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "重发失败");
  }
};
const resolve = async (item: ReconciliationDifference) => {
  const reason = window.prompt("请输入处理原因", "已核实并处理") || "";
  if (!reason) return;
  try {
    await resolveReconciliationDifference(item.difference_id, reason);
    emit("notice", "差异已处理");
    await load();
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "差异处理失败");
  }
};
onMounted(load);
</script>
<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">OPERATIONS</span>
        <h3>运营处置</h3>
      </div>
      <button class="outline-btn" @click="load">
        <RefreshCw :size="16" />刷新
      </button>
    </div>
    <h4>Outbox / DLQ</h4>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!outbox.length" class="empty">暂无死信消息</div>
    <div v-else class="record-list">
      <div v-for="event in outbox" :key="event.eventId" class="record-row">
        <div>
          <strong>{{ event.eventType }}</strong
          ><small>{{ event.eventId }} · {{ event.lastError || "" }}</small>
        </div>
        <b>{{ event.status }}</b
        ><button class="outline-btn" @click="redrive(event)">重新投递</button>
      </div>
    </div>
    <h4>对账差异</h4>
    <div v-if="!differences.length" class="empty">暂无未处理差异</div>
    <div v-else class="record-list">
      <div
        v-for="item in differences"
        :key="item.difference_id"
        class="record-row"
      >
        <div>
          <strong>{{ item.difference_type }}</strong
          ><small>{{ item.bill_id }} · {{ item.reason || "" }}</small>
        </div>
        <b>{{ item.expected_amount }} / {{ item.actual_amount }}</b
        ><button class="outline-btn" @click="resolve(item)">处理</button>
      </div>
    </div>
  </section>
</template>
