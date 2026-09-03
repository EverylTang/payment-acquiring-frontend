import { request } from "../../api";

export type AdminMenu = {
  id: number;
  parentId: number;
  menuCode: string;
  menuName: string;
  menuType: "DIRECTORY" | "PAGE";
  routePath?: string;
  componentKey?: string;
  icon?: string;
  sortOrder: number;
  visible: boolean;
  status: "ACTIVE" | "DISABLED";
};
export type MenuPermission = {
  permissionCode: string;
  permissionName: string;
  resourceType: string;
  status: "ACTIVE" | "DISABLED";
};
export type ResourceType = { resourceType: string; resourceName: string };

export const getMenus = (params: { page?: number; pageSize?: number } = {}) =>
  request<{ items: AdminMenu[]; page: number; pageSize: number; total: number }>(
    `/admin/v1/menus?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const createMenu = (payload: Omit<AdminMenu, "id" | "parentId" | "status"> & { parentMenuCode?: string }) =>
  request<AdminMenu>("/admin/v1/menus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const changeMenuStatus = (menuCode: string, status: string) =>
  request<AdminMenu>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const updateMenu = (
  menuCode: string,
  payload: Omit<AdminMenu, "id" | "parentId" | "menuCode" | "status"> & { parentMenuCode?: string },
) => request<AdminMenu>(`/admin/v1/menus/${encodeURIComponent(menuCode)}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteMenu = (menuCode: string) =>
  request<void>(`/admin/v1/menus/${encodeURIComponent(menuCode)}`, { method: "DELETE" });
export const getMenuPermissions = (menuCode: string) =>
  request<MenuPermission[]>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/permissions`);
export const createMenuPermission = (
  menuCode: string,
  payload: { actionCode: string; permissionName: string; resourceType: string },
) => request<MenuPermission>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/permissions`, { method: "POST", body: JSON.stringify(payload) });
export const updateMenuPermission = (
  menuCode: string,
  actionCode: string,
  payload: { permissionName: string; resourceType: string; status: string },
) => request<MenuPermission>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/permissions/${encodeURIComponent(actionCode)}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteMenuPermission = (menuCode: string, actionCode: string) =>
  request<void>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/permissions/${encodeURIComponent(actionCode)}`, { method: "DELETE" });
export const getResourceTypes = () => request<ResourceType[]>("/admin/v1/menus/resource-types");
export const createResourceType = (payload: { resourceType: string; resourceName: string }) =>
  request<ResourceType>("/admin/v1/menus/resource-types", { method: "POST", body: JSON.stringify(payload) });
export const getMenuResourceTypes = (menuCode: string) =>
  request<string[]>(`/admin/v1/menus/${encodeURIComponent(menuCode)}/resource-types`);
