import assert from "node:assert/strict";
import { test } from "node:test";

// 仅 GET，无真实账号、密码或 token；与合成 UI 回归分开运行。
const baseUrl = process.env.ADMIN_API_URL || "http://127.0.0.1:8080";
const paths = [
  "/api/admin/v1/access",
  "/api/admin/v1/merchants?page=1&pageSize=1",
  "/api/admin/v1/orders?page=1&pageSize=1",
  "/api/admin/v1/roles?page=1&pageSize=1",
  "/api/admin/v1/settlement/batches/SYNTHETIC_NOT_FOUND",
  "/api/admin/v1/outbox/dead?limit=1",
];

for (const [mode, headers] of [
  ["未登录", {}],
  ["无效 Bearer", { Authorization: "Bearer SYNTHETIC_INVALID_TOKEN" }],
]) {
  test(`真实 Gateway ${mode}只读访问必须返回 401`, async t => {
    for (const path of paths) {
      await t.test(new URL(path, baseUrl).pathname, async () => {
        const response = await fetch(new URL(path, baseUrl), {
          method: "GET", headers, redirect: "manual", signal: AbortSignal.timeout(10000),
        });
        await response.body?.cancel();
        assert.equal(response.status, 401, "未通过身份认证的请求不得返回业务数据或重定向到业务页面");
      });
    }
  });
}
