interface Env {
  CLOUDNAV_KV?: any;
  PASSWORD: string;
}

// 数据结构
interface AppData {
  links: any[];
  categories: any[];
  settings?: any;
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

      if (!kv) {
        // 返回默认数据
        return new Response(JSON.stringify({
          links: [],
          categories: [],
          settings: {
            title: 'CloudNav - 我的导航',
            navTitle: '云航 CloudNav',
            favicon: '',
            cardStyle: 'detailed'
          }
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 先尝试读取新结构
      let linksData, categoriesData, settingsData, iconsData;

      try {
        [linksData, categoriesData, settingsData, iconsData] = await Promise.all([
          kv.get('app_data:links', 'json').catch(() => null),
          kv.get('app_data:categories', 'json').catch(() => null),
          kv.get('app_data:settings', 'json').catch(() => null),
          kv.get('app_data:icons', 'json').catch(() => null)
        ]);
      } catch (e) {
        // 读取失败，尝试旧结构
      }

      // 如果新结构没有数据，尝试从旧结构迁移
      if (!linksData && !categoriesData) {
        try {
          const oldData = await kv.get('app_data', 'json');
          if (oldData && (oldData.links || oldData.categories)) {
            // 提取图标数据
            const iconsMap: Record<string, string> = {};
            const linksWithoutIcons = (oldData.links || []).map((link: any) => {
              if (link.icon && link.icon.startsWith('data:image')) {
                iconsMap[link.id] = link.icon;
                return { ...link, icon: '' };
              }
              return link;
            });

            // 写入新结构
            await Promise.all([
              kv.put('app_data:links', JSON.stringify(linksWithoutIcons)),
              kv.put('app_data:categories', JSON.stringify(oldData.categories || [])),
              oldData.settings ? kv.put('app_data:settings', JSON.stringify(oldData.settings)) : Promise.resolve(),
              Object.keys(iconsMap).length > 0 ? kv.put('app_data:icons', JSON.stringify(iconsMap)) : Promise.resolve()
            ]);

            // 使用迁移后的数据
            linksData = linksWithoutIcons;
            categoriesData = oldData.categories || [];
            settingsData = oldData.settings || null;
            iconsData = iconsMap;
          }
        } catch (e) {
          // 旧结构也没有数据，使用默认值
        }
      }

      const data: AppData = {
        links: linksData || [],
        categories: categoriesData || []
      };

      if (settingsData) {
        data.settings = settingsData;
      }

      // 将图标数据合并到 links 中
      if (iconsData && data.links) {
        data.links = data.links.map(link => ({
          ...link,
          icon: iconsData[link.id] || link.icon
        }));
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

      // 提取图标数据（从 links 中分离出来）
      const iconsData: Record<string, string> = {};
      const linksWithoutIcons = (body.links || []).map((link: any) => {
        const { icon, ...rest } = link;
        // 如果是 base64 图标，存到 iconsData 中
        if (icon && icon.startsWith('data:image')) {
          iconsData[link.id] = icon;
          return { ...rest, icon: '' }; // links 中保留空字符串或原始 URL
        }
        return link; // 非 base64 图标（如 API URL）保留原样
      });

      // 并行写入四个独立的键
      await Promise.all([
        kv.put('app_data:links', JSON.stringify(linksWithoutIcons)),
        kv.put('app_data:categories', JSON.stringify(body.categories || [])),
        body.settings ? kv.put('app_data:settings', JSON.stringify(body.settings)) : Promise.resolve(),
        Object.keys(iconsData).length > 0 ? kv.put('app_data:icons', JSON.stringify(iconsData)) : Promise.resolve()
      ]);

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

