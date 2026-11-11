<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Activity, CircleDollarSign, RefreshCw, Settings2, Store } from "lucide-vue-next";
import { getChannelHealth, getOverview, getSnapshot, type DashboardOverview } from "./api";
import { getOrderStatistics } from "../order/api";

const props = defineProps<{ reload?: number; refresh?: number }>();
const emit = defineEmits<{ notice: [message: string] }>();
const busy = ref(false);
const overview = ref<DashboardOverview | null>(null);
const snapshotForm = ref({
  merchantId: "",
  productCode: "CARD-US-USD",
  paymentMethod: "CARD",
  currency: "USD",
  country: "US",
  amount: "1.00",
});
const snapshot = ref<Record<string, unknown> | null>(null);
const channelHealth = ref("检查中");
const run = async <T,>(action: () => Promise<T>, success = "") => {
  busy.value = true;
  emit("notice", "");
  try {
    const result = await action();
    emit("notice", success);
    return result;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "请求失败");
  } finally {
    busy.value = false;
  }
};
const loadOverview = async () => {
  const result = await run(async () => {
    const [platformOverview, orderStatistics] = await Promise.all([
      getOverview(),
      getOrderStatistics(),
    ]);
    return {
      ...platformOverview,
      paymentSuccessRate: orderStatistics.paymentSuccessRate,
      paymentVolume: orderStatistics.paymentVolume,
      activeMerchants: orderStatistics.activeMerchants,
    };
  });
  if (result) overview.value = result;
};
const checkHealth = async () => {
  const channel = overview.value?.channelHealth[0];
  if (!channel) {
    channelHealth.value = "未配置渠道";
    return;
  }
  const result = await run(() => getChannelHealth(channel.channelId));
  if (result) channelHealth.value = `${channel.channelId} · ${result.status}`;
};
const loadSnapshot = async () => {
  const result = await run(() => getSnapshot(snapshotForm.value));
  if (result) snapshot.value = result;
};
const reloadAll = async () => {
  await loadOverview();
  await checkHealth();
};
onMounted(() => void loadOverview());
watch(() => props.reload, () => void loadOverview());
watch(() => props.refresh, () => void reloadAll());
</script>
<template>
  <section class="metrics">
    <article>
      <div class="metric-head"><span>支付成功率</span><i class="metric-icon success"><Activity :size="16" /></i></div>
      <strong>{{ overview?.paymentSuccessRate ?? "--" }}<small>%</small></strong>
      <em>累计订单口径</em>
    </article>
    <article>
      <div class="metric-head"><span>订单名义金额</span><i class="metric-icon accent"><CircleDollarSign :size="16" /></i></div>
      <strong>{{ overview?.paymentVolume?.toLocaleString() ?? "--" }}</strong>
      <em>全币种累计</em>
    </article>
    <article>
      <div class="metric-head"><span>交易商户</span><i class="metric-icon blue"><Store :size="16" /></i></div>
      <strong>{{ overview?.activeMerchants ?? "--" }}</strong>
      <em>历史去重</em>
    </article>
    <article>
      <div class="metric-head"><span>待发布配置</span><i class="metric-icon warning"><Settings2 :size="16" /></i></div>
      <strong>{{ overview?.pendingReleases ?? "--" }}</strong>
      <em>需要关注</em>
    </article>
  </section>
  <section class="content-grid">
    <article class="panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">CHANNEL HEALTH</span>
          <h3>渠道健康度</h3>
        </div>
        <span class="health-status">{{ channelHealth }}</span>
        <button class="icon-btn" @click="checkHealth">
          <RefreshCw :size="16" />
        </button>
      </div>
      <div
        v-for="channel in overview?.channelHealth || []"
        :key="channel.channelId"
        class="health-row"
      >
        <span
          class="status-dot"
          :class="channel.status.toLowerCase()"
        ></span>
        <div>
          <strong>{{ channel.name }}</strong
          ><small>{{ channel.channelId }}</small>
        </div>
        <b>{{ channel.successRate }}%</b
        ><span class="health-status">{{ channel.status }}</span>
      </div>
    </article>
    <article class="panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">QUICK CHECK</span>
          <h3>配置快照验证</h3>
        </div>
      </div>
      <div class="form-grid">
        <input
          v-model="snapshotForm.merchantId"
          placeholder="商户 ID"
        /><input
          v-model="snapshotForm.productCode"
          placeholder="产品编码"
        /><input
          v-model="snapshotForm.paymentMethod"
          placeholder="支付方式"
        /><input v-model="snapshotForm.currency" placeholder="币种" /><input v-model="snapshotForm.country" placeholder="国家" /><input v-model="snapshotForm.amount" placeholder="金额" />
      </div>
      <button class="primary-btn" :disabled="busy" @click="loadSnapshot">
        {{ busy ? "查询中…" : "查询已发布快照" }}
      </button>
      <pre v-if="snapshot">{{ JSON.stringify(snapshot, null, 2) }}</pre>
    </article>
  </section>
</template>

<style scoped>
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1440px; margin: 0 auto 22px; }
.metrics article { position: relative; min-width: 0; padding: 20px 22px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); box-shadow: 0 8px 24px rgba(30, 50, 80, .06); transition: box-shadow .2s ease, transform .2s ease; }
.metrics article:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(30, 50, 80, .1); }
.metrics span { display: block; color: var(--muted); font-size: 12px; }
.metrics strong { display: block; overflow: hidden; margin: 12px 0 10px; font-family: 'DM Mono', 'IBM Plex Sans SC', monospace; font-size: clamp(24px, 2.2vw, 32px); font-weight: 600; line-height: 1; color: var(--ink); text-overflow: ellipsis; }
.metrics strong small { margin-left: 3px; font-size: 14px; }
.metrics em { display: flex; align-items: center; gap: 6px; color: var(--muted-light); font-size: 10px; font-style: normal; }
.content-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); gap: 20px; max-width: 1440px; margin: 0 auto; }
.content-grid > .panel { min-height: 330px; padding: 25px; }
.health-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto auto; align-items: center; gap: 14px; padding: 15px 2px; border-bottom: 1px solid var(--line); }
.health-row:last-child { border-bottom: 0; }
.health-row div strong, .health-row div small { display: block; }
.health-row div strong { font-size: 13px; font-weight: 600; color: var(--ink); }
.health-row div small { margin-top: 3px; color: var(--muted-light); font: 10px 'DM Mono', monospace; }
.health-row b { font: 500 13px 'DM Mono', monospace; color: var(--accent-dark); }
.health-status { min-width: 66px; padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--success) 35%, transparent); border-radius: 999px; color: var(--success); background: color-mix(in srgb, var(--success) 8%, transparent); font: 500 9px 'DM Mono', monospace; text-align: center; text-transform: uppercase; }
.metrics { animation-delay: .04s; }
.content-grid { animation-delay: .08s; }
@media (max-width: 1100px) {
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .metrics article:nth-child(2) { border-right: 0; }
  .metrics article:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
}
@media (max-width: 820px) {
  .content-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .metrics { grid-template-columns: 1fr; }
  .metrics article { border-right: 0; border-bottom: 1px solid var(--line); }
  .metrics article:last-child { border-bottom: 0; }
}
@media (max-width: 560px) {
  .health-row { grid-template-columns: 8px minmax(0,1fr) auto; }
  .health-status { display: none; }
}
.metric-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.metric-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; }
.metric-icon.success { color: var(--success); background: color-mix(in srgb, var(--success) 10%, transparent); }
.metric-icon.accent { color: var(--accent-dark); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.metric-icon.blue { color: var(--info); background: rgba(59, 130, 246, .1); }
.metric-icon.warning { color: var(--warning); background: color-mix(in srgb, var(--warning) 10%, transparent); }
.metrics { max-width: 1520px; gap: 12px; margin-bottom: 16px; }
.metrics article {
  padding: 17px 18px;
  border-color: var(--line);
  border-radius: 6px;
  background: var(--paper);
  box-shadow: none;
}
.metrics article:hover { transform: none; box-shadow: 0 2px 6px rgba(31, 41, 55, .06); }
.metrics span { color: var(--muted); font-size: 12px; }
.metrics strong { margin: 11px 0 7px; color: var(--ink); font-family: Inter, "Noto Sans SC", sans-serif; font-size: 26px; }
.metrics em { color: var(--muted-light); font-family: Inter, "Noto Sans SC", sans-serif; }
.metric-icon { width: 30px; height: 30px; border-radius: 6px; }
.metric-icon.accent { color: var(--accent-dark); background: var(--accent-soft); }
.metric-icon.blue { color: var(--info); background: color-mix(in srgb, var(--info) 10%, transparent); }
.metric-icon.warning { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
.content-grid { max-width: 1520px; gap: 16px; }
.content-grid > .panel { min-height: 0; padding: 20px; }
.metrics { margin-top: 28px; }
@media (max-width: 820px) { .metrics { margin-top: 20px; } }
</style>
