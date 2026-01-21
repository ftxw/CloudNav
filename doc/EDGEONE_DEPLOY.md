# EdgeOne Pages 部署指南

本项目现已同时支持 **Cloudflare Pages** 和 **EdgeOne Pages**，可自由选择平台部署。

## 🚀 EdgeOne Pages 部署步骤

### 前提条件
- EdgeOne 账号
- GitHub 账号（项目已 fork 到您的仓库）

### 部署步骤

#### 方法一：通过 EdgeOne 控制台直接部署

1. **Fork 项目**：点击 GitHub 右上角 Fork 按钮，将本项目克隆到您的账号。

2. **登录 EdgeOne 控制台**：
   - 访问 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
   - 进入"静态网站托管"（Pages）服务

3. **创建新应用**：
   - 点击"创建应用"
   - 选择"从 Git 仓库导入"
   - 授权访问您的 GitHub 账号
   - 选择刚才 fork 的 `CloudNav-` 仓库

4. **配置构建设置**：
   - **框架预设**：选择"无"（None）或"Vite"
   - **构建命令**：`npm run build`
   - **输出目录**：`dist`
   - **Node.js 版本**：推荐 `18` 或 `20`

5. **配置环境变量**：
   - 在应用设置中找到"环境变量"
   - 添加变量 `PASSWORD`，设置您的访问密码

6. **配置存储（根据 EdgeOne 实际情况）**：

   **方案 A：如果 EdgeOne 提供类似 Cloudflare 的 KV 绑定**
   - 在应用设置中找到"存储绑定"（Bindings）
   - 创建 KV 命名空间，命名为 `CLOUDNAV_DB`
   - 添加 KV 绑定，变量名填 `EDGEONE_KV`

   **方案 B：如果 EdgeOne 提供独立的 KV 服务**
   - 在 EdgeOne 控制台找到 KV 服务
   - 创建 KV 实例，获取 API 端点和 Token
   - 添加环境变量：
     - `EDGEONE_KV_API=https://your-kv-api-url`
     - `EDGEONE_KV_TOKEN=your_api_token`

7. **部署**：点击"部署"按钮，等待构建完成。

---

## 🔄 Cloudflare Pages 与 EdgeOne Pages 的区别

| 特性 | Cloudflare Pages | EdgeOne Pages |
|------|----------------|--------------|
| KV 存储 | Cloudflare KV (原生支持) | EdgeOne KV (需适配) |
| 全球节点 | 200+ 城市 | 50+ 城市 |
| 免费额度 | 每天 100,000 次读取 | 根据 EdgeOne 套餐 |
| 自定义域名 | 免费支持 | 免费支持 |
| 构建时间 | 免费额度内 | 免费额度内 |

---

## 🛠️ 环境变量配置说明

### 必需变量
| 变量名 | 说明 | 示例 |
|---------|------|------|
| `PASSWORD` | 访问密码 | `mypassword123` |

### 可选变量（EdgeOne）
| 变量名 | 说明 | 示例 |
|---------|------|------|
| `EDGEONE_KV_API` | EdgeOne KV API 端点 | `https://kv-api.example.com` |
| `EDGEONE_KV_TOKEN` | EdgeOne KV 访问 Token | `your_token_here` |

---

## 🐛 常见问题

### 1. EdgeOne 部署后无法保存数据？

**原因**：EdgeOne KV 未正确配置或绑定。

**解决方法**：
- 检查 EdgeOne 控制台是否正确绑定了 KV
- 查看应用日志，确认 KV 适配器是否正确初始化
- 确保环境变量 `EDGEONE_KV` 已设置

### 2. 如何确认当前使用的是哪个平台？

查看应用控制台日志，会显示以下信息之一：
- `Using Cloudflare KV adapter` - 使用 Cloudflare KV
- `Using EdgeOne KV adapter` - 使用 EdgeOne KV
- `Using Cloudflare KV adapter (fallback)` - 使用 Cloudflare KV 作为后备

### 3. 可以同时部署在两个平台吗？

可以！您可以：
1. 在 Cloudflare Pages 部署一个实例，使用 Cloudflare KV
2. 在 EdgeOne Pages 部署另一个实例，使用 EdgeOne KV
3. 通过不同的自定义域名访问，互不干扰

---

## 📝 兼容性说明

程序通过 `_kvAdapter.ts` 实现了统一的存储接口，自动检测运行环境：

```typescript
// 自动检测逻辑
if (env.CLOUDNAV_KV) {
  // 使用 Cloudflare KV
} else if (env.EDGEONE_KV) {
  // 使用 EdgeOne KV
}
```

如果您的 EdgeOne KV 接口与预期不同，可以修改 `functions/api/_kvAdapter.ts` 中的 `EdgeOneKVAdapter` 类。

---

## 📚 相关文档

- [Cloudflare Pages 部署指南](README.md#部署教程免费)
- [EdgeOne 官方文档](https://cloud.tencent.com/document/product/1708)
- [EdgeOne Pages 文档](https://cloud.tencent.com/document/product/1708/76536)
