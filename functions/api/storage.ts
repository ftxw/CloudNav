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

// 处理 OPTIONS 请求（解决跨域预检）
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// GET: 获取数据
export const onRequestGet = async (context: { env: Env }) => {
  try {
    const { env } = context;

    const debugInfo = {
      hasKV: !!env.CLOUDNAV_KV,
      hasPassword: !!env.PASSWORD,
      kvType: env.CLOUDNAV_KV ? typeof env.CLOUDNAV_KV : 'undefined',
      kvHasGet: env.CLOUDNAV_KV && typeof env.CLOUDNAV_KV.get === 'function'
    };

    // 在响应中返回调试信息（临时）
    console.log('Storage GET request:', JSON.stringify(debugInfo));

    // 直接使用 CLOUDNAV_KV（EdgeOne Pages 与 Cloudflare Pages KV API 兼容）
    const data = env.CLOUDNAV_KV ? await env.CLOUDNAV_KV.get('app_data') : null;

    if (!data) {
      // 如果没有数据，返回空结构
      return new Response(JSON.stringify({ links: [], categories: [], _debug: debugInfo }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const errorDetails = {
      error: 'Failed to fetch data',
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      hasKV: !!context.env.CLOUDNAV_KV
    };
    console.error('Failed to fetch data:', JSON.stringify(errorDetails));
    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST: 保存数据
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;

    // 1. 验证密码
    const providedPassword = request.headers.get('x-auth-password');
    const serverPassword = env.PASSWORD;

    if (!serverPassword) {
      const error = { error: 'Server misconfigured: PASSWORD not set' };
      console.error(JSON.stringify(error));
      return new Response(JSON.stringify(error), {
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
    console.log('Password validation:', JSON.stringify(debugInfo));

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

    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(body));

    return new Response(JSON.stringify({ success: true, _debug: debugInfo }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const errorDetails = {
      error: 'Failed to save data',
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      hasKV: !!context.env.CLOUDNAV_KV
    };
    console.error('Failed to save data:', JSON.stringify(errorDetails));
    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};