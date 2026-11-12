import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test } from "node:test";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.ADMIN_UI_URL || "http://127.0.0.1:5173";
const shots = process.env.ADMIN_UI_SCREENSHOTS;
const root = "/api/admin/v1";
const pageOf = (items, total = items.length, page = 1, pageSize = 100) => ({ items, total, page, pageSize });
const merchant = { merchantId: "M_TEST", name: "合成测试商户", country: "US", status: "ACTIVE" };
const currency = { code: "USD", name: "合成测试美元", symbol: "$", decimalPlaces: 2, status: "ACTIVE" };
const country = { code: "US", name: "合成测试国家", region: "TEST", status: "ACTIVE" };
const menu = (id, parentId, menuCode, menuName = menuCode) => ({ id, parentId, menuCode, menuName, menuType: "PAGE", routePath: "/test", componentKey: "test", icon: "Settings2", sortOrder: id, visible: true, status: "ACTIVE" });

const fixture = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><div id="fixture"></div><script type="module">
import { createApp, h, reactive } from '/node_modules/.vite/deps/vue.js';
import { authState } from '/src/auth.ts';
import '/src/style.css';
${["date-picker", "form", "form-item", "tab-pane", "input-number", "loading", "select", "table", "table-column", "tabs"].map(name => `import '/node_modules/element-plus/es/components/${name}/style/css.mjs';`).join("\n")}
const views = {
  menu: '/src/modules/menu/MenuManagementView.vue',
  master: '/src/modules/master-data/MasterDataView.vue',
  risk: '/src/modules/risk/RiskWorkspaceView.vue',
  config: '/src/modules/configuration/ConfigurationCenterView.vue',
  merchant: '/src/modules/merchant/MerchantManagementView.vue',
  detail: '/src/modules/merchant/MerchantDetailView.vue',
  product: '/src/modules/product/ProductManagementView.vue',
  role: '/src/modules/permission/PermissionManagementView.vue',
  order: '/src/modules/order/OrderManagementView.vue',
  settlement: '/src/modules/settlement/SettlementManagementView.vue',
  operations: '/src/modules/operations/OperationsView.vue',
  user: '/src/modules/user/UserManagementView.vue'
};
const setup = window.workflowSetup;
authState.access = { roles: [], menus: [], permissions: setup.permissions };
authState.user = { username: 'synthetic', displayName: '合成测试账号', roles: [] };
authState.ready = true;
window.workflowNotices = reactive([]);
window.setPermissions = permissions => authState.access.permissions = permissions;
const view = (await import(views[setup.view])).default;
createApp({ setup: () => () => h('div', { style: 'padding:16px;min-height:900px' }, [
  h('p', {}, '功能回归：合成数据，全部接口已拦截，不连接真实业务'),
  h(view, { ...setup.props, onNotice: message => window.workflowNotices.push(message) }),
  h('div', { id: 'workflow-notices', role: 'status' }, window.workflowNotices.map(message => h('p', {}, message)))
]) }).mount('#fixture');
</script></body></html>`;

// 默认拒绝未声明接口，包括 GET；不会使用真实 token，也不会把写请求送到后端。
async function mount(t, browser, view, permissions, handler, props = {}, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Shanghai", ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const calls = [], unexpected = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(setup => { window.workflowSetup = setup; }, { view, permissions, props });
  // 字体样式不是业务回归目标，避免外部 CDN 延迟阻塞页面加载。
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const call = { path: decodeURIComponent(url.pathname).replace(root, ""), method: request.method(), query: url.searchParams, body: request.postDataJSON() };
    calls.push(call);
    const result = await handler(call);
    if (result === undefined) {
      unexpected.push(`${call.method} ${call.path}`);
      return route.fulfill({ status: 500, json: { message: "未声明的测试接口" } });
    }
    if (typeof result.status === "number") return route.fulfill(result);
    return route.fulfill({ status: 200, json: result });
  });
  await page.route("**/__admin-workflows", route => route.fulfill({ contentType: "text/html", body: fixture }));
  t.after(async () => {
    await context.close();
    assert.deepEqual(unexpected, [], "不得访问未声明的业务接口");
    assert.deepEqual(errors, [], "浏览器不得出现未处理错误");
  });
  await page.goto(`${baseUrl}/__admin-workflows`);
  await page.locator(".workspace-panel, .panel, .detail-heading").first().waitFor();
  return { page, calls };
}
const failure = message => ({ status: 403, json: { message } });
async function snapshot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/workflow-${name}.png`, fullPage: true, animations: "disabled" });
}
const fillLabel = (scope, name, value) => scope.locator("label").filter({ hasText: new RegExp(`^${name}( \\*)?$`) }).locator("input").fill(value);

test("管理后台功能与分权浏览器回归", async t => {
  const browser = await chromium.launch({ chromiumSandbox: true });
  t.after(() => browser.close());

  await t.test("筛选后的子菜单保持原父级，父目录跨页完整加载并排除后代", async t => {
    const parent = menu(101, 0, "ROOT", "合成父目录"); parent.menuType = "DIRECTORY";
    const child = menu(102, 101, "CHILD", "合成子菜单");
    const descendant = menu(103, 102, "DESCENDANT");
    const firstPage = Array.from({ length: 100 }, (_, i) => menu(i + 1, 0, `MENU_${i + 1}`));
    let saved;
    const { page, calls } = await mount(t, browser, "menu", [], call => {
      if (call.path === "/menus/resource-types") return [{ resourceType: "MENU", resourceName: "菜单" }];
      if (call.path === "/menus/CHILD/resource-types") return ["MENU"];
      if (call.path === "/menus" && call.method === "GET") {
        if (call.query.get("pageSize") !== "100" || call.query.get("menuName")) return pageOf([child]);
        return call.query.get("page") === "1" ? pageOf(firstPage, 103) : pageOf([parent, child, descendant], 103, 2);
      }
      if (call.path === "/menus/CHILD" && call.method === "PUT") { saved = call.body; return { ...child, menuName: call.body.menuName }; }
    });
    await page.getByPlaceholder("输入菜单名称").fill("合成子菜单");
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await page.getByTitle("编辑菜单", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑菜单", exact: true });
    await dialog.waitFor();
    const select = dialog.locator("label").filter({ hasText: "父级菜单" }).locator("select");
    assert.equal(await select.inputValue(), "ROOT");
    assert.equal(await select.locator('option[value="DESCENDANT"]').count(), 0);
    assert.equal(await select.locator('option[value="CHILD"]').count(), 0);
    await dialog.getByPlaceholder("请输入菜单名称").fill("合成修改名称");
    await snapshot(page, "menu-parent");
    await dialog.getByRole("button", { name: "保存菜单", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(saved.parentMenuCode, "ROOT");
    assert.ok(calls.some(call => call.path === "/menus" && call.query.get("page") === "2"));
  });

  await t.test("父级缺失时阻止编辑，不会静默保存为根菜单", async t => {
    const child = menu(2, 999, "ORPHAN", "合成孤立菜单");
    const { page, calls } = await mount(t, browser, "menu", [], call => {
      if (call.path === "/menus") return pageOf([child]);
      if (call.path === "/menus/resource-types") return [];
      if (call.path === "/menus/ORPHAN/resource-types") return ["MENU"];
    });
    await page.getByTitle("编辑菜单", { exact: true }).click();
    await page.getByText("原父级菜单未找到", { exact: false }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.ok(!calls.some(call => call.method === "PUT"));
  });

  const pricing = { ruleId: "PRICE_TEST", releaseVersion: 1, productCode: "P_SYNTHETIC", currency: "USD", feeRate: 0.01, fixedFee: 0, extraFee: 0, feeType: "PERCENTAGE", tiers: [], feeMode: "PAYER_BEAR", minAmount: 1, maxAmount: 1000, status: "ACTIVE" };
  await t.test("无主数据和其他参考权限仍可查看费率列表", async t => {
    const { page, calls } = await mount(t, browser, "config", ["pricing-rule:list"], call => {
      if (call.path === "/pricing-rules") return pageOf([pricing]);
    }, { section: "pricing" });
    await page.getByText("P_SYNTHETIC", { exact: true }).waitFor();
    assert.deepEqual(calls.map(call => call.path), ["/pricing-rules"]);
  });
  await t.test("币种参考接口失败不阻断业务列表", async t => {
    const { page } = await mount(t, browser, "config", ["pricing-rule:list", "master-data:list"], call => {
      if (call.path === "/pricing-rules") return pageOf([pricing]);
      if (call.path === "/master-data/currencies/active") return failure("合成币种接口错误");
    }, { section: "pricing" });
    await page.getByText("P_SYNTHETIC", { exact: true }).waitFor();
    await page.locator("#workflow-notices").getByText(/合成币种接口错误/).waitFor();
  });
  await t.test("仅路由读取权限默认进入路由，不请求渠道和其他选项", async t => {
    const { page, calls } = await mount(t, browser, "config", ["routing-rule:list"], call => {
      if (call.path === "/routing-rules") return pageOf([{ ruleId: "ROUTE_TEST", releaseVersion: 1, productCode: "P_ROUTE", paymentMethod: "CARD", currency: "USD", channelId: "CH_TEST", priority: 1, weight: 100, status: "ACTIVE" }]);
    }, { section: "routing" });
    await page.getByText("P_ROUTE", { exact: true }).waitFor();
    assert.deepEqual(calls.map(call => call.path), ["/routing-rules"]);
  });

  await t.test("关联现有币种仅调用关联接口，不会重复创建币种", async t => {
    let associated;
    const relations = [{ countryCode: "US", countryName: country.name, currencyCode: "EUR", currencyName: "测试欧元", status: "DISABLED" }];
    const { page, calls } = await mount(t, browser, "master", ["master-data:list", "master-data:create"], call => {
      if (call.path === "/master-data/countries") return pageOf([country]);
      if (call.path === "/master-data/country-currencies" && call.method === "GET") return pageOf(relations);
      if (call.path === "/master-data/currencies/active") return [currency, { ...currency, code: "EUR" }];
      if (call.path === "/master-data/country-currencies" && call.method === "POST") { associated = call.body; relations.push({ ...call.body, currencyName: currency.name, status: "ACTIVE" }); return relations.at(-1); }
    });
    await page.getByTitle("管理关联币种", { exact: true }).click();
    await page.getByRole("button", { name: "关联现有币种", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /关联现有币种/ });
    await dialog.locator("select").waitFor();
    assert.equal(await dialog.locator('option[value="EUR"]').count(), 0);
    await dialog.locator("select").selectOption("USD");
    assert.ok(await dialog.getByRole("button", { name: "确认关联", exact: true }).evaluate(el => {
      const box = el.getBoundingClientRect(), mask = el.closest('.drawer-mask').getBoundingClientRect();
      return box.top >= mask.top && box.bottom <= mask.bottom && box.bottom <= innerHeight;
    }), "关联操作按钮不能被局部抽屉裁切");
    await snapshot(page, "currency-association");
    await dialog.getByRole("button", { name: "确认关联", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(associated, { countryCode: "US", currencyCode: "USD" });
    assert.ok(!calls.some(call => call.method === "POST" && call.path.includes("/countries/")));
  });

  await t.test("风控名单本地时间转换为 UTC Instant，未填失效时间则省略", async t => {
    const payloads = [];
    const { page } = await mount(t, browser, "risk", ["risk:list:manage"], call => {
      if (call.path === "/risk/overview") return { openEvents: 0, reviewEvents: 0, rejectedEvents: 0, events24h: 0 };
      if (call.path === "/risk/events" || (call.path === "/risk/lists" && call.method === "GET")) return pageOf([]);
      if (call.path === "/risk/lists" && call.method === "POST") { payloads.push(call.body); return { status: 204 }; }
    });
    await page.getByRole("button", { name: "名单管理", exact: true }).click();
    for (const expiry of ["2030-01-02T10:30", ""]) {
      await page.getByRole("button", { name: "新增名单", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "新增名单", exact: true });
      await dialog.getByPlaceholder("仅用于本地哈希，不会保存原文").fill("synthetic@example.invalid");
      await dialog.getByPlaceholder("例如 已确认盗刷").fill("合成测试");
      await dialog.locator('input[type="datetime-local"]').fill(expiry);
      assert.match(await dialog.innerText(), /Asia\/Shanghai/);
      await dialog.getByRole("button", { name: "保存名单", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
    }
    assert.equal(payloads[0].expiresAt, "2030-01-02T02:30:00.000Z");
    assert.ok(!("expiresAt" in payloads[1]));
    if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: `${shots}/workflow-risk.png`, fullPage: true }); }
  });

  await t.test("商户账户已创建而资料失败，重试只保存资料", async t => {
    let profiles = 0;
    const { page, calls } = await mount(t, browser, "merchant", ["merchant:list", "merchant:create", "merchant:profile:update"], call => {
      if (call.path === "/merchants" && call.method === "GET") return pageOf([]);
      if (call.path === "/merchants" && call.method === "POST") return { ...merchant, name: call.body.name };
      if (call.path === "/merchants/M_TEST/profile" && call.method === "PUT") return ++profiles === 1 ? failure("合成资料失败") : { merchantId: merchant.merchantId, ...call.body };
    });
    await page.getByRole("button", { name: "新增商户", exact: true }).click();
    const create = page.getByRole("dialog", { name: "新增商户", exact: true });
    await fillLabel(create, "商户名称", merchant.name);
    await fillLabel(create, "法定名称", "合成法定主体");
    await fillLabel(create, "注册国家 / 地区", "US");
    await create.getByRole("button", { name: "创建商户", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "编辑商户", exact: true });
    await edit.getByRole("alert").getByText(/不会重复创建/).waitFor();
    await snapshot(page, "merchant-retry");
    await edit.getByRole("button", { name: "保存商户资料", exact: true }).click();
    await edit.waitFor({ state: "hidden" });
    assert.equal(calls.filter(call => call.method === "POST").length, 1);
    assert.equal(profiles, 2);
    assert.deepEqual(calls.filter(call => call.method === "PUT").map(call => call.path), ["/merchants/M_TEST/profile", "/merchants/M_TEST/profile"]);
  });

  await t.test("仅商户创建权限不会提交法定资料", async t => {
    const { page, calls } = await mount(t, browser, "merchant", ["merchant:list", "merchant:create"], call => {
      if (call.path === "/merchants") return call.method === "GET" ? pageOf([]) : merchant;
    });
    await page.getByRole("button", { name: "新增商户", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新增商户", exact: true });
    await fillLabel(dialog, "商户名称", merchant.name);
    await dialog.getByRole("button", { name: "创建商户", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => call.path), ["/merchants"]);
  });

  await t.test("产品及首条能力已保存，失败重试不重复创建", async t => {
    let capabilities = 0;
    const { page, calls } = await mount(t, browser, "product", ["product:list", "product:create", "product-capability:create"], call => {
      if (call.path === "/products" && call.method === "GET") return pageOf([]);
      if (call.path === "/products" && call.method === "POST") return { ...call.body, status: "ACTIVE", activeCapabilityCount: 0 };
      if (call.path === "/products/P_TEST/capabilities" && call.method === "POST") {
        capabilities += 1;
        return capabilities === 2 ? failure("合成第二能力失败") : { ...call.body, capabilityId: `CAP_${capabilities}`, productCode: "P_TEST", status: "ACTIVE" };
      }
    });
    await page.getByRole("button", { name: "新建产品", exact: true }).click();
    const create = page.getByRole("dialog", { name: "新建产品", exact: true });
    await create.getByPlaceholder("例如 CARD-US-USD").fill("P_TEST");
    await create.getByPlaceholder("例如 美国卡支付").fill("合成测试产品");
    await create.getByRole("button", { name: "新增支付方式", exact: true }).click();
    await fillLabel(create.locator(".capability-editor").nth(1), "对客支付方式", "PIX");
    await create.getByRole("button", { name: "保存产品", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "编辑产品", exact: true });
    await edit.getByRole("alert").getByText(/不会重复创建/).waitFor();
    assert.ok(await edit.locator(".capability-editor").first().locator("input").first().isDisabled());
    await snapshot(page, "product-retry");
    await edit.getByRole("button", { name: "保存产品", exact: true }).click();
    await edit.waitFor({ state: "hidden" });
    assert.equal(calls.filter(call => call.path === "/products" && call.method === "POST").length, 1);
    assert.deepEqual(calls.filter(call => call.path.endsWith("/capabilities")).map(call => call.body.customerPaymentMethod), ["CARD", "PIX", "PIX"]);
  });

  await t.test("商户资料不被国家参考失败阻断并保留当前国家", async t => {
    const { page } = await mount(t, browser, "detail", ["merchant:profile", "merchant:profile:update", "master-data:list"], call => {
      if (call.path === "/merchants/M_TEST/profile") return { merchantId: merchant.merchantId, legalName: "合成法定主体", businessType: "COMPANY", registeredCountry: "US", riskLevel: "MEDIUM" };
      if (call.path === "/master-data/countries/active") return failure("合成国家接口失败");
    }, { merchant, section: "profile" });
    const countrySelect = page.locator("label").filter({ hasText: "注册国家 / 地区" }).locator("select");
    await countrySelect.locator('option[value="US"]').waitFor({ state: "attached" });
    assert.equal(await countrySelect.inputValue(), "US");
    assert.ok(await page.getByRole("button", { name: "保存资料", exact: true }).isEnabled());
  });

  for (const section of ["contacts", "credentials"]) {
    await t.test(`商户 ${section} 页面不读取国家选项`, async t => {
      const { page, calls } = await mount(t, browser, "detail", ["master-data:list"], call => {
        if (call.path === `/merchants/M_TEST/${section}`) return [];
      }, { merchant, section });
      await page.locator(".merchant-empty").waitFor();
      assert.deepEqual(calls.map(call => call.path), [`/merchants/M_TEST/${section}`]);
    });
  }

  for (const credentialType of ["API", "WEBHOOK"]) {
    await t.test(`${credentialType} 一次性凭证保持到明确确认，刷新失败不丢失`, async t => {
      const secret = `SYNTHETIC_ONLY_${credentialType}_SECRET`;
      let reads = 0;
      const { page, calls } = await mount(t, browser, "detail", ["merchant:credential:list", "merchant:credential:rotate"], call => {
        if (call.path === "/merchants/M_TEST/credentials") return ++reads === 1 ? [] : failure("合成列表刷新失败");
        if (call.path === "/merchants/M_TEST/credentials/rotate") return { credentialId: `KEY_${credentialType}`, credentialType, secret, createdAt: "2030-01-01T00:00:00Z" };
      }, { merchant, section: "credentials" });
      await page.getByLabel("凭证类型", { exact: true }).selectOption(credentialType);
      await page.getByRole("button", { name: `轮换 ${credentialType} 凭证`, exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "一次性凭证交付" });
      await dialog.getByText(secret, { exact: true }).waitFor();
      await dialog.getByText(/列表刷新失败/).waitFor();
      assert.ok(await dialog.getByRole("button", { name: "我已安全保存，确认关闭", exact: true }).isDisabled());
      await page.keyboard.press("Escape");
      await page.mouse.click(2, 2);
      // Exceeds the former six-second auto-clear window.
      await page.waitForTimeout(6200);
      assert.ok(await dialog.getByText(secret, { exact: true }).isVisible());
      assert.ok(await dialog.getByText(`KEY_${credentialType}`, { exact: true }).isVisible());
      assert.ok(!(await page.locator("#workflow-notices").innerText()).includes(secret));
      assert.ok(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(secret));
      await snapshot(page, `credential-${credentialType.toLowerCase()}`);
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: "我已安全保存，确认关闭", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await page.getByText(secret, { exact: true }).count(), 0);
      assert.deepEqual(calls.filter(call => call.method === "POST").map(call => call.body), [{ credentialType }]);
    });
  }

  const testRole = { id: 1, roleCode: "TEST", roleName: "合成测试角色" };
  for (const section of ["access", "scope"]) {
    await t.test(`仅角色 ${section} 权限可单独保存，不依赖改名权限`, async t => {
      const access = section === "access";
      const configPath = access ? "/roles/TEST/permissions" : "/data-scopes/roles/TEST";
      const config = access ? { menuCodes: [], permissionCodes: [] } : { roleCode: "TEST", scopeTypes: ["SELF"] };
      const permissions = ["system:role:list", ...(access ? ["system:permission:list", "system:role:permission:list", "system:role:permission:update"] : ["system:data-scope:role:list", "system:data-scope:role:update"])];
      const { page, calls } = await mount(t, browser, "role", permissions, call => {
        if (call.path === "/roles") return pageOf([testRole]);
        if (call.path === "/permission-catalog") return { menus: [], permissions: [] };
        if (call.path === configPath) return config;
      });
      await page.getByRole("button", { name: access ? "授权" : "数据范围", exact: true }).click();
      const save = page.getByRole("button", { name: access ? "保存权限配置" : "保存数据范围", exact: true });
      await save.waitFor();
      await page.getByText("加载中…", { exact: true }).waitFor({ state: "hidden" });
      await snapshot(page, `role-${section}`);
      await save.click();
      await page.locator("#workflow-notices").getByText(access ? "角色权限已保存" : "数据范围已保存", { exact: true }).waitFor();
      assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => `${call.method} ${call.path}`), [`PUT ${configPath}`]);
    });
  }

  await t.test("仅角色创建权限使用一次 POST 完成初始配置", async t => {
    const { page, calls } = await mount(t, browser, "role", ["system:role:list", "system:role:create"], call => {
      if (call.path === "/roles") return call.method === "GET" ? pageOf([]) : { ...testRole, ...call.body };
    });
    await page.getByRole("button", { name: "新增角色", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新增角色", exact: true });
    await dialog.getByPlaceholder("例如 RISK_REVIEWER").fill("TEST");
    await dialog.getByPlaceholder("请输入角色名称").fill(testRole.roleName);
    await dialog.getByRole("button", { name: "创建并授权", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => `${call.method} ${call.path}`), ["POST /roles"]);
  });

  await t.test("角色原配置读取失败时禁止覆盖保存", async t => {
    const { page, calls } = await mount(t, browser, "role", ["system:role:list", "system:data-scope:role:list", "system:data-scope:role:update"], call => {
      if (call.path === "/roles") return pageOf([testRole]);
      if (call.path === "/data-scopes/roles/TEST") return failure("合成配置读取失败");
    });
    await page.getByRole("button", { name: "数据范围", exact: true }).click();
    await page.locator("#workflow-notices").getByText("合成配置读取失败", { exact: true }).waitFor();
    assert.ok(await page.getByRole("button", { name: "保存数据范围", exact: true }).isDisabled());
    assert.ok(!calls.some(call => call.method !== "GET"));
  });

  await t.test("退款只读查询不受订单创建退款条件限制", async t => {
    const order = { orderId: "O_TEST", merchantId: merchant.merchantId, merchantOrderNo: "SYNTHETIC", productCode: "P_TEST", orderType: "PAYOUT", status: "FAILED", amount: 10, currency: "USD", country: "US", paymentMethod: "CARD", createdAt: "2030-01-01T00:00:00Z" };
    const { page, calls } = await mount(t, browser, "order", ["order:list"], call => {
      if (call.path === "/orders") return pageOf([order]);
      if (call.path === "/orders/O_TEST") return order;
      if (call.path === "/orders/O_TEST/refunds/R_TEST") return { refundId: "R_TEST", orderId: order.orderId, amount: 10, currency: "USD", status: "CREATED" };
    });
    await page.getByTitle("查看订单详情", { exact: true }).click();
    await page.getByPlaceholder("退款 ID", { exact: true }).fill("R_TEST");
    await page.getByRole("button", { name: "查询退款", exact: true }).click();
    await page.locator(".refund-panel").getByText("R_TEST", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /提交退款|执行退款/ }).count(), 0);
    assert.ok(calls.every(call => call.method === "GET"));
    await snapshot(page, "refund-readonly");
  });

  await t.test("仅结算批次读取权限可查询，不读取规则与参考数据", async t => {
    const { page, calls } = await mount(t, browser, "settlement", ["settlement:batch:read"], call => {
      if (call.path === "/settlement/batches/B_TEST") return { batch: { batchId: "B_TEST", status: "SUCCESS", totalOrders: 0, totalMerchants: 0, totalAmount: 0 }, details: [] };
    });
    await page.getByRole("button", { name: "查询批次", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "结算批次", exact: true });
    await dialog.getByPlaceholder("输入批次 ID 查询").fill("B_TEST");
    await dialog.getByRole("button", { name: "查询批次", exact: true }).click();
    await dialog.getByText("B_TEST", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /手动执行|执行批次/ }).count(), 0);
    assert.deepEqual(calls.map(call => `${call.method} ${call.path}`), ["GET /settlement/batches/B_TEST"]);
    await snapshot(page, "settlement-readonly");
  });

  const testUser = { id: 1, username: "synthetic_user", displayName: "合成测试用户", status: "ACTIVE", roles: ["LEGACY_TEST"] };
  await t.test("用户只读列表不请求角色或数据范围，刷新失败标记旧数据", async t => {
    let fail = false;
    const { page, calls } = await mount(t, browser, "user", ["system:user:list"], call => {
      if (call.path === "/users") return fail ? failure("合成用户刷新失败") : pageOf([testUser]);
    });
    await page.getByText(testUser.displayName, { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /编辑|数据范围|重置密码|配置角色/ }).count(), 0);
    fail = true;
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "合成用户刷新失败" }).waitFor();
    assert.ok(await page.getByText(testUser.displayName, { exact: true }).isVisible());
    assert.ok(calls.every(call => call.path === "/users" && call.method === "GET"));
  });

  await t.test("角色目录失败不阻断用户列表，保存保留已有角色编码", async t => {
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:user:update", "system:role:list"], call => {
      if (call.path === "/roles") return failure("合成角色目录失败");
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/users/1" && call.method === "PUT") return { ...testUser, ...call.body };
    });
    await page.getByText(testUser.displayName, { exact: true }).waitFor();
    await page.getByRole("alert").filter({ hasText: "合成角色目录失败" }).waitFor();
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    assert.equal(await dialog.getByPlaceholder("多个角色编码请用逗号分隔").inputValue(), "LEGACY_TEST");
    await fillLabel(dialog, "显示名称", "合成新名称");
    await dialog.getByRole("button", { name: "保存用户", exact: true }).click();
    await page.locator("#workflow-notices").getByText("用户资料与角色已保存", { exact: true }).waitFor();
    assert.deepEqual(calls.find(call => call.method === "PUT").body, { displayName: "合成新名称", roles: ["LEGACY_TEST"] });
    assert.equal(await dialog.getByText("商户数据范围", { exact: true }).count(), 0);
    assert.equal(await dialog.locator('input[type="password"]').count(), 0);
  });

  await t.test("角色目录跨页加载，角色专属更新保留目录外的已有角色", async t => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, roleCode: `ROLE_${i}`, roleName: `合成角色${i}` }));
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:user:role:update", "system:role:list"], call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/roles") return call.query.get("page") === "1" ? pageOf(first, 101) : pageOf([testRole], 101, 2);
      if (call.path === "/users/1/roles" && call.method === "PUT") return { ...testUser, ...call.body };
    });
    await page.getByRole("button", { name: "配置角色", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await dialog.getByRole("checkbox", { name: testRole.roleName, exact: true }).check();
    assert.ok(await dialog.getByRole("checkbox", { name: "LEGACY_TEST", exact: true }).isChecked());
    assert.ok(await dialog.getByPlaceholder("请输入显示名称").isDisabled());
    await dialog.getByRole("button", { name: "保存用户角色", exact: true }).click();
    await page.locator("#workflow-notices").getByText("用户角色已保存", { exact: true }).waitFor();
    assert.deepEqual(calls.filter(call => call.method === "PUT").map(call => [call.path, call.body]), [["/users/1/roles", { roles: ["LEGACY_TEST", "TEST"] }]]);
    assert.ok(calls.some(call => call.path === "/roles" && call.query.get("page") === "2"));
  });

  await t.test("仅密码重置权限可操作，保存期间禁改禁关且密码不进入通知或存储", async t => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    t.after(() => release());
    const password = "SYNTHETIC_PASSWORD_ONLY";
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:user:password:reset"], async call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/users/1/reset-password" && call.method === "POST") { await pending; return { status: 204 }; }
    });
    await page.getByRole("button", { name: "重置密码", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    const input = dialog.locator('input[type="password"]');
    assert.equal(await input.getAttribute("maxlength"), "128");
    await input.fill("short");
    assert.ok(await dialog.getByRole("button", { name: "重置密码", exact: true }).isDisabled());
    await input.fill(password);
    const passwordRequest = page.waitForRequest(request => request.url().endsWith("/reset-password") && request.method() === "POST");
    await dialog.getByRole("button", { name: "重置密码", exact: true }).click();
    await passwordRequest;
    assert.ok(await input.isDisabled());
    await dialog.getByTitle("关闭", { exact: true }).click();
    assert.ok(await dialog.isVisible());
    release();
    await page.locator("#workflow-notices").getByText("密码已重置", { exact: true }).waitFor();
    assert.equal(await input.inputValue(), "");
    assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => [call.path, call.body]), [["/users/1/reset-password", { newPassword: password }]]);
    assert.ok(!(await page.locator("#workflow-notices").innerText()).includes(password));
    assert.ok(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(password));
    assert.equal(await dialog.getByText("商户数据范围", { exact: true }).count(), 0);
  });

  await t.test("用户范围读取失败禁止覆盖，不误把空输入保存为全部商户", async t => {
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:data-scope:user:list", "system:data-scope:user:update"], call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/data-scopes/users/1") return failure("合成用户范围读取失败");
    });
    await page.getByRole("button", { name: "数据范围", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await dialog.getByRole("alert").filter({ hasText: "已禁止覆盖保存" }).waitFor();
    assert.ok(await dialog.getByRole("button", { name: "保存商户范围", exact: true }).isDisabled());
    assert.ok(await dialog.getByPlaceholder("多个 ID 请用逗号分隔；留空表示可查看全部商户").isDisabled());
    assert.ok(calls.every(call => call.method === "GET"));
    await snapshot(page, "user-scope-failure");
  });

  await t.test("仅用户范围读取权限能查看配置但不能提交", async t => {
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:data-scope:user:list"], call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/data-scopes/users/1") return { userId: 1, merchantIds: ["M_SYNTHETIC"] };
    });
    await page.getByRole("button", { name: "数据范围", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await page.waitForFunction(() => document.querySelector('input[placeholder^="多个 ID"]').value === "M_SYNTHETIC");
    assert.ok(await dialog.locator("input").isDisabled());
    assert.equal(await dialog.getByRole("button", { name: "保存商户范围", exact: true }).count(), 0);
    assert.ok(calls.every(call => call.method === "GET"));
  });

  await t.test("无原范围读取权限须确认完整替换，取消不写入且角色接口不被调用", async t => {
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:data-scope:user:update"], call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/data-scopes/users/1" && call.method === "PUT") return { userId: 1, ...call.body };
    });
    await page.getByRole("button", { name: "数据范围", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await fillLabel(dialog, "商户 ID", " M_A, M_B, M_A ");
    page.once("dialog", prompt => { assert.match(prompt.message(), /完整替换/); return prompt.dismiss(); });
    await dialog.getByRole("button", { name: "保存商户范围", exact: true }).click();
    assert.ok(calls.every(call => call.method === "GET"));
    page.once("dialog", prompt => { assert.match(prompt.message(), /完整替换/); return prompt.accept(); });
    await dialog.getByRole("button", { name: "保存商户范围", exact: true }).click();
    await page.locator("#workflow-notices").getByText("用户商户数据范围已保存", { exact: true }).waitFor();
    assert.deepEqual(calls.map(call => `${call.method} ${call.path}`), ["GET /users", "PUT /data-scopes/users/1"]);
    assert.deepEqual(calls[1].body, { merchantIds: ["M_A", "M_B"] });
  });

  await t.test("清空已读取的用户范围必须确认全部商户访问", async t => {
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:data-scope:user:list", "system:data-scope:user:update"], call => {
      if (call.path === "/users") return pageOf([testUser]);
      if (call.path === "/data-scopes/users/1") return { userId: 1, merchantIds: call.method === "GET" ? ["M_A"] : call.body.merchantIds };
    });
    await page.getByRole("button", { name: "数据范围", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await fillLabel(dialog, "商户 ID", "");
    page.once("dialog", prompt => { assert.match(prompt.message(), /允许查看全部商户/); return prompt.dismiss(); });
    await dialog.getByRole("button", { name: "保存商户范围", exact: true }).click();
    assert.equal(calls.filter(call => call.method === "PUT").length, 0);
    page.once("dialog", prompt => { assert.match(prompt.message(), /允许查看全部商户/); return prompt.accept(); });
    await dialog.getByRole("button", { name: "保存商户范围", exact: true }).click();
    await page.locator("#workflow-notices").getByText("用户商户数据范围已保存", { exact: true }).waitFor();
    assert.deepEqual(calls.find(call => call.method === "PUT").body, { merchantIds: [] });
  });

  await t.test("关闭后重开另一用户，迟到的范围响应不能覆盖当前配置", async t => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    t.after(() => release());
    const second = { ...testUser, id: 2, username: "synthetic_second", displayName: "合成第二用户" };
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:data-scope:user:list", "system:data-scope:user:update"], async call => {
      if (call.path === "/users") return pageOf([testUser, second]);
      if (call.path === "/data-scopes/users/1") { await pending; return { userId: 1, merchantIds: ["M_OLD"] }; }
      if (call.path === "/data-scopes/users/2") return { userId: 2, merchantIds: call.method === "GET" ? ["M_CURRENT"] : call.body.merchantIds };
    });
    await page.locator("tbody tr").first().getByRole("button", { name: "数据范围", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑用户", exact: true });
    await dialog.getByText("商户数据范围加载中…", { exact: true }).waitFor();
    await dialog.getByTitle("关闭", { exact: true }).click();
    await page.locator("tbody tr").nth(1).getByRole("button", { name: "数据范围", exact: true }).click();
    const input = dialog.getByPlaceholder("多个 ID 请用逗号分隔；留空表示可查看全部商户");
    await page.waitForFunction(() => document.querySelector('input[placeholder^="多个 ID"]').value === "M_CURRENT");
    const oldResponse = page.waitForResponse(response => response.url().endsWith("/data-scopes/users/1"));
    release();
    await (await oldResponse).finished();
    // A subsequent write proves that only the current selection's scope is submitted.
    await dialog.getByRole("button", { name: "保存商户范围", exact: true }).click();
    await page.locator("#workflow-notices").getByText("用户商户数据范围已保存", { exact: true }).waitFor();
    assert.equal(await input.inputValue(), "M_CURRENT");
    assert.deepEqual(calls.filter(call => call.method === "PUT").map(call => [call.path, call.body]), [["/data-scopes/users/2", { merchantIds: ["M_CURRENT"] }]]);
  });

  await t.test("新增用户显式指定角色并刷新总数，不隐含授予 OPS", async t => {
    let created = false;
    const { page, calls } = await mount(t, browser, "user", ["system:user:list", "system:user:create"], call => {
      if (call.path === "/users" && call.method === "GET") return pageOf(created ? [testUser] : [], created ? 1 : 0, 1, 10);
      if (call.path === "/users" && call.method === "POST") { created = true; return testUser; }
    });
    await page.getByRole("button", { name: "新增用户", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新增用户", exact: true });
    await fillLabel(dialog, "用户名", "synthetic_new");
    await fillLabel(dialog, "显示名称", "合成新增用户");
    await dialog.locator('input[type="password"]').fill("SYNTHETIC_NEW_PASSWORD");
    const save = dialog.getByRole("button", { name: "创建用户", exact: true });
    assert.ok(await save.isDisabled());
    assert.equal(await dialog.getByPlaceholder("多个角色编码请用逗号分隔").inputValue(), "");
    await dialog.getByPlaceholder("多个角色编码请用逗号分隔").pressSequentially("TEST, SECOND_TEST, TEST");
    await snapshot(page, "user-create-explicit-role");
    await save.click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("共 1 个用户", { exact: true }).waitFor();
    assert.deepEqual(calls.find(call => call.method === "POST").body.roles, ["TEST", "SECOND_TEST"]);
    assert.equal(calls.filter(call => call.method === "GET").length, 2);
  });

  await t.test("运营某个接口失败不会阻断其余列表，刷新失败保留旧数据并标记", async t => {
    let refresh = false;
    const { page, calls } = await mount(t, browser, "operations", ["outbox:list", "audit:list", "payment-event:list"], call => {
      if (call.path === "/outbox/dead") return refresh ? failure("合成死信刷新失败") : { items: [{ eventId: "E_SYNTHETIC", eventType: "SYNTHETIC_NOTIFICATION", status: "DEAD", attemptCount: 1 }] };
      if (call.path === "/audits") return failure("合成审计失败");
      if (call.path === "/payment-events/failed") return { items: [{ id: 1, eventId: "PE_SYNTHETIC", eventType: "SYNTHETIC_PAYMENT", status: "FAILED" }] };
    });
    await page.getByText("SYNTHETIC_NOTIFICATION", { exact: true }).waitFor();
    await page.getByText("SYNTHETIC_PAYMENT", { exact: true }).waitFor();
    await page.getByRole("alert").filter({ hasText: "合成审计失败" }).waitFor();
    assert.equal(await page.getByText("暂无操作审计记录", { exact: true }).count(), 0);
    refresh = true;
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "合成死信刷新失败" }).waitFor();
    await page.getByText("SYNTHETIC_NOTIFICATION", { exact: true }).waitFor();
    await snapshot(page, "operations-isolation");
    assert.ok(calls.every(call => call.method === "GET"));
    assert.deepEqual([...new Set(calls.map(call => call.path))].sort(), ["/audits", "/outbox/dead", "/payment-events/failed"]);
  });

  await t.test("运营无任何查询权限时不调用接口", async t => {
    const { page, calls } = await mount(t, browser, "operations", [], () => undefined);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    assert.deepEqual(calls, []);
  });

  await t.test("死信与对账差异分页条数相互独立", async t => {
    const { page } = await mount(t, browser, "operations", ["outbox:list", "reconciliation:difference:list"], call => {
      if (call.path === "/outbox/dead") return { items: Array.from({ length: 30 }, (_, i) => ({ eventId: `E_${i}`, eventType: `SYNTHETIC_EVENT_${i}`, status: "DEAD", attemptCount: 1 })) };
      if (call.path === "/reconciliation/differences") return { items: Array.from({ length: 30 }, (_, i) => ({ difference_id: `D_${i}`, bill_id: "B_SYNTHETIC", difference_type: `SYNTHETIC_DIFF_${i}`, expected_amount: 1, actual_amount: 0, status: "OPEN" })) };
    });
    await page.getByText("SYNTHETIC_DIFF_19", { exact: true }).waitFor();
    await page.locator(".app-pagination").first().locator("select").selectOption("10");
    assert.equal(await page.getByText("SYNTHETIC_EVENT_10", { exact: true }).count(), 0);
    assert.equal(await page.getByText("SYNTHETIC_DIFF_19", { exact: true }).count(), 1);
    assert.equal(await page.locator(".app-pagination").nth(1).locator("select").inputValue(), "20");
  });
});
