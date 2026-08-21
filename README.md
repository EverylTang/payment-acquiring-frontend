# payment-acquiring-frontend

通用收单系统前端独立 Git 仓库，当前包含 Vue 3 + TypeScript + Vite 管理后台。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Lucide Vue

## 目录

```text
payment-acquiring-frontend/
├── src/
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── index.html
├── vite.config.ts
├── package.json
├── package-lock.json
├── .env.example
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

npm run build:dev
npm run build:stage
npm run build:prod
```

前端开发服务器默认通过 `/api` 访问后端网关，代理地址由 `vite.config.ts` 根据 `dev`、`stage`、`prod` 模式选择。若不同环境使用不同网关地址，直接修改配置文件中的 `proxyTargets`，不要通过 `.env` 注入。

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

当前前端已经不是纯 UI 骨架，已完成登录、JWT 会话恢复、退出登录、401 处理，并接入工作台、订单查询/统计/详情/取消、模拟回调、配置快照和渠道健康等真实 API。当前仍采用单页控制台，商户、产品、渠道、路由、费率、风控和配置发布的完整表单、菜单/按钮权限、订单时间线、退款与对账页面仍待开发。

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

1. 完成订单详情时间线、支付尝试和回调记录展示。
2. 联调模拟渠道下单、处理中、超时、成功和失败状态。
3. 补充配置草稿、审核、发布、差异和回滚页面。
4. 增加统一表单校验、分页筛选、错误提示和按钮权限。

### P1

1. 完成商户、产品、渠道、路由、费率和风控的增改启停页面。
2. 增加退款、资金分录、对账差异和人工处置页面。
3. 按角色拆分菜单和操作权限。

### P2

1. 接入 OpenAPI 类型生成。
2. 增加端到端浏览器验收、错误恢复和权限回归测试。
3. 完善指标、告警和生产环境配置提示。

## 前端边界

前端不直接访问数据库，只通过 Gateway 或后端公开 API 访问业务能力。真实环境中的 API 地址、鉴权信息和敏感配置不得写入仓库。
