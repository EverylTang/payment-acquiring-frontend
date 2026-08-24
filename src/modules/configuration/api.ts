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
  status: "ACTIVE" | "DISABLED";
  weight: number;
  configuration: Record<string, unknown>;
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
  currency: string;
  feeRate: number;
  fixedFee: number;
  feeMode: "INCLUSIVE" | "EXCLUSIVE";
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

const adminPage = <T>(path: string) => request<PageResponse<T>>(`${path}?page=1&pageSize=100`);

export const getChannels = () => adminPage<Channel>("/admin/v1/channels");
export const createChannel = (payload: {
  channelId: string;
  name: string;
  provider: string;
  weight: number;
  configuration: Record<string, unknown>;
  country: string;
  currency: string;
  paymentMethod: string;
  minAmount: number;
  maxAmount: number;
}) => request<void>("/admin/v1/channels", { method: "POST", body: JSON.stringify(payload) });
export const changeChannelStatus = (channelId: string, status: string) =>
  request<void>(`/admin/v1/channels/${encodeURIComponent(channelId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getRoutingRules = () => request<PageResponse<RoutingRule>>("/admin/v1/routing-rules?p=1&s=100");
export const createRoutingRule = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/routing-rules", { method: "POST", body: JSON.stringify(payload) });
export const changeRoutingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/routing-rules/${encodeURIComponent(ruleId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getPricingRules = () => request<PageResponse<PricingRule>>("/admin/v1/pricing-rules?p=1&s=100");
export const createPricingRule = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/pricing-rules", { method: "POST", body: JSON.stringify(payload) });
export const changePricingRuleStatus = (ruleId: string, status: string) =>
  request<void>(`/admin/v1/pricing-rules/${encodeURIComponent(ruleId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getRiskPolicies = () => request<PageResponse<RiskPolicy>>("/admin/v1/risk-policies?p=1&s=100");
export const createRiskPolicy = (payload: Record<string, unknown>) =>
  request<void>("/admin/v1/risk-policies", { method: "POST", body: JSON.stringify(payload) });
export const changeRiskPolicyStatus = (policyId: string, status: string) =>
  request<void>(`/admin/v1/risk-policies/${encodeURIComponent(policyId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const getReleases = () => request<PageResponse<ConfigRelease>>("/admin/v1/config-releases?p=1&s=100");
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
