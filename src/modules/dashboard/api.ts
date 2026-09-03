import { request } from "../../api";
import { getOrderStatistics } from "../order/api";
export type DashboardOverview = { paymentSuccessRate: number; paymentVolume: number; activeMerchants: number; activeChannels: number; pendingReleases: number; channelHealth: Array<{ channelId: string; name: string; status: string; successRate: number }> };
export type { OrderStatistics } from "../order/api";
export { getOrderStatistics };
export const getOverview = () => request<DashboardOverview>("/admin/v1/dashboard/overview");
export const getChannelHealth = (id: string) => request<{ channelId: string; status: string; checkedAt: number }>(`/admin/v1/configurations/channels/${encodeURIComponent(id)}/health`);
export const getOrderHealth = () => request<{ service: string; status: string }>("/v1/payments/orders/health");
export const getSnapshot = (params: Record<string, string>) => request<Record<string, unknown>>(`/admin/v1/configurations/snapshot?${new URLSearchParams({ country: "US", amount: "1.00", ...params })}`);
