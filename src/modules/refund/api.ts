import { request } from "../../api";
export type Refund = { refundId: string; orderId: string; amount: number; currency: string; status: string; reason: string };
export const createRefund = (orderId: string, payload: { amount: number; reason: string }, idempotencyKey: string) => request<Refund>(`/v1/payments/orders/${encodeURIComponent(orderId)}/refunds`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) });
export const getRefund = (orderId: string, refundId: string) => request<Refund>(`/v1/payments/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`);
