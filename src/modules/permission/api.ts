import { request } from "../../api";
export type AdminRole = { id: number; roleCode: string; roleName: string };
export type RolePermissions = { menuCodes: string[]; permissionCodes: string[] };
export type PermissionCatalog = { menus: Array<{ id: number; menuCode: string; menuName: string; parentId: number; menuType: string; status: string; visible: boolean; sortOrder: number }>; permissions: Array<{ permissionCode: string; permissionName: string; resourceType: string; status: string }> };
export type PageResponse<T> = { items: T[]; page: number; pageSize: number; total: number };
type RoleListParams = { page?: number; pageSize?: number; roleName?: string; roleCode?: string };
export const getRoles = (params: RoleListParams = {}) => {
  const query = new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 100) });
  (["roleName", "roleCode"] as const).forEach((key) => { if (params[key]) query.set(key, params[key]); });
  return request<PageResponse<AdminRole>>(`/admin/v1/roles?${query}`);
};
export const createRole = (payload: { roleCode: string; roleName: string; menuCodes: string[]; permissionCodes: string[]; scopeTypes: string[] }) =>
  request<AdminRole>("/admin/v1/roles", { method: "POST", body: JSON.stringify(payload) });
export const updateRole = (roleCode: string, payload: { roleName: string }) =>
  request<AdminRole>(`/admin/v1/roles/${encodeURIComponent(roleCode)}`, { method: "PUT", body: JSON.stringify(payload) });
export const getRolePermissions = (roleCode: string) => request<RolePermissions>(`/admin/v1/roles/${encodeURIComponent(roleCode)}/permissions`);
export const updateRolePermissions = (roleCode: string, payload: RolePermissions) => request<RolePermissions>(`/admin/v1/roles/${encodeURIComponent(roleCode)}/permissions`, { method: "PUT", body: JSON.stringify(payload) });
export const getPermissionCatalog = () => request<PermissionCatalog>("/admin/v1/permission-catalog");
export type RoleDataScope = { roleCode: string; scopeTypes: Array<"ALL" | "ASSIGNED" | "SELF"> };
export const getRoleDataScope = (roleCode: string) => request<RoleDataScope>(`/admin/v1/data-scopes/roles/${encodeURIComponent(roleCode)}`);
export const updateRoleDataScope = (roleCode: string, scopeTypes: string[]) => request<RoleDataScope>(`/admin/v1/data-scopes/roles/${encodeURIComponent(roleCode)}`, { method: "PUT", body: JSON.stringify({ scopeTypes }) });
