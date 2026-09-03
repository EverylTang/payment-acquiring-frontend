import { request } from "../../api";

export interface RoutingRule {
  ruleId: string;
  releaseVersion: number;
  productCode: string;
  merchantId: string | null;
  country: string;
  currency: string;
  paymentMethod: string;
  channelId: string;
  priority: number;
  weight: number;
  status: string;
}

export interface RoutingRuleRequest {
  releaseVersion: number;
  productCode: string;
  merchantId?: string;
  country: string;
  currency: string;
  paymentMethod: string;
  channelId: string;
  priority: number;
  weight: number;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const getRoutingRules = (params: { page: number; pageSize: number }) =>
  request<PageResponse<RoutingRule>>(`/admin/v1/routing-rules-mgmt?page=${params.page}&pageSize=${params.pageSize}`);

export const getRoutingRuleDetail = (ruleId: string) =>
  request<RoutingRule>(`/admin/v1/routing-rules-mgmt/${encodeURIComponent(ruleId)}`);

export const createRoutingRule = (data: RoutingRuleRequest) =>
  request<RoutingRule>("/admin/v1/routing-rules-mgmt", { method: "POST", body: JSON.stringify(data) });

export const updateRoutingRule = (ruleId: string, data: RoutingRuleRequest) =>
  request<RoutingRule>(`/admin/v1/routing-rules-mgmt/${encodeURIComponent(ruleId)}`, { method: "PUT", body: JSON.stringify(data) });

export const changeRoutingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/routing-rules-mgmt/${encodeURIComponent(ruleId)}/status`, { method: "PUT", body: JSON.stringify({ status }) });

export const deleteRoutingRule = (ruleId: string) =>
  request<void>(`/admin/v1/routing-rules-mgmt/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
