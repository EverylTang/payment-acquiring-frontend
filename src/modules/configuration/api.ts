import { request } from "../../api";

export type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type Channel = {
  channelId: string;
  name: string;
  provider: string;
  requestUrl: string;
  signatureProfile: string;
  status: "ACTIVE" | "DISABLED";
  configuration: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

export type RoutingRule = {
  ruleId: string;
  releaseVersion: number;
  productCode: string;
  merchantId?: string;
  paymentMethod: string;
  country?: string;
  currency: string;
  channelId: string;
  priority: number;
  weight: number;
  status: "ACTIVE" | "DISABLED";
};

export type PricingRule = {
  ruleId: string;
  releaseVersion: number;
  productCode: string;
  merchantId?: string;
  channelId?: string;
  currency: string;
  feeRate: number;
  fixedFee: number;
  extraFee: number;
  minFee?: number | null;
  maxFee?: number | null;
  feeType: "FIXED" | "PERCENTAGE" | "TIERED" | "COMBINED";
  tiers: Array<{ minAmount: number; maxAmount: number; feeRate: number; fixedFee: number }>;
  feeMode: "PAYER_BEAR" | "MERCHANT_BEAR" | "INCLUSIVE" | "EXCLUSIVE";
  minAmount: number;
  maxAmount: number;
  status: "ACTIVE" | "DISABLED";
};

export type RiskPolicy = {
  policyId: string;
  releaseVersion: number;
  name: string;
  priority: number;
  decision: "PASS" | "REJECT" | "REVIEW";
  condition: Record<string, unknown>;
  status: "ACTIVE" | "DISABLED";
};

export type ConfigRelease = {
  releaseId: string;
  versionNo: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "DISABLED";
  createdBy: string;
  approvedBy?: string;
  publishedAt?: string;
  createdAt: string;
};

const adminPage = <T>(path: string, params: { page?: number; pageSize?: number } = {}) =>
  request<PageResponse<T>>(`${path}?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`);
const configPage = (params: { page?: number; pageSize?: number } = {}) =>
  new URLSearchParams({ p: String(params.page || 1), s: String(params.pageSize || 20) });

export const getChannels = (params: { page?: number; pageSize?: number } = {}) => adminPage<Channel>("/admin/v1/channels", params);
export const createChannel = (payload: {
  channelId: string;
  name: string;
  provider: string;
  requestUrl: string;
  signatureProfile: string;
  configuration: Record<string, unknown>;
  credentials: Record<string, unknown>;
  country: string;
  currency: string;
  paymentMethod: string;
  minAmount: number;
  maxAmount: number;
}) => request<void>("/admin/v1/channels", { method: "POST", body: JSON.stringify(payload) });
export const updateChannel = (channelId: string, payload: {
  name: string;
  provider: string;
  requestUrl: string;
  signatureProfile: string;
  configuration: Record<string, unknown>;
  credentials: Record<string, unknown>;
}) => request<void>(`/admin/v1/channels/${encodeURIComponent(channelId)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changeChannelStatus = (channelId: string, status: string) =>
  request<void>(`/admin/v1/channels/${encodeURIComponent(channelId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getRoutingRules = (params: { page?: number; pageSize?: number } = {}) => request<PageResponse<RoutingRule>>(`/admin/v1/routing-rules?${configPage(params)}`);
export const createRoutingRule = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/routing-rules", { method: "POST", body: JSON.stringify(payload) });
export const updateRoutingRule = (ruleId: string, payload: {
  productCode: string;
  merchantId?: string | null;
  paymentMethod: string;
  country?: string | null;
  currency: string;
  channelId: string;
  priority: number;
  weight: number;
}) => request<void>(`/admin/v1/routing-rules/${encodeURIComponent(ruleId)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changeRoutingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/routing-rules/${encodeURIComponent(ruleId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getPricingRules = (params: { page?: number; pageSize?: number } = {}) => request<PageResponse<PricingRule>>(`/admin/v1/pricing-rules?${configPage(params)}`);
export const createPricingRule = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/pricing-rules", { method: "POST", body: JSON.stringify(payload) });
export const updatePricingRule = (ruleId: string, payload: Record<string, unknown>) =>
  request<void>(`/admin/v1/pricing-rules/${encodeURIComponent(ruleId)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changePricingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/pricing-rules/${encodeURIComponent(ruleId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getRiskPolicies = (params: { page?: number; pageSize?: number } = {}) => request<PageResponse<RiskPolicy>>(`/admin/v1/risk-policies?${configPage(params)}`);
export const createRiskPolicy = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/risk-policies", { method: "POST", body: JSON.stringify(payload) });
export const updateRiskPolicy = (policyId: string, payload: Record<string, unknown>) =>
  request<void>(`/admin/v1/risk-policies/${encodeURIComponent(policyId)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changeRiskPolicyStatus = (policyId: string, status: string) =>
  request<void>(`/admin/v1/risk-policies/${encodeURIComponent(policyId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getReleases = (params: { page?: number; pageSize?: number } = {}) => request<PageResponse<ConfigRelease>>(`/admin/v1/config-releases?${configPage(params)}`);
export const createRelease = (configuration: Record<string, unknown>, reason: string) =>
  request<ConfigRelease>("/admin/v1/config-releases", {
    method: "POST",
    body: JSON.stringify({ configuration, reason }),
  });
export const transitionRelease = (
  releaseId: string,
  action: "submit" | "approve" | "publish" | "rollback",
  reason: string,
) => request<ConfigRelease>(`/admin/v1/config-releases/${encodeURIComponent(releaseId)}/${action}`, {
  method: "POST",
  body: JSON.stringify({ reason }),
});
export const getReleaseDiff = (releaseId: string) =>
  request<Record<string, unknown>>(`/admin/v1/config-releases/${encodeURIComponent(releaseId)}/diff`);
