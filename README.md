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

生产构建：

```bash
npm run build
```

前端开发服务器默认通过 `/api` 访问后端网关，Vite 会代理到 `http://127.0.0.1:8080`。可复制 `.env.example` 为 `.env.local` 修改：

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:8080
```

## 前后端联调

先启动后端仓库的 Gateway：

```bash
cd ../payment-acquiring-backend
java -jar gateway-service/target/gateway-service-0.1.0-SNAPSHOT.jar
```

再回到本仓库启动前端：

```bash
npm run dev
```

当前管理后台为概览 UI 骨架，业务 API、鉴权、菜单权限和 OpenAPI 类型生成将在接口契约确定后接入。

## Git 上传

```bash
git init
git add .
git commit -m "chore: initialize payment acquiring frontend"
git branch -M main
git remote add origin <frontend-repository-url>
git push -u origin main
```

## 前端边界

前端不直接访问数据库，只通过 Gateway 或后端公开 API 访问业务能力。真实环境中的 API 地址、鉴权信息和敏感配置不得写入仓库。
