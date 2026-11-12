# payment-acquiring-frontend

通用收单系统前端独立 Git 仓库，当前包含 Vue 3 + TypeScript + Vite 管理后台。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Element Plus(局部组件)
- Lucide Vue
- ESLint(typescript-eslint + eslint-plugin-vue)

## 目录

```text
payment-acquiring-frontend/
├── src/
│   ├── App.vue                 # 控制台外壳:侧边栏菜单、页面映射、通知队列
│   ├── main.ts                 # 根组件:登录态分流(LoginView / App)
│   ├── api.ts                  # 统一 HTTP 请求(Bearer / 401 会话失效)
│   ├── auth.ts                 # 登录、会话恢复、权限判断
│   ├── preferences.ts          # 语言/主题偏好(含 DOM 级中英翻译,待重构为 i18n)
│   ├── style.css
│   └── modules/                # 按业务域划分:视图 + 各自 api.ts
│       ├── account/ auth/ configuration/ dashboard/ master-data/
│       ├── menu/ merchant/ merchant-funds/ operations/ order/
│       ├── permission/ pricing/ product/ refund/ risk/ routing/
│       ├── settlement/ user/
├── eslint.config.mjs
├── vite.config.ts
├── .env.example
├── package.json
├── package-lock.json
├── tsconfig.json
└── .gitignore
```

## 开发

环境要求：Node.js 20+、npm 10+。

```bash
npm install
npm run dev
```

环境通过命令参数选择，不使用环境变量：

```bash
npm run dev
npm run dev:stage
npm run dev:prod

npm run build          # 默认 prod 模式
npm run build:dev
npm run build:stage
npm run build:prod

npm run typecheck
npm run lint           # ESLint(渐进策略:真实错误阻断,风格规则暂关)
```

前端开发服务器默认通过 `/api` 访问后端网关,代理目标取 `VITE_API_PROXY_TARGET`(默认 `http://127.0.0.1:8080`)。可按模式复制 `.env.example` 为 `.env.local` / `.env.stage` / `.env.prod` 覆盖;生产构建不含代理,需由部署层反向代理把 `/api` 转发到 Gateway。

## 前后端联调

先确认后端 Nacos、MySQL 和 Redis 已启动，并启动后端仓库的 Gateway 与 Platform：

```bash
cd ../payment-acquiring-backend
java -jar gateway-service/target/gateway-service-0.1.0-SNAPSHOT.jar
java -jar platform-service/target/platform-service-0.1.0-SNAPSHOT.jar
```

Platform 管理后台登录接口为 `/api/admin/v1/auth/login`。登录成功后 JWT 保存在当前浏览器会话中，后续管理 API 由前端自动携带 Bearer Token。

再回到本仓库启动前端：

```bash
npm run dev
```

当前前端已接入登录与会话恢复、动态菜单、用户/角色/数据范围、菜单、商户及联系人凭证、产品和产品能力、商户产品、渠道/路由/费率/风控配置发布、订单与退款(创建/执行/回调查询)、商户资金账户与账务流水、结算规则与批次、对账、死信重投和运营审计等真实 API;401 会话过期会明确提示重新登录。

当前仍为单页控制台(无 vue-router,菜单驱动的组件映射导航)。跨页全局筛选依赖后端补充查询接口；现有浏览器回归覆盖公共分页与表单布局，尚不等同于完整业务端到端验收。中英切换目前是 `preferences.ts` 的 DOM 级文本替换,属临时方案,待重构为正规 i18n。

## 公共 UI 浏览器回归

先启动 `npm run dev`，再使用本机已有的 Playwright 和对应 Chromium 运行：

```bash
# Playwright 已可从本项目解析时
npm run test:ui

# 复用其他工具环境中的 Playwright，不向应用运行时添加依赖
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:ui

# 可选：指定开发服务器和截图输出目录
ADMIN_UI_URL=http://127.0.0.1:5173 ADMIN_UI_SCREENSHOTS=/tmp/payment-ui-shots \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:ui
```

测试使用浏览器拦截的临时页面加载真实 Vue 组件和项目 CSS，使用合成数据，不需要管理员密码，不连接业务接口。包含两组回归：

- `tests/admin-ui.test.mjs`：翻页、每页条数、页码跳转、空列表、首尾页码窗口、Element Plus 输入/下拉/日期控件、320–1440px 响应式布局及暗色主题。
- `tests/admin-workflows.test.mjs`：菜单父级跨页解析、参考数据失败隔离、现有币种关联、风控时区转换，以及商户/产品部分保存后的重试、一次性凭证交付、角色分权和退款/结算只读查询。所有 API 请求均被拦截，未声明的请求会使测试失败，写入不会发送到真实后端。

测试保持 Chromium 沙箱开启；Playwright 和浏览器需事先安装，本命令不会自动下载。这些回归不替代真实后端权限验收或退款、结算、发布等业务端到端验收。

## Git 上传

```bash
git init
git add .
git commit -m "chore: initialize payment acquiring frontend"
git branch -M main
git remote add origin <frontend-repository-url>
git push -u origin main
```

## 当前开发计划

### P0

1. 增加渠道回调记录查询。
2. 为管理列表补齐服务端筛选和统一表单校验。
3. 完成按钮级权限回归。

### P1

1. 支持菜单的编辑、层级调整、可见性和排序。
2. 支持商户产品的筛选和关联配置视图。
3. 将模拟回调迁移至受控测试工具页。
4. 用 vue-i18n 重构 `preferences.ts` 的 DOM 级中英翻译。

### P2

1. 接入 OpenAPI 类型生成。
2. 增加 Vitest 组件测试与端到端浏览器验收、错误恢复和权限回归测试。
3. 完善指标、告警和生产环境配置提示。
4. 视页面增长评估引入 vue-router。

## 前端边界

前端不直接访问数据库，只通过 Gateway 或后端公开 API 访问业务能力。真实环境中的 API 地址、鉴权信息和敏感配置不得写入仓库。
