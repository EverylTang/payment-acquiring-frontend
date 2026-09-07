<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Eye, RefreshCw, RotateCcw } from "lucide-vue-next";
import {
  getDeadOutbox,
  getExpiredPaymentSuccesses,
  getFailedPaymentEvents,
  getOperationAudits,
  getOutboxEvent,
  getPaymentEvent,
  getReconciliationDifferences,
  getSettlementBill,
  getSettlementBills,
  importReconciliationBill,
  reconcileBill,
  redriveOutbox,
  replayPaymentEvent,
  resolveExpiredPaymentSuccess,
  resolveReconciliationDifference,
  type ExpiredPaymentSuccess,
  type OutboxEvent,
  type OperationAudit,
  type PaymentEvent,
  type ReconciliationDifference,
  type SettlementBill,
  type SettlementBillDetail,
} from "./api";
import { hasPermission } from "../../auth";
import AppDialog from "../../components/AppDialog.vue";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";
const emit = defineEmits<{ notice: [message: string] }>();
const outbox = ref<OutboxEvent[]>([]);
const differences = ref<ReconciliationDifference[]>([]);
const audits = ref<OperationAudit[]>([]);
const failedPaymentEvents = ref<PaymentEvent[]>([]);
const expiredPaymentSuccesses = ref<ExpiredPaymentSuccess[]>([]);
const settlementBills = ref<SettlementBill[]>([]);
const billForm = ref({ billId: "", channelId: "", billDate: new Date().toISOString().slice(0, 10), currency: "USD", totalAmount: 0, totalCount: 0, lines: "[]" });
const reconcileBillId = ref("");
const loading = ref(false);
const localPageSize = ref(20);
const outboxPage = ref(1);
const differencePage = ref(1);
const paymentEventPage = ref(1);
const paymentEventPageSize = ref(20);
const expiredSuccessPage = ref(1);
const expiredSuccessPageSize = ref(20);
const auditPage = ref({ current: 1, pageSize: 10, total: 0 });
const settlementBillPage = ref({ current: 1, pageSize: 10, total: 0 });
const visibleOutbox = computed(() => outbox.value.slice((outboxPage.value - 1) * localPageSize.value, outboxPage.value * localPageSize.value));
const visibleDifferences = computed(() => differences.value.slice((differencePage.value - 1) * localPageSize.value, differencePage.value * localPageSize.value));
const visiblePaymentEvents = computed(() => failedPaymentEvents.value.slice((paymentEventPage.value - 1) * paymentEventPageSize.value, paymentEventPage.value * paymentEventPageSize.value));
const visibleExpiredSuccesses = computed(() => expiredPaymentSuccesses.value.slice((expiredSuccessPage.value - 1) * expiredSuccessPageSize.value, expiredSuccessPage.value * expiredSuccessPageSize.value));
const selectedOutboxDetail = ref<Record<string, unknown> | null>(null);
const selectedSettlementBill = ref<SettlementBillDetail | null>(null);
const selectedPaymentEvent = ref<PaymentEvent | null>(null);
const replayingPaymentEvent = ref<PaymentEvent | null>(null);
const resolvingExpired = ref<ExpiredPaymentSuccess | null>(null);
const text = (value: unknown) => value == null ? "" : String(value);
const lineValue = (line: Record<string, unknown>, key: string) => line[key] ?? line[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
const changeOutboxPageSize = (pageSize: number) => { localPageSize.value = pageSize; outboxPage.value = 1; };
const changeDifferencePageSize = (pageSize: number) => { localPageSize.value = pageSize; differencePage.value = 1; };
const changePaymentEventPageSize = (pageSize: number) => { paymentEventPageSize.value = pageSize; paymentEventPage.value = 1; };
const changeExpiredSuccessPageSize = (pageSize: number) => { expiredSuccessPageSize.value = pageSize; expiredSuccessPage.value = 1; };
const load = async (currentAuditPage = auditPage.value.current, currentSettlementBillPage = settlementBillPage.value.current) => {
  loading.value = true;
  try {
    const [o, d, a, p, e, b] = await Promise.all([
      hasPermission("outbox:list") ? getDeadOutbox() : Promise.resolve({ items: [] as OutboxEvent[] }),
      hasPermission("reconciliation:difference:list") ? getReconciliationDifferences() : Promise.resolve({ items: [] as ReconciliationDifference[] }),
      hasPermission("audit:list")
        ? getOperationAudits({ page: currentAuditPage, pageSize: auditPage.value.pageSize })
        : Promise.resolve({ items: [] as OperationAudit[], page: currentAuditPage, pageSize: auditPage.value.pageSize, total: 0 }),
      hasPermission("payment-event:list") ? getFailedPaymentEvents() : Promise.resolve({ items: [] as PaymentEvent[] }),
      hasPermission("reconciliation:difference:list") ? getExpiredPaymentSuccesses() : Promise.resolve({ items: [] as ExpiredPaymentSuccess[] }),
      hasPermission("reconciliation:bill:list")
        ? getSettlementBills({ page: currentSettlementBillPage, pageSize: settlementBillPage.value.pageSize })
        : Promise.resolve({ items: [] as SettlementBill[], page: currentSettlementBillPage, pageSize: settlementBillPage.value.pageSize, total: 0 }),
    ]);
    outbox.value = o.items;
    differences.value = d.items;
    audits.value = a.items;
    failedPaymentEvents.value = p.items;
    expiredPaymentSuccesses.value = e.items;
    settlementBills.value = b.items;
    auditPage.value = { current: a.page, pageSize: a.pageSize, total: a.total };
    settlementBillPage.value = { current: b.page, pageSize: b.pageSize, total: b.total };
    outboxPage.value = 1;
    differencePage.value = 1;
    paymentEventPage.value = 1;
    expiredSuccessPage.value = 1;
  } catch (e) {
    emit("notice", e instanceof Error ? e.message : "运营数据加载失败");
  } finally {
    loading.value = false;
  }
};
const openOutboxDetail = async (eventId: string) => {
  try {
    selectedOutboxDetail.value = await getOutboxEvent(eventId);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "Outbox 详情加载失败");
  }
};
const openSettlementBill = async (billId: string) => {
  try {
    selectedSettlementBill.value = await getSettlementBill(billId);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "结算账单详情加载失败");
  }
};
const changeSettlementBillPage = (page: number) => { void load(auditPage.value.current, page); };
const changeSettlementBillPageSize = (pageSize: number) => {
  settlementBillPage.value.pageSize = pageSize;
  void load(auditPage.value.current, 1);
};
const openPaymentEvent = async (event: PaymentEvent) => {
  const id = text(event.id) || text(event.eventId);
  if (!id) return;
  try {
    selectedPaymentEvent.value = await getPaymentEvent(id);
  } catch (error) {
    selectedPaymentEvent.value = event;
    emit("notice", error instanceof Error ? error.message : "支付事件详情加载失败");
  }
};
const doReplayPaymentEvent = async (reason: string) => {
  const event = replayingPaymentEvent.value;
  replayingPaymentEvent.value = null;
  if (!event || !reason) return;
  const id = text(event.id) || text(event.eventId);
  if (!id) return;
  try {
    await replayPaymentEvent(id, reason);
    emit("notice", "支付事件已重放");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "支付事件重放失败");
  }
};
const doResolveExpiredSuccess = async (resolution: string) => {
  const item = resolvingExpired.value;
  resolvingExpired.value = null;
  if (!item || !resolution) return;
  const id = text(item.exceptionId);
  if (!id) return;
  try {
    await resolveExpiredPaymentSuccess(id, resolution);
    emit("notice", "过期支付成功异常已处理");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "过期支付成功异常处理失败");
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
    await load();
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
    <template v-if="hasPermission('outbox:list')">
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
          ><button v-if="hasPermission('outbox:detail')" class="outline-btn action-btn" title="查看详情" @click="openOutboxDetail(event.eventId)"><Eye :size="15" />查看</button
          ><button v-if="hasPermission('outbox:redrive')" class="outline-btn" @click="redrive(event)">重新投递</button>
        </div>
      </div>
      <AppPagination :page="outboxPage" :page-size="localPageSize" :total="outbox.length" noun="条死信消息" @change="(page) => outboxPage = page" @size-change="changeOutboxPageSize" />
    </template>
    <template v-if="hasPermission('payment-event:list')">
      <h4>支付事件重放</h4>
      <div v-if="!failedPaymentEvents.length" class="empty">暂无失败支付事件</div>
      <div v-else class="record-list">
        <div v-for="(event, index) in visiblePaymentEvents" :key="text(event.eventId) || text(event.id) || index" class="record-row">
          <div>
            <strong>{{ text(event.eventType) }}</strong
            ><small>{{ text(event.eventId) }} · {{ text(event.orderId) }} · {{ text(event.lastError) || text(event.failureType) || "" }}</small>
          </div>
          <span class="status-badge" :class="'st-' + text(event.status).toLowerCase()">{{ text(event.status) }}</span
          ><button v-if="hasPermission('payment-event:detail')" class="outline-btn action-btn" title="查看详情" @click="openPaymentEvent(event)"><Eye :size="15" />查看</button
          ><button v-if="hasPermission('payment-event:replay')" class="outline-btn" @click="replayingPaymentEvent = event"><RotateCcw :size="16" />重放</button>
        </div>
      </div>
      <AppPagination :page="paymentEventPage" :page-size="paymentEventPageSize" :total="failedPaymentEvents.length" noun="条支付事件" @change="(page) => paymentEventPage = page" @size-change="changePaymentEventPageSize" />
    </template>
    <template v-if="hasPermission('reconciliation:bill:import') || hasPermission('reconciliation:bill:reconcile')">
      <div class="operation-form">
        <div class="panel-title"><div><span class="eyebrow">RECONCILIATION</span><h4>导入渠道账单</h4></div></div>
        <div class="form-grid"><input v-model="billForm.billId" placeholder="账单 ID" /><input v-model="billForm.channelId" placeholder="渠道 ID" /><input v-model="billForm.billDate" type="date" /><input v-model="billForm.currency" maxlength="3" placeholder="币种" /><input v-model.number="billForm.totalAmount" type="number" min="0" step="0.01" placeholder="账单总金额" /><input v-model.number="billForm.totalCount" type="number" min="0" placeholder="账单笔数" /></div>
        <input v-model="billForm.lines" placeholder='账单明细 JSON 数组，例如 [{"channelOrderId":"...","amount":100}]' /><div class="button-row"><button v-if="hasPermission('reconciliation:bill:import')" class="primary-btn" @click="importBill">导入账单</button><input v-model="reconcileBillId" placeholder="待对账账单 ID" /><button v-if="hasPermission('reconciliation:bill:reconcile')" class="outline-btn" @click="runReconciliation">发起对账</button></div>
      </div>
    </template>
    <template v-if="hasPermission('reconciliation:bill:list')">
      <h4>渠道结算账单</h4>
      <div v-if="loading && !settlementBills.length" class="empty">加载中…</div>
      <div v-else-if="!settlementBills.length" class="empty">暂无渠道结算账单</div>
      <div v-else class="record-list">
        <div v-for="bill in settlementBills" :key="bill.billId" class="record-row">
          <div>
            <strong>{{ bill.billId }}</strong>
            <small>{{ bill.channelId }} · {{ bill.billDate }} · {{ bill.currency }}</small>
          </div>
          <b>{{ bill.totalAmount }} / {{ bill.totalCount }}</b>
          <span class="status-badge" :class="'st-' + bill.status.toLowerCase()">{{ bill.status }}</span>
          <button v-if="hasPermission('reconciliation:bill:detail')" class="outline-btn action-btn" title="查看账单详情" @click="openSettlementBill(bill.billId)"><Eye :size="15" />查看</button>
        </div>
      </div>
      <AppPagination :page="settlementBillPage.current" :page-size="settlementBillPage.pageSize" :total="settlementBillPage.total" noun="条结算账单" @change="changeSettlementBillPage" @size-change="changeSettlementBillPageSize" />
    </template>
    <template v-if="hasPermission('reconciliation:difference:list')">
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
          ><button v-if="hasPermission('reconciliation:difference:resolve')" class="outline-btn" @click="resolve(item)">处理</button>
        </div>
      </div>
      <AppPagination :page="differencePage" :page-size="localPageSize" :total="differences.length" noun="条差异" @change="(page) => differencePage = page" @size-change="changeDifferencePageSize" />
    </template>
    <template v-if="hasPermission('reconciliation:difference:list')">
      <h4>过期支付成功异常</h4>
      <div v-if="!expiredPaymentSuccesses.length" class="empty">暂无待处理异常</div>
      <div v-else class="record-list">
        <div v-for="(item, index) in visibleExpiredSuccesses" :key="text(item.exceptionId) || index" class="record-row">
          <div>
            <strong>{{ text(item.orderId) }} · {{ text(item.attemptId) }}</strong
            ><small>{{ text(item.exceptionId) }} · {{ text(item.channelId) }} · {{ text(item.currency) }} {{ text(item.amount) }}</small>
          </div>
          <span class="status-badge" :class="'st-' + text(item.status).toLowerCase()">{{ text(item.status) }}</span
          ><button v-if="hasPermission('reconciliation:difference:resolve')" class="outline-btn" @click="resolvingExpired = item">处理</button>
        </div>
      </div>
      <AppPagination :page="expiredSuccessPage" :page-size="expiredSuccessPageSize" :total="expiredPaymentSuccesses.length" noun="条过期支付成功异常" @change="(page) => expiredSuccessPage = page" @size-change="changeExpiredSuccessPageSize" />
    </template>
    <template v-if="hasPermission('audit:list')">
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
      <AppPagination :page="auditPage.current" :page-size="auditPage.pageSize" :total="auditPage.total" noun="条审计记录" @change="load" @size-change="(size) => { auditPage.pageSize = size; load(1); }" />
    </template>
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
    <AppDialog
      v-if="replayingPaymentEvent"
      title="重放支付事件"
      :message="`事件 ${text(replayingPaymentEvent.eventId) || text(replayingPaymentEvent.id)}`"
      confirm-text="确认重放"
      input-placeholder="请输入重放原因"
      input-value="运营后台人工重放"
      @confirm="doReplayPaymentEvent"
      @cancel="replayingPaymentEvent = null"
    />
    <AppDialog
      v-if="resolvingExpired"
      title="处理过期支付成功异常"
      :message="`订单 ${text(resolvingExpired.orderId)} · 异常 ${text(resolvingExpired.exceptionId)}`"
      confirm-text="确认处理"
      input-placeholder="请输入处理结论"
      input-value="已核实并处理"
      @confirm="doResolveExpiredSuccess"
      @cancel="resolvingExpired = null"
    />
    <AppDrawer v-if="selectedOutboxDetail" title="Outbox 详情" description="OUTBOX EVENT" @close="selectedOutboxDetail = null">
      <pre class="snapshot-preview">{{ JSON.stringify(selectedOutboxDetail, null, 2) }}</pre>
    </AppDrawer>
    <AppDrawer v-if="selectedPaymentEvent" title="支付事件详情" description="PAYMENT EVENT" @close="selectedPaymentEvent = null">
      <pre class="snapshot-preview">{{ JSON.stringify(selectedPaymentEvent, null, 2) }}</pre>
    </AppDrawer>
    <AppDrawer v-if="selectedSettlementBill" title="结算账单详情" description="SETTLEMENT BILL" @close="selectedSettlementBill = null">
      <section class="drawer-section settlement-bill-detail">
        <dl class="settlement-detail-list">
          <div><dt>账单 ID</dt><dd class="mono">{{ selectedSettlementBill.billId }}</dd></div>
          <div><dt>渠道</dt><dd>{{ selectedSettlementBill.channelId }}</dd></div>
          <div><dt>账单日期</dt><dd>{{ selectedSettlementBill.billDate }}</dd></div>
          <div><dt>币种</dt><dd>{{ selectedSettlementBill.currency }}</dd></div>
          <div><dt>总金额</dt><dd>{{ selectedSettlementBill.totalAmount }}</dd></div>
          <div><dt>总笔数</dt><dd>{{ selectedSettlementBill.totalCount }}</dd></div>
          <div><dt>状态</dt><dd>{{ selectedSettlementBill.status }}</dd></div>
          <div><dt>导入时间</dt><dd>{{ selectedSettlementBill.importedAt }}</dd></div>
        </dl>
        <div v-if="selectedSettlementBill.lines?.length" class="settlement-line-table-wrap">
          <table class="data-table settlement-line-table"><thead><tr><th>渠道订单号</th><th>订单 ID</th><th>商户</th><th>类型</th><th>金额</th><th>状态</th></tr></thead><tbody><tr v-for="(line, index) in selectedSettlementBill.lines" :key="String(lineValue(line, 'channelOrderId') || index)"><td class="mono">{{ lineValue(line, 'channelOrderId') || '--' }}</td><td class="mono">{{ lineValue(line, 'orderId') || '--' }}</td><td>{{ lineValue(line, 'merchantId') || '--' }}</td><td>{{ lineValue(line, 'transactionType') || '--' }}</td><td>{{ lineValue(line, 'amount') ?? '--' }} {{ lineValue(line, 'currency') || selectedSettlementBill.currency }}</td><td>{{ lineValue(line, 'status') || '--' }}</td></tr></tbody></table>
        </div>
      </section>
    </AppDrawer>
  </section>
</template>
