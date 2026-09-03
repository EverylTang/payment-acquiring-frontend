# payment-acquiring-frontend

通用收单系统前端独立 Git 仓库，当前包含 Vue 3 + TypeScript + Vite 管理后台。

## 技术栈

- Vue 3
- TypeScript
- Vite
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

当前前端已接入登录与会话恢复、动态菜单、用户/角色/数据范围、菜单、商户及联系人凭证、产品和产品能力、商户产品、渠道/路由/费率/风控配置发布、订单与支付尝试、退款、对账和运营审计等真实 API。

当前仍采用单页控制台。支付尝试历史、退款列表、资金分录查询以及跨页全局筛选依赖后端补充查询接口；前端尚未配置组件和端到端测试框架。

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

1. 增加支付尝试历史和渠道回调记录查询。
2. 增加退款列表与资金分录查询页面。
3. 为管理列表补齐服务端筛选和统一表单校验。
4. 完成按钮级权限回归。

### P1

1. 支持菜单的编辑、层级调整、可见性和排序。
2. 支持商户产品的筛选和关联配置视图。
3. 将模拟回调迁移至受控测试工具页。

### P2

1. 接入 OpenAPI 类型生成。
2. 增加端到端浏览器验收、错误恢复和权限回归测试。
3. 完善指标、告警和生产环境配置提示。

## 前端边界

前端不直接访问数据库，只通过 Gateway 或后端公开 API 访问业务能力。真实环境中的 API 地址、鉴权信息和敏感配置不得写入仓库。
