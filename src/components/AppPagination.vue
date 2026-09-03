<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
}>(), {
  noun: "条记录",
});

const emit = defineEmits<{ change: [page: number] }>();
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>

<template>
  <div v-if="total > pageSize" class="pagination">
    <button class="outline-btn" :disabled="page <= 1" @click="emit('change', page - 1)">
      上一页
    </button>
    <span>第 {{ page }} / {{ totalPages }} 页，共 {{ total }} {{ noun }}</span>
    <button class="outline-btn" :disabled="page >= totalPages" @click="emit('change', page + 1)">
      下一页
    </button>
  </div>
</template>
