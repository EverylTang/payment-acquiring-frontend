import { request } from "../../api";

export type RiskEvent = { eventId: string; orderId?: string; merchantId: string; policyId?: string; policyName?: string; decision: "PASS" | "REVIEW" | "REJECT"; riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: "OPEN" | "RESOLVED"; reason: string; subjectType?: string; subjectMasked?: string; reviewer?: string; reviewDecision?: "PASS" | "REJECT"; reviewNote?: string; createdAt: string; resolvedAt?: string };
export type RiskListEntry = { entryId: string; listType: "BLACK" | "WHITE" | "GREY"; subjectType: string; subjectHash: string; label: string; expiresAt?: string; status: "ACTIVE" | "DISABLED"; createdBy: string; createdAt: string };
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
const query = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)])).toString();
export const getRiskOverview = () => request<{ openEvents: number; reviewEvents: number; rejectedEvents: number; events24h: number }>("/admin/v1/risk/overview");
export const getRiskEvents = (params: { page?: number; pageSize?: number; status?: string; level?: string; merchantId?: string } = {}) => request<Page<RiskEvent>>(`/admin/v1/risk/events?${query(params)}`);
export const reviewRiskEvent = (eventId: string, decision: "PASS" | "REJECT", note: string) => request<void>(`/admin/v1/risk/events/${encodeURIComponent(eventId)}/review`, { method: "PUT", body: JSON.stringify({ decision, note }) });
export const getRiskLists = (params: { page?: number; pageSize?: number; type?: string } = {}) => request<Page<RiskListEntry>>(`/admin/v1/risk/lists?${query(params)}`);
export const createRiskList = (payload: { listType: string; subjectType: string; subjectValue: string; label: string; expiresAt?: string }) => request<void>("/admin/v1/risk/lists", { method: "POST", body: JSON.stringify(payload) });
export const changeRiskListStatus = (entryId: string, status: "ACTIVE" | "DISABLED") => request<void>(`/admin/v1/risk/lists/${encodeURIComponent(entryId)}/status`, { method: "PUT", body: JSON.stringify({ status }) });
