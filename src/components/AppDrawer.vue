<script setup lang="ts">
import { X } from "lucide-vue-next";

defineProps<{
  title: string;
  description?: string;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="drawer-mask" @click.self="emit('close')">
    <div class="app-drawer" role="dialog" aria-modal="true" :aria-label="title">
      <div class="drawer-head">
        <div>
          <span v-if="description" class="eyebrow">{{ description }}</span>
          <h3>{{ title }}</h3>
        </div>
        <button class="icon-btn" title="关闭" @click="emit('close')"><X :size="17" /></button>
      </div>
      <div class="drawer-body"><slot /></div>
    </div>
  </div>
</template>
