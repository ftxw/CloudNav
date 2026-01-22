interface Env {
  CLOUDNAV_KV?: any;
  PASSWORD: string;
}

// 数据结构
interface AppData {
  links: any[];
  categories: any[];
  settings?: any;
  iconCache?: { [linkId: string]: string }; // 图标缓存：linkId -> base64 icon data
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

// 辅助函数：获取 KV 实例（兼容 EdgeOne 和 Cloudflare）
function getKVStorage(env: Env): any {
  // EdgeOne 使用全局变量 CLOUDNAV_KV
  if (typeof (globalThis as any).CLOUDNAV_KV !== 'undefined') {
    return (globalThis as any).CLOUDNAV_KV;
  }
  // Cloudflare 使用 env.CLOUDNAV_KV
  return env?.CLOUDNAV_KV;
}

// 辅助函数：获取密码（兼容 EdgeOne 和 Cloudflare）
function getPassword(env: Env): string | undefined {
  // EdgeOne 密码可能作为全局变量或环境变量
  if (typeof (globalThis as any).PASSWORD !== 'undefined') {
    return (globalThis as any).PASSWORD;
  }
  return env?.PASSWORD;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method === 'GET') {
    try {
      const kv = getKVStorage(env);
      let data = null;
      let iconCache = null;

      if (kv) {
        try {
          data = await kv.get('app_data', 'json');
        } catch (e) {
          data = await kv.get('app_data');
          if (data && typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (parseErr) {
              // Keep as is if parse fails
            }
          }
        }

        // 获取图标缓存
        try {
          iconCache = await kv.get('icon_cache', 'json');
        } catch (e) {
          const iconCacheStr = await kv.get('icon_cache');
          if (iconCacheStr && typeof iconCacheStr === 'string') {
            try {
              iconCache = JSON.parse(iconCacheStr);
            } catch (parseErr) {}
          }
        }
      }

      if (!data) {
        // 返回默认数据，包括默认标题
        return new Response(JSON.stringify({
          links: [],
          categories: [],
          settings: {
            title: 'CloudNav - 我的导航',
            navTitle: '云航 CloudNav',
            favicon: '',
            cardStyle: 'detailed'
          },
          iconCache: {}
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 将图标缓存添加到响应中
      if (iconCache) {
        (data as any).iconCache = iconCache;
      } else {
        (data as any).iconCache = {};
      }

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch data',
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const providedPassword = request.headers.get('x-auth-password');
      const serverPassword = getPassword(env);

      if (!serverPassword) {
        return new Response(JSON.stringify({ error: 'Server misconfigured: PASSWORD not set' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (providedPassword !== serverPassword) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const body = await request.json();

      const kv = getKVStorage(env);
      if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 保存图标缓存到单独的 KV 键
      if (body.iconCache) {
        await kv.put('icon_cache', JSON.stringify(body.iconCache));
        delete body.iconCache; // 从主数据中移除，减少数据大小
      }

      await kv.put('app_data', JSON.stringify(body));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Failed to save data',
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

