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
