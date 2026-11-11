import { reactive } from "vue";
import {
  clearAccessToken, getAccessToken, setAccessToken, setUnauthorizedHandler,
} from "./api";
import { getAccess, getCurrentUser, login, type AccessResponse, type CurrentUser } from "./modules/auth/api";

export const authState = reactive<{
  user: CurrentUser | null;
  access: AccessResponse | null;
  ready: boolean;
  expiredNotice: string;
}>({ user: null, access: null, ready: false, expiredNotice: "" });

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
  authState.expiredNotice = "";
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

const handleUnauthorized = () => {
  signOut();
  authState.expiredNotice = "登录已过期,请重新登录。";
};

setUnauthorizedHandler(handleUnauthorized);
