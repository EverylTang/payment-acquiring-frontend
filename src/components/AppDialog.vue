<script setup lang="ts">
import { ref, watch } from "vue";
import { TriangleAlert, X } from "lucide-vue-next";

const props = defineProps<{
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
}>();
const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>();
const value = ref(props.inputValue ?? "");
watch(
  () => props.inputValue,
  (next) => (value.value = next ?? ""),
);
const confirm = () => {
  if (props.inputPlaceholder !== undefined && !value.value.trim()) return;
  emit("confirm", value.value.trim());
};
</script>

<template>
  <div class="dialog-mask" @click.self="emit('cancel')">
    <div class="dialog" role="dialog" :aria-label="title">
      <div class="dialog-head">
        <span class="dialog-icon" :class="{ danger }"><TriangleAlert :size="16" /></span>
        <h4>{{ title }}</h4>
        <button class="icon-btn" title="关闭" @click="emit('cancel')"><X :size="15" /></button>
      </div>
      <p v-if="message" class="dialog-message">{{ message }}</p>
      <input
        v-if="inputPlaceholder !== undefined"
        v-model="value"
        :placeholder="inputPlaceholder"
        autofocus
        @keyup.enter="confirm"
      />
      <div class="dialog-actions">
        <button class="outline-btn" @click="emit('cancel')">取消</button>
        <button :class="danger ? 'danger-btn' : 'primary-btn'" @click="confirm">
          {{ confirmText || "确认" }}
        </button>
      </div>
    </div>
  </div>
</template>
