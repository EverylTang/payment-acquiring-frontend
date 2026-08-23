import { request } from "../../api";
export type CurrentUser = { username: string; displayName: string; roles: string[] };
export type AccessMenu = { menuCode: string; menuName: string; menuType: string; routePath: string | null; componentKey: string | null; icon: string | null; sortOrder: number };
export type AccessResponse = { roles: string[]; menus: AccessMenu[]; permissions: string[] };
export type LoginResponse = { accessToken: string; tokenType: string; expiresIn: number; user: CurrentUser };
export const login = (username: string, password: string) => request<LoginResponse>("/admin/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
export const getCurrentUser = () => request<CurrentUser>("/admin/v1/auth/me");
export const getAccess = () => request<AccessResponse>("/admin/v1/access");
