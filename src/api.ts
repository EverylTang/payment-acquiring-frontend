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
  channelHealth: Array<{
    channelId: string;
    name: string;
    status: string;
    successRate: number;
  }>;
};

export type AdminRecord = Record<string, string | number | boolean>;
export type OrderPage = {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
};
export type OrderStatistics = {
  totalOrders: number;
  successfulOrders: number;
  paymentSuccessRate: number;
  paymentVolume: number;
  activeMerchants: number;
};

const tokenKey = "payment-admin-token";
/** @deprecated 兼容旧入口；新业务 API 请从各业务模块 api.ts 引入。 */
export const getAccessToken = () => sessionStorage.getItem(tokenKey);
export const setAccessToken = (token: string) =>
  sessionStorage.setItem(tokenKey, token);
export const clearAccessToken = () => sessionStorage.removeItem(tokenKey);

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
  if (response.status === 401) clearAccessToken();
  if (!response.ok) {
    const raw = await response.text();
    let payload: { code?: string; message?: string } | undefined;
    try {
      payload = JSON.parse(raw) as { code?: string; message?: string };
    } catch {
      /* non-JSON gateway response */
    }
    if (payload?.message)
      throw new Error(
        `${payload.message}${payload.code ? ` [${payload.code}]` : ""}`,
      );
    throw new Error(raw || `请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export type CurrentUser = {
  username: string;
  displayName: string;
  roles: string[];
};
export type AccessMenu = {
  menuCode: string;
  menuName: string;
  menuType: string;
  routePath: string | null;
  componentKey: string | null;
  icon: string | null;
  sortOrder: number;
};
export type AccessResponse = {
  roles: string[];
  menus: AccessMenu[];
  permissions: string[];
};
export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: CurrentUser;
};
export const login = (username: string, password: string) =>
  request<LoginResponse>("/admin/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
export const getCurrentUser = () => request<CurrentUser>("/admin/v1/auth/me");
export const getAccess = () => request<AccessResponse>("/admin/v1/access");

export type AdminUser = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  roles: string[];
};
export type AdminRole = { id: number; roleCode: string; roleName: string };
export type RolePermissions = {
  menuCodes: string[];
  permissionCodes: string[];
};
export type PermissionCatalog = {
  menus: Array<{
    menuCode: string;
    menuName: string;
    parentId: number;
    menuType: string;
    status: string;
    visible: boolean;
    sortOrder: number;
  }>;
  permissions: Array<{
    permissionCode: string;
    permissionName: string;
    resourceType: string;
    status: string;
  }>;
};
export const getRoles = () =>
  request<PageResponse<AdminRole>>("/admin/v1/roles?page=1&pageSize=100");
export const getRolePermissions = (roleCode: string) =>
  request<RolePermissions>(
    `/admin/v1/roles/${encodeURIComponent(roleCode)}/permissions`,
  );
export const updateRolePermissions = (
  roleCode: string,
  payload: RolePermissions,
) =>
  request<RolePermissions>(
    `/admin/v1/roles/${encodeURIComponent(roleCode)}/permissions`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
export const getPermissionCatalog = () =>
  request<PermissionCatalog>("/admin/v1/permission-catalog");
export type Merchant = {
  merchantId: string;
  name: string;
  status: string;
  settlementCurrency: string;
  createdAt: string;
  updatedAt: string;
};
export type Product = {
  productCode: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
export type ProductCapability = {
  capabilityId: string;
  productCode: string;
  country: string;
  currency: string;
  paymentMethod: string;
  minAmount: number;
  maxAmount: number;
  supportsRefund: boolean;
  status: string;
};
export type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
export const getMerchants = (
  params: { page?: number; pageSize?: number } = {},
) =>
  request<PageResponse<Merchant>>(
    `/admin/v1/merchants?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const getMerchant = (id: string) =>
  request<Merchant>(`/admin/v1/merchants/${encodeURIComponent(id)}`);
export type MerchantProfile = {
  merchantId: string;
  legalName: string;
  registeredCountry: string;
  industry?: string;
  riskLevel: string;
  taxIdentifier?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type MerchantContact = {
  id: number;
  merchantId: string;
  contactType: string;
  contactName: string;
  email?: string;
  phone?: string;
  notifyEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};
export type MerchantCallback = {
  merchantId: string;
  callbackUrl: string;
  eventTypes: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};
export type MerchantCredential = {
  credentialId: string;
  merchantId: string;
  credentialType: string;
  secretHint: string;
  status: string;
  createdAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
};
export type RotatedCredential = {
  credentialId: string;
  credentialType: string;
  secret: string;
  createdAt: string;
};
export const getMerchantProfile = (id: string) =>
  request<MerchantProfile>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/profile`,
  );
export const updateMerchantProfile = (
  id: string,
  payload: Omit<MerchantProfile, "merchantId" | "createdAt" | "updatedAt">,
) =>
  request<MerchantProfile>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/profile`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
export const getMerchantContacts = (id: string) =>
  request<MerchantContact[]>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/contacts`,
  );
export const createMerchantContact = (
  id: string,
  payload: Omit<
    MerchantContact,
    "id" | "merchantId" | "createdAt" | "updatedAt"
  >,
) =>
  request<MerchantContact>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/contacts`,
    { method: "POST", body: JSON.stringify(payload) },
  );
export const getMerchantCallback = (id: string) =>
  request<MerchantCallback>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/callback-config`,
  );
export const updateMerchantCallback = (
  id: string,
  payload: { callbackUrl: string; eventTypesJson: string; status: string },
) =>
  request<MerchantCallback>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/callback-config`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
export const getMerchantCredentials = (id: string) =>
  request<MerchantCredential[]>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/credentials`,
  );
export const rotateMerchantCredential = (
  id: string,
  credentialType: "API" | "WEBHOOK",
) =>
  request<RotatedCredential>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/credentials/rotate`,
    { method: "POST", body: JSON.stringify({ credentialType }) },
  );
export const revokeMerchantCredential = (id: string, credentialId: string) =>
  request<void>(
    `/admin/v1/merchants/${encodeURIComponent(id)}/credentials/${encodeURIComponent(credentialId)}/revoke`,
    { method: "POST" },
  );
export const createMerchant = (payload: {
  merchantId: string;
  name: string;
  settlementCurrency: string;
}) =>
  request<Merchant>("/admin/v1/merchants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateMerchant = (
  id: string,
  payload: { name: string; settlementCurrency: string },
) =>
  request<Merchant>(`/admin/v1/merchants/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const changeMerchantStatus = (id: string, status: string) =>
  request<Merchant>(`/admin/v1/merchants/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const getProducts = (
  params: { page?: number; pageSize?: number } = {},
) =>
  request<PageResponse<Product>>(
    `/admin/v1/products?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const createProduct = (payload: { productCode: string; name: string }) =>
  request<Product>("/admin/v1/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateProduct = (code: string, payload: { name: string }) =>
  request<Product>(`/admin/v1/products/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const changeProductStatus = (code: string, status: string) =>
  request<Product>(`/admin/v1/products/${encodeURIComponent(code)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const getProductCapabilities = (code: string) =>
  request<PageResponse<ProductCapability>>(
    `/admin/v1/products/${encodeURIComponent(code)}/capabilities?page=1&pageSize=100`,
  );
export type MerchantProduct = {
  bindingId: string;
  merchantId: string;
  merchantName: string;
  productCode: string;
  productName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
export const getUsers = (params: { page?: number; pageSize?: number } = {}) =>
  request<PageResponse<AdminUser>>(
    `/admin/v1/users?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const createUser = (payload: {
  username: string;
  password: string;
  displayName: string;
  roles: string[];
}) =>
  request<AdminUser>("/admin/v1/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const getMerchantProducts = (
  params: { page?: number; pageSize?: number } = {},
) =>
  request<PageResponse<MerchantProduct>>(
    `/admin/v1/merchant-products?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const bindMerchantProduct = (payload: {
  merchantId: string;
  productCode: string;
}) =>
  request<MerchantProduct>("/admin/v1/merchant-products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateMerchantProduct = (
  id: string,
  payload: { merchantId: string; productCode: string },
) =>
  request<MerchantProduct>(
    `/admin/v1/merchant-products/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );

export type CreateOrderRequest = {
  merchantId: string;
  merchantOrderNo: string;
  productCode: string;
  paymentMethod: string;
  country: string;
  currency: string;
  amount: number;
};

export const createOrder = (
  payload: CreateOrderRequest,
  idempotencyKey: string,
) =>
  request<Order>("/v1/payments/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
export const getOrder = (id: string) =>
  request<Order>(`/v1/payments/orders/${encodeURIComponent(id)}`);
export const getOrderStatus = (id: string) =>
  request<{ orderId: string; status: string }>(
    `/v1/payments/orders/${encodeURIComponent(id)}/status`,
  );
export const getOrderHealth = () =>
  request<{ service: string; status: string }>("/v1/payments/orders/health");
export const cancelOrder = (id: string) =>
  request<Order>(`/v1/payments/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
export const callbackOrder = (id: string, status: string) =>
  request<Order>(
    `/v1/payments/orders/${encodeURIComponent(id)}/callback?status=${encodeURIComponent(status)}`,
    { method: "POST" },
  );
export const getSnapshot = (params: Record<string, string>) =>
  request<Record<string, unknown>>(
    `/admin/v1/configurations/snapshot?${new URLSearchParams({ country: "US", amount: "1.00", ...params })}`,
  );
export const getChannelHealth = (id: string) =>
  request<{ channelId: string; status: string; checkedAt: number }>(
    `/admin/v1/configurations/channels/${encodeURIComponent(id)}/health`,
  );
export const getOverview = () =>
  request<DashboardOverview>("/admin/v1/dashboard/overview");
export const getAdminList = (
  resource: string,
  params: { page?: number; pageSize?: number } = {},
) =>
  request<PageResponse<AdminRecord>>(
    `/admin/v1/${resource}?${new URLSearchParams({ page: String(params.page || 1), pageSize: String(params.pageSize || 20) })}`,
  );
export const getOrderPage = (params: {
  merchantId?: string;
  status?: string;
  currency?: string;
  page?: number;
  pageSize?: number;
}) =>
  request<OrderPage>(
    `/admin/v1/orders?${new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    )}`,
  );
export const getOrderStatistics = () =>
  request<OrderStatistics>("/admin/v1/orders/statistics");
export type Refund = {
  refundId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
};
export const createRefund = (
  orderId: string,
  payload: { amount: number; reason: string },
  idempotencyKey: string,
) =>
  request<Refund>(
    `/v1/payments/orders/${encodeURIComponent(orderId)}/refunds`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    },
  );
export const getRefund = (orderId: string, refundId: string) =>
  request<Refund>(
    `/v1/payments/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
  );
export type OutboxEvent = {
  eventId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  lastError?: string;
  deadAt?: string;
};
export const getDeadOutbox = () =>
  request<{ items: OutboxEvent[] }>("/admin/v1/outbox/dead");
export const redriveOutbox = (eventId: string, reason: string) =>
  request<OutboxEvent>(
    `/admin/v1/outbox/${encodeURIComponent(eventId)}/redrive`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
export type ReconciliationDifference = {
  difference_id: string;
  bill_id: string;
  difference_type: string;
  expected_amount: number;
  actual_amount: number;
  status: string;
  reason?: string;
};
export const getReconciliationDifferences = () =>
  request<{ items: ReconciliationDifference[] }>(
    "/admin/v1/reconciliation/differences",
  );
export const resolveReconciliationDifference = (id: string, reason: string) =>
  request<Record<string, string>>(
    `/admin/v1/reconciliation/differences/${encodeURIComponent(id)}/resolve`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
