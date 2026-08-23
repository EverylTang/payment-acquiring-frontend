import { reactive } from "vue";
import {
  clearAccessToken, getAccessToken, setAccessToken,
} from "./api";
import { getAccess, getCurrentUser, login, type AccessResponse, type CurrentUser } from "./modules/auth/api";

export const authState = reactive<{
  user: CurrentUser | null;
  access: AccessResponse | null;
  ready: boolean;
}>({ user: null, access: null, ready: false });

export const restoreSession = async () => {
  if (getAccessToken()) {
    try {
      [authState.user, authState.access] = await Promise.all([
        getCurrentUser(),
        getAccess(),
      ]);
    } catch {
      clearAccessToken();
    }
  }
  authState.ready = true;
};

export const signIn = async (username: string, password: string) => {
  const response = await login(username, password);
  setAccessToken(response.accessToken);
  authState.user = response.user;
  authState.access = await getAccess();
};

export const hasPermission = (permission: string) =>
  authState.access?.permissions.includes(permission) ?? false;
export const hasAnyPermission = (permissions: string[]) =>
  permissions.some(hasPermission);

export const signOut = () => {
  clearAccessToken();
  authState.user = null;
  authState.access = null;
};
