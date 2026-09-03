<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import {
  getDeadOutbox,
  getOperationAudits,
  getReconciliationDifferences,
  importReconciliationBill,
  reconcileBill,
  redriveOutbox,
  resolveReconciliationDifference,
  type OutboxEvent,
  type OperationAudit,
  type ReconciliationDifference,
} from "./api";
import AppDialog from "../../components/AppDialog.vue";
import AppPagination from "../../components/AppPagination.vue";
const emit = defineEmits<{ notice: [message: string] }>();
const outbox = ref<OutboxEvent[]>([]);
const differences = ref<ReconciliationDifference[]>([]);
const audits = ref<OperationAudit[]>([]);
const billForm = ref({ billId: "", channelId: "", billDate: new Date().toISOString().slice(0, 10), currency: "USD", totalAmount: 0, totalCount: 0, lines: "[]" });
const reconcileBillId = ref("");
const loading = ref(false);
const localPageSize = 20;
const outboxPage = ref(1);
const differencePage = ref(1);
const auditPage = ref({ current: 1, pageSize: 20, total: 0 });
const visibleOutbox = computed(() => outbox.value.slice((outboxPage.value - 1) * localPageSize, outboxPage.value * localPageSize));
const visibleDifferences = computed(() => differences.value.slice((differencePage.value - 1) * localPageSize, differencePage.value * localPageSize));
const load = async (currentAuditPage = auditPage.value.current) => {
  loading.value = true;
  try {
    const [o, d, a] = await Promise.all([
      getDeadOutbox(),
      getReconciliationDifferences(),
      getOperationAudits({ page: currentAuditPage, pageSize: auditPage.value.pageSize }),
    ]);
    outbox.value = o.items;
    differences.value = d.items;
    audits.value = a.items;
    auditPage.value = { current: a.page, pageSize: a.pageSize, total: a.total };
    outboxPage.value = 1;
    differencePage.value = 1;
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
const resolving = ref<ReconciliationDifference | null>(null);
const resolve = (item: ReconciliationDifference) => {
  resolving.value = item;
};
const doResolve = async (reason: string) => {
  const item = resolving.value;
  resolving.value = null;
  if (!item || !reason) return;
  try {
    await resolveReconciliationDifference(item.difference_id, reason);
    emit("notice", "差异已处理");
    await load();
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "差异处理失败");
  }
};
const importBill = async () => {
  try {
    const lines = JSON.parse(billForm.value.lines);
    if (!Array.isArray(lines)) throw new Error("账单明细必须是 JSON 数组");
    await importReconciliationBill({ ...billForm.value, lines });
    reconcileBillId.value = billForm.value.billId;
    emit("notice", "渠道账单已导入");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "账单导入失败");
  }
};
const runReconciliation = async () => {
  if (!reconcileBillId.value.trim()) return;
  try {
    await reconcileBill(reconcileBillId.value.trim());
    emit("notice", "对账已发起");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "对账发起失败");
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
      <button class="outline-btn" @click="() => load()">
        <RefreshCw :size="16" />刷新
      </button>
    </div>
    <h4>Outbox / DLQ</h4>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!outbox.length" class="empty">暂无死信消息</div>
    <div v-else class="record-list">
      <div v-for="event in visibleOutbox" :key="event.eventId" class="record-row">
        <div>
          <strong>{{ event.eventType }}</strong
          ><small>{{ event.eventId }} · {{ event.lastError || "" }}</small>
        </div>
        <span class="status-badge" :class="'st-' + event.status.toLowerCase()">{{ event.status }}</span
        ><button class="outline-btn" @click="redrive(event)">重新投递</button>
      </div>
    </div>
    <AppPagination :page="outboxPage" :page-size="localPageSize" :total="outbox.length" noun="条死信消息" @change="(page) => outboxPage = page" />
    <div class="operation-form">
      <div class="panel-title"><div><span class="eyebrow">RECONCILIATION</span><h4>导入渠道账单</h4></div></div>
      <div class="form-grid"><input v-model="billForm.billId" placeholder="账单 ID" /><input v-model="billForm.channelId" placeholder="渠道 ID" /><input v-model="billForm.billDate" type="date" /><input v-model="billForm.currency" maxlength="3" placeholder="币种" /><input v-model.number="billForm.totalAmount" type="number" min="0" step="0.01" placeholder="账单总金额" /><input v-model.number="billForm.totalCount" type="number" min="0" placeholder="账单笔数" /></div>
      <input v-model="billForm.lines" placeholder='账单明细 JSON 数组，例如 [{"channelOrderId":"...","amount":100}]' /><div class="button-row"><button class="primary-btn" @click="importBill">导入账单</button><input v-model="reconcileBillId" placeholder="待对账账单 ID" /><button class="outline-btn" @click="runReconciliation">发起对账</button></div>
    </div>
    <h4>对账差异</h4>
    <div v-if="!differences.length" class="empty">暂无未处理差异</div>
    <div v-else class="record-list">
      <div
        v-for="item in visibleDifferences"
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
    <AppPagination :page="differencePage" :page-size="localPageSize" :total="differences.length" noun="条差异" @change="(page) => differencePage = page" />
    <h4>后台操作审计</h4>
    <div v-if="!audits.length" class="empty">暂无操作审计记录</div>
    <div v-else class="record-list">
      <div v-for="item in audits" :key="item.auditId" class="record-row">
        <div>
          <strong>{{ item.action }} · {{ item.resourceType }}</strong><small>{{ item.operatorId }} · {{ item.resourceId }} · {{ item.createdAt }}</small>
        </div>
        <b>{{ item.reason || "--" }}</b>
      </div>
    </div>
    <AppPagination :page="auditPage.current" :page-size="auditPage.pageSize" :total="auditPage.total" noun="条审计记录" @change="load" />
    <AppDialog
      v-if="resolving"
      title="处理对账差异"
      :message="`账单 ${resolving.bill_id} · 差异类型 ${resolving.difference_type}`"
      confirm-text="确认处理"
      input-placeholder="请输入处理原因"
      input-value="已核实并处理"
      @confirm="doResolve"
      @cancel="resolving = null"
    />
  </section>
</template>
