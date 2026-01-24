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
        // KV 存储不可用，返回默认数据，标记 hasKeys: false
        return new Response(JSON.stringify({
          links: [],
          categories: [],
          settings: {
            title: 'HaoNav - 我的导航',
            navTitle: 'HaoNav',
            favicon: '',
            cardStyle: 'detailed'
          },
          hasKeys: false
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 读取时间戳
      const timestampRaw = await kv.get('app_data:timestamp', { type: 'text' }).catch(() => null);

      // 如果没有时间戳键，说明是首次部署，返回初始数据并写入KV
      if (timestampRaw === null) {
        const initialSettings = {
          title: 'HaoNav - 我的导航',
          navTitle: 'HaoNav',
          favicon: '',
          cardStyle: 'detailed',
          aiConfig: {
            provider: 'gemini',
            apiKey: '',
            baseUrl: '',
            model: 'gemini-2.5-flash'
          }
        };

        const initialLinks = [
          { id: '1', title: 'GitHub', url: 'https://github.com', categoryId: 'dev', createdAt: Date.now(), description: '代码托管平台', pinned: true },
          { id: '2', title: 'React', url: 'https://react.dev', categoryId: 'dev', createdAt: Date.now(), description: '构建Web用户界面的库' },
          { id: '3', title: 'Tailwind CSS', url: 'https://tailwindcss.com', categoryId: 'design', createdAt: Date.now(), description: '原子化CSS框架' },
          { id: '4', title: 'ChatGPT', url: 'https://chat.openai.com', categoryId: 'ai', createdAt: Date.now(), description: 'OpenAI聊天机器人', pinned: true },
          { id: '5', title: 'Gemini', url: 'https://gemini.google.com', categoryId: 'ai', createdAt: Date.now(), description: 'Google DeepMind AI' },
        ];

        const initialCategories = [
          { id: 'common', name: '常用推荐', icon: 'Folder' },
          { id: 'dev', name: '开发工具', icon: 'LayoutPanelLeft' },
          { id: 'design', name: '设计资源', icon: 'Palette' },
          { id: 'read', name: '阅读资讯', icon: 'BookOpen' },
          { id: 'ent', name: '休闲娱乐', icon: 'Gamepad2' },
          { id: 'ai', name: '人工智能', icon: 'Bot' },
        ];

        const timestamp = Date.now();

        Promise.all([
          kv.put('app_data:timestamp', String(timestamp)),
          kv.put('app_data:links', JSON.stringify(initialLinks)),
          kv.put('app_data:categories', JSON.stringify(initialCategories)),
          kv.put('app_data:settings', JSON.stringify(initialSettings)),
          kv.put('app_data:icons', JSON.stringify({})),
        ]).catch(err => {
          console.error('Failed to initialize data:', err);
        });

        const data: AppData = {
          links: initialLinks,
          categories: initialCategories,
          settings: initialSettings,
          timestamp
        };

        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 有时间戳键，读取所有数据
      const timestamp = parseInt(timestampRaw || '0', 10);

      const [linksRaw, categoriesRaw, settingsRaw, iconsRaw] = await Promise.all([
        kv.get('app_data:links', { type: 'text' }).catch(() => null),
        kv.get('app_data:categories', { type: 'text' }).catch(() => null),
        kv.get('app_data:settings', { type: 'text' }).catch(() => null),
        kv.get('app_data:icons', { type: 'text' }).catch(() => null)
      ]);

      const linksData = JSON.parse(linksRaw || '[]') || [];
      const categoriesData = JSON.parse(categoriesRaw || '[]') || [];
      const settingsData = JSON.parse(settingsRaw || 'null') || null;
      const iconsData = JSON.parse(iconsRaw || '{}') || null;

      const data: AppData = {
        links: linksData,
        categories: categoriesData,
        timestamp
      };

      if (settingsData) {
        data.settings = settingsData;
      }

      // 将图标数据合并到 links 中
      if (iconsData && data.links) {
        data.links = data.links.map(link => ({
          ...link,
          icon: iconsData[link.id] || ''
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
      (body.links || []).forEach((link: any) => {
        // 如果是 base64 图标，存到 iconsData 中
        if (link.icon && link.icon.startsWith('data:image')) {
          iconsData[link.id] = link.icon;
        }
      });

      // 移除 icon 字段
      const linksWithoutIcons = (body.links || []).map((link: any) => {
        const { icon, ...rest } = link;
        return rest;
      });

      // 合并 aiConfig 和 searchEngines 到 settings
      const finalSettings = body.settings || {};
      if (body.aiConfig) {
        finalSettings.aiConfig = body.aiConfig;
      }
      if (body.searchEngines) {
        finalSettings.searchEngines = body.searchEngines;
      }

      // 并行写入所有数据，包括时间戳
      const timestamp = Date.now();
      await Promise.all([
        kv.put('app_data:timestamp', String(timestamp)),
        kv.put('app_data:links', JSON.stringify(linksWithoutIcons)),
        kv.put('app_data:categories', JSON.stringify(body.categories || [])),
        kv.put('app_data:settings', JSON.stringify(finalSettings)),
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

