<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, Pencil, Plus, RefreshCw, Save, ToggleLeft } from "lucide-vue-next";
import {
  changeProductCapabilityStatus,
  changeProductStatus,
  createProduct,
  createProductCapability,
  getProductCapabilities,
  getProducts,
  updateProduct,
  updateProductCapability,
  type Product,
  type ProductCapability,
} from "./api";
import { hasPermission } from "../../auth";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const products = ref<Product[]>([]);
const capabilities = ref<ProductCapability[]>([]);
const selected = ref<Product | null>(null);
const editingCapability = ref<ProductCapability | null>(null);
const page = ref({ current: 1, pageSize: 20, total: 0 });
const capabilityPage = ref({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const saving = ref(false);
const form = ref({ productCode: "", name: "" });
const capabilityForm = ref({ country: "US", currency: "USD", paymentMethod: "CARD", minAmount: 0.01, maxAmount: 100000, supportsRefund: true });

const load = async (current = page.value.current) => {
  loading.value = true;
  try {
    const result = await getProducts({ page: current, pageSize: page.value.pageSize });
    products.value = result.items;
    page.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品加载失败");
  } finally {
    loading.value = false;
  }
};
const loadCapabilities = async (product: Product, current = capabilityPage.value.current) => {
  selected.value = product;
  const result = await getProductCapabilities(product.productCode, {
    page: current,
    pageSize: capabilityPage.value.pageSize,
  });
  capabilities.value = result.items;
  capabilityPage.value = { current: result.page, pageSize: result.pageSize, total: result.total };
};
const save = async () => {
  saving.value = true;
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
  } finally {
    saving.value = false;
  }
};
const edit = async (product: Product) => {
  form.value = { productCode: product.productCode, name: product.name };
  await loadCapabilities(product, 1);
};
const toggle = async (product: Product) => {
  try {
    Object.assign(product, await changeProductStatus(product.productCode, product.status === "ACTIVE" ? "DISABLED" : "ACTIVE"));
    emit("notice", "产品状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品状态更新失败");
  }
};
const editCapability = (capability: ProductCapability) => {
  editingCapability.value = capability;
  capabilityForm.value = {
    country: capability.country,
    currency: capability.currency,
    paymentMethod: capability.paymentMethod,
    minAmount: capability.minAmount,
    maxAmount: capability.maxAmount,
    supportsRefund: capability.supportsRefund,
  };
};
const saveCapability = async () => {
  if (!selected.value) return;
  saving.value = true;
  try {
    const wasEditing = Boolean(editingCapability.value);
    await (editingCapability.value
      ? await updateProductCapability(selected.value.productCode, editingCapability.value.capabilityId, capabilityForm.value)
      : await createProductCapability(selected.value.productCode, capabilityForm.value));
    editingCapability.value = null;
    capabilityForm.value = { country: "US", currency: "USD", paymentMethod: "CARD", minAmount: 0.01, maxAmount: 100000, supportsRefund: true };
    await loadCapabilities(selected.value, wasEditing ? capabilityPage.value.current : 1);
    emit("notice", "产品能力已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品能力保存失败");
  } finally {
    saving.value = false;
  }
};
const toggleCapability = async (capability: ProductCapability) => {
  if (!selected.value) return;
  try {
    const result = await changeProductCapabilityStatus(selected.value.productCode, capability.capabilityId, capability.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
    capabilities.value = capabilities.value.map((item) => item.capabilityId === result.capabilityId ? result : item);
    emit("notice", "产品能力状态已更新");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "产品能力状态更新失败");
  }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-title"><div><span class="eyebrow">PRODUCTS</span><h3>产品管理</h3></div><button class="outline-btn" @click="load()"><RefreshCw :size="16" />刷新</button></div>
    <div class="form-grid"><input v-model="form.productCode" :disabled="!!selected" placeholder="产品编码" /><input v-model="form.name" placeholder="产品名称" /><button v-if="hasPermission(selected ? 'product:update' : 'product:create')" class="primary-btn" :disabled="saving" @click="save"><Save :size="16" />{{ selected ? "保存产品" : "新增产品" }}</button></div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <div v-else class="record-list"><div v-for="product in products" :key="product.productCode" class="record-row"><div><strong>{{ product.name }}</strong><small>{{ product.productCode }}</small></div><span class="status-badge" :class="'st-' + product.status.toLowerCase()">{{ product.status }}</span><div class="button-row"><button v-if="hasPermission('product:update')" class="icon-btn" title="编辑产品及能力" @click="edit(product)"><Pencil :size="16" /></button><button v-if="hasPermission('product:status')" class="icon-btn" title="切换产品状态" @click="toggle(product)"><ToggleLeft :size="16" /></button></div></div></div>
    <div v-if="page.total > page.pageSize" class="pagination"><button class="outline-btn" :disabled="page.current <= 1" @click="load(page.current - 1)">上一页</button><span>第 {{ page.current }} / {{ Math.ceil(page.total / page.pageSize) }} 页，共 {{ page.total }} 个产品</span><button class="outline-btn" :disabled="page.current >= Math.ceil(page.total / page.pageSize)" @click="load(page.current + 1)">下一页</button></div>
    <div v-if="selected" class="detail-panel">
      <div class="panel-title"><div><span class="eyebrow">PRODUCT CAPABILITIES</span><h4>{{ selected.productCode }}</h4></div><button class="outline-btn" @click="selected = null">关闭</button></div>
      <div class="capability-form"><input v-model="capabilityForm.country" placeholder="国家" /><input v-model="capabilityForm.currency" maxlength="3" placeholder="币种" /><input v-model="capabilityForm.paymentMethod" placeholder="支付方式" /><input v-model.number="capabilityForm.minAmount" type="number" min="0.01" step="0.01" placeholder="最小金额" /><input v-model.number="capabilityForm.maxAmount" type="number" min="0.01" step="0.01" placeholder="最大金额" /><label class="menu-visible"><input v-model="capabilityForm.supportsRefund" type="checkbox" />支持退款</label><button class="primary-btn" :disabled="saving" @click="saveCapability"><Plus v-if="!editingCapability" :size="16" /><Save v-else :size="16" />{{ editingCapability ? "保存能力" : "新增能力" }}</button></div>
      <div v-if="!capabilities.length" class="empty">暂无产品能力</div>
      <div v-else class="record-list"><div v-for="capability in capabilities" :key="capability.capabilityId" class="record-row"><div><strong>{{ capability.paymentMethod }} · {{ capability.country }}/{{ capability.currency }}</strong><small>{{ capability.minAmount }} - {{ capability.maxAmount }} · {{ capability.supportsRefund ? "支持退款" : "不支持退款" }}</small></div><span class="status-badge" :class="'st-' + capability.status.toLowerCase()">{{ capability.status }}</span><div class="button-row"><button class="icon-btn" title="编辑能力" @click="editCapability(capability)"><Pencil :size="16" /></button><button class="icon-btn" title="切换能力状态" @click="toggleCapability(capability)"><ToggleLeft :size="16" /></button></div></div></div>
      <AppPagination :page="capabilityPage.current" :page-size="capabilityPage.pageSize" :total="capabilityPage.total" noun="项能力" @change="(current) => selected && loadCapabilities(selected, current)" />
    </div>
  </section>
</template>
