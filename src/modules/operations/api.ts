import { request } from "../../api";
export type AdminRecord = Record<string, string | number | boolean>;
export type OutboxEvent = { eventId: string; eventType: string; status: string; attemptCount: number; lastError?: string; deadAt?: string };
export type ReconciliationDifference = { difference_id: string; bill_id: string; difference_type: string; expected_amount: number; actual_amount: number; status: string; reason?: string };
export const getAdminList = (resource: string, params: { page?: number; pageSize?: number } = {}) => request<{ items: AdminRecord[]; page: number; pageSize: number; total: number }>(`/admin/v1/${resource}?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`);
export const getDeadOutbox = () => request<{ items: OutboxEvent[] }>("/admin/v1/outbox/dead");
export const redriveOutbox = (eventId: string, reason: string) => request<OutboxEvent>(`/admin/v1/outbox/${encodeURIComponent(eventId)}/redrive`, { method: "POST", body: JSON.stringify({ reason }) });
export const getReconciliationDifferences = () => request<{ items: ReconciliationDifference[] }>("/admin/v1/reconciliation/differences");
export const resolveReconciliationDifference = (id: string, reason: string) => request<Record<string, string>>(`/admin/v1/reconciliation/differences/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ reason }) });
