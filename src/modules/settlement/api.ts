import { request } from "../../api";

export type SettlementRule = {
  id?: number;
  merchantId: string;
  productCode: string;
  currency: string;
  settlementCycle: string;
  cycleDays: number;
  settlementDay?: number | null;
  cycleInterval?: number;
  minSettlementAmount: number;
  feeRate: number;
  autoSettlement: boolean;
  status: string;
  effectiveDate: string;
  expireDate?: string | null;
};

export const getSettlementRules = (filters: { page?: number; pageSize?: number; merchantId?: string; productCode?: string; currency?: string; status?: string } = {}) => {
  const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: String(filters.pageSize || 20) });
  (["merchantId", "productCode", "currency", "status"] as const).forEach((key) => { if (filters[key]) query.set(key, filters[key]); });
  return request<{ items: SettlementRule[]; page: number; pageSize: number; total: number }>(`/admin/v1/settlement/rules?${query}`);
};

export const saveSettlementRule = (rule: SettlementRule) =>
  request<SettlementRule>("/admin/v1/settlement/rules", { method: "POST", body: JSON.stringify(rule) });
export const changeSettlementRuleStatus = (id: number, status: string) =>
  request<SettlementRule>(`/admin/v1/settlement/rules/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

export const runSettlementBatch = (settlementDate: string) =>
  request<{ batchId: string }>("/admin/v1/settlement/batches", { method: "POST", body: JSON.stringify({ settlementDate }) });

export const getSettlementBatch = (batchId: string) =>
  request<{ batch: Record<string, unknown>; details: Record<string, unknown>[] }>(`/admin/v1/settlement/batches/${encodeURIComponent(batchId)}`);
