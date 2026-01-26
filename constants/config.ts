// 初始配置文件 - 统一管理所有初始数据

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  createdAt: number;
  pinned?: boolean;
  pinnedOrder?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  password?: string;
}

export interface SiteSettings {
  title: string;
  navTitle: string;
  favicon: string;
  cardStyle: 'detailed' | 'simple';
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
}

// 默认站点设置
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  title: 'HaoNav - 我的导航',
  navTitle: 'HaoNav',
  favicon: '',
  cardStyle: 'detailed'
};

// 默认分类
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Folder' },
  { id: 'dev', name: '开发工具', icon: 'LayoutPanelLeft' },
  { id: 'design', name: '设计资源', icon: 'Palette' },
  { id: 'read', name: '阅读资讯', icon: 'BookOpen' },
  { id: 'ent', name: '休闲娱乐', icon: 'Gamepad2' },
  { id: 'ai', name: '人工智能', icon: 'Bot' },
];

// 默认链接
export const INITIAL_LINKS: LinkItem[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com', categoryId: 'dev', createdAt: Date.now(), description: '代码托管平台', pinned: true },
  { id: '2', title: 'React', url: 'https://react.dev', categoryId: 'dev', createdAt: Date.now(), description: '构建Web用户界面的库' },
  { id: '3', title: 'Tailwind CSS', url: 'https://tailwindcss.com', categoryId: 'design', createdAt: Date.now(), description: '原子化CSS框架' },
  { id: '4', title: 'ChatGPT', url: 'https://chat.openai.com', categoryId: 'ai', createdAt: Date.now(), description: 'OpenAI聊天机器人', pinned: true },
  { id: '5', title: 'Gemini', url: 'https://gemini.google.com', categoryId: 'ai', createdAt: Date.now(), description: 'Google DeepMind AI' },
];

// 默认搜索引擎
export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  { id: 'local', name: '站内', url: '', icon: 'Search' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', icon: 'https://www.google.com/favicon.ico' },
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=', icon: 'https://www.bing.com/favicon.ico' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=', icon: 'https://www.baidu.com/favicon.ico' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=', icon: 'https://github.com/favicon.ico' },
  { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword=', icon: 'https://www.bilibili.com/favicon.ico' },
];
