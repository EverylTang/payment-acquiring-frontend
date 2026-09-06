import { request } from "../../api";

export type SettlementRule = {
  id?: number;
  merchantId: string;
  currency: string;
  settlementCycle: string;
  cycleDays: number;
  minSettlementAmount: number;
  feeRate: number;
  autoSettlement: boolean;
  status: string;
  effectiveDate: string;
  expireDate?: string | null;
};

export const getSettlementRules = (merchantId?: string, currency?: string) => {
  const query = new URLSearchParams();
  if (merchantId) query.set("merchantId", merchantId);
  if (currency) query.set("currency", currency);
  return request<{ items: SettlementRule[] }>(`/admin/v1/settlement/rules?${query}`);
};

export const saveSettlementRule = (rule: SettlementRule) =>
  request<SettlementRule>("/admin/v1/settlement/rules", { method: "POST", body: JSON.stringify(rule) });
export const changeSettlementRuleStatus = (id: number, status: string) =>
  request<SettlementRule>(`/admin/v1/settlement/rules/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

export const runSettlementBatch = (settlementDate: string) =>
  request<{ batchId: string }>("/admin/v1/settlement/batches", { method: "POST", body: JSON.stringify({ settlementDate }) });

export const getSettlementBatch = (batchId: string) =>
  request<{ batch: Record<string, unknown>; details: Record<string, unknown>[] }>(`/admin/v1/settlement/batches/${encodeURIComponent(batchId)}`);
