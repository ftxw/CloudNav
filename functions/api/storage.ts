interface Env {
  CLOUDNAV_KV?: any;
  EDGEONE_KV?: any;
  PASSWORD: string;
}

// 统一的响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

import { createKVAdapter } from './_kvAdapter';

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

    // 使用 KV 适配器获取数据
    const kvAdapter = createKVAdapter(env);
    const data = await kvAdapter.get('app_data');

    if (!data) {
      // 如果没有数据，返回空结构
      return new Response(JSON.stringify({ links: [], categories: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('Failed to fetch data:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch data', details: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

// POST: 保存数据
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. 验证密码
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD;

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

  // 2. 保存数据
  try {
    const body = await request.json();

    // 使用 KV 适配器保存数据
    const kvAdapter = createKVAdapter(env);
    await kvAdapter.put('app_data', JSON.stringify(body));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('Failed to save data:', err);
    return new Response(JSON.stringify({ error: 'Failed to save data', details: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};