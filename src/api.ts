export type Order = {
  orderId: string;
  merchantId: string;
  merchantOrderNo: string;
  currency: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  status: string;
  expireAt?: string;
  createdAt?: string;
  paidAt?: string;
};

export type DashboardOverview = {
  paymentSuccessRate: number;
  paymentVolume: number;
  activeMerchants: number;
  activeChannels: number;
  pendingReleases: number;
  channelHealth: Array<{ channelId: string; name: string; status: string; successRate: number }>;
};

export type AdminRecord = Record<string, string | number | boolean>;
export type OrderPage = { items: Order[]; page: number; pageSize: number; total: number };
export type OrderStatistics = { totalOrders: number; successfulOrders: number; paymentSuccessRate: number; paymentVolume: number; activeMerchants: number };

const tokenKey = 'payment-admin-token';
export const getAccessToken = () => sessionStorage.getItem(tokenKey);
export const setAccessToken = (token: string) => sessionStorage.setItem(tokenKey, token);
export const clearAccessToken = () => sessionStorage.removeItem(tokenKey);

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = getAccessToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) }
  });
  if (response.status === 401) clearAccessToken();
  if (!response.ok) throw new Error((await response.text()) || `请求失败 (${response.status})`);
  return response.json() as Promise<T>;
};

export type CurrentUser = { username: string; displayName: string; roles: string[] };
export type AccessMenu = { menuCode: string; menuName: string; menuType: string; routePath: string | null; componentKey: string | null; icon: string | null; sortOrder: number };
export type AccessResponse = { roles: string[]; menus: AccessMenu[]; permissions: string[] };
export type LoginResponse = { accessToken: string; tokenType: string; expiresIn: number; user: CurrentUser };
export const login = (username: string, password: string) => request<LoginResponse>('/admin/v1/auth/login', {
  method: 'POST', body: JSON.stringify({ username, password })
});
export const getCurrentUser = () => request<CurrentUser>('/admin/v1/auth/me');
export const getAccess = () => request<AccessResponse>('/admin/v1/access');

export type AdminUser = { id: number; username: string; displayName: string; status: string; roles: string[] };
export type MerchantProduct = { bindingId: string; merchantId: string; merchantName: string; productCode: string; productName: string; status: string; createdAt: string; updatedAt: string };
export const getUsers = () => request<AdminUser[]>('/admin/v1/users');
export const createUser = (payload: { username: string; password: string; displayName: string; roles: string[] }) => request<AdminUser>('/admin/v1/users', { method: 'POST', body: JSON.stringify(payload) });
export const getMerchantProducts = () => request<MerchantProduct[]>('/admin/v1/merchant-products');
export const bindMerchantProduct = (payload: { merchantId: string; productCode: string }) => request<MerchantProduct>('/admin/v1/merchant-products', { method: 'POST', body: JSON.stringify(payload) });

export type CreateOrderRequest = {
  merchantId: string;
  merchantOrderNo: string;
  productCode: string;
  paymentMethod: string;
  country: string;
  currency: string;
  amount: number;
};

export const createOrder = (payload: CreateOrderRequest, idempotencyKey: string) => request<Order>('/v1/payments/orders', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(payload)
});
export const getOrder = (id: string) => request<Order>(`/v1/payments/orders/${encodeURIComponent(id)}`);
export const getOrderStatus = (id: string) => request<{ orderId: string; status: string }>(`/v1/payments/orders/${encodeURIComponent(id)}/status`);
export const getOrderHealth = () => request<{ service: string; status: string }>('/v1/payments/orders/health');
export const cancelOrder = (id: string) => request<Order>(`/v1/payments/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
export const callbackOrder = (id: string, status: string) => request<Order>(`/v1/payments/orders/${encodeURIComponent(id)}/callback?status=${encodeURIComponent(status)}`, { method: 'POST' });
export const getSnapshot = (params: Record<string, string>) => request<Record<string, unknown>>(`/admin/v1/configurations/snapshot?${new URLSearchParams({ country: 'US', amount: '1.00', ...params })}`);
export const getChannelHealth = (id: string) => request<{ channelId: string; status: string; checkedAt: number }>(`/admin/v1/configurations/channels/${encodeURIComponent(id)}/health`);
export const getOverview = () => request<DashboardOverview>('/admin/v1/dashboard/overview');
export const getAdminList = (resource: string) => request<AdminRecord[]>(`/admin/v1/${resource}`);
export const getOrderPage = (params: { merchantId?: string; status?: string; currency?: string; page?: number; pageSize?: number }) => request<OrderPage>(`/admin/v1/orders?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]))}`);
export const getOrderStatistics = () => request<OrderStatistics>('/admin/v1/orders/statistics');
