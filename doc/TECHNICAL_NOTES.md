# Cloudflare Pages & EdgeOne Pages 兼容性说明

## 🎯 设计目标

本项目通过适配器模式实现多平台兼容，让同一套代码可以在 **Cloudflare Pages** 和 **EdgeOne Pages** 上无缝运行。

---

## 🏗️ 架构设计

### 核心概念：KV 适配器模式

```
┌─────────────────────────────────────────┐
│         Application Logic              │
│   (storage.ts, link.ts)             │
└───────────────┬─────────────────────┘
                │
                │ 统一接口: KVAdapter
                │   - get(key): Promise<string>
                │   - put(key, value): Promise<void>
                │
        ┌───────┴────────┐
        │                │
   ┌────▼────┐    ┌───▼────────┐
   │Cloudflare│    │   EdgeOne   │
   │  Adapter │    │   Adapter   │
   └────┬────┘    └───┬────────┘
        │               │
   ┌────▼────┐    ┌───▼────────┐
   │  CF KV  │    │EdgeOne KV  │
   │ Storage  │    │  Storage   │
   └──────────┘    └────────────┘
```

### 接口定义

```typescript
interface KVAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
```

---

## 🔧 Cloudflare 适配器

### 工作原理

直接使用 Cloudflare 提供的 KV Binding：

```typescript
class CloudflareKVAdapter implements KVAdapter {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async get(key: string): Promise<string | null> {
    return await this.kv.get(key);
  }

  async put(key: string, value: string): Promise<void> {
    await this.kv.put(key, value);
  }
}
```

### 环境变量

```bash
# 在 Cloudflare Pages 设置中
CLOUDNAV_KV = [KV Binding]
PASSWORD = your_password
```

---

## 🔧 EdgeOne 适配器

### 支持的三种模式

#### 模式 1: KV Binding（推荐）

如果 EdgeOne 提供类似 Cloudflare 的 KV 绑定功能：

```typescript
if (env.EDGEONE_KV && typeof env.EDGEONE_KV.get === 'function') {
  this.kv = env.EDGEONE_KV;
  this.mode = 'binding';
}
```

**配置方法**：
```bash
# 在 EdgeOne Pages 设置中
EDGEONE_KV = [KV Binding]
PASSWORD = your_password
```

---

#### 模式 2: HTTP API

如果 EdgeOne 提供 HTTP API 访问 KV：

```typescript
const response = await fetch(`${apiUrl}/${key}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
  },
});
```

**配置方法**：
```bash
# 在 EdgeOne Pages 环境变量中
EDGEONE_KV_API = https://your-kv-api.com
EDGEONE_KV_TOKEN = your_api_token
PASSWORD = your_password
```

---

#### 模式 3: Fallback（自动回退）

如果 EdgeOne 使用与 Cloudflare 相同的绑定命名：

```typescript
if (env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function') {
  this.kv = env.CLOUDNAV_KV;
  this.mode = 'fallback';
}
```

**配置方法**：
```bash
# 在 EdgeOne Pages 设置中
CLOUDNAV_KV = [KV Binding]  # 注意：仍然是这个名字
PASSWORD = your_password
```

---

## 🚀 自动检测逻辑

`createKVAdapter()` 函数按以下优先级检测环境：

```typescript
export function createKVAdapter(env: any): KVAdapter {
  // 1. 优先检测 Cloudflare KV
  if (env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function') {
    return new CloudflareKVAdapter(env.CLOUDNAV_KV);
  }

  // 2. 检测 EdgeOne KV
  if (env.EDGEONE_KV || env.EDGEONE_KV_API || env.EDGEONE_KV_TOKEN) {
    return new EdgeOneKVAdapter(env);
  }

  // 3. 回退方案
  if (env.CLOUDNAV_KV) {
    return new CloudflareKVAdapter(env.CLOUDNAV_KV);
  }

  // 4. 完全失败
  throw new Error('No KV storage found...');
}
```

---

## 📊 平台对比

| 特性 | Cloudflare Pages | EdgeOne Pages |
|------|----------------|--------------|
| **KV 类型** | 原生 KV Binding | 可能多种形式 |
| **配置复杂度** | 简单（一键绑定） | 视具体实现 |
| **国内访问** | 一般 | 优秀 |
| **全球节点** | 200+ 城市 | 50+ 城市 |
| **免费额度** | 100,000 次读取/天 | 视套餐 |
| **调试难度** | 简单 | 可能需要调试 |

---

## 🐛 调试指南

### 查看当前使用的适配器

在应用控制台（Cloudflare/EdgeOne 日志）中查看：

- `✓ Using Cloudflare KV adapter` → 使用 Cloudflare
- `✓ Using EdgeOne KV adapter` → 使用 EdgeOne

### EdgeOne 常见问题

#### 问题 1: "No KV storage found"

**原因**：未配置任何 KV 存储

**解决方法**：
1. 检查 EdgeOne 控制台是否绑定了 KV
2. 确认变量名正确（`EDGEONE_KV` 或 `CLOUDNAV_KV`）

#### 问题 2: KV API 调用失败

**原因**：EdgeOne KV API 配置不正确

**解决方法**：
1. 检查 `EDGEONE_KV_API` 地址是否正确
2. 确认 `EDGEONE_KV_TOKEN` 是否有效
3. 查看 EdgeOne KV 服务文档，确认 API 格式

#### 问题 3: 数据无法保存

**原因**：网络问题或 KV 服务异常

**解决方法**：
1. 检查 EdgeOne 控制台日志
2. 确认 EdgeOne KV 服务是否正常运行
3. 尝试重新部署应用

---

## 🔐 安全注意事项

1. **不要在代码中硬编码敏感信息**
   - 使用环境变量存储密码和 Token
   - 不要提交 `.edgeone.env` 到 Git

2. **使用强密码**
   - `PASSWORD` 应包含大小写字母、数字、特殊字符

3. **定期备份**
   - 使用 WebDAV 功能定期备份数据
   - 导出 HTML 文件作为本地备份

---

## 📝 扩展指南

如果 EdgeOne KV 的实现发生变化，或需要支持其他平台：

### 添加新平台适配器

```typescript
// 1. 创建新适配器类
class NewPlatformAdapter implements KVAdapter {
  constructor(env: any) {
    // 初始化配置
  }

  async get(key: string): Promise<string | null> {
    // 实现读取逻辑
  }

  async put(key: string, value: string): Promise<void> {
    // 实现写入逻辑
  }
}

// 2. 在 createKVAdapter 中添加检测
export function createKVAdapter(env: any): KVAdapter {
  // ... 现有逻辑 ...

  // 新增检测
  if (env.NEW_PLATFORM_KV) {
    return new NewPlatformAdapter(env);
  }
}
```

---

## 📚 参考资料

- [Cloudflare Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [EdgeOne 文档](https://cloud.tencent.com/document/product/1708)
- [EdgeOne Pages 部署指南](./EDGEONE_DEPLOY.md)
