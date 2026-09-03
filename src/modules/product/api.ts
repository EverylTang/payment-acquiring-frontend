import { request } from "../../api";

export type PageResponse<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Product = {
  productCode: string; name: string; productType: "PAYIN" | "PAYOUT";
  accessMode: "DIRECT" | "AGGREGATED" | null; defaultCountry: string; defaultCurrency: string;
  description: string | null; statementDescriptor: string | null; status: "ACTIVE" | "DISABLED";
  activeCapabilityCount: number; supportedCurrencies: string; supportedPaymentMethods: string; createdAt: string; updatedAt: string;
};
export type ProductPayload = Omit<Product, "productCode" | "status" | "activeCapabilityCount" | "supportedCurrencies" | "supportedPaymentMethods" | "createdAt" | "updatedAt">;
export type ProductCapability = { capabilityId: string; productCode: string; country: string; currency: string; paymentMethod: string; minAmount: number; maxAmount: number; supportsRefund: boolean; status: string };
const pageQuery = (params: { page?: number; pageSize?: number; status?: string; productType?: string }) => {
  const query = new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) });
  if (params.status) query.set("status", params.status);
  if (params.productType) query.set("productType", params.productType);
  return query;
};
export const getProducts = (params: { page?: number; pageSize?: number; status?: string; productType?: string } = {}) => request<PageResponse<Product>>(`/admin/v1/products?${pageQuery(params)}`);
export const createProduct = (payload: ProductPayload & { productCode: string }) => request<Product>("/admin/v1/products", { method: "POST", body: JSON.stringify(payload) });
export const updateProduct = (code: string, payload: ProductPayload) => request<Product>(`/admin/v1/products/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changeProductStatus = (code: string, status: string) => request<Product>(`/admin/v1/products/${encodeURIComponent(code)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getProductCapabilities = (code: string, params: { page?: number; pageSize?: number } = {}) => request<PageResponse<ProductCapability>>(`/admin/v1/products/${encodeURIComponent(code)}/capabilities?${pageQuery(params)}`);
export const createProductCapability = (code: string, payload: Omit<ProductCapability, "capabilityId" | "productCode" | "status">) => request<ProductCapability>(`/admin/v1/products/${encodeURIComponent(code)}/capabilities`, { method: "POST", body: JSON.stringify(payload) });
export const updateProductCapability = (code: string, id: string, payload: Omit<ProductCapability, "capabilityId" | "productCode" | "status">) => request<ProductCapability>(`/admin/v1/products/${encodeURIComponent(code)}/capabilities/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
export const changeProductCapabilityStatus = (code: string, id: string, status: string) => request<ProductCapability>(`/admin/v1/products/${encodeURIComponent(code)}/capabilities/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
