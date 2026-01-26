import { DEFAULT_SITE_SETTINGS, DEFAULT_CATEGORIES, INITIAL_LINKS } from '../../constants/config';

interface Env {
  CLOUDNAV_KV?: any;
  PASSWORD: string;
}

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

function getKVStorage(env: Env): any {
  if (typeof (globalThis as any).CLOUDNAV_KV !== 'undefined') {
    return (globalThis as any).CLOUDNAV_KV;
  }
  return env?.CLOUDNAV_KV;
}

function getPassword(env: Env): string | undefined {
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
        return new Response(JSON.stringify({
          links: [],
          categories: [],
          settings: DEFAULT_SITE_SETTINGS,
          hasKeys: false
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const timestampRaw = await kv.get('app_data:timestamp', { type: 'text' }).catch(() => null);

      if (timestampRaw === null) {
        const initialSettings = {
          ...DEFAULT_SITE_SETTINGS,
          aiConfig: {
            provider: 'gemini',
            apiKey: '',
            baseUrl: '',
            model: 'gemini-2.5-flash'
          }
        };

        const initialLinks = INITIAL_LINKS;
        const initialCategories = DEFAULT_CATEGORIES;

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

      const iconsData: Record<string, string> = {};
      (body.links || []).forEach((link: any) => {
        if (link.icon && link.icon.startsWith('data:image')) {
          iconsData[link.id] = link.icon;
        }
      });

      const linksWithoutIcons = (body.links || []).map((link: any) => {
        const { icon, ...rest } = link;
        return rest;
      });

      const finalSettings = body.settings || {};
      if (body.aiConfig) {
        finalSettings.aiConfig = body.aiConfig;
      }
      if (body.searchEngines) {
        finalSettings.searchEngines = body.searchEngines;
      }

      const timestamp = body.timestamp || Date.now();
      console.log('POST 接收到的数据:', {
        timestamp: timestamp,
        linksCount: body.links?.length,
        hasIcons: Object.keys(iconsData).length > 0
      });

      await Promise.all([
        kv.put('app_data:timestamp', String(timestamp)),
        kv.put('app_data:links', JSON.stringify(linksWithoutIcons)),
        kv.put('app_data:categories', JSON.stringify(body.categories || [])),
        kv.put('app_data:settings', JSON.stringify(finalSettings)),
        Object.keys(iconsData).length > 0 ? kv.put('app_data:icons', JSON.stringify(iconsData)) : Promise.resolve()
      ]);

      console.log('POST 保存成功,返回 timestamp:', timestamp);

      return new Response(JSON.stringify({ success: true, timestamp }), {
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
