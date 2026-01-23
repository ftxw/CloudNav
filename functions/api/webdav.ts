interface Env {
  CLOUDNAV_KV?: any;
  PASSWORD: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { operation, config, payload } = body;

      if (operation === 'check') {
        const success = await checkConnection(config);
        return new Response(JSON.stringify({ success }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (operation === 'upload') {
        const success = await uploadBackup(config, payload);
        return new Response(JSON.stringify({ success }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (operation === 'download') {
        const data = await downloadBackup(config);
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid operation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Failed to process WebDAV request',
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// 确保 URL 以 / 结尾
function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : url + '/';
}

// 解码 URL（处理中文文件名）
function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch (e) {
    return path;
  }
}

// 检查连接
async function checkConnection(config: WebDavConfig): Promise<boolean> {
  try {
    const url = normalizeUrl(config.url);
    const auth = btoa(`${config.username}:${config.password}`);

    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Depth': '0',
      },
    });

    return response.ok;
  } catch (e) {
    console.error('WebDAV check connection error:', e);
    return false;
  }
}

// 上传备份
async function uploadBackup(config: WebDavConfig, payload: { links: any[], categories: any[] }): Promise<boolean> {
  try {
    const url = normalizeUrl(config.url);
    const auth = btoa(`${config.username}:${config.password}`);

    // 检查目录是否存在，不存在则创建
    const cloudnavDirUrl = url + 'cloudnav/';
    const checkDirResponse = await fetch(cloudnavDirUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Depth': '0',
      },
    });

    if (checkDirResponse.status === 404) {
      // 创建目录
      const createDirResponse = await fetch(cloudnavDirUrl, {
        method: 'MKCOL',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });
      if (!createDirResponse.ok) {
        console.error('Failed to create directory:', createDirResponse.status);
        return false;
      }
    }

    // 上传文件
    const backupData = JSON.stringify(payload, null, 2);
    const fileUrl = cloudnavDirUrl + 'backup.json';
    const uploadResponse = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: backupData,
    });

    return uploadResponse.ok;
  } catch (e) {
    console.error('WebDAV upload error:', e);
    return false;
  }
}

// 下载备份
async function downloadBackup(config: WebDavConfig): Promise<any | null> {
  try {
    const url = normalizeUrl(config.url);
    const auth = btoa(`${config.username}:${config.password}`);

    const fileUrl = url + 'cloudnav/backup.json';
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // 文件不存在
      }
      console.error('WebDAV download error:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error('WebDAV download error:', e);
    return null;
  }
}
