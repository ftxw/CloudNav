interface Env {
  CLOUDNAV_KV?: any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
      const url = new URL(request.url);
      const iconUrl = url.searchParams.get('url');

      if (!iconUrl) {
        return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 通过后端代理获取图标，避免 CORS 问题
      const response = await fetch(iconUrl);
      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch icon' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const blob = await response.blob();
      
      // 将图片转换为 base64
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const mimeType = blob.type || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return new Response(JSON.stringify({ dataUrl }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Failed to process icon',
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
