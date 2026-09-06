import { request } from "../../api";

export type FundAccount = {
  accountId: string;
  merchantId: string;
  currency: string;
  balance: number;
  frozenBalance: number;
  totalIncome: number;
  totalExpense: number;
  status: string;
  updatedAt: string;
};

export type FundTransaction = {
  transactionId: string;
  accountId: string;
  merchantId: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  relatedOrderId?: string | null;
  relatedSettlementId?: string | null;
  remark?: string | null;
  createdAt: string;
};

export type FundPage<T> = { items: T[]; page: number; pageSize: number; total: number };

type AccountFilters = { page?: number; pageSize?: number; merchantId?: string; currency?: string; status?: string };
type TransactionFilters = { page?: number; pageSize?: number; merchantId?: string; currency?: string; transactionType?: string; createdFrom?: string; createdTo?: string };

const queryString = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return query.toString();
};

export const getFundAccounts = (filters: AccountFilters = {}) =>
  request<FundPage<FundAccount>>(`/admin/v1/merchant-funds/accounts?${queryString({ page: filters.page || 1, pageSize: filters.pageSize || 20, merchantId: filters.merchantId, currency: filters.currency, status: filters.status })}`);

export const getFundTransactions = (filters: TransactionFilters = {}) =>
  request<FundPage<FundTransaction>>(`/admin/v1/merchant-funds/transactions?${queryString({ page: filters.page || 1, pageSize: filters.pageSize || 20, merchantId: filters.merchantId, currency: filters.currency, transactionType: filters.transactionType, createdFrom: filters.createdFrom, createdTo: filters.createdTo })}`);
