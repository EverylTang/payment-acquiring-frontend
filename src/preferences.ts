import { nextTick, reactive, watch } from "vue";

export type AppLocale = "zh-CN" | "en-US";
export type AppTheme = "indigo" | "blue" | "emerald" | "midnight";

const localeKey = "payment-admin:locale";
const themeKey = "payment-admin:theme";
const themeOptions: AppTheme[] = ["indigo", "blue", "emerald", "midnight"];

const readPreference = (key: string) =>
  typeof window === "undefined" ? null : window.localStorage.getItem(key);

export const preferences = reactive<{
  locale: AppLocale;
  theme: AppTheme;
}>({
  locale: readPreference(localeKey) === "en-US" ? "en-US" : "zh-CN",
  theme: themeOptions.includes(readPreference(themeKey) as AppTheme)
    ? (readPreference(themeKey) as AppTheme)
    : "indigo",
});

const applyPreferences = () => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = preferences.locale;
  document.documentElement.dataset.theme = preferences.theme;
};

export const setLocale = (locale: AppLocale) => {
  preferences.locale = locale;
  window.localStorage.setItem(localeKey, locale);
  applyPreferences();
};

export const setTheme = (theme: AppTheme) => {
  preferences.theme = theme;
  window.localStorage.setItem(themeKey, theme);
  applyPreferences();
};

const englishTexts: Record<string, string> = {
  "运营控制台": "Operations console",
  "刷新": "Refresh",
  "关闭": "Close",
  "取消": "Cancel",
  "确认": "Confirm",
  "上一页": "Previous",
  "下一页": "Next",
  "加载中…": "Loading...",
  "暂无数据": "No data available",
  "查询": "Search",
  "创建订单": "Create order",
  "创建真实订单": "Create live order",
  "订单列表": "Order list",
  "订单 ID": "Order ID",
  "商户 ID": "Merchant ID",
  "商户名称": "Merchant name",
  "商户订单号": "Merchant order number",
  "产品编码": "Product code",
  "产品名称": "Product name",
  "国家": "Country",
  "币种": "Currency",
  "支付方式": "Payment method",
  "金额": "Amount",
  "状态": "Status",
  "全部状态": "All statuses",
  "输入订单 ID": "Enter order ID",
  "输入订单 ID 后可查看状态、支付尝试和退款信息。": "Enter an order ID to view its status, payment attempts, and refunds.",
  "查询渠道": "Check channel",
  "创建尝试": "Create attempt",
  "取消尝试": "Cancel attempt",
  "重试": "Retry",
  "刷新状态": "Refresh status",
  "取消订单": "Cancel order",
  "回调成功": "Mark callback successful",
  "回调失败": "Mark callback failed",
  "订单处置": "Order actions",
  "订单退款": "Order refund",
  "退款金额": "Refund amount",
  "退款原因": "Refund reason",
  "提交退款": "Submit refund",
  "退款 ID": "Refund ID",
  "查询退款": "Find refund",
  "执行退款": "Execute refund",
  "商户管理": "Merchants",
  "产品管理": "Products",
  "保存产品": "Save product",
  "新增产品": "Add product",
  "编辑产品及能力": "Edit product and capabilities",
  "切换产品状态": "Toggle product status",
  "产品能力": "Product capabilities",
  "支持退款": "Refunds supported",
  "不支持退款": "Refunds not supported",
  "保存能力": "Save capability",
  "新增能力": "Add capability",
  "编辑能力": "Edit capability",
  "切换能力状态": "Toggle capability status",
  "暂无产品能力": "No product capabilities",
  "商户产品": "Merchant products",
  "商户产品绑定": "Merchant product bindings",
  "结算币种": "Settlement currency",
  "编辑": "Edit",
  "保存": "Save",
  "新增": "Create",
  "保存绑定": "Save binding",
  "绑定产品": "Bind product",
  "停用": "Disable",
  "启用": "Enable",
  "返回列表": "Back to list",
  "基础资料": "Profile",
  "法定名称": "Legal name",
  "注册国家": "Registration country",
  "行业": "Industry",
  "税务识别号": "Tax identifier",
  "回调配置": "Callback configuration",
  "保存配置": "Save configuration",
  "回调地址": "Callback URL",
  "事件 JSON，例如 PAYMENT_SUCCEEDED": "Events JSON, e.g. PAYMENT_SUCCEEDED",
  "联系人": "Contacts",
  "新增联系人": "Add contact",
  "保存联系人": "Save contact",
  "联系人姓名": "Contact name",
  "邮箱": "Email",
  "电话": "Phone",
  "启用通知": "Enable notifications",
  "通知": "Notify",
  "不通知": "Do not notify",
  "编辑联系人": "Edit contact",
  "删除联系人": "Delete contact",
  "确认删除": "Delete",
  "暂无联系人": "No contacts",
  "API 凭证": "API credentials",
  "轮换 API 凭证": "Rotate API credentials",
  "撤销": "Revoke",
  "暂无凭证": "No credentials",
  "用户管理": "Users",
  "用户名": "Username",
  "显示名": "Display name",
  "初始密码（至少 12 位）": "Initial password (12+ characters)",
  "创建用户": "Create user",
  "暂无用户": "No users",
  "编辑用户": "Edit user",
  "切换用户状态": "Toggle user status",
  "关闭编辑": "Close editor",
  "保存用户": "Save user",
  "商户数据范围": "Merchant data scope",
  "多个 ID 请用逗号分隔；留空表示可查看全部商户": "Merchant IDs, comma-separated; leave blank for all merchants",
  "保存商户范围": "Save merchant scope",
  "重置密码": "Reset password",
  "新密码（至少 12 位）": "New password (12+ characters)",
  "角色权限配置": "Roles & permissions",
  "菜单权限": "Menu access",
  "操作权限": "Action access",
  "保存权限配置": "Save permissions",
  "数据范围": "Data scope",
  "决定该角色可读取的商户数据范围，最终仍由后端数据权限校验。": "Controls the merchant data this role can read; the backend still enforces data access.",
  "全部商户数据": "All merchant data",
  "已分配商户数据": "Assigned merchant data",
  "本人负责商户数据": "My merchant data",
  "保存数据范围": "Save data scope",
  "菜单管理": "Menu management",
  "菜单编码，如 system:report": "Menu code, e.g. system:report",
  "菜单名称": "Menu name",
  "父级菜单编码（可选）": "Parent menu code (optional)",
  "路由路径，如 /reports": "Route path, e.g. /reports",
  "组件标识，如 reports": "Component key, e.g. reports",
  "Lucide 图标名称": "Lucide icon name",
  "排序": "Sort order",
  "在侧边栏显示": "Show in sidebar",
  "新增菜单": "Add menu",
  "暂无菜单": "No menus",
  "无路由": "No route",
  "切换菜单状态": "Toggle menu status",
  "路由与渠道": "Routing & channels",
  "费率与结算": "Pricing & settlement",
  "费率管理": "Pricing",
  "风控工作台": "Risk workspace",
  "列表管理": "Manage records",
  "版本发布": "Releases",
  "渠道": "Channels",
  "渠道列表": "Channels",
  "路由规则": "Routing rules",
  "费率规则": "Pricing rules",
  "风控策略": "Risk policies",
  "配置版本与发布": "Configuration releases",
  "创建草稿": "Create draft",
  "创建发布草稿": "Create release draft",
  "新增渠道": "Add channel",
  "新增路由规则": "Add routing rule",
  "新增费率规则": "Add pricing rule",
  "新增风控策略": "Add risk policy",
  "渠道 ID": "Channel ID",
  "渠道名称": "Channel name",
  "服务商": "Provider",
  "渠道权重": "Channel weight",
  "最小金额": "Minimum amount",
  "最大金额": "Maximum amount",
  "规则 ID": "Rule ID",
  "策略 ID": "Policy ID",
  "策略名称": "Policy name",
  "优先级": "Priority",
  "规则权重": "Rule weight",
  "费率": "Rate",
  "固定费用": "Fixed fee",
  "选择草稿版本": "Select draft release",
  "商户 ID（可选）": "Merchant ID (optional)",
  "创建草稿原因": "Reason for draft",
  "请输入操作原因": "Enter action reason",
  "查看版本差异": "View version diff",
  "提交审核": "Submit for review",
  "审核通过": "Approve",
  "正式发布": "Publish",
  "回滚生成草稿": "Create rollback draft",
  "暂无渠道配置": "No channel configuration",
  "暂无路由规则": "No routing rules",
  "暂无费率规则": "No pricing rules",
  "暂无风控策略": "No risk policies",
  "暂无发布版本": "No releases",
  "切换渠道状态": "Toggle channel status",
  "切换规则状态": "Toggle rule status",
  "切换策略状态": "Toggle policy status",
  "渠道配置 JSON，如 {\"terminal\":\"...\"}": "Channel configuration JSON, e.g. {\"terminal\":\"...\"}",
  "条件 JSON，如 {\"amountGt\":1000}": "Condition JSON, e.g. {\"amountGt\":1000}",
  "发布配置 JSON，如 {\"description\":\"...\"}": "Release configuration JSON, e.g. {\"description\":\"...\"}",
  "全商户": "All merchants",
  "运营处置": "Operations",
  "重新投递": "Redeliver",
  "导入渠道账单": "Import channel statement",
  "账单 ID": "Statement ID",
  "账单总金额": "Statement total amount",
  "账单笔数": "Statement count",
  "账单明细 JSON 数组，例如 [{\"channelOrderId\":\"...\",\"amount\":100}]": "Statement-line JSON array, e.g. [{\"channelOrderId\":\"...\",\"amount\":100}]",
  "导入账单": "Import statement",
  "待对账账单 ID": "Statement ID to reconcile",
  "发起对账": "Start reconciliation",
  "对账差异": "Reconciliation differences",
  "处理": "Resolve",
  "后台操作审计": "Administration audit",
  "暂无死信消息": "No dead-letter messages",
  "暂无未处理差异": "No unresolved differences",
  "暂无操作审计记录": "No audit records",
  "处理对账差异": "Resolve reconciliation difference",
  "确认处理": "Confirm resolution",
  "运营后台操作": "Operations console action",
  "登录运营控制台": "Sign in to operations console",
  "请输入管理员账号继续。": "Enter your administrator account to continue.",
  "账号": "Account",
  "密码": "Password",
  "安全登录": "Secure sign in",
  "统一管理支付配置、渠道路由、风险策略与资金流向。": "Manage payment configuration, routing, risk policies, and fund movement in one place.",
  "受 JWT 与角色权限保护": "Protected by JWT and role-based access",
  "支付成功率": "Payment success rate",
  "订单名义金额": "Payment volume",
  "交易商户": "Transacting merchants",
  "待发布配置": "Pending releases",
  "累计订单口径": "All-time orders",
  "全币种累计": "All currencies",
  "历史去重": "Historical unique count",
  "需要关注": "Needs attention",
  "渠道健康度": "Channel health",
  "配置快照验证": "Configuration snapshot",
  "个渠道": "channels",
  "条规则": "rules",
  "条策略": "policies",
  "个版本": "releases",
  "个角色": "roles",
  "个菜单": "menus",
  "个产品": "products",
  "人": "users",
  "项能力": "capabilities",
  "条绑定": "bindings",
  "条死信消息": "dead-letter messages",
  "条差异": "differences",
  "条审计记录": "audit records",
  "刷新详情": "Refresh details",
};

const chineseTexts = Object.fromEntries(
  Object.entries(englishTexts).map(([chinese, english]) => [english, chinese]),
);

export const t = (text: string) =>
  preferences.locale === "en-US" ? englishTexts[text] || text : chineseTexts[text] || text;

const translateDynamicText = (text: string) => {
  const direct = t(text);
  if (direct !== text) return direct;
  if (preferences.locale === "zh-CN") {
    return text
      .replace(/^(\d+) channels$/, "$1 个渠道")
      .replace(/^(\d+) rules$/, "$1 条规则")
      .replace(/^(\d+) policies$/, "$1 条策略")
      .replace(/^(\d+) releases$/, "$1 个版本")
      .replace(/^(\d+) roles$/, "$1 个角色")
      .replace(/^(\d+) menus$/, "$1 个菜单")
      .replace(/^(\d+) products$/, "$1 个产品")
      .replace(/^(\d+) users$/, "$1 人")
      .replace(/^(\d+) capabilities$/, "$1 项能力")
      .replace(/^(\d+) bindings$/, "$1 条绑定")
      .replace(/^(\d+) dead-letter messages$/, "$1 条死信消息")
      .replace(/^(\d+) differences$/, "$1 条差异")
      .replace(/^(\d+) audit records$/, "$1 条审计记录")
      .replace(/^Weight (.+)$/, "权重 $1")
      .replace(/^Priority (.+)$/, "优先级 $1")
      .replace(/^Version v(.+)$/, "版本 v$1")
      .replace(/^Page (\d+) \/ (\d+), (\d+) (.+)$/, (_, page, totalPages, total, noun) => `第 ${page} / ${totalPages} 页，共 ${total} ${t(noun)}`)
      .replace(/Created by/g, "创建人")
      .replace(/Weight/g, "权重")
      .replace(/Priority/g, "优先级");
  }
  return text
    .replace(/^(\d+) 个渠道$/, "$1 channels")
    .replace(/^(\d+) 条规则$/, "$1 rules")
    .replace(/^(\d+) 条策略$/, "$1 policies")
    .replace(/^(\d+) 个版本$/, "$1 releases")
    .replace(/^(\d+) 个角色$/, "$1 roles")
    .replace(/^(\d+) 个菜单$/, "$1 menus")
    .replace(/^(\d+) 个产品$/, "$1 products")
    .replace(/^(\d+) 人$/, "$1 users")
    .replace(/^(\d+) 项能力$/, "$1 capabilities")
    .replace(/^(\d+) 条绑定$/, "$1 bindings")
    .replace(/^(\d+) 条死信消息$/, "$1 dead-letter messages")
    .replace(/^(\d+) 条差异$/, "$1 differences")
    .replace(/^(\d+) 条审计记录$/, "$1 audit records")
    .replace(/^权重 (.+)$/, "Weight $1")
    .replace(/^优先级 (.+)$/, "Priority $1")
    .replace(/^版本 v(.+)$/, "Version v$1")
    .replace(/^第 (\d+) \/ (\d+) 页，共 (\d+) (.+)$/, (_, page, totalPages, total, noun) => `Page ${page} / ${totalPages}, ${total} ${t(noun)}`)
    .replace(/创建人/g, "Created by")
    .replace(/权重/g, "Weight")
    .replace(/优先级/g, "Priority");
};

const localizeElement = (element: Element) => {
  for (const attribute of ["placeholder", "title", "aria-label"]) {
    const value = element.getAttribute(attribute);
    const translated = value ? t(value) : value;
    if (translated && translated !== value) element.setAttribute(attribute, translated);
  }
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue;
    const value = node.textContent;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const translated = translateDynamicText(trimmed);
    if (translated !== trimmed) node.textContent = value.replace(trimmed, translated);
  }
};

export const installLocaleObserver = () => {
  if (typeof document === "undefined") return;
  const root = document.body;
  let scheduled = false;
  const localize = () => {
    scheduled = false;
    localizeElement(root);
    root.querySelectorAll("*").forEach(localizeElement);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(localize);
  };
  new MutationObserver(schedule).observe(root, {
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
    childList: true,
    subtree: true,
    characterData: true,
  });
  watch(() => preferences.locale, () => nextTick(schedule), { immediate: true });
};

applyPreferences();
