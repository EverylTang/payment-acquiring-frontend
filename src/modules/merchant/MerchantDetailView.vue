<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArrowLeft, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-vue-next";
import { hasPermission } from "../../auth";
import AppDialog from "../../components/AppDialog.vue";
import { createMerchantContact, deleteMerchantContact, getMerchantContacts, getMerchantCredentials, getMerchantProfile, revokeMerchantCredential, rotateMerchantCredential, updateMerchantContact, updateMerchantProfile, type Merchant, type MerchantContact, type MerchantCredential, type MerchantCredentialType, type MerchantProfile, type RotatedCredential } from "./api";
import { getActiveCountries, type Country } from "../master-data/api";

type DetailSection = "profile" | "contacts" | "credentials";
const props = withDefaults(defineProps<{ merchant: Merchant; section?: DetailSection }>(), { section: "profile" });
const emit = defineEmits<{ back: []; notice: [message: string] }>();
const loading = ref(true);
const saving = ref(false);
const confirmDelete = ref<MerchantContact | null>(null);
const editingContact = ref<MerchantContact | null>(null);
const contacts = ref<MerchantContact[]>([]);
const credentials = ref<MerchantCredential[]>([]);
const countries = ref<Country[]>([]);
const countriesError = ref("");
const loadError = ref("");
const profileLoaded = ref(false);
const rotating = ref(false);
const credentialType = ref<MerchantCredentialType>("API");
const deliveredCredential = ref<RotatedCredential | null>(null);
const secretAcknowledged = ref(false);
const deliveryStatus = ref("");
const deliveryDialog = ref<HTMLElement | null>(null);
let countriesRequested = false;
let loadSequence = 0;
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
  credentials: ["API / WEBHOOK 凭证", "用于商户请求签名和异步通知验签的凭证管理"],
}[props.section]));
const canEditProfile = computed(() => hasPermission("merchant:profile:update"));
const canEditContacts = computed(() => hasPermission("merchant:contact:update"));
const canRotateCredential = computed(() => hasPermission("merchant:credential:rotate"));
const canRevokeCredential = computed(() => hasPermission("merchant:credential:revoke"));

const load = async () => {
  const sequence = ++loadSequence;
  const section = props.section;
  const merchantId = props.merchant.merchantId;
  loading.value = true;
  loadError.value = "";
  if (section === "profile") profileLoaded.value = false;
  try {
    if (section === "profile") { const result = await getMerchantProfile(merchantId); if (sequence === loadSequence) { profile.value = result; profileLoaded.value = true; } }
    if (section === "contacts") { const result = await getMerchantContacts(merchantId); if (sequence === loadSequence) contacts.value = result; }
    if (section === "credentials") { const result = await getMerchantCredentials(merchantId); if (sequence === loadSequence) credentials.value = result; }
  } catch (error) {
    if (sequence !== loadSequence) return;
    loadError.value = error instanceof Error ? error.message : `${meta.value[0]}加载失败`;
    emit("notice", loadError.value);
  }
  finally { if (sequence === loadSequence) loading.value = false; }
};
const loadCountries = async () => {
  if (props.section !== "profile" || !canEditProfile.value || !hasPermission("master-data:list") || countriesRequested) return;
  countriesRequested = true;
  try { countries.value = await getActiveCountries(); }
  catch { countriesError.value = "可选国家加载失败，已保留现有国家代码，不影响其他资料加载。"; }
};
const saveProfile = async () => {
  if (saving.value || !canEditProfile.value || !profileLoaded.value) return;
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
const rotate = async () => {
  if (rotating.value || deliveredCredential.value || !canRotateCredential.value) return;
  rotating.value = true;
  deliveryStatus.value = "";
  try {
    const result = await rotateMerchantCredential(props.merchant.merchantId, credentialType.value);
    // Hand off the one-time secret BEFORE attempting a fallible list refresh.
    deliveredCredential.value = result;
    secretAcknowledged.value = false;
    credentials.value = [
      { credentialId: result.credentialId, merchantId: props.merchant.merchantId, credentialType: result.credentialType, secretHint: "仅在交付弹窗中显示", status: "ACTIVE", createdAt: result.createdAt },
      ...credentials.value.map((item) => item.credentialType === result.credentialType && item.status === "ACTIVE" ? { ...item, status: "REVOKED" } : item),
    ];
    await nextTick();
    deliveryDialog.value?.focus();
    emit("notice", `${result.credentialType} 凭证已轮换，请在安全弹窗中保存 keyId 和一次性密钥`);
    try { credentials.value = await getMerchantCredentials(props.merchant.merchantId); }
    catch { deliveryStatus.value = "凭证已生成，但列表刷新失败。下方 keyId 和一次性密钥仍然有效，请先安全保存，切勿为刷新列表而再次轮换。"; }
  } catch (error) { emit("notice", error instanceof Error ? error.message : "凭证轮换失败"); }
  finally { rotating.value = false; }
};
const copyDelivery = async (field: "credentialId" | "secret") => {
  if (!deliveredCredential.value) return;
  try {
    await navigator.clipboard.writeText(deliveredCredential.value[field]);
    deliveryStatus.value = field === "secret" ? "密钥已复制，请存入安全的密钥管理系统，并注意清理剪贴板。" : "keyId 已复制。";
  } catch { deliveryStatus.value = "无法访问剪贴板，请手动选择并复制；密钥不会再次显示。"; }
};
const closeDelivery = () => {
  if (!secretAcknowledged.value) return;
  deliveredCredential.value = null;
  secretAcknowledged.value = false;
  deliveryStatus.value = "";
};
const trapDeliveryFocus = (event: KeyboardEvent) => {
  if (event.key !== "Tab" || !deliveryDialog.value) return;
  const elements = [...deliveryDialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
  const first = elements[0], last = elements[elements.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === deliveryDialog.value)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === deliveryDialog.value)) { event.preventDefault(); first?.focus(); }
};
const protectDelivery = (event: BeforeUnloadEvent) => { if (deliveredCredential.value) { event.preventDefault(); event.returnValue = ""; } };
const revoke = async (credential: MerchantCredential) => { if (!canRevokeCredential.value) return; try { await revokeMerchantCredential(props.merchant.merchantId, credential.credentialId); credential.status = "REVOKED"; emit("notice", "凭证已撤销"); } catch (error) { emit("notice", error instanceof Error ? error.message : "凭证撤销失败"); } };
onMounted(() => { void load(); void loadCountries(); window.addEventListener("beforeunload", protectDelivery); });
watch(() => [props.merchant.merchantId, props.section], () => { void load(); void loadCountries(); });
onBeforeUnmount(() => { loadSequence += 1; deliveredCredential.value = null; window.removeEventListener("beforeunload", protectDelivery); });
</script>

<template>
  <section class="panel workspace-panel merchant-detail-view">
    <div class="panel-title detail-heading"><div><span class="eyebrow">MERCHANT / {{ section.toUpperCase() }}</span><h3>{{ meta[0] }}</h3><small>{{ merchant.name }} · {{ merchant.merchantId }} · {{ meta[1] }}</small></div><div class="button-row"><button class="icon-btn" title="刷新当前模块" @click="load"><RefreshCw :size="16" /></button><button class="outline-btn" :disabled="!!deliveredCredential || rotating" @click="emit('back')"><ArrowLeft :size="15" />返回列表</button></div></div>
    <p v-if="loadError" class="detail-error" role="alert">加载失败：{{ loadError }}</p>
    <div v-if="loading" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
    <template v-else>
      <article v-if="section === 'profile'" class="el-module-panel"><div class="module-header"><div><h4>业务与法定资料</h4><small>账单展示和合规审核信息</small></div><button v-if="canEditProfile" class="primary-btn" :disabled="saving || !profileLoaded" @click="saveProfile">保存资料</button></div><p v-if="countriesError" class="detail-warning" role="status">{{ countriesError }}</p><div class="el-form-grid"><label><span>法定名称</span><input v-model="profile.legalName" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>主体类型</span><select v-model="profile.businessType" :disabled="!canEditProfile || !profileLoaded || saving"><option value="COMPANY">公司</option><option value="INDIVIDUAL">个体经营者</option><option value="NON_PROFIT">非营利组织</option><option value="GOVERNMENT">政府机构</option></select></label><label><span>注册国家 / 地区</span><select v-model="profile.registeredCountry" :disabled="!canEditProfile || !profileLoaded || saving"><option value="">请选择国家 / 地区</option><option v-if="profile.registeredCountry && !countries.some(country => country.code === profile.registeredCountry)" :value="profile.registeredCountry">{{ profile.registeredCountry }}</option><option v-for="country in countries" :key="country.code" :value="country.code">{{ country.name }} · {{ country.code }}</option></select></label><label><span>行业 / MCC</span><input v-model="profile.industry" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label class="full"><span>业务网站</span><input v-model="profile.businessUrl" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label class="full"><span>商品或服务描述</span><input v-model="profile.productDescription" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>账单描述符</span><input v-model="profile.statementDescriptor" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>风险等级</span><select v-model="profile.riskLevel" :disabled="!canEditProfile || !profileLoaded || saving"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label><label><span>税务识别号</span><input v-model="profile.taxIdentifier" :disabled="!canEditProfile || !profileLoaded || saving" /></label></div><div class="module-divider" /><div class="module-header compact"><div><h4>客户支持与注册地址</h4><small>支付方对外支持信息</small></div></div><div class="el-form-grid"><label><span>支持邮箱</span><input v-model="profile.supportEmail" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>支持电话</span><input v-model="profile.supportPhone" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label class="full"><span>支持网站</span><input v-model="profile.supportUrl" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label class="full"><span>注册地址</span><input v-model="profile.addressLine1" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label class="full"><span>地址补充</span><input v-model="profile.addressLine2" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>城市</span><input v-model="profile.addressCity" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>省 / 州</span><input v-model="profile.addressState" :disabled="!canEditProfile || !profileLoaded || saving" /></label><label><span>邮编</span><input v-model="profile.addressPostalCode" :disabled="!canEditProfile || !profileLoaded || saving" /></label></div></article>
      <article v-else-if="section === 'contacts'" class="el-module-panel"><div class="module-header"><div><h4>{{ editingContact ? "编辑联系人" : "新增联系人" }}</h4><small>设置不同业务场景下的通知对象</small></div><button v-if="canEditContacts" class="primary-btn" @click="saveContact"><Plus v-if="!editingContact" :size="15" />{{ editingContact ? "保存联系人" : "新增联系人" }}</button></div><div class="el-form-grid"><label><span>联系人类型</span><select v-model="contactForm.contactType" :disabled="!canEditContacts"><option v-for="option in contactTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label><span>联系人姓名</span><input v-model="contactForm.contactName" :disabled="!canEditContacts" /></label><label><span>邮箱</span><input v-model="contactForm.email" :disabled="!canEditContacts" /></label><label><span>电话</span><input v-model="contactForm.phone" :disabled="!canEditContacts" /></label><label class="switch-field"><input v-model="contactForm.notifyEnabled" type="checkbox" :disabled="!canEditContacts" /><span>启用通知</span></label></div><div class="module-divider" /><div class="el-table-shell"><table class="data-table"><thead><tr><th>联系人</th><th>类型</th><th>联系方式</th><th>通知</th><th v-if="canEditContacts" class="actions">操作</th></tr></thead><tbody><tr v-for="contact in contacts" :key="contact.id"><td><strong>{{ contact.contactName }}</strong></td><td>{{ contactTypeLabel(contact.contactType) }}</td><td>{{ contact.email || contact.phone || "--" }}</td><td><span class="status-badge" :class="contact.notifyEnabled ? 'st-active' : 'st-disabled'">{{ contact.notifyEnabled ? "已启用" : "未启用" }}</span></td><td v-if="canEditContacts" class="actions"><button class="text-btn" @click="editContact(contact)"><Pencil :size="15" />编辑</button><button class="text-btn danger-text" @click="confirmDelete = contact"><Trash2 :size="15" />删除</button></td></tr><tr v-if="!contacts.length"><td :colspan="canEditContacts ? 5 : 4" class="merchant-empty">暂无联系人</td></tr></tbody></table></div></article>
      <article v-else class="el-module-panel">
        <div class="module-header"><div><h4>API / WEBHOOK 凭证</h4><small>轮换会撤销同类型的旧凭证；新密钥仅在安全弹窗中交付一次。</small></div><div v-if="canRotateCredential" class="button-row"><label class="credential-type-selector"><span>凭证类型</span><select v-model="credentialType" :disabled="rotating || !!deliveredCredential" aria-label="凭证类型"><option value="API">API</option><option value="WEBHOOK">WEBHOOK</option></select></label><button class="outline-btn" :disabled="rotating || !!deliveredCredential" @click="rotate"><RotateCw :size="15" />{{ rotating ? '轮换中…' : `轮换 ${credentialType} 凭证` }}</button></div></div>
        <div class="el-table-shell"><table class="data-table"><thead><tr><th>类型</th><th>凭证 ID / keyId</th><th>密钥提示</th><th>创建时间</th><th>状态</th><th v-if="canRevokeCredential" class="actions">操作</th></tr></thead><tbody><tr v-for="credential in credentials" :key="credential.credentialId"><td><span class="credential-kind"><KeyRound :size="15" />{{ credential.credentialType }}</span></td><td class="mono">{{ credential.credentialId }}</td><td class="mono">{{ credential.secretHint }}</td><td>{{ credential.createdAt || "--" }}</td><td><span class="status-badge" :class="'st-' + credential.status.toLowerCase()">{{ credential.status }}</span></td><td v-if="canRevokeCredential" class="actions"><button v-if="credential.status === 'ACTIVE'" class="text-btn danger-text" @click="revoke(credential)">撤销</button></td></tr><tr v-if="!credentials.length"><td :colspan="canRevokeCredential ? 6 : 5" class="merchant-empty">暂无凭证</td></tr></tbody></table></div>
      </article>
    </template>
    <Teleport to="body">
      <div v-if="deliveredCredential" class="dialog-mask credential-delivery-mask" @keydown.esc.prevent.stop @keydown="trapDeliveryFocus">
        <section ref="deliveryDialog" class="dialog credential-delivery" role="dialog" aria-modal="true" aria-labelledby="credential-delivery-title" aria-describedby="credential-delivery-warning" tabindex="-1">
          <h4 id="credential-delivery-title">{{ deliveredCredential.credentialType }} 一次性凭证交付</h4>
          <p id="credential-delivery-warning">请立即将 keyId 和密钥存入安全的密钥管理系统。关闭后无法再次查看密钥；不要将密钥写入日志、URL 或普通说明。API 与 WEBHOOK 密钥不能混用。</p>
          <label class="delivery-field"><span>凭证 ID / keyId（API 请求头 X-Merchant-Key-Id）</span><code tabindex="0">{{ deliveredCredential.credentialId }}</code><button type="button" class="outline-btn" @click="copyDelivery('credentialId')">复制 keyId</button></label>
          <label class="delivery-field"><span>一次性密钥 / secret</span><code tabindex="0">{{ deliveredCredential.secret }}</code><button type="button" class="outline-btn" @click="copyDelivery('secret')">复制密钥</button></label>
          <p v-if="deliveryStatus" class="detail-warning" role="status">{{ deliveryStatus }}</p>
          <label class="delivery-acknowledgement"><input v-model="secretAcknowledged" type="checkbox" />我已安全保存 keyId 和密钥，理解关闭后无法再次查看。</label>
          <div class="dialog-actions"><button type="button" class="primary-btn" :disabled="!secretAcknowledged" @click="closeDelivery">我已安全保存，确认关闭</button></div>
        </section>
      </div>
    </Teleport>
    <AppDialog v-if="confirmDelete" title="删除联系人" :message="`确认删除联系人“${confirmDelete.contactName}”？删除后不可恢复。`" confirm-text="确认删除" danger @confirm="doDeleteContact" @cancel="confirmDelete = null" />
  </section>
</template>

<style scoped>
.detail-error { color: var(--danger); font-size: 13px; }
.detail-warning { margin: 0 0 16px; padding: 12px; border: 1px solid var(--line-dark); border-radius: 4px; color: var(--ink-soft); background: var(--surface-2); font-size: 12px; line-height: 1.6; }
.credential-type-selector { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.credential-type-selector select { height: 34px; color: var(--ink); background: var(--inset-field); border: 1px solid var(--line-dark); border-radius: 4px; }
.credential-delivery-mask { z-index: 3000; padding: 16px; }
.credential-delivery { box-sizing: border-box; width: min(620px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; }
.credential-delivery h4 { margin: 0; font-size: 17px; }
.credential-delivery > p { line-height: 1.65; font-size: 13px; }
.delivery-field { display: grid; min-width: 0; gap: 8px; margin: 18px 0; color: var(--ink-soft); font-size: 12px; }
.delivery-field code { display: block; padding: 12px; border: 1px solid var(--line-dark); border-radius: 4px; background: var(--surface-2); color: var(--ink); overflow-wrap: anywhere; white-space: pre-wrap; user-select: all; }
.delivery-field button { justify-self: start; }
.delivery-acknowledgement { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.6; }
.delivery-acknowledgement input { flex: none; margin-top: 4px; }
.detail-heading { margin-bottom: 20px; }.detail-heading h3 { margin-bottom: 5px; }.detail-heading small { color: var(--muted); }.el-module-panel { border: 1px solid var(--line); border-radius: 6px; background: var(--paper); padding: 22px; }.module-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }.module-header h4 { margin: 0 0 5px; color: var(--ink); font-size: 15px; }.module-header small { color: var(--muted); font-size: 12px; }.module-header.compact { margin-bottom: 16px; }.module-divider { height: 1px; margin: 26px 0; background: var(--line); }.el-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.el-form-grid label { display: grid; gap: 7px; color: var(--ink-soft); font-size: 12px; }.el-form-grid label.full { grid-column: 1 / -1; }.el-form-grid input, .el-form-grid select { min-width: 0; height: 34px; border: 1px solid var(--line-dark); border-radius: 4px; background: var(--inset-field); }.el-form-grid input:disabled, .el-form-grid select:disabled { color: var(--ink-soft); background: var(--surface); cursor: not-allowed; }.switch-field { display: flex !important; align-items: center; gap: 8px !important; height: 34px; }.switch-field input { width: 15px; height: 15px; }.el-table-shell { overflow-x: auto; border: 1px solid var(--line); border-radius: 5px; }.el-table-shell .data-table { min-width: 680px; }.credential-kind { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-soft); }.callback-tip { display: flex; align-items: center; gap: 9px; margin-top: 20px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent); border-radius: 4px; color: var(--accent-dark); background: color-mix(in srgb, var(--accent) 6%, transparent); font-size: 12px; }.primary-btn, .outline-btn, .text-btn { display: inline-flex; align-items: center; gap: 6px; } @media (max-width: 700px) { .detail-heading, .module-header { align-items: flex-start; flex-direction: column; }.el-module-panel { padding: 16px; }.el-form-grid { grid-template-columns: 1fr; }.el-form-grid label.full { grid-column: auto; } }
</style>
