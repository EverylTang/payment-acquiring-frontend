<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, RefreshCw } from "lucide-vue-next";
import {
  changeProductStatus,
  createProduct,
  getProductCapabilities,
  getProducts,
  updateProduct,
  type Product,
  type ProductCapability,
} from "./api";
import { hasPermission } from "./auth";
const emit = defineEmits<{ notice: [message: string] }>();
const products = ref<Product[]>([]);
const capabilities = ref<ProductCapability[]>([]);
const selected = ref<Product | null>(null);
const loading = ref(false);
const form = ref({ productCode: "", name: "" });
const load = async () => {
  loading.value = true;
  try {
    products.value = (await getProducts()).items;
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品加载失败");
  } finally {
    loading.value = false;
  }
};
const save = async () => {
  try {
    const editing = selected.value;
    const result = editing
      ? await updateProduct(editing.productCode, { name: form.value.name })
      : await createProduct(form.value);
    emit("notice", editing ? "产品已更新" : "产品已创建");
    selected.value = null;
    form.value = { productCode: "", name: "" };
    if (!editing) products.value = [result, ...products.value];
    await load();
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品保存失败");
  }
};
const edit = async (product: Product) => {
  selected.value = product;
  form.value = { productCode: product.productCode, name: product.name };
  capabilities.value = (
    await getProductCapabilities(product.productCode)
  ).items;
};
const toggle = async (product: Product) => {
  try {
    Object.assign(
      product,
      await changeProductStatus(
        product.productCode,
        product.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      ),
    );
    emit("notice", "产品状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品状态更新失败");
  }
};
onMounted(load);
</script>
<template>
  <section class="panel workspace-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">PRODUCTS</span>
        <h3>产品管理</h3>
      </div>
      <button class="outline-btn" @click="load">
        <RefreshCw :size="16" />刷新
      </button>
    </div>
    <div class="form-grid">
      <input
        v-model="form.productCode"
        :disabled="!!selected"
        placeholder="产品编码"
      /><input v-model="form.name" placeholder="产品名称" /><button
        v-if="hasPermission(selected ? 'product:update' : 'product:create')"
        class="primary-btn"
        @click="save"
      >
        {{ selected ? "保存编辑" : "新增产品" }}
      </button>
    </div>
    <div v-if="loading" class="empty">
      <LoaderCircle class="spin" :size="22" />加载中…
    </div>
    <div v-else class="record-list">
      <div
        v-for="product in products"
        :key="product.productCode"
        class="record-row"
      >
        <div>
          <strong>{{ product.name }}</strong
          ><small>{{ product.productCode }}</small>
        </div>
        <span class="status-badge">{{ product.status }}</span
        ><button
          v-if="hasPermission('product:update')"
          class="outline-btn"
          @click="edit(product)"
        >
          编辑</button
        ><button
          v-if="hasPermission('product:status')"
          class="outline-btn"
          @click="toggle(product)"
        >
          {{ product.status === "ACTIVE" ? "停用" : "启用" }}
        </button>
      </div>
    </div>
    <div v-if="selected" class="detail-panel">
      <h4>产品能力（{{ selected.productCode }}）</h4>
      <div
        v-for="capability in capabilities"
        :key="capability.capabilityId"
        class="record-row"
      >
        <div>
          <strong
            >{{ capability.paymentMethod }} · {{ capability.country }}/{{
              capability.currency
            }}</strong
          ><small
            >{{ capability.minAmount }} - {{ capability.maxAmount }}</small
          >
        </div>
        <span class="status-badge">{{ capability.status }}</span>
      </div>
    </div>
  </section>
</template>
