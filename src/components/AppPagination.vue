<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

const props = withDefaults(defineProps<{
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
  pageSizes?: number[];
}>(), {
  noun: "条记录",
  pageSizes: () => [10, 20, 50, 100],
});

const emit = defineEmits<{
  change: [page: number];
  sizeChange: [pageSize: number];
}>();

const totalRecords = computed(() => Number.isFinite(props.total) ? Math.max(0, Math.floor(props.total)) : 0);
const currentSize = computed(() => Number.isFinite(props.pageSize) && props.pageSize > 0 ? Math.floor(props.pageSize) || 1 : 20);
const pageCount = computed(() => Math.max(1, Math.ceil(totalRecords.value / currentSize.value)));
const currentPage = computed(() => Number.isFinite(props.page) ? Math.min(Math.max(1, Math.floor(props.page)), pageCount.value) : 1);
const sizes = computed(() => [...new Set([currentSize.value, ...props.pageSizes])]
  .filter(size => Number.isInteger(size) && size > 0).sort((a, b) => a - b));

// 保持单个文本节点，供 preferences.ts 的整句翻译规则匹配。
const summary = computed(() =>
  `第 ${currentPage.value} / ${pageCount.value} 页，共 ${totalRecords.value} ${props.noun}`,
);

// 首尾页始终可达；靠近边界时补齐窗口，避免只有 1、2、…、末页。
const slots = computed<(number | "gap")[]>(() => {
  const total = pageCount.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const current = currentPage.value;
  if (current <= 4) return [1, 2, 3, 4, 5, "gap", total];
  if (current >= total - 3) return [1, "gap", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
});

const jumpDraft = ref("");
watch(() => [props.page, props.pageSize, props.total], () => { jumpDraft.value = ""; });
const go = (page: number) => {
  if (!Number.isInteger(page) || totalRecords.value === 0) return;
  const next = Math.min(Math.max(1, page), pageCount.value);
  if (next !== currentPage.value) emit("change", next);
};
const applyJump = () => {
  const draft = jumpDraft.value.trim();
  jumpDraft.value = "";
  if (/^\d+$/.test(draft)) go(Number(draft));
};
const onSizeChange = (event: Event) => {
  const size = Number((event.target as HTMLSelectElement).value);
  if (Number.isInteger(size) && size > 0 && size !== currentSize.value) emit("sizeChange", size);
};
</script>

<template>
  <nav class="app-pagination" aria-label="分页">
    <span class="pagination-summary" role="status" aria-live="polite">{{ summary }}</span>
    <select class="pagination-sizes" :value="currentSize" aria-label="每页条数" @change="onSizeChange">
      <option v-for="size in sizes" :key="size" :value="size">{{ size }} 条/页</option>
    </select>
    <div class="pagination-pages">
      <button class="pagination-arrow" type="button" title="上一页" aria-label="上一页" :disabled="currentPage <= 1" @click="go(currentPage - 1)">
        <ChevronLeft :size="15" />
      </button>
      <template v-for="(slot, index) in slots" :key="index">
        <span v-if="slot === 'gap'" class="pagination-dots" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="pagination-page"
          :class="{ active: slot === currentPage }"
          :aria-label="`第 ${slot} 页`"
          :aria-current="slot === currentPage ? 'page' : undefined"
          :disabled="totalRecords === 0"
          @click="go(slot)"
        >{{ slot }}</button>
      </template>
      <button class="pagination-arrow" type="button" title="下一页" aria-label="下一页" :disabled="currentPage >= pageCount" @click="go(currentPage + 1)">
        <ChevronRight :size="15" />
      </button>
    </div>
    <label class="pagination-jump">前往<input v-model="jumpDraft" type="text" inputmode="numeric" pattern="[0-9]*" aria-label="跳转页码" :disabled="pageCount <= 1" @keydown.enter.prevent="applyJump" @blur="applyJump" />页</label>
  </nav>
</template>

<style scoped>
.app-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 12px;
  min-width: 0;
  min-height: 52px;
  padding-top: 16px;
  color: var(--muted);
  font-size: 13px;
}
.pagination-summary { margin-right: auto; line-height: 1.6; }
.pagination-sizes {
  flex: 0 0 auto;
  width: auto;
  height: 32px;
  min-width: 96px;
  padding: 0 8px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--inset-field);
  font: inherit;
  font-size: 12px;
}
.pagination-pages { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; max-width: 100%; }
.pagination-page,
.pagination-arrow {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--paper);
  font: inherit;
  font-variant-numeric: tabular-nums;
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.pagination-page:hover:not(:disabled):not(.active),
.pagination-arrow:hover:not(:disabled),
.pagination-sizes:hover { border-color: var(--accent); color: var(--accent); }
.pagination-page.active { border-color: var(--accent); color: var(--accent-contrast, #fff); background: var(--accent); font-weight: 600; }
.pagination-page:disabled,
.pagination-arrow:disabled { opacity: .45; cursor: not-allowed; }
.pagination-dots { width: 18px; text-align: center; color: var(--muted); }
.pagination-jump { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.pagination-jump input {
  width: 52px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--inset-field);
  font: inherit;
  font-size: 12px;
  text-align: center;
}
.pagination-jump input:disabled { cursor: not-allowed; opacity: .45; }
.pagination-page:focus-visible,
.pagination-arrow:focus-visible,
.pagination-sizes:focus-visible,
.pagination-jump input:focus-visible { border-color: var(--accent); outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 700px) {
  .app-pagination { justify-content: center; }
  .pagination-summary { flex: 1 1 100%; margin-right: 0; text-align: center; }
}
@media (max-width: 460px) {
  .pagination-pages { gap: 2px; }
  .pagination-page, .pagination-arrow { min-width: 28px; }
  .pagination-dots { width: 12px; }
}
</style>
