const tokenKey = "payment-admin-token";

export const getAccessToken = () => sessionStorage.getItem(tokenKey);
export const setAccessToken = (token: string) =>
  sessionStorage.setItem(tokenKey, token);
export const clearAccessToken = () => sessionStorage.removeItem(tokenKey);
let unauthorizedHandler = clearAccessToken;
export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};

/** 统一 HTTP 请求入口；业务请求请放在对应模块的 api.ts。 */
export const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const token = getAccessToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (response.status === 401) unauthorizedHandler();
  if (!response.ok) {
    const raw = await response.text();
    let payload: { code?: string; message?: string } | undefined;
    try {
      payload = JSON.parse(raw) as { code?: string; message?: string };
    } catch {
      /* non-JSON gateway response */
    }
    if (payload?.message) {
      throw new Error(
        `${payload.message}${payload.code ? ` [${payload.code}]` : ""}`,
      );
    }
    throw new Error(raw || `请求失败 (${response.status})`);
  }
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0" ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};
