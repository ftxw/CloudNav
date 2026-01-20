/**
 * KV 存储适配器
 * 同时兼容 Cloudflare KV 和 EdgeOne KV
 */

interface KVAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: any): Promise<void>;
}

/**
 * Cloudflare KV 适配器
 */
class CloudflareKVAdapter implements KVAdapter {
  private kv: any;

  constructor(kv: any) {
    this.kv = kv;
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.kv.get(key);
      return value;
    } catch (e) {
      console.error('Cloudflare KV get error:', e);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      await this.kv.put(key, value);
    } catch (e) {
      console.error('Cloudflare KV put error:', e);
      throw e;
    }
  }
}

/**
 * EdgeOne KV 适配器
 * 支持多种 EdgeOne KV 访问方式
 */
class EdgeOneKVAdapter implements KVAdapter {
  private kv?: any;
  private apiUrl?: string;
  private authToken?: string;
  private mode: 'binding' | 'http' | 'fallback';

  constructor(env: any) {
    // 方式 1: 通过 HTTP API 访问（优先级最高）
    const apiUrl = env.EDGEONE_KV_API || process.env.EDGEONE_KV_API;
    const authToken = env.EDGEONE_KV_TOKEN || process.env.EDGEONE_KV_TOKEN;

    if (apiUrl && authToken) {
      this.apiUrl = apiUrl;
      this.authToken = authToken;
      this.mode = 'http';
      console.log('EdgeOne KV: Using HTTP API mode');
      return;
    }

    // 方式 2: 使用 CLOUDNAV_KV 绑定（EdgeOne Pages 上也使用这个名字）
    if (env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function') {
      this.kv = env.CLOUDNAV_KV;
      this.mode = 'binding';
      console.log('EdgeOne KV: Using CLOUDNAV_KV binding mode');
      return;
    }

    // 方式 3: EdgeOne 提供的专用 KV 绑定
    if (env.EDGEONE_KV && typeof env.EDGEONE_KV.get === 'function') {
      this.kv = env.EDGEONE_KV;
      this.mode = 'binding';
      console.log('EdgeOne KV: Using EDGEONE_KV binding mode');
      return;
    }

    this.mode = 'fallback';
    console.warn('EdgeOne KV: No valid configuration found, will try to use fallback');
  }

  async get(key: string): Promise<string | null> {
    try {
      // 方式 1: 使用 KV 绑定（尝试多种调用方式）
      if (this.mode === 'binding' && this.kv) {
        // 尝试 Cloudflare 风格的调用
        try {
          const result = await this.kv.get(key);
          if (result !== undefined && result !== null) {
            return result;
          }
        } catch (e) {
          console.log('Cloudflare-style get failed, trying EdgeOne style:', e);
        }

        // 尝试 EdgeOne 风格的调用（可能需要不同的方法或参数）
        try {
          if (typeof this.kv.getItem === 'function') {
            return await this.kv.getItem(key);
          }
        } catch (e) {
          console.log('EdgeOne getItem failed:', e);
        }

        return null;
      }

      // 方式 2: 使用 HTTP API
      if (this.mode === 'http' && this.apiUrl && this.authToken) {
        const response = await fetch(`${this.apiUrl}/${key}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return data.value || data.data || null;
        } else if (response.status === 404) {
          return null;
        } else {
          throw new Error(`EdgeOne KV API error: ${response.status}`);
        }
      }

      // 方式 3: 使用回退绑定
      if (this.mode === 'fallback' && this.kv) {
        return await this.kv.get(key);
      }

      return null;
    } catch (e) {
      console.error('EdgeOne KV get error:', e);
      // 如果 HTTP API 失败，尝试回退到本地存储（仅用于调试）
      return this.getFromLocalStorage(key);
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      // 方式 1: 使用 KV 绑定（尝试多种调用方式）
      if (this.mode === 'binding' && this.kv) {
        // 尝试 Cloudflare 风格的调用
        try {
          await this.kv.put(key, value);
          return;
        } catch (e) {
          console.log('Cloudflare-style put failed, trying EdgeOne style:', e);
        }

        // 尝试 EdgeOne 风格的调用
        try {
          if (typeof this.kv.setItem === 'function') {
            await this.kv.setItem(key, value);
            return;
          }
        } catch (e) {
          console.log('EdgeOne setItem failed:', e);
        }

        throw new Error('KV put operation failed with all available methods');
      }

      // 方式 2: 使用 HTTP API
      if (this.mode === 'http' && this.apiUrl && this.authToken) {
        const response = await fetch(`${this.apiUrl}/${key}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        });

        if (!response.ok) {
          throw new Error(`EdgeOne KV API put failed: ${response.status}`);
        }
        return;
      }

      // 方式 3: 使用回退绑定
      if (this.mode === 'fallback' && this.kv) {
        await this.kv.put(key, value);
        return;
      }

      throw new Error('EdgeOne KV: No valid configuration available for put operation');
    } catch (e) {
      console.error('EdgeOne KV put error:', e);
      // 同时保存到本地存储作为备份
      this.setToLocalStorage(key, value);
      throw e;
    }
  }

  // 本地存储辅助方法（仅用于调试和回退）
  private getFromLocalStorage(key: string): string | null {
    // 注意：在生产环境中不应依赖本地存储
    // 这里仅作为错误时的临时方案
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(`kv_${key}`);
        return data;
      }
    } catch (e) {
      console.warn('localStorage access failed:', e);
    }
    return null;
  }

  private setToLocalStorage(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`kv_${key}`, value);
      }
    } catch (e) {
      console.warn('localStorage set failed:', e);
    }
  }
}

/**
 * 创建 KV 适配器工厂函数
 * 自动检测运行环境并返回合适的适配器
 */
export function createKVAdapter(env: any): KVAdapter {
  // 检测是否有 CLOUDNAV_KV 绑定（Cloudflare 或 EdgeOne）
  if (env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function') {
    console.log('✓ Using KV adapter (CLOUDNAV_KV binding detected)');
    // 直接使用 CloudflareKVAdapter，因为 EdgeOne Pages 的 KV API 与 Cloudflare KV API 兼容
    return new CloudflareKVAdapter(env.CLOUDNAV_KV);
  }

  // 检测 EdgeOne 专用 KV 绑定
  if (env.EDGEONE_KV && typeof env.EDGEONE_KV.get === 'function') {
    console.log('✓ Using KV adapter (EDGEONE_KV binding detected)');
    return new CloudflareKVAdapter(env.EDGEONE_KV);
  }

  // 通过 HTTP API 访问 EdgeOne KV
  const apiUrl = env.EDGEONE_KV_API || process.env.EDGEONE_KV_API;
  const authToken = env.EDGEONE_KV_TOKEN || process.env.EDGEONE_KV_TOKEN;

  if (apiUrl && authToken) {
    console.log('✓ Using EdgeOne KV adapter (HTTP API mode)');
    return new EdgeOneKVAdapter(env);
  }

  throw new Error(
    '❌ No KV storage found. Please configure KV binding:\n' +
    '- Cloudflare: Bind CLOUDNAV_KV in Pages Settings\n' +
    '- EdgeOne: Bind CLOUDNAV_KV in Pages Settings'
  );
}
