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

      console.log('Fetching icon from:', iconUrl);

      // 通过后端代理获取图标，避免 CORS 问题
      const response = await fetch(iconUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch icon, status:', response.status, 'url:', iconUrl);
        return new Response(JSON.stringify({
          error: 'Failed to fetch icon',
          status: response.status,
          url: iconUrl
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const blob = await response.blob();
      console.log('Icon fetched successfully, size:', blob.size, 'type:', blob.type);

      // 将图片转换为 base64
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = blob.type || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return new Response(JSON.stringify({ dataUrl }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      console.error('Icon processing error:', err);
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
