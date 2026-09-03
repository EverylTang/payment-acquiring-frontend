import { request } from "../../api";

export interface PricingRule {
  ruleId: string;
  releaseVersion: number;
  productCode: string;
  merchantId: string | null;
  currency: string;
  feeRate: number | null;
  fixedFee: number | null;
  feeMode: string;
  minAmount: number | null;
  maxAmount: number | null;
  status: string;
}

export interface PricingRuleRequest {
  releaseVersion: number;
  productCode: string;
  merchantId?: string;
  currency: string;
  feeRate: number;
  fixedFee: number;
  feeMode: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const getPricingRules = (params: { page: number; pageSize: number }) =>
  request<PageResponse<PricingRule>>(`/admin/v1/pricing-rules-mgmt?page=${params.page}&pageSize=${params.pageSize}`);

export const getPricingRuleDetail = (ruleId: string) =>
  request<PricingRule>(`/admin/v1/pricing-rules-mgmt/${encodeURIComponent(ruleId)}`);

export const createPricingRule = (data: PricingRuleRequest) =>
  request<PricingRule>("/admin/v1/pricing-rules-mgmt", { method: "POST", body: JSON.stringify(data) });

export const updatePricingRule = (ruleId: string, data: PricingRuleRequest) =>
  request<PricingRule>(`/admin/v1/pricing-rules-mgmt/${encodeURIComponent(ruleId)}`, { method: "PUT", body: JSON.stringify(data) });

export const changePricingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/pricing-rules-mgmt/${encodeURIComponent(ruleId)}/status`, { method: "PUT", body: JSON.stringify({ status }) });

export const deletePricingRule = (ruleId: string) =>
  request<void>(`/admin/v1/pricing-rules-mgmt/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
