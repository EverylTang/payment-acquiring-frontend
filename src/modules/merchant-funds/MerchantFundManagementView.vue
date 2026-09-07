<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Eye, LoaderCircle, RotateCcw, Search, WalletCards } from "lucide-vue-next";
import { ElDatePicker, ElOption, ElSelect, ElTabPane, ElTable, ElTableColumn, ElTabs } from "element-plus";
import { getMerchants, type Merchant } from "../merchant/api";
import { getActiveCurrencies, type Currency } from "../master-data/api";
import { getFundAccounts, getFundTransactions, type FundAccount, type FundTransaction } from "./api";
import AppDrawer from "../../components/AppDrawer.vue";
import AppPagination from "../../components/AppPagination.vue";

const emit = defineEmits<{ notice: [message: string] }>();
const activeTab = ref("accounts"), merchants = ref<Merchant[]>([]), currencies = ref<Currency[]>([]);
const accounts = ref<FundAccount[]>([]), transactions = ref<FundTransaction[]>([]), accountDetail = ref<FundAccount | null>(null);
const loadingAccounts = ref(false), loadingTransactions = ref(false);
const accountFilters = ref({ merchantId: "", currency: "", status: "" });
const transactionFilters = ref({ merchantId: "", currency: "", transactionType: "", dates: [] as string[] });
const accountPage = ref({ current: 1, pageSize: 10, total: 0 });
const transactionPage = ref({ current: 1, pageSize: 10, total: 0 });

const amount = (value: number, currency: string) => `${Number(value || 0).toFixed(4)} ${currency}`;
const displayTime = (value?: string) => value ? value.replace("T", " ").slice(0, 19) : "--";
const typeLabel = (value: string) => ({ SETTLEMENT_IN: "结算入账", REFUND_OUT: "退款扣款", REFUND_FEE_OUT: "退款手续费", REFUND_PENDING: "待结算退款" }[value] || value);

const loadAccounts = async (current = accountPage.value.current) => {
  loadingAccounts.value = true;
  try {
    const result = await getFundAccounts({ page: current, pageSize: accountPage.value.pageSize, ...accountFilters.value });
    accounts.value = result.items;
    accountPage.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) { emit("notice", error instanceof Error ? error.message : "商户余额加载失败"); }
  finally { loadingAccounts.value = false; }
};

const loadTransactions = async (current = transactionPage.value.current) => {
  loadingTransactions.value = true;
  try {
    const result = await getFundTransactions({
      page: current,
      pageSize: transactionPage.value.pageSize,
      merchantId: transactionFilters.value.merchantId,
      currency: transactionFilters.value.currency,
      transactionType: transactionFilters.value.transactionType,
      createdFrom: transactionFilters.value.dates[0],
      createdTo: transactionFilters.value.dates[1],
    });
    transactions.value = result.items;
    transactionPage.value = { current: result.page, pageSize: result.pageSize, total: result.total };
  } catch (error) { emit("notice", error instanceof Error ? error.message : "余额明细加载失败"); }
  finally { loadingTransactions.value = false; }
};

const changeTab = (tab: string | number) => {
  activeTab.value = String(tab);
  if (activeTab.value === "accounts" && !accounts.value.length) void loadAccounts(1);
  if (activeTab.value === "transactions" && !transactions.value.length) void loadTransactions(1);
};
const resetAccounts = () => { accountFilters.value = { merchantId: "", currency: "", status: "" }; void loadAccounts(1); };
const resetTransactions = () => { transactionFilters.value = { merchantId: "", currency: "", transactionType: "", dates: [] }; void loadTransactions(1); };
const changeAccountPageSize = (pageSize: number) => { accountPage.value.pageSize = pageSize; void loadAccounts(1); };
const changeTransactionPageSize = (pageSize: number) => { transactionPage.value.pageSize = pageSize; void loadTransactions(1); };
const viewTransactions = (account: FundAccount) => {
  transactionFilters.value = { ...transactionFilters.value, merchantId: account.merchantId, currency: account.currency };
  activeTab.value = "transactions";
  void loadTransactions(1);
};
onMounted(async () => {
  try {
    const [merchantResult, currencyResult] = await Promise.all([getMerchants({ page: 1, pageSize: 100, status: "ACTIVE" }), getActiveCurrencies()]);
    merchants.value = merchantResult.items;
    currencies.value = currencyResult;
  } catch (error) { emit("notice", error instanceof Error ? error.message : "筛选项加载失败"); }
  await loadAccounts(1);
});
</script>

<template>
  <section class="workspace-panel configuration-center management-list-page merchant-fund-management">
    <ElTabs v-model="activeTab" class="merchant-fund-tabs" @tab-change="changeTab">
      <ElTabPane name="accounts"><template #label><span class="merchant-fund-tab-label"><WalletCards :size="16" />商户余额</span></template>
        <form class="management-filter-form" @submit.prevent="loadAccounts(1)"><div class="management-filter-fields"><label class="management-form-item"><span>商户</span><ElSelect v-model="accountFilters.merchantId" clearable filterable placeholder="全部商户"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label><label class="management-form-item"><span>币种</span><ElSelect v-model="accountFilters.currency" clearable placeholder="全部币种"><ElOption v-for="currency in currencies" :key="currency.code" :label="currency.code" :value="currency.code" /></ElSelect></label><label class="management-form-item"><span>账户状态</span><ElSelect v-model="accountFilters.status" clearable placeholder="全部状态"><ElOption label="正常" value="ACTIVE" /><ElOption label="已停用" value="DISABLED" /></ElSelect></label></div><div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetAccounts"><RotateCcw :size="16" />重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button></div></form>
        <div class="management-list-summary"><span>资金账户</span><small>共 {{ accountPage.total }} 个账户</small></div>
        <div v-if="loadingAccounts" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
        <div v-else class="merchant-fund-table-shell"><ElTable :data="accounts" border stripe table-layout="fixed" row-key="accountId"><ElTableColumn label="商户 / 账户" min-width="210"><template #default="scope"><strong>{{ scope.row.merchantId }}</strong><small class="table-subtext mono">{{ scope.row.accountId }}</small></template></ElTableColumn><ElTableColumn label="可用余额" min-width="150"><template #default="scope"><strong class="fund-amount">{{ amount(scope.row.balance, scope.row.currency) }}</strong></template></ElTableColumn><ElTableColumn label="冻结金额" min-width="140"><template #default="scope">{{ amount(scope.row.frozenBalance, scope.row.currency) }}</template></ElTableColumn><ElTableColumn label="累计收支" min-width="180"><template #default="scope"><span class="fund-income">+{{ amount(scope.row.totalIncome, scope.row.currency) }}</span><small class="table-subtext fund-expense">-{{ amount(scope.row.totalExpense, scope.row.currency) }}</small></template></ElTableColumn><ElTableColumn label="状态" width="100"><template #default="scope"><span class="status-badge" :class="'st-' + scope.row.status.toLowerCase()">{{ scope.row.status }}</span></template></ElTableColumn><ElTableColumn label="更新时间" min-width="160"><template #default="scope"><span class="table-date">{{ displayTime(scope.row.updatedAt) }}</span></template></ElTableColumn><ElTableColumn label="操作" width="180" align="right"><template #default="scope"><div class="settlement-row-actions"><button class="outline-btn action-btn" type="button" title="查看账户详情" @click="accountDetail = scope.row as FundAccount"><Eye :size="15" />详情</button><button class="outline-btn action-btn" type="button" title="查看余额明细" @click="viewTransactions(scope.row as FundAccount)"><Search :size="15" />明细</button></div></template></ElTableColumn></ElTable></div>
        <AppPagination :page="accountPage.current" :page-size="accountPage.pageSize" :total="accountPage.total" @change="loadAccounts" @size-change="changeAccountPageSize" />
      </ElTabPane>
      <ElTabPane name="transactions"><template #label><span class="merchant-fund-tab-label"><WalletCards :size="16" />余额明细</span></template>
        <form class="management-filter-form" @submit.prevent="loadTransactions(1)"><div class="management-filter-fields"><label class="management-form-item"><span>商户</span><ElSelect v-model="transactionFilters.merchantId" clearable filterable placeholder="全部商户"><ElOption v-for="merchant in merchants" :key="merchant.merchantId" :label="`${merchant.name} · ${merchant.merchantId}`" :value="merchant.merchantId" /></ElSelect></label><label class="management-form-item"><span>币种</span><ElSelect v-model="transactionFilters.currency" clearable placeholder="全部币种"><ElOption v-for="currency in currencies" :key="currency.code" :label="currency.code" :value="currency.code" /></ElSelect></label><label class="management-form-item"><span>流水类型</span><ElSelect v-model="transactionFilters.transactionType" clearable placeholder="全部类型"><ElOption label="结算入账" value="SETTLEMENT_IN" /><ElOption label="退款扣款" value="REFUND_OUT" /><ElOption label="退款手续费" value="REFUND_FEE_OUT" /><ElOption label="待结算退款" value="REFUND_PENDING" /></ElSelect></label><label class="management-form-item"><span>入账日期</span><ElDatePicker v-model="transactionFilters.dates" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" /></label></div><div class="management-filter-actions"><button class="outline-btn" type="button" @click="resetTransactions"><RotateCcw :size="16" />重置</button><button class="primary-btn" type="submit"><Search :size="16" />查询</button></div></form>
        <div class="management-list-summary"><span>余额明细</span><small>共 {{ transactionPage.total }} 条流水</small></div>
        <div v-if="loadingTransactions" class="empty"><LoaderCircle class="spin" :size="22" />加载中…</div>
        <div v-else class="merchant-fund-table-shell"><ElTable :data="transactions" border stripe table-layout="fixed" row-key="transactionId"><ElTableColumn label="流水 / 类型" min-width="195"><template #default="scope"><strong class="mono">{{ scope.row.transactionId }}</strong><small class="table-subtext">{{ typeLabel(scope.row.transactionType) }}</small></template></ElTableColumn><ElTableColumn label="商户 / 账户" min-width="185"><template #default="scope"><strong>{{ scope.row.merchantId }}</strong><small class="table-subtext mono">{{ scope.row.accountId }}</small></template></ElTableColumn><ElTableColumn label="变动金额" min-width="140"><template #default="scope"><strong :class="scope.row.amount >= 0 ? 'fund-income' : 'fund-expense'">{{ scope.row.amount >= 0 ? '+' : '' }}{{ amount(scope.row.amount, scope.row.currency) }}</strong></template></ElTableColumn><ElTableColumn label="变动后余额" min-width="145"><template #default="scope"><span class="fund-amount">{{ amount(scope.row.balanceAfter, scope.row.currency) }}</span></template></ElTableColumn><ElTableColumn label="关联订单" min-width="165"><template #default="scope"><span class="mono">{{ scope.row.relatedOrderId || '--' }}</span><small v-if="scope.row.relatedSettlementId" class="table-subtext mono">{{ scope.row.relatedSettlementId }}</small></template></ElTableColumn><ElTableColumn label="入账时间" min-width="160"><template #default="scope"><span class="table-date">{{ displayTime(scope.row.createdAt) }}</span></template></ElTableColumn></ElTable></div>
        <AppPagination :page="transactionPage.current" :page-size="transactionPage.pageSize" :total="transactionPage.total" @change="loadTransactions" @size-change="changeTransactionPageSize" />
      </ElTabPane>
    </ElTabs>
  </section>
  <AppDrawer v-if="accountDetail" title="资金账户详情" :description="`${accountDetail.merchantId} · ${accountDetail.currency}`" @close="accountDetail = null"><section class="drawer-section merchant-fund-detail"><div class="settlement-detail-status"><span class="status-badge" :class="'st-' + accountDetail.status.toLowerCase()">{{ accountDetail.status }}</span><button class="outline-btn" type="button" @click="viewTransactions(accountDetail); accountDetail = null"><Search :size="15" />查看明细</button></div><dl class="settlement-detail-list"><div><dt>账户 ID</dt><dd class="mono">{{ accountDetail.accountId }}</dd></div><div><dt>可用余额</dt><dd class="fund-amount">{{ amount(accountDetail.balance, accountDetail.currency) }}</dd></div><div><dt>冻结金额</dt><dd>{{ amount(accountDetail.frozenBalance, accountDetail.currency) }}</dd></div><div><dt>累计收入</dt><dd class="fund-income">{{ amount(accountDetail.totalIncome, accountDetail.currency) }}</dd></div><div><dt>累计支出</dt><dd class="fund-expense">{{ amount(accountDetail.totalExpense, accountDetail.currency) }}</dd></div><div><dt>最后更新</dt><dd>{{ displayTime(accountDetail.updatedAt) }}</dd></div></dl></section></AppDrawer>
</template>
