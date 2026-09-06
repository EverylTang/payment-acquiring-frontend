<script setup lang="ts">
import { ElPagination } from "element-plus";

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
</script>

<template>
  <div class="app-pagination">
    <ElPagination
      background
      layout="total, sizes, prev, pager, next, jumper"
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :total="total"
      :hide-on-single-page="false"
      @current-change="emit('change', $event)"
      @size-change="emit('sizeChange', $event)"
    />
  </div>
</template>
