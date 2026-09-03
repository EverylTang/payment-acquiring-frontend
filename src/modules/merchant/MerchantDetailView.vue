<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ArrowLeft, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-vue-next";
import { hasPermission } from "../../auth";
import AppDialog from "../../components/AppDialog.vue";
import { createMerchantContact, deleteMerchantContact, getMerchantContacts, getMerchantCredentials, getMerchantProfile, revokeMerchantCredential, rotateMerchantCredential, updateMerchantContact, updateMerchantProfile, type Merchant, type MerchantContact, type MerchantCredential, type MerchantProfile } from "./api";

type DetailSection = "profile" | "contacts" | "credentials";
const props = withDefaults(defineProps<{ merchant: Merchant; section?: DetailSection }>(), { section: "profile" });
const emit = defineEmits<{ back: []; notice: [message: string] }>();
const loading = ref(true);
const saving = ref(false);
const confirmDelete = ref<MerchantContact | null>(null);
const editingContact = ref<MerchantContact | null>(null);
const contacts = ref<MerchantContact[]>([]);
const credentials = ref<MerchantCredential[]>([]);
const profile = ref<MerchantProfile>({ merchantId: props.merchant.merchantId, legalName: props.merchant.name, businessType: "COMPANY", registeredCountry: "", industry: "", businessUrl: "", productDescription: "", statementDescriptor: "", supportEmail: "", supportPhone: "", supportUrl: "", addressLine1: "", addressLine2: "", addressCity: "", addressState: "", addressPostalCode: "", riskLevel: "MEDIUM", taxIdentifier: "" });
const contactForm = ref({ contactType: "OPERATIONS", contactName: "", email: "", phone: "", notifyEnabled: true });
const contactTypeOptions = [
  { value: "OPERATIONS", label: "运营联系人" },
  { value: "FINANCE", label: "财务联系人" },
  { value: "TECHNICAL", label: "技术联系人" },
  { value: "LEGAL", label: "法务联系人" },
];
const contactTypeLabel = (value: string) =>
  contactTypeOptions.find((item) => item.value === value)?.label || value;
const meta = computed(() => ({
  profile: ["商户资料", "业务、法定主体、客户支持与注册地址"], contacts: ["商户联系人", "运营、财务、技术和法务联系人"],
  credentials: ["API 凭证", "用于商户服务端接入的凭证管理"],
}[props.section]));
const canEditProfile = computed(() => hasPermission("merchant:profile:update"));
const canEditContacts = computed(() => hasPermission("merchant:contact:update"));
const canRotateCredential = computed(() => hasPermission("merchant:credential:rotate"));
const canRevokeCredential = computed(() => hasPermission("merchant:credential:revoke"));

const load = async () => {
  loading.value = true;
  try {
    if (props.section === "profile") profile.value = await getMerchantProfile(props.merchant.merchantId);
    if (props.section === "contacts") contacts.value = await getMerchantContacts(props.merchant.merchantId);
    if (props.section === "credentials") credentials.value = await getMerchantCredentials(props.merchant.merchantId);
  } catch (error) { emit("notice", error instanceof Error ? error.message : `${meta.value[0]}加载失败`); }
  finally { loading.value = false; }
};
const saveProfile = async () => {
  saving.value = true;
  try {
    profile.value = await updateMerchantProfile(props.merchant.merchantId, { legalName: profile.value.legalName, businessType: profile.value.businessType, registeredCountry: profile.value.registeredCountry, industry: profile.value.industry, businessUrl: profile.value.businessUrl, productDescription: profile.value.productDescription, statementDescriptor: profile.value.statementDescriptor, supportEmail: profile.value.supportEmail, supportPhone: profile.value.supportPhone, supportUrl: profile.value.supportUrl, addressLine1: profile.value.addressLine1, addressLine2: profile.value.addressLine2, addressCity: profile.value.addressCity, addressState: profile.value.addressState, addressPostalCode: profile.value.addressPostalCode, riskLevel: profile.value.riskLevel, taxIdentifier: profile.value.taxIdentifier });
    emit("notice", "商户资料已保存");
  } catch (error) { emit("notice", error instanceof Error ? error.message : "商户资料保存失败"); }
  finally { saving.value = false; }
};
const resetContactForm = () => { editingContact.value = null; contactForm.value = { contactType: "OPERATIONS", contactName: "", email: "", phone: "", notifyEnabled: true }; };
const saveContact = async () => {
  try { const saved = editingContact.value ? await updateMerchantContact(props.merchant.merchantId, editingContact.value.id, contactForm.value) : await createMerchantContact(props.merchant.merchantId, contactForm.value); contacts.value = editingContact.value ? contacts.value.map((item) => item.id === saved.id ? saved : item) : [saved, ...contacts.value]; resetContactForm(); emit("notice", "联系人已保存"); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "联系人保存失败"); }
};
const editContact = (contact: MerchantContact) => { editingContact.value = contact; contactForm.value = { contactType: contact.contactType, contactName: contact.contactName, email: contact.email || "", phone: contact.phone || "", notifyEnabled: contact.notifyEnabled }; };
const doDeleteContact = async () => {
  const contact = confirmDelete.value; confirmDelete.value = null; if (!contact) return;
  try { await deleteMerchantContact(props.merchant.merchantId, contact.id); contacts.value = contacts.value.filter((item) => item.id !== contact.id); emit("notice", "联系人已删除"); }
  catch (error) { emit("notice", error instanceof Error ? error.message : "联系人删除失败"); }
};
const rotate = async () => { try { const result = await rotateMerchantCredential(props.merchant.merchantId, "API"); credentials.value = await getMerchantCredentials(props.merchant.merchantId); emit("notice", `凭证已轮换，新密钥仅显示一次：${result.secret}`); } catch (error) { emit("notice", error instanceof Error ? error.message : "凭证轮换失败"); } };
const revoke = async (credential: MerchantCredential) => { try { await revokeMerchantCredential(props.merchant.merchantId, credential.credentialId); credential.status = "REVOKED"; emit("notice", "凭证已撤销"); } catch (error) { emit("notice", error instanceof Error ? error.message : "凭证撤销失败"); } };
onMounted(load);
</script>

<template>
  <section class="panel workspace-panel merchant-detail-view">
    <div class="panel-title detail-heading"><div><span class="eyebrow">MERCHANT / {{ section.toUpperCase() }}</span><h3>{{ meta[0] }}</h3><small>{{ merchant.name }} · {{ merchant.merchantId }} · {{ meta[1] }}</small></div><div class="button-row"><button class="icon-btn" title="刷新当前模块" @click="load"><RefreshCw :size="16" /></button><button class="outline-btn" @click="emit('back')"><ArrowLeft :size="15" />返回列表</button></div></div>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <template v-else>
      <article v-if="section === 'profile'" class="el-module-panel"><div class="module-header"><div><h4>业务与法定资料</h4><small>账单展示和合规审核信息</small></div><button v-if="canEditProfile" class="primary-btn" :disabled="saving" @click="saveProfile">保存资料</button></div><div class="el-form-grid"><label><span>法定名称</span><input v-model="profile.legalName" :disabled="!canEditProfile" /></label><label><span>主体类型</span><select v-model="profile.businessType" :disabled="!canEditProfile"><option value="COMPANY">公司</option><option value="INDIVIDUAL">个体经营者</option><option value="NON_PROFIT">非营利组织</option><option value="GOVERNMENT">政府机构</option></select></label><label><span>注册国家 / 地区</span><input v-model="profile.registeredCountry" :disabled="!canEditProfile" /></label><label><span>行业 / MCC</span><input v-model="profile.industry" :disabled="!canEditProfile" /></label><label class="full"><span>业务网站</span><input v-model="profile.businessUrl" :disabled="!canEditProfile" /></label><label class="full"><span>商品或服务描述</span><input v-model="profile.productDescription" :disabled="!canEditProfile" /></label><label><span>账单描述符</span><input v-model="profile.statementDescriptor" :disabled="!canEditProfile" /></label><label><span>风险等级</span><select v-model="profile.riskLevel" :disabled="!canEditProfile"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label><label><span>税务识别号</span><input v-model="profile.taxIdentifier" :disabled="!canEditProfile" /></label></div><div class="module-divider" /><div class="module-header compact"><div><h4>客户支持与注册地址</h4><small>支付方对外支持信息</small></div></div><div class="el-form-grid"><label><span>支持邮箱</span><input v-model="profile.supportEmail" :disabled="!canEditProfile" /></label><label><span>支持电话</span><input v-model="profile.supportPhone" :disabled="!canEditProfile" /></label><label class="full"><span>支持网站</span><input v-model="profile.supportUrl" :disabled="!canEditProfile" /></label><label class="full"><span>注册地址</span><input v-model="profile.addressLine1" :disabled="!canEditProfile" /></label><label class="full"><span>地址补充</span><input v-model="profile.addressLine2" :disabled="!canEditProfile" /></label><label><span>城市</span><input v-model="profile.addressCity" :disabled="!canEditProfile" /></label><label><span>省 / 州</span><input v-model="profile.addressState" :disabled="!canEditProfile" /></label><label><span>邮编</span><input v-model="profile.addressPostalCode" :disabled="!canEditProfile" /></label></div></article>
      <article v-else-if="section === 'contacts'" class="el-module-panel"><div class="module-header"><div><h4>{{ editingContact ? "编辑联系人" : "新增联系人" }}</h4><small>设置不同业务场景下的通知对象</small></div><button v-if="canEditContacts" class="primary-btn" @click="saveContact"><Plus v-if="!editingContact" :size="15" />{{ editingContact ? "保存联系人" : "新增联系人" }}</button></div><div class="el-form-grid"><label><span>联系人类型</span><select v-model="contactForm.contactType" :disabled="!canEditContacts"><option v-for="option in contactTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label><span>联系人姓名</span><input v-model="contactForm.contactName" :disabled="!canEditContacts" /></label><label><span>邮箱</span><input v-model="contactForm.email" :disabled="!canEditContacts" /></label><label><span>电话</span><input v-model="contactForm.phone" :disabled="!canEditContacts" /></label><label class="switch-field"><input v-model="contactForm.notifyEnabled" type="checkbox" :disabled="!canEditContacts" /><span>启用通知</span></label></div><div class="module-divider" /><div class="el-table-shell"><table class="data-table"><thead><tr><th>联系人</th><th>类型</th><th>联系方式</th><th>通知</th><th v-if="canEditContacts" class="actions">操作</th></tr></thead><tbody><tr v-for="contact in contacts" :key="contact.id"><td><strong>{{ contact.contactName }}</strong></td><td>{{ contactTypeLabel(contact.contactType) }}</td><td>{{ contact.email || contact.phone || "--" }}</td><td><span class="status-badge" :class="contact.notifyEnabled ? 'st-active' : 'st-disabled'">{{ contact.notifyEnabled ? "已启用" : "未启用" }}</span></td><td v-if="canEditContacts" class="actions"><button class="text-btn" @click="editContact(contact)"><Pencil :size="15" />编辑</button><button class="text-btn danger-text" @click="confirmDelete = contact"><Trash2 :size="15" />删除</button></td></tr><tr v-if="!contacts.length"><td :colspan="canEditContacts ? 5 : 4" class="merchant-empty">暂无联系人</td></tr></tbody></table></div></article>
      <article v-else class="el-module-panel"><div class="module-header"><div><h4>API 凭证</h4><small>新密钥只会在轮换完成后显示一次</small></div><button v-if="canRotateCredential" class="outline-btn" @click="rotate"><RotateCw :size="15" />轮换 API 凭证</button></div><div class="el-table-shell"><table class="data-table"><thead><tr><th>类型</th><th>密钥标识</th><th>创建时间</th><th>状态</th><th v-if="canRevokeCredential" class="actions">操作</th></tr></thead><tbody><tr v-for="credential in credentials" :key="credential.credentialId"><td><span class="credential-kind"><KeyRound :size="15" />{{ credential.credentialType }}</span></td><td class="mono">{{ credential.secretHint }}</td><td>{{ credential.createdAt || "--" }}</td><td><span class="status-badge" :class="'st-' + credential.status.toLowerCase()">{{ credential.status }}</span></td><td v-if="canRevokeCredential" class="actions"><button v-if="credential.status === 'ACTIVE'" class="text-btn danger-text" @click="revoke(credential)">撤销</button></td></tr><tr v-if="!credentials.length"><td :colspan="canRevokeCredential ? 5 : 4" class="merchant-empty">暂无凭证</td></tr></tbody></table></div></article>
    </template>
    <AppDialog v-if="confirmDelete" title="删除联系人" :message="`确认删除联系人“${confirmDelete.contactName}”？删除后不可恢复。`" confirm-text="确认删除" danger @confirm="doDeleteContact" @cancel="confirmDelete = null" />
  </section>
</template>

<style scoped>
.detail-heading { margin-bottom: 20px; }.detail-heading h3 { margin-bottom: 5px; }.detail-heading small { color: var(--muted); }.el-module-panel { border: 1px solid var(--line); border-radius: 6px; background: #fff; padding: 22px; }.module-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }.module-header h4 { margin: 0 0 5px; color: var(--ink); font-size: 15px; }.module-header small { color: var(--muted); font-size: 12px; }.module-header.compact { margin-bottom: 16px; }.module-divider { height: 1px; margin: 26px 0; background: var(--line); }.el-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.el-form-grid label { display: grid; gap: 7px; color: var(--ink-soft); font-size: 12px; }.el-form-grid label.full { grid-column: 1 / -1; }.el-form-grid input, .el-form-grid select { min-width: 0; height: 34px; border: 1px solid var(--line-dark); border-radius: 4px; background: #fff; }.el-form-grid input:disabled, .el-form-grid select:disabled { color: var(--ink-soft); background: var(--surface); cursor: not-allowed; }.switch-field { display: flex !important; align-items: center; gap: 8px !important; height: 34px; }.switch-field input { width: 15px; height: 15px; }.el-table-shell { overflow-x: auto; border: 1px solid var(--line); border-radius: 5px; }.el-table-shell .data-table { min-width: 680px; }.credential-kind { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-soft); }.callback-tip { display: flex; align-items: center; gap: 9px; margin-top: 20px; padding: 11px 12px; border: 1px solid rgba(8, 145, 178, .24); border-radius: 4px; color: var(--accent-dark); background: rgba(8, 145, 178, .06); font-size: 12px; }.primary-btn, .outline-btn, .text-btn { display: inline-flex; align-items: center; gap: 6px; } @media (max-width: 700px) { .detail-heading, .module-header { align-items: flex-start; flex-direction: column; }.el-module-panel { padding: 16px; }.el-form-grid { grid-template-columns: 1fr; }.el-form-grid label.full { grid-column: auto; } }
</style>
