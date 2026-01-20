interface Env {
  CLOUDNAV_KV?: any;
  PASSWORD: string;
}

// 统一的响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

// 单个 onRequest 函数（EdgeOne Pages 要求）
export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Handle GET requests
  if (request.method === 'GET') {
    try {
      const debugInfo = {
        hasKV: !!env.CLOUDNAV_KV,
        hasPassword: !!env.PASSWORD,
        kvType: env.CLOUDNAV_KV ? typeof env.CLOUDNAV_KV : 'undefined',
        kvHasGet: env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function'
      };

      // 直接使用 CLOUDNAV_KV（EdgeOne Pages 与 Cloudflare Pages KV API 兼容）
      // EdgeOne KV 支持 get(key, "json") 直接返回 JSON 对象
      let data = null;
      if (env.CLOUDNAV_KV) {
        try {
          // 尝试 EdgeOne 方式
          data = await env.CLOUDNAV_KV.get('app_data', 'json');
        } catch (e) {
          // 回退到 Cloudflare 方式
          data = await env.CLOUDNAV_KV.get('app_data');
          if (data && typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (parseErr) {
              // 解析失败，保持原样
            }
          }
        }
      }

      if (!data) {
        // 如果没有数据，返回空结构
        return new Response(JSON.stringify({ links: [], categories: [], _debug: debugInfo }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      const errorDetails = {
        error: 'Failed to fetch data',
        details: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        hasKV: !!env.CLOUDNAV_KV
      };
      return new Response(JSON.stringify(errorDetails), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Handle POST requests
  if (request.method === 'POST') {
    try {
      // 1. 验证密码
      const providedPassword = request.headers.get('x-auth-password');
      const serverPassword = env.PASSWORD;

      if (!serverPassword) {
        return new Response(JSON.stringify({ error: 'Server misconfigured: PASSWORD not set' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const debugInfo = {
        provided: providedPassword ? 'present' : 'missing',
        server: serverPassword ? 'present' : 'missing',
        match: providedPassword === serverPassword,
        hasKV: !!env.CLOUDNAV_KV,
        kvType: env.CLOUDNAV_KV ? typeof env.CLOUDNAV_KV : 'undefined',
        kvHasGet: env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function',
        kvHasPut: env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.put === 'function'
      };

      if (providedPassword !== serverPassword) {
        return new Response(JSON.stringify({ error: 'Unauthorized', _debug: debugInfo }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 2. 保存数据
      const body = await request.json();

      // 直接使用 CLOUDNAV_KV
      if (!env.CLOUDNAV_KV) {
        throw new Error('KV storage not available. Please bind CLOUDNAV_KV in EdgeOne Pages settings.');
      }

      // EdgeOne KV put 方法支持直接传入 JSON 对象
      await env.CLOUDNAV_KV.put('app_data', JSON.stringify(body));

      return new Response(JSON.stringify({ success: true, _debug: debugInfo }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      const errorDetails = {
        error: 'Failed to save data',
        details: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        hasKV: !!env.CLOUDNAV_KV
      };
      return new Response(JSON.stringify(errorDetails), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
