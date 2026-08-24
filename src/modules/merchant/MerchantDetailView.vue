<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, Pencil, RefreshCw, Trash2 } from "lucide-vue-next";
import {
  createMerchantContact,
  deleteMerchantContact,
  getMerchantCallback,
  getMerchantContacts,
  getMerchantCredentials,
  getMerchantProfile,
  revokeMerchantCredential,
  rotateMerchantCredential,
  updateMerchantContact,
  updateMerchantCallback,
  updateMerchantProfile,
  type Merchant,
  type MerchantCallback,
  type MerchantContact,
  type MerchantCredential,
  type MerchantProfile,
} from "./api";
import { hasPermission } from "../../auth";

const props = defineProps<{ merchant: Merchant }>();
const emit = defineEmits<{ back: []; notice: [message: string] }>();
const loading = ref(true);
const saving = ref(false);
const profile = ref<MerchantProfile>({
  merchantId: props.merchant.merchantId,
  legalName: props.merchant.name,
  registeredCountry: "",
  industry: "",
  riskLevel: "MEDIUM",
  taxIdentifier: "",
});
const callback = ref<MerchantCallback>({
  merchantId: props.merchant.merchantId,
  callbackUrl: "",
  eventTypes: "[]",
  status: "DISABLED",
});
const contacts = ref<MerchantContact[]>([]);
const editingContact = ref<MerchantContact | null>(null);
const credentials = ref<MerchantCredential[]>([]);
const contactForm = ref({
  contactType: "OPERATIONS",
  contactName: "",
  email: "",
  phone: "",
  notifyEnabled: true,
});

const load = async () => {
  loading.value = true;
  try {
    [profile.value, contacts.value, callback.value, credentials.value] =
      await Promise.all([
        getMerchantProfile(props.merchant.merchantId),
        getMerchantContacts(props.merchant.merchantId),
        getMerchantCallback(props.merchant.merchantId),
        getMerchantCredentials(props.merchant.merchantId),
      ]);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "商户详情加载失败");
  } finally {
    loading.value = false;
  }
};
const saveProfile = async () => {
  saving.value = true;
  try {
    profile.value = await updateMerchantProfile(props.merchant.merchantId, {
      legalName: profile.value.legalName,
      registeredCountry: profile.value.registeredCountry,
      industry: profile.value.industry,
      riskLevel: profile.value.riskLevel,
      taxIdentifier: profile.value.taxIdentifier,
    });
    emit("notice", "商户资料已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "商户资料保存失败");
  } finally {
    saving.value = false;
  }
};
const saveCallback = async () => {
  saving.value = true;
  try {
    callback.value = await updateMerchantCallback(props.merchant.merchantId, {
      callbackUrl: callback.value.callbackUrl,
      eventTypesJson: callback.value.eventTypes,
      status: callback.value.status,
    });
    emit("notice", "回调配置已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "回调配置保存失败");
  } finally {
    saving.value = false;
  }
};
const addContact = async () => {
  try {
    const contact = editingContact.value
      ? await updateMerchantContact(
          props.merchant.merchantId,
          editingContact.value.id,
          contactForm.value,
        )
      : await createMerchantContact(props.merchant.merchantId, contactForm.value);
    contacts.value = editingContact.value
      ? contacts.value.map((item) => (item.id === contact.id ? contact : item))
      : [contact, ...contacts.value];
    contactForm.value = {
      contactType: "OPERATIONS",
      contactName: "",
      email: "",
      phone: "",
      notifyEnabled: true,
    };
    editingContact.value = null;
    emit("notice", "联系人已保存");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "联系人新增失败");
  }
};
const editContact = (contact: MerchantContact) => {
  editingContact.value = contact;
  contactForm.value = {
    contactType: contact.contactType,
    contactName: contact.contactName,
    email: contact.email || "",
    phone: contact.phone || "",
    notifyEnabled: contact.notifyEnabled,
  };
};
const deleteContact = async (contact: MerchantContact) => {
  if (!window.confirm(`确认删除联系人“${contact.contactName}”？`)) return;
  try {
    await deleteMerchantContact(props.merchant.merchantId, contact.id);
    contacts.value = contacts.value.filter((item) => item.id !== contact.id);
    if (editingContact.value?.id === contact.id) editingContact.value = null;
    emit("notice", "联系人已删除");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "联系人删除失败");
  }
};
const rotate = async () => {
  try {
    const result = await rotateMerchantCredential(
      props.merchant.merchantId,
      "API",
    );
    credentials.value = await getMerchantCredentials(props.merchant.merchantId);
    emit("notice", `凭证已轮换，新密钥仅显示一次：${result.secret}`);
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "凭证轮换失败");
  }
};
const revoke = async (credential: MerchantCredential) => {
  try {
    await revokeMerchantCredential(
      props.merchant.merchantId,
      credential.credentialId,
    );
    credential.status = "REVOKED";
    emit("notice", "凭证已撤销");
  } catch (error) {
    emit("notice", error instanceof Error ? error.message : "凭证撤销失败");
  }
};
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel merchant-detail-view">
    <div class="panel-title">
      <div>
        <span class="eyebrow">MERCHANT DETAIL</span>
        <h3>{{ merchant.name }}</h3>
        <small>{{ merchant.merchantId }} · {{ merchant.status }}</small>
      </div>
      <div class="button-row">
        <button class="icon-btn" title="刷新详情" @click="load">
          <RefreshCw :size="16" /></button
        ><button class="outline-btn" @click="emit('back')">返回列表</button>
      </div>
    </div>
    <div v-if="loading" class="empty">
      <LoaderCircle class="spin" :size="22" />加载中…
    </div>
    <template v-else>
      <div class="detail-grid">
        <article class="detail-panel">
          <div class="panel-title">
            <h4>基础资料</h4>
            <button class="primary-btn" :disabled="saving" @click="saveProfile">
              保存资料
            </button>
          </div>
          <div class="form-grid">
            <input v-model="profile.legalName" placeholder="法定名称" /><input
              v-model="profile.registeredCountry"
              placeholder="注册国家"
            /><input v-model="profile.industry" placeholder="行业" /><select
              v-model="profile.riskLevel"
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option></select
            ><input v-model="profile.taxIdentifier" placeholder="税务识别号" />
          </div>
        </article>
        <article class="detail-panel">
          <div class="panel-title">
            <h4>回调配置</h4>
            <button
              class="primary-btn"
              :disabled="saving"
              @click="saveCallback"
            >
              保存配置
            </button>
          </div>
          <div class="form-grid">
            <input
              v-model="callback.callbackUrl"
              placeholder="回调地址"
            /><input
              v-model="callback.eventTypes"
              placeholder="事件 JSON，例如 PAYMENT_SUCCEEDED"
            /><select v-model="callback.status">
              <option>ACTIVE</option>
              <option>DISABLED</option>
            </select>
          </div>
        </article>
      </div>
      <div class="detail-grid">
        <article class="detail-panel">
          <div class="panel-title">
            <h4>联系人</h4>
            <button v-if="hasPermission('merchant:contact:update')" class="primary-btn" @click="addContact">{{ editingContact ? "保存联系人" : "新增联系人" }}</button>
          </div>
          <div class="form-grid">
            <select v-model="contactForm.contactType"><option>OPERATIONS</option><option>FINANCE</option><option>TECHNICAL</option><option>LEGAL</option></select><input
              v-model="contactForm.contactName"
              placeholder="联系人姓名"
            /><input v-model="contactForm.email" placeholder="邮箱" /><input
              v-model="contactForm.phone"
              placeholder="电话"
            /><label class="menu-visible"><input v-model="contactForm.notifyEnabled" type="checkbox" />启用通知</label>
          </div>
          <div v-for="contact in contacts" :key="contact.id" class="record-row">
            <div>
              <strong>{{ contact.contactName }}</strong
              ><small
                >{{ contact.contactType }} ·
                {{ contact.email || contact.phone || "--" }}</small
              >
            </div>
            <b>{{ contact.notifyEnabled ? "通知" : "不通知" }}</b><div v-if="hasPermission('merchant:contact:update')" class="button-row"><button class="icon-btn" title="编辑联系人" @click="editContact(contact)"><Pencil :size="16" /></button><button class="icon-btn" title="删除联系人" @click="deleteContact(contact)"><Trash2 :size="16" /></button></div>
          </div>
          <div v-if="!contacts.length" class="empty">暂无联系人</div>
        </article>
        <article class="detail-panel">
          <div class="panel-title">
            <h4>API 凭证</h4>
            <button class="outline-btn" @click="rotate">轮换 API 凭证</button>
          </div>
          <div
            v-for="credential in credentials"
            :key="credential.credentialId"
            class="record-row"
          >
            <div>
              <strong>{{ credential.credentialType }}</strong
              ><small
                >{{ credential.secretHint }} ·
                {{ credential.createdAt || "--" }}</small
              >
            </div>
            <b>{{ credential.status }}</b
            ><button
              v-if="credential.status === 'ACTIVE'"
              class="danger-btn"
              @click="revoke(credential)"
            >
              撤销
            </button>
          </div>
          <div v-if="!credentials.length" class="empty">暂无凭证</div>
        </article>
      </div>
    </template>
  </section>
</template>
