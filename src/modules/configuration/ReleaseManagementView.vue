<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Check, FileDiff, Plus, RefreshCw, RotateCcw, Send } from "lucide-vue-next";
import { authState } from "../../auth";
import AppDialog from "../../components/AppDialog.vue";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";
import { createRelease, getReleaseDiff, getReleases, transitionRelease, type ConfigRelease } from "./api";

const emit = defineEmits<{ notice: [message: string] }>();

const loading = ref(false);
const saving = ref(false);
const releases = ref<ConfigRelease[]>([]);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const drawer = ref<"create" | "diff" | null>(null);
const releaseReason = ref("");
const releaseConfig = ref("{}");
const selectedRelease = ref<ConfigRelease | null>(null);
const selectedDiff = ref<Record<string, unknown> | null>(null);
const pending = ref<{ release: ConfigRelease; action: "submit" | "approve" | "publish" | "rollback" } | null>(null);

const canCreate = computed(() => authState.user?.roles.some((role) => ["ADMIN", "OPS"].includes(role)) ?? false);
const canApprove = computed(() => authState.user?.roles.includes("ADMIN") ?? false);
const actionLabels = { submit: "提交审核", approve: "审核通过", publish: "正式发布", rollback: "回滚生成草稿" } as const;

const load = async () => {
  loading.value = true;
  try {
    const result = await getReleases({ page: page.value.current, pageSize: page.value.pageSize });
    releases.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "发布版本加载失败");
  } finally {
    loading.value = false;
  }
};

const parseConfiguration = () => {
  try {
    const value: unknown = JSON.parse(releaseConfig.value);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error("发布配置必须是 JSON 对象");
  }
};

const createDraft = async () => {
  if (!releaseReason.value.trim()) {
    emit("notice", "请填写创建原因");
    return;
  }
  saving.value = true;
  try {
    await createRelease(parseConfiguration(), releaseReason.value.trim());
    releaseReason.value = "";
    releaseConfig.value = "{}";
    drawer.value = null;
    page.value.current = 1;
    emit("notice", "草稿版本已创建，可继续添加规则");
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "创建草稿失败");
  } finally {
    saving.value = false;
  }
};

const showDiff = async (release: ConfigRelease) => {
  try {
    selectedRelease.value = release;
    selectedDiff.value = await getReleaseDiff(release.releaseId);
    drawer.value = "diff";
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "差异加载失败");
  }
};

const runAction = async (reason: string) => {
  const current = pending.value;
  pending.value = null;
  if (!current || !reason) return;
  saving.value = true;
  try {
    await transitionRelease(current.release.releaseId, current.action, reason);
    emit("notice", `${actionLabels[current.action]}完成`);
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "版本操作失败");
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <section class="workspace-panel configuration-center">
    <div class="panel-title">
      <div><span class="eyebrow">RELEASE CONTROL</span><h3>版本发布</h3></div>
      <div class="button-row">
        <button v-if="canCreate" class="primary-btn" type="button" @click="drawer = 'create'"><Plus :size="16" />创建草稿</button>
        <button class="icon-btn" type="button" title="刷新" :disabled="loading" @click="load"><RefreshCw :class="{ spin: loading }" :size="16" /></button>
      </div>
    </div>

    <div class="configuration-summary-grid">
      <article class="configuration-summary-card"><span>版本总数</span><strong>{{ page.total }}</strong><small>包含历史发布版本</small></article>
      <article class="configuration-summary-card"><span>当前页草稿</span><strong>{{ releases.filter((item) => item.status === 'DRAFT').length }}</strong><small>可继续调整规则</small></article>
      <article class="configuration-summary-card"><span>待审核</span><strong>{{ releases.filter((item) => item.status === 'IN_REVIEW').length }}</strong><small>等待管理员审批</small></article>
      <article class="configuration-summary-card"><span>已发布</span><strong>{{ releases.filter((item) => item.status === 'PUBLISHED').length }}</strong><small>当前页正式版本</small></article>
    </div>

    <div class="section-heading"><div><h4>配置版本</h4></div><span>{{ page.total }} 个版本</span></div>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!releases.length" class="empty">暂无发布版本</div>
    <div v-else class="configuration-table-wrap">
      <table class="data-table configuration-table">
        <thead><tr><th>版本</th><th>状态</th><th>创建信息</th><th>审批 / 发布时间</th><th class="actions">操作</th></tr></thead>
        <tbody>
          <tr v-for="item in releases" :key="item.releaseId">
            <td><strong>v{{ item.versionNo }}</strong><small class="table-subtext mono">{{ item.releaseId }}</small></td>
            <td><span class="status-badge" :class="'st-' + item.status.toLowerCase()">{{ item.status }}</span></td>
            <td>{{ item.createdBy }}<small class="table-subtext table-date">{{ item.createdAt }}</small></td>
            <td>{{ item.approvedBy || "--" }}<small class="table-subtext table-date">{{ item.publishedAt || "--" }}</small></td>
            <td class="actions">
              <button class="icon-btn" type="button" title="查看版本差异" @click="showDiff(item)"><FileDiff :size="16" /></button>
              <button v-if="canCreate && item.status === 'DRAFT'" class="icon-btn" type="button" title="提交审核" :disabled="saving" @click="pending = { release: item, action: 'submit' }"><Send :size="16" /></button>
              <button v-if="canApprove && item.status === 'IN_REVIEW'" class="icon-btn" type="button" title="审核通过" :disabled="saving" @click="pending = { release: item, action: 'approve' }"><Check :size="16" /></button>
              <button v-if="canApprove && item.status === 'APPROVED'" class="icon-btn" type="button" title="正式发布" :disabled="saving" @click="pending = { release: item, action: 'publish' }"><Send :size="16" /></button>
              <button v-if="canApprove && item.status === 'PUBLISHED'" class="icon-btn" type="button" title="回滚生成草稿" :disabled="saving" @click="pending = { release: item, action: 'rollback' }"><RotateCcw :size="16" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination :page="page.current" :page-size="page.pageSize" :total="page.total" noun="个版本" @change="(current) => { page.current = current; load(); }" />

    <AppDrawer v-if="drawer === 'create'" title="创建发布草稿" description="RELEASE CONTROL" @close="drawer = null">
      <form class="drawer-section" @submit.prevent="createDraft">
        <label class="settlement-lines-field"><span>创建原因</span><input v-model="releaseReason" maxlength="256" placeholder="说明本次配置调整的原因" required /></label>
        <label class="settlement-lines-field"><span>发布配置</span><textarea v-model="releaseConfig" rows="12" spellcheck="false" placeholder='{"description":"..."}' required /></label>
        <button class="primary-btn drawer-submit" type="submit" :disabled="saving">{{ saving ? "创建中" : "创建草稿" }}</button>
      </form>
    </AppDrawer>

    <AppDrawer v-if="drawer === 'diff' && selectedRelease" :title="`版本 v${selectedRelease.versionNo} 差异`" description="CONFIGURATION DIFF" @close="drawer = null">
      <pre class="release-diff">{{ JSON.stringify(selectedDiff, null, 2) }}</pre>
    </AppDrawer>
    <AppDialog v-if="pending" :title="actionLabels[pending.action]" :message="`版本 v${pending.release.versionNo} · ${pending.release.releaseId}`" :confirm-text="actionLabels[pending.action]" :danger="pending.action === 'rollback'" input-placeholder="请输入操作原因" input-value="运营后台操作" @confirm="runAction" @cancel="pending = null" />
  </section>
</template>
