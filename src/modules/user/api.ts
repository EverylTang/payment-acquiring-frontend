import { request } from "../../api";
import { getRoles } from "../permission/api";
export type PageResponse<T> = { items: T[]; page: number; pageSize: number; total: number };
export type AdminUser = { id: number; username: string; displayName: string; status: string; roles: string[] };
const pageQuery = (params: { page?: number; pageSize?: number }) => new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) });
export const getUsers = (params: { page?: number; pageSize?: number } = {}) => request<PageResponse<AdminUser>>(`/admin/v1/users?${pageQuery(params)}`);
export const createUser = (payload: { username: string; password: string; displayName: string; roles: string[] }) => request<AdminUser>("/admin/v1/users", { method: "POST", body: JSON.stringify(payload) });
export { getRoles };
