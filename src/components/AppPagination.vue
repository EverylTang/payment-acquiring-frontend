<script setup lang="ts">
import { computed, ref } from "vue";
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

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

// 汇总信息输出为单个文本节点,preferences.ts 的 DOM 级翻译正则(第 X / Y 页,共 N …)才能整句匹配。
const summary = computed(() =>
  `第 ${Math.min(Math.max(1, props.page), pageCount.value)} / ${pageCount.value} 页，共 ${props.total} ${props.noun}`,
);

// 页码窗口:首、尾、当前页 ±1,间隙以省略号占位(最多 5 个页码按钮 + 2 个省略号)。
const slots = computed<(number | "gap")[]>(() => {
  const total = pageCount.value;
  const current = Math.min(Math.max(1, props.page), total);
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const visible = new Set([1, total]);
  for (let p = current - 1; p <= current + 1; p += 1) if (p > 1 && p < total) visible.add(p);
  const ordered = [...visible].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  ordered.forEach((p, i) => {
    if (i > 0 && p - ordered[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
});

const jumpDraft = ref("");
const go = (page: number) => {
  const next = Math.min(Math.max(1, page), pageCount.value);
  if (next !== props.page) emit("change", next);
};
const applyJump = () => {
  const target = Number.parseInt(jumpDraft.value, 10);
  jumpDraft.value = "";
  if (Number.isFinite(target)) go(target);
};
const onSizeChange = (event: Event) => {
  const size = Number((event.target as HTMLSelectElement).value);
  if (Number.isFinite(size) && size > 0) emit("sizeChange", size);
};
</script>

<template>
  <nav class="app-pagination" aria-label="分页">
    <span class="pagination-summary">{{ summary }}</span>
    <select class="pagination-sizes" :value="pageSize" aria-label="每页条数" @change="onSizeChange">
      <option v-if="!pageSizes.includes(pageSize)" :value="pageSize">{{ pageSize }} 条/页</option>
      <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} 条/页</option>
    </select>
    <button class="pagination-arrow" type="button" title="上一页" :disabled="page <= 1" @click="go(page - 1)">
      <ChevronLeft :size="15" />
    </button>
    <template v-for="(slot, index) in slots" :key="index">
      <span v-if="slot === 'gap'" class="pagination-dots" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        class="pagination-page"
        :class="{ active: slot === page }"
        :aria-current="slot === page ? 'page' : undefined"
        @click="go(slot)"
      >{{ slot }}</button>
    </template>
    <button class="pagination-arrow" type="button" title="下一页" :disabled="page >= pageCount" @click="go(page + 1)">
      <ChevronRight :size="15" />
    </button>
    <span class="pagination-jump">前往<input v-model="jumpDraft" type="number" :min="1" :max="pageCount" aria-label="跳转页码" @keyup.enter="applyJump" @blur="applyJump" />页</span>
  </nav>
</template>

<style scoped>
/* 自绘分页(替代 ElPagination,省去 ~157KB 按需 chunk);样式随全局 token 走主题。 */
.app-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-height: 52px;
  padding-top: 16px;
  overflow-x: auto;
  color: var(--muted);
  font-size: 13px;
}
.app-pagination > * { flex: 0 0 auto; }
.pagination-summary { margin-right: 4px; white-space: nowrap; }
.pagination-sizes {
  height: 30px;
  min-width: 88px;
  padding: 0 8px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--inset-field);
  font: inherit;
  font-size: 12px;
}
.pagination-sizes:hover { border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.pagination-page,
.pagination-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--paper);
  font: inherit;
  font-variant-numeric: tabular-nums;
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.pagination-page:hover:not(.active),
.pagination-arrow:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.pagination-page.active { border-color: var(--accent); color: var(--paper); background: var(--accent); font-weight: 600; }
.pagination-arrow:disabled { opacity: .45; cursor: not-allowed; }
.pagination-dots { width: 22px; text-align: center; color: var(--muted-light); }
.pagination-jump { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; white-space: nowrap; }
.pagination-jump input {
  width: 52px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--line-dark);
  border-radius: 4px;
  color: var(--ink-soft);
  background: var(--inset-field);
  font: inherit;
  font-size: 12px;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}
.pagination-jump input::-webkit-outer-spin-button,
.pagination-jump input::-webkit-inner-spin-button { margin: 0; appearance: none; -webkit-appearance: none; }
.pagination-jump input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent); }
@media (max-width: 700px) { .app-pagination { justify-content: center; } }
</style>
