
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Search, Plus, Upload, Moon, Sun, Menu,
  Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle, AlertTriangle,
  Pin, Settings, Lock, CloudCog, GitFork,
  QrCode, Copy, LayoutGrid, List, ArrowRight, LogOut, X,
  Move, PlusSquare, Merge
} from 'lucide-react';
import { 
    LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, 
    WebDavConfig, AIConfig, SiteSettings, SearchEngine, DEFAULT_SEARCH_ENGINES 
} from './types';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import CategoryModal from './components/CategoryModal';
import AuthModal from './components/AuthModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchSettingsModal from './components/SearchSettingsModal';

const GITHUB_REPO_URL = 'https://github.com/ftxw/CloudNav';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_ENGINES_KEY = 'cloudnav_search_engines';
const ICON_CACHE_KEY = 'cloudnav_icon_cache';

function App() {
  // --- 可复用的样式对象 ---
  const cardStyles = {
    simple: 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10',
    detailed: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
  };

  const iconSizeStyles = {
    simple: 'w-6 h-6 text-xs',
    detailed: 'w-8 h-8 text-sm'
  };

  const paddingStyles = {
    simple: 'p-2',
    detailed: 'p-3'
  };

  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Search State
  const [searchMode, setSearchMode] = useState<'local' | 'external'>('local');
  const [externalEngines, setExternalEngines] = useState<SearchEngine[]>(() => {
      const saved = localStorage.getItem(SEARCH_ENGINES_KEY);
      if (saved) {
          try { return JSON.parse(saved); } catch(e) {}
      }
      // Filter out 'local' from defaults for the external list
      return DEFAULT_SEARCH_ENGINES.filter(e => e.id !== 'local');
  });
  const [activeEngineId, setActiveEngineId] = useState<string>(() => {
      return externalEngines[0]?.id || 'google';
  });
  const [isSearchSettingsOpen, setIsSearchSettingsOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Site Settings - 从 localStorage 读取初始数据，如果没有则使用空值（标题由云端或 localStorage 提供）
  const getInitialSettings = (): SiteSettings => {
      const initialSettings = {
          title: '',
          navTitle: '云航 CloudNav',
          favicon: '',
          cardStyle: 'detailed'
      };
      try {
          const stored = localStorage.getItem('cloudnav_data_cache');
          if (stored) {
              const data = JSON.parse(stored);
              return { ...initialSettings, ...(data.settings || {}) };
          }
      } catch (e) {}
      return initialSettings;
  };
  const initialSettings = (typeof window !== 'undefined' && (window as any).__CLOUDNAV_INITIAL_DATA__) || getInitialSettings();

  // 立即设置标题和 favicon，不等待数据加载
  if (typeof window !== 'undefined') {
      const cachedTitle = initialSettings.title;
      if (cachedTitle && document.title !== cachedTitle) {
          document.title = cachedTitle;
      }
      const cachedFavicon = initialSettings.favicon;
      if (cachedFavicon) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link && link.href !== cachedFavicon) {
              link.href = cachedFavicon;
          }
      }
  }

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(initialSettings);
  const [dataLoaded, setDataLoaded] = useState(false);
  const DEFAULT_TITLE = 'CloudNav - 我的导航';

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Search Engine Selector State
  const [showEngineSelector, setShowEngineSelector] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, link: LinkItem | null, inPinnedSection?: boolean } | null>(null);

  // Category Context Menu State
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number, y: number, category: Category | null } | null>(null);

  // Category Section Context Menu State (for empty space in category)
  const [categorySectionMenu, setCategorySectionMenu] = useState<{ x: number, y: number, categoryId: string | null } | null>(null);

  const categorySectionMenuRef = useRef<HTMLDivElement>(null);

  // Category Sort Mode
  const [isSortingCategory, setIsSortingCategory] = useState<string | null>(null);

  // Link Sort Mode
  const [isSortingLinks, setIsSortingLinks] = useState<string | null>(null);

  // Default category for adding links
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | undefined>(undefined);

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'add' | 'edit' | 'merge'>('add');
  const [categoryModalCategory, setCategoryModalCategory] = useState<Category | undefined>(undefined);

  // Drag and Drop State
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [qrCodeLink, setQrCodeLink] = useState<LinkItem | null>(null);

  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: '',
      username: '',
      password: '',
      enabled: false
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      
      // Safe access to process env
      let defaultKey = '';
      try {
          if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
              defaultKey = process.env.API_KEY;
          }
      } catch(e) {}

      return {
          provider: 'gemini',
          apiKey: defaultKey, 
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  const [deleteLinkConfirm, setDeleteLinkConfirm] = useState<LinkItem | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<Category | null>(null);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<{ show: boolean; title: string }>({ show: false, title: '' });

  const mainRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const categoryContextMenuRef = useRef<HTMLDivElement>(null);
  const searchEngineSelectorRef = useRef<HTMLDivElement>(null);

  // --- Category Operations ---

  const handleAddCategory = () => {
      setCategoryContextMenu(null);
      setCategoryModalMode('add');
      setCategoryModalCategory(undefined);
      setCategoryModalOpen(true);
  };

  const handleSortCategory = () => {
      setCategoryContextMenu(null);
      setIsSortingCategory('all');
  };

  const handleRenameCategory = (cat: Category) => {
      setCategoryContextMenu(null);
      setCategoryModalMode('edit');
      setCategoryModalCategory(cat);
      setCategoryModalOpen(true);
  };

  const handleMergeCategory = (cat: Category) => {
      setCategoryContextMenu(null);
      setCategoryModalMode('merge');
      setCategoryModalCategory(cat);
      setCategoryModalOpen(true);
  };

  const handleDeleteCategory = (catId: string) => {
      setCategoryContextMenu(null);

      const cat = categories.find(c => c.id === catId);
      if (!cat) return;

      setDeleteCategoryConfirm(cat);
  };

  const handleConfirmDeleteCategory = () => {
      if (!deleteCategoryConfirm) return;
      const newCategories = categories.filter(c => c.id !== deleteCategoryConfirm.id);
      const newLinks = links.filter(l => l.categoryId !== deleteCategoryConfirm.id);
      updateData(newLinks, newCategories);
      setDeleteCategoryConfirm(null);
  };

  const handleSaveCategorySort = () => {
      setIsSortingCategory(null);
  };

  const handleSaveLinkSort = () => {
      setIsSortingLinks(null);
  };

  const handleDragStart = (event: any) => {
      setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (active && over && active.id !== over.id) {
          const oldIndex = categories.findIndex(c => c.id === active.id);
          const newIndex = categories.findIndex(c => c.id === over.id);
          const newCategories = arrayMove(categories, oldIndex, newIndex);
          updateData(links, newCategories);
      }

      setActiveId(null);
  };

  const handleLinkDragStart = (event: any) => {
      setActiveId(event.active.id);
  };

  const handleLinkDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (active && over && active.id !== over.id && isSortingLinks) {
          if (isSortingLinks === 'pinned') {
              // 处理置顶链接的排序 - 只更新 pinnedOrder
              // pinnedLinks 已经按 pinnedOrder 排序好了
              const pinnedLinkIds = pinnedLinks.map(l => l.id);
              const oldIndex = pinnedLinkIds.indexOf(active.id);
              const newIndex = pinnedLinkIds.indexOf(over.id);

              if (oldIndex !== -1 && newIndex !== -1) {
                  const newLinks = [...links];
                  // 直接使用 pinnedLinks（已排序）来进行重新排序
                  const reorderedPinnedLinks = arrayMove(pinnedLinks, oldIndex, newIndex);
                  // 根据新顺序更新每个链接的 pinnedOrder
                  reorderedPinnedLinks.forEach((link, index) => {
                      const targetLink = newLinks.find(l => l.id === link.id);
                      if (targetLink) {
                          targetLink.pinnedOrder = index;
                      }
                  });
                  updateData(newLinks, categories);
              }
          } else {
              // 处理分类内链接的排序
              const catLinks = links.filter(l => l.categoryId === isSortingLinks);
              const oldIndex = catLinks.findIndex(l => l.id === active.id);
              const newIndex = catLinks.findIndex(l => l.id === over.id);

              if (oldIndex !== -1 && newIndex !== -1) {
                  const movedLink = catLinks[oldIndex];
                  const otherLinks = links.filter(l => l.categoryId !== isSortingLinks);

                  // Create new array with correct order
                  const newCatLinks = [...catLinks];
                  const [removed] = newCatLinks.splice(oldIndex, 1);
                  newCatLinks.splice(newIndex, 0, removed);

                  updateData([...newCatLinks, ...otherLinks], categories);
              }
          }
      }

      setActiveId(null);
  };

  const handleModalAddCategory = (name: string, icon: string, password?: string) => {
      const newCategory: Category = {
          id: Date.now().toString(),
          name: name.trim(),
          icon: icon || 'Folder',
          password: password?.trim() || undefined
      };
      const newCategories = [...categories, newCategory];
      updateData(links, newCategories);
      setCategoryModalOpen(false);
  };

  const handleModalEditCategory = (categoryId: string, name: string, icon: string, password?: string) => {
      const newCategories = categories.map(cat =>
          cat.id === categoryId ? { ...cat, name: name.trim(), password: password?.trim() || undefined, icon } : cat
      );
      updateData(links, newCategories);
      setCategoryModalOpen(false);
  };

  const handleModalMergeCategory = (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const newLinks = links.map(l =>
          l.categoryId === sourceId ? { ...l, categoryId: targetId } : l
      );
      const newCategories = categories.filter(c => c.id !== sourceId);
      updateData(newLinks, newCategories);
      setCategoryModalOpen(false);
  };

  // --- Helpers ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const linksData = parsed.links || INITIAL_LINKS;
        // 从本地图标缓存合并图标
        const iconCache = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
        const linksWithCachedIcons = linksData.map(link => ({
          ...link,
          // 如果本地缓存有这个链接的图标，使用缓存的
          icon: iconCache[link.id] || link.icon
        }));
        setLinks(linksWithCachedIcons);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
        if (parsed.settings) setSiteSettings(prev => ({ ...prev, ...parsed.settings }));
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  // 缓存图标并更新到 links 中的 icon 字段
  const cacheIcon = async (linkId: string, iconUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(iconUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // 更新 link 的 icon 字段为 base64 数据
          const updatedLinks = links.map(l => l.id === linkId ? { ...l, icon: base64data } : l);
          setLinks(updatedLinks);
          updateData(updatedLinks, categories);
          resolve(base64data);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  // 立即转换图标为 base64（用于添加/编辑链接时）
  const cacheIconForLink = async (iconUrl: string): Promise<string> => {
    try {
      const response = await fetch(`/api/icon?url=${encodeURIComponent(iconUrl)}`);
      if (!response.ok) {
        return iconUrl;
      }
      const data = await response.json();
      if (data.dataUrl) {
        return data.dataUrl;
      }
      return iconUrl;
    } catch (e) {
      return iconUrl;
    }
  };

  // 批量缓存缺失的图标
  const cacheMissingIcons = async (linksToCache: LinkItem[]) => {
    const iconCache = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
    let hasUpdates = false;

    for (const link of linksToCache) {
      if (link.icon && link.icon.includes('favicon.org.cn')) {
        await new Promise(resolve => setTimeout(resolve, 300)); // 增加延迟避免请求过快
        const base64data = await cacheIconForLink(link.icon);
        if (base64data !== link.icon) {
          // 更新本地图标缓存
          iconCache[link.id] = base64data;
          hasUpdates = true;
        }
      }
    }

    // 如果有更新，保存图标缓存并更新显示
    if (hasUpdates) {
      localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache));
      // 合并图标到 links
      const updatedLinks = links.map(link => ({
        ...link,
        icon: iconCache[link.id] || link.icon
      }));
      setLinks(updatedLinks);
    }
  };

  // 提取链接图标的可复用函数
  const getLinkIconDisplay = (link: LinkItem) => {
    const iconSrc = link.icon;
    if (iconSrc) {
      return (
        <img
          src={iconSrc}
          alt=""
          className="w-5 h-5 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerText = link.title.charAt(0);
          }}
        />
      );
    }
    return link.title.charAt(0);
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings, token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings })
        });

        if (response.status === 401) {
            // 认证失败，静默处理，不弹出登录框
            if (token) {
                // 只有在有 token 时才清除（说明 token 过期）
                setAuthToken('');
                localStorage.removeItem(AUTH_KEY);
            }
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 2000);
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');

        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings = siteSettings) => {
      // 立即更新状态，确保 UI 响应
      setLinks(newLinks);
      setCategories(newCategories);
      setSiteSettings(newSettings);

      // 立即更新标题（当用户修改标题时）
      if (newSettings.title && document.title !== newSettings.title) {
          document.title = newSettings.title;
      }

      // 异步更新 localStorage，不阻塞 UI
      requestAnimationFrame(() => {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings }));
      });

      // 异步同步到云端，不阻塞 UI（无论用户是否登录都尝试同步）
      syncToCloud(newLinks, newCategories, newSettings, authToken || '');
  };

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        window.history.replaceState({}, '', window.location.pathname);
        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common'
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    const initData = async () => {
        // 从云端获取时间戳和数据
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const cloudData = await res.json();
                const cloudTimestamp = cloudData.timestamp || 0;

                // 获取本地缓存的时间戳
                const localDataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
                const localTimestamp = localDataStr ? (JSON.parse(localDataStr).timestamp || 0) : 0;

                // 对比时间戳，如果不一致则使用云端数据
                if (cloudTimestamp !== localTimestamp) {
                    setLinks(cloudData.links || []);
                    setCategories(cloudData.categories || []);
                    const settings = cloudData.settings || {
                        title: 'CloudNav - 我的导航',
                        navTitle: '云航 CloudNav',
                        favicon: '',
                        cardStyle: 'detailed'
                    };
                    setSiteSettings(settings);
                    if (settings.aiConfig) {
                        setAiConfig(settings.aiConfig);
                        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(settings.aiConfig));
                    }
                    if (settings.searchEngines && settings.searchEngines.length > 0) {
                        setExternalEngines(settings.searchEngines);
                        localStorage.setItem(SEARCH_ENGINES_KEY, JSON.stringify(settings.searchEngines));
                    } else {
                        // 使用默认搜索引擎（过滤掉站内搜索）
                        setExternalEngines(DEFAULT_SEARCH_ENGINES.filter(e => e.id !== 'local'));
                        localStorage.setItem(SEARCH_ENGINES_KEY, JSON.stringify(DEFAULT_SEARCH_ENGINES.filter(e => e.id !== 'local')));
                    }
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData));
                    cacheMissingIcons(cloudData.links || []);
                } else {
                    // 时间戳一致，使用本地缓存
                    loadFromLocal();
                }
                setDataLoaded(true);
                return;
            }
        } catch (e) {
            // 云端请求失败，使用本地数据
        }

        loadFromLocal();
        setDataLoaded(true);
    };

    initData();
  }, []);


  useEffect(() => {
      // 标题更新逻辑 - 数据加载完成后设置标题
      if (dataLoaded) {
          const finalTitle = siteSettings.title || DEFAULT_TITLE;
          if (document.title !== finalTitle) {
              document.title = finalTitle;
          }
      }
      // favicon 更新逻辑
      if (dataLoaded) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
              if (siteSettings.favicon && link.href !== siteSettings.favicon) {
                  link.href = siteSettings.favicon;
              } else if (!siteSettings.favicon) {
                  // 如果 favicon 为空，使用默认图标
                  link.href = '/favicon.ico';
              }
          }
      }
  }, [siteSettings.title, siteSettings.favicon, dataLoaded]);

  // 数据加载完成后，自动缓存缺失的图标
  useEffect(() => {
      if (dataLoaded && links.length > 0) {
          const linksToCache = links.filter(l =>
              l.icon && l.icon.includes('favicon.org.cn')
          );
          if (linksToCache.length > 0) {
              cacheMissingIcons(linksToCache);
          }
      }
  }, [dataLoaded, links]);

  useEffect(() => {
      // 关闭所有菜单的统一处理函数
      const closeAllMenus = () => {
          if (contextMenu) setContextMenu(null);
          if (categoryContextMenu) setCategoryContextMenu(null);
          if (categorySectionMenu) setCategorySectionMenu(null);
          if (showEngineSelector) setShowEngineSelector(false);
          if (isSortingCategory) {
              setIsSortingCategory(null);
          }
          if (isSortingLinks) {
              setIsSortingLinks(null);
          }
          if (openMenuId) setOpenMenuId(null);
      };

      const handleClickOutside = (e: MouseEvent) => {
          const target = e.target as Node;

          // 处理链接右键菜单
          if (contextMenu && contextMenuRef.current) {
              if (!contextMenuRef.current.contains(target)) {
                  setContextMenu(null);
              }
          }

          // 处理分类右键菜单
          if (categoryContextMenu && categoryContextMenuRef.current) {
              if (!categoryContextMenuRef.current.contains(target)) {
                  setCategoryContextMenu(null);
              }
          }

          // 处理分类空白区域右键菜单
          if (categorySectionMenu && categorySectionMenuRef.current) {
              if (!categorySectionMenuRef.current.contains(target)) {
                  setCategorySectionMenu(null);
              }
          }

          // 处理搜索引擎选择器
          if (showEngineSelector && searchEngineSelectorRef.current) {
              if (!searchEngineSelectorRef.current.contains(target)) {
                  setShowEngineSelector(false);
              }
          }

          // 处理排序状态
          if (isSortingCategory) {
              const sidebarElement = document.querySelector('aside');
              if (sidebarElement && !sidebarElement.contains(target)) {
                  setIsSortingCategory(null);
              }
          }

          if (isSortingLinks) {
              const mainElement = document.querySelector('main');
              if (mainElement && !mainElement.contains(target)) {
                  setIsSortingLinks(null);
              }
          }
      };

      const handleScroll = () => {
         closeAllMenus();
      };

      // 全局禁用右键菜单（除了程序提供的特定区域）
      const handleContextMenu = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          
          // 检查是否在链接卡片上
          const linkCard = target.closest('a[href]');
          if (linkCard) return; // 允许链接右键菜单
          
          // 检查是否在分类空白区域
          const sectionElement = target.closest('section');
          if (sectionElement) {
              const linkInSection = sectionElement.querySelector('a[href]');
              if (!linkInSection && authToken) return; // 允许分类空白区域右键菜单
          }
          
          // 检查是否在分类项上
          const categoryItem = target.closest('[data-category-item]');
          if (categoryItem) return; // 允许分类项右键菜单
          
          // 检查是否在侧边栏空白区域（有认证令牌时允许）
          const sidebarElement = target.closest('aside');
          if (sidebarElement && authToken) {
              const categoryItemInSidebar = target.closest('[data-category-item]');
              const buttonElement = target.closest('button');
              const headerElement = target.closest('.p-4.border-b'); // 侧边栏头部
              const footerElement = target.closest('.border-t'); // 侧边栏底部
              if (!categoryItemInSidebar && !buttonElement && !headerElement && !footerElement) {
                  return; // 允许侧边栏空白区域右键菜单
              }
          }
          
          // 其他所有区域禁用右键
          e.preventDefault();
      };

      // 任何点击（左键或右键）都关闭右键菜单
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('contextmenu', handleContextMenu);

      return () => {
          window.removeEventListener('click', handleClickOutside);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('contextmenu', handleContextMenu);
      }
  }, [openMenuId, contextMenu, categoryContextMenu, categorySectionMenu, showEngineSelector, isSortingCategory, isSortingLinks]);

  useEffect(() => {
    const handleScroll = () => {
        if (isAutoScrollingRef.current) return;
        if (!mainRef.current) return;
        
        const scrollPosition = mainRef.current.scrollTop + 150;

        if (mainRef.current.scrollTop < 80) {
            setActiveCategory('all');
            return;
        }

        let currentCatId = 'all';
        for (const cat of categories) {
            const el = document.getElementById(`cat-${cat.id}`);
            if (el && el.offsetTop <= scrollPosition && (el.offsetTop + el.offsetHeight) > scrollPosition) {
                currentCatId = cat.id;
                break;
            }
        }
        if (currentCatId !== 'all') setActiveCategory(currentCatId);
    };

    const mainEl = mainRef.current;
    if (mainEl) mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl?.removeEventListener('scroll', handleScroll);
  }, [categories]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- Handlers ---
  const handleLogin = async (password: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ links, categories, settings: siteSettings })
        });

        if (response.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleLogout = () => {
      setAuthToken('');
      localStorage.removeItem(AUTH_KEY);
      setSyncStatus('idle');
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      const mergedCategories = [...categories];
      newCategories.forEach(nc => {
          if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) {
              mergedCategories.push(nc);
          }
      });
      const mergedLinks = [...links, ...newLinks];
      updateData(mergedLinks, mergedCategories);
      setIsImportModalOpen(false);
      alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = async (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    // 创建新链接，使用原始图标URL
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    // 如果是置顶链接，设置初始 pinnedOrder
    if (newLink.pinned) {
      const maxPinnedOrder = links.reduce((max, link) => {
          return link.pinned && link.pinnedOrder !== undefined ? Math.max(max, link.pinnedOrder) : max;
      }, -1);
      newLink.pinnedOrder = maxPinnedOrder + 1;
    }

    // 立即添加链接并显示
    updateData([newLink, ...links], categories);
    setPrefillLink(undefined);

    // 后台异步转换图标（不阻塞UI，不触发重新渲染）
    // 任何 http:// 或 https:// 开头的图标 URL 都转换为 base64
    if (newLink.icon && (newLink.icon.startsWith('http://') || newLink.icon.startsWith('https://'))) {
      cacheIconForLink(newLink.icon).then(base64data => {
        if (base64data && base64data !== newLink.icon) {
          // 只更新本地图标缓存，不更新 links 状态（避免闪烁）
          requestAnimationFrame(() => {
            const iconCache = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
            iconCache[newLink.id] = base64data;
            localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache));

            // 异步更新主数据（包含图标数据）并同步到云端
            const cachedData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
            const updatedCloudLinks = (cachedData.links || INITIAL_LINKS).map(l =>
              l.id === newLink.id ? { ...l, icon: base64data } : l
            );
            const newData = { ...cachedData, links: updatedCloudLinks };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));

            // 触发一次静默的云端同步
            if (authToken) {
              syncToCloud(updatedCloudLinks, categories, siteSettings, authToken);
            }
          });
        }
      });
    }
  };

  const handleEditLink = async (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!editingLink) return;

    // 更新链接，保留原始的 base64 图标
    const originalLink = links.find(l => l.id === editingLink.id);
    const updated = links.map(l => {
        if (l.id === editingLink.id) {
            const newLink = { ...l, ...data };

            // 如果原始链接有 base64 图标，且编辑时没有修改图标字段，则保留原始图标
            if (originalLink && originalLink.icon && originalLink.icon.startsWith('data:image') && !data.icon) {
                newLink.icon = originalLink.icon;
            }

            // 如果从未置顶变为置顶，设置初始 pinnedOrder
            if (newLink.pinned && l.pinnedOrder === undefined) {
                const maxPinnedOrder = links.reduce((max, link) => {
                    return link.pinned && link.pinnedOrder !== undefined ? Math.max(max, link.pinnedOrder) : max;
                }, -1);
                newLink.pinnedOrder = maxPinnedOrder + 1;
            }
            return newLink;
        }
        return l;
    });
    updateData(updated, categories);
    setEditingLink(undefined);

    // 后台异步转换图标（不阻塞UI，不触发重新渲染）
    // 任何 http:// 或 https:// 开头的图标 URL 都转换为 base64
    if (data.icon && (data.icon.startsWith('http://') || data.icon.startsWith('https://'))) {
      cacheIconForLink(data.icon).then(base64data => {
        if (base64data && base64data !== data.icon) {
          // 只更新本地图标缓存，不更新 links 状态（避免闪烁）
          requestAnimationFrame(() => {
            const iconCache = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
            iconCache[editingLink.id] = base64data;
            localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache));

            // 异步更新主数据（包含图标数据）并同步到云端
            const cachedData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
            const updatedCloudLinks = (cachedData.links || INITIAL_LINKS).map(l =>
              l.id === editingLink.id ? { ...l, icon: base64data } : l
            );
            const newData = { ...cachedData, links: updatedCloudLinks };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));

            // 触发一次静默的云端同步
            if (authToken) {
              syncToCloud(updatedCloudLinks, categories, siteSettings, authToken);
            }
          });
        }
      });
    }
  };

  const handleDeleteLink = (id: string) => {
    const link = links.find(l => l.id === id);
    if (link) {
      setDeleteLinkConfirm(link);
    }
  };

  const handleConfirmDeleteLink = () => {
    if (!deleteLinkConfirm) return;
    updateData(links.filter(l => l.id !== deleteLinkConfirm.id), categories);
    setDeleteLinkConfirm(null);
  };

  const togglePin = (id: string) => {
      const link = links.find(l => l.id === id);
      if (!link) return;

      const newPinned = !link.pinned;
      let pinnedOrder: number | undefined;
      if (newPinned) {
          // 如果是从未置顶变为置顶，设置 pinnedOrder
          const maxPinnedOrder = links.reduce((max, l) => {
              return l.pinned && l.pinnedOrder !== undefined ? Math.max(max, l.pinnedOrder) : max;
          }, -1);
          pinnedOrder = maxPinnedOrder + 1;
      }

      // 立即更新状态
      const updated = links.map(l => {
          if (l.id === id) {
              return { ...l, pinned: newPinned, pinnedOrder };
          }
          return l;
      });
      setLinks(updated);

      // 然后调用 updateData 同步到云端和本地
      updateData(updated, categories);
  };
  
  const handleCopyLink = (text: string, title?: string) => {
      navigator.clipboard.writeText(text);
      setCopySuccess({ show: true, title: title || '该网址' });
      setTimeout(() => setCopySuccess({ show: false, title: '' }), 3000);
  };

  const handleSaveAIConfig = (config: AIConfig, newSiteSettings: SiteSettings) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      // 立即更新标题（当用户修改标题时）
      if (newSiteSettings.title && document.title !== newSiteSettings.title) {
          document.title = newSiteSettings.title;
      }
      // 立即更新 favicon（当用户修改 favicon 时）
      if (newSiteSettings.favicon) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
              link.href = newSiteSettings.favicon;
          }
      }
      setSiteSettings(newSiteSettings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories, settings: newSiteSettings }));
      // 同步到云端（无论是否登录都尝试）
      syncSettingsToCloud(newSiteSettings, config);
  };

  const syncSettingsToCloud = async (newSettings: SiteSettings, config: AIConfig) => {
      try {
          const mergedSettings = { ...newSettings, aiConfig: config };
          const response = await fetch('/api/storage', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-auth-password': authToken || ''
              },
              body: JSON.stringify({ links, categories, settings: mergedSettings })
          });
          if (response.status === 401) {
              if (authToken) {
                  setAuthToken('');
                  localStorage.removeItem(AUTH_KEY);
              }
          }
      } catch (e) {
          // Ignore errors silently
      }
  };

  const syncSearchEnginesToCloud = async (newEngines: SearchEngine[]) => {
      try {
          const mergedSettings = { ...siteSettings, searchEngines: newEngines };
          const response = await fetch('/api/storage', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-auth-password': authToken || ''
              },
              body: JSON.stringify({ links, categories, settings: mergedSettings })
          });
          if (response.status === 401) {
              if (authToken) {
                  setAuthToken('');
                  localStorage.removeItem(AUTH_KEY);
              }
          }
      } catch (e) {
          // Ignore errors silently
      }
  };

  const scrollToCategory = (catId: string) => {
      setActiveCategory(catId);
      setSidebarOpen(false);
      
      if (catId === 'all') {
          isAutoScrollingRef.current = true;
          mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
          return;
      }
      const el = document.getElementById(`cat-${catId}`);
      if (el) {
          isAutoScrollingRef.current = true;
          const top = el.offsetTop - 80;
          mainRef.current?.scrollTo({ top, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
      }
  };

  const handleUnlockCategory = (catId: string, password: string, success: boolean) => {
      if (success) {
          setUnlockedCategoryIds(prev => new Set(prev).add(catId));
      }
  };

  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };
  
  // Updated Search Logic
  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      
      if (searchMode === 'external') {
          const engine = externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
          if (engine) {
              window.open(engine.url + encodeURIComponent(searchQuery), '_blank');
              setSearchQuery('');
          }
      }
  };

  const handleUpdateSearchEngines = (newEngines: SearchEngine[]) => {
      setExternalEngines(newEngines);
      localStorage.setItem(SEARCH_ENGINES_KEY, JSON.stringify(newEngines));
      // 同步到云端（无论是否登录都尝试）
      syncSearchEnginesToCloud(newEngines);
  };

  const isCategoryLocked = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.password) return false;
      return !unlockedCategoryIds.has(catId);
  };

  // Sortable Category Item Component
  const SortableCategoryItem = ({ cat, isSorting }: { cat: Category, isSorting: boolean }) => {
      const {
          attributes,
          listeners,
          setNodeRef,
          transform,
          transition,
          isDragging,
      } = useSortable({ id: cat.id, disabled: !isSorting });

      const style = {
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? 'none' : transition,
      };

      const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);

      return (
          <div
              ref={setNodeRef}
              style={style}
              data-category-item
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl group relative ${
                  activeCategory === cat.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              } border ${isSorting ? 'cursor-move border-dashed border-blue-400 dark:border-blue-500' : 'border-transparent'} ${isDragging ? 'opacity-0' : ''}`}
              onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSorting || categoryModalOpen) return;
                  let x = e.clientX;
                  let y = e.clientY;
                  if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                  if (y + 250 > window.innerHeight) y = window.innerHeight - 260;
                  // Close other context menus
                  setContextMenu(null);
                  setCategorySectionMenu(null);
                  setCategoryContextMenu({ x, y, category: cat });
              }}
              onClick={() => !isSorting && scrollToCategory(cat.id)}
              {...attributes}
              {...listeners}
          >
              <div className={`p-1.5 rounded-lg flex items-center justify-center ${activeCategory === cat.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {isEmoji ? <span className="text-base leading-none">{cat.icon}</span> : <Icon name={cat.icon} size={16} />}
              </div>
              <span className="truncate flex-1 text-left">{cat.name}</span>
              {cat.password && <Lock size={14} className="text-amber-500 shrink-0" />}
          </div>
      );
  };

  // Sortable Link Card Component
  const SortableLinkCard = ({ link, isSorting }: { link: LinkItem, isSorting: boolean }) => {
      const {
          attributes,
          listeners,
          setNodeRef,
          transform,
          transition,
          isDragging,
      } = useSortable({ id: link.id, disabled: !isSorting });

      const style = {
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? 'none' : transition,
      };

      return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative flex flex-col ${paddingStyles[siteSettings.cardStyle]} bg-white dark:bg-slate-800 rounded-xl border ${isSorting ? 'cursor-move border-dashed border-blue-400 dark:border-blue-500' : 'border-slate-100 dark:border-slate-700/50'} shadow-sm ${isDragging ? 'opacity-0' : ''}`}
            title={link.description || link.url}
            {...attributes}
            {...listeners}
        >
            <div className={`flex items-center gap-3 ${siteSettings.cardStyle === 'simple' ? '' : 'mb-1.5'} pr-6`}>
                <div className={`${iconSizeStyles[siteSettings.cardStyle]} rounded-lg bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden`}>
                    {getLinkIconDisplay(link)}
                </div>
                <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate flex-1">
                    {link.title}
                </h3>
            </div>
            {siteSettings.cardStyle === 'detailed' && (
                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
                    {link.description || <span className="opacity-0">.</span>}
                </div>
            )}
        </div>
      );
  };

  const pinnedLinks = useMemo(() => {
      // 始终显示所有置顶链接，并按照 pinnedOrder 排序
      return links
          .filter(l => l.pinned === true && !isCategoryLocked(l.categoryId))
          .sort((a, b) => {
              const orderA = a.pinnedOrder ?? Number.MAX_SAFE_INTEGER;
              const orderB = b.pinnedOrder ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
          });
  }, [links, categories, unlockedCategoryIds]);

  const searchResults = useMemo(() => {
    // Only filter locally if mode is 'local'
    if (searchMode !== 'local') return links;

    let result = links;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title.toLowerCase().includes(q) || 
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, searchQuery, searchMode]);

  const activeExternalEngine = useMemo(() => {
      return externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
  }, [externalEngines, activeEngineId]);

  // --- Render Components ---

  const renderDragOverlayCard = (linkId: string) => {
    const link = links.find(l => l.id === linkId);
    if (!link) return null;
    const isSimple = siteSettings.cardStyle === 'simple';
    return (
      <div className={`group relative flex flex-col ${paddingStyles[siteSettings.cardStyle]} bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-300 dark:border-blue-600 shadow-2xl pointer-events-none`}>
        <div className={`flex items-center gap-3 ${isSimple ? '' : 'mb-1.5'} pr-6`}>
          <div className={`${iconSizeStyles[siteSettings.cardStyle]} rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden`}>
            {getLinkIconDisplay(link)}
          </div>
          <h3 className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate flex-1">
            {link.title}
          </h3>
        </div>
        {!isSimple && (
          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
            {link.description || <span className="opacity-0">.</span>}
          </div>
        )}
      </div>
    );
  };

  const renderLinkCard = (link: LinkItem) => {
      return (
        <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                let x = e.clientX;
                let y = e.clientY;
                if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
                if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
                    const target = e.currentTarget;
                    const inPinnedSection = target.closest('section')?.querySelector('h2')?.textContent?.includes('置顶 / 常用') ?? false;
                    setCategoryContextMenu(null);
                    setCategorySectionMenu(null);
                    setContextMenu({ x, y, link, inPinnedSection });
                return false;
            }}
            onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                const bg = e.currentTarget.querySelector('.icon-bg') as HTMLElement;
                if (bg) {
                    bg.style.setProperty('--pointer-x', x.toString());
                    bg.style.setProperty('--pointer-y', y.toString());
                }
            }}
            className={`group relative flex flex-col ${paddingStyles[siteSettings.cardStyle]} bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}
            title={link.description || link.url}
        >
            {/* Blurred icon background on hover */}
            {link.icon && (
                <div
                    className="icon-bg absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-[0.05] pointer-events-none group-hover:transition-opacity group-hover:duration-[300ms]"
                    style={{
                        '--pointer-x': -10,
                        '--pointer-y': -10,
                        filter: 'blur(20px) saturate(3) brightness(1.2) contrast(1.3)',
                        transform: 'translateZ(0)',
                        translate: 'calc(var(--pointer-x, -10) * 40%) calc(var(--pointer-y, -10) * 40%)',
                    } as React.CSSProperties}
                >
                    <img src={link.icon} alt="" className="w-20 h-20 object-contain opacity-80" style={{ transform: 'scale(2.8)' }} />
                </div>
            )}
            <div className="relative z-10">
                <div className={`flex items-center gap-3 ${siteSettings.cardStyle === 'detailed' && link.description ? 'mb-1.5' : ''} pr-8`}>
                    <div className={`${iconSizeStyles[siteSettings.cardStyle]} rounded-lg bg-slate-50/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden backdrop-blur-sm`}>
                        {getLinkIconDisplay(link)}
                    </div>
                    <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {link.title}
                    </h3>
                </div>
                {siteSettings.cardStyle === 'detailed' && link.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
                        {link.description}
                    </div>
                )}
            </div>
        </a>
      );
  };

  return (
    <>
      {/* Copy Success Toast */}
      {copySuccess.show && (
          <div
            key={`copy-toast-${copySuccess.title}`}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-white text-blue-600 px-6 py-3 rounded-full shadow-lg flex items-center gap-3"
            style={{
              animation: 'slideInFromTop 0.3s ease-out forwards'
            }}
          >
              <CheckCircle2 size={20} />
              <span>您已成功复制 {copySuccess.title} 的网址</span>
          </div>
      )}
      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translate(-50%, -100%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>

      <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">

      {/* Right Click Context Menu */}
      {contextMenu && (
          <div
             key="context-menu"
             ref={contextMenuRef}
             className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-600 w-44 py-2 flex flex-col animate-in fade-in zoom-in duration-100 overflow-hidden"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()}
             onContextMenu={(e) => e.preventDefault()}
          >
             <button onClick={() => { handleCopyLink(contextMenu.link!.url, contextMenu.link!.title); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Copy size={16} className="text-slate-400"/> <span>复制</span>
             </button>
             <button onClick={() => { setQrCodeLink(contextMenu.link!); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <QrCode size={16} className="text-slate-400"/> <span>二维码</span>
             </button>
             {authToken && (
                 <>
                     <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
                     <button onClick={() => { setContextMenu(null); setDefaultCategoryId(contextMenu.inPinnedSection ? undefined : contextMenu.link!.categoryId); setEditingLink(undefined); setIsModalOpen(true); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                        <PlusSquare size={16} className="text-slate-400"/> <span>添加</span>
                    </button>
                    <button onClick={() => { setContextMenu(null); setIsSortingLinks(contextMenu.inPinnedSection ? 'pinned' : contextMenu.link!.categoryId); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                        <Move size={16} className="text-slate-400"/> <span>排序</span>
                    </button>
                     <button onClick={() => { setContextMenu(null); setEditingLink(contextMenu.link!); setIsModalOpen(true); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                         <Edit2 size={16} className="text-slate-400"/> <span>编辑</span>
                     </button>
                     <button onClick={() => { togglePin(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                         <Pin size={16} className={contextMenu.link!.pinned ? "fill-current text-blue-500" : "text-slate-400"}/> <span>{contextMenu.link!.pinned ? '取消置顶' : '置顶'}</span>
                     </button>
                     <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
                     <button onClick={() => { handleDeleteLink(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-left">
                         <Trash2 size={16}/> <span>删除链接</span>
                     </button>
                 </>
             )}
          </div>
      )}

      {/* QR Code Modal */}
      {qrCodeLink && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrCodeLink(null)}>
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg text-slate-800">{qrCodeLink.title}</h3>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <img
                        src={`https://api.2dcode.biz/v1/create-qr-code?data=${encodeURIComponent(qrCodeLink.url)}`}
                        alt="QR Code"
                        className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs text-slate-500 max-w-[200px] truncate">{qrCodeLink.url}</p>
              </div>
          </div>
      )}

      {/* Delete Link Confirmation Modal */}
      {deleteLinkConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteLinkConfirm(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 dark:text-slate-400" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <AlertTriangle size={28} />
              </div>
              <h2 className="text-lg font-bold dark:text-white">删除链接</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                确定要删除此链接吗？
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 max-w-full">
                {deleteLinkConfirm.title}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeleteLink}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                确认删除
              </button>
              <button
                onClick={() => setDeleteLinkConfirm(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {deleteCategoryConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteCategoryConfirm(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 dark:text-slate-400" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <AlertTriangle size={28} />
              </div>
              <h2 className="text-lg font-bold dark:text-white">删除分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                确定要删除分类"{deleteCategoryConfirm.name}"吗？
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1.5">
                该分类下的 {links.filter(l => l.categoryId === deleteCategoryConfirm.id).length} 个链接将一并删除，此操作不可恢复。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeleteCategory}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                确认删除
              </button>
              <button
                onClick={() => setDeleteCategoryConfirm(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} onClose={() => setIsAuthOpen(false)} />

      <CategoryAuthModal
        isOpen={!!catAuthModalData}
        category={catAuthModalData}
        onClose={() => setCatAuthModalData(null)}
        onUnlock={handleUnlockCategory}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        links={links}
        categories={categories}
        onRestore={handleRestoreBackup}
        webDavConfig={webDavConfig}
        onSaveWebDavConfig={handleSaveWebDavConfig}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingLinks={links}
        categories={categories}
        onImport={handleImportConfirm}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={aiConfig}
        siteSettings={siteSettings}
        onSave={handleSaveAIConfig}
        links={links}
        categories={categories}
        onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
      />

      <SearchSettingsModal
        isOpen={isSearchSettingsOpen}
        onClose={() => setIsSearchSettingsOpen(false)}
        engines={externalEngines}
        activeEngineId={activeEngineId}
        onUpdateEngines={handleUpdateSearchEngines}
        onSelectEngine={setActiveEngineId}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        mode={categoryModalMode}
        onClose={() => setCategoryModalOpen(false)}
        onAdd={handleModalAddCategory}
        onEdit={handleModalEditCategory}
        onMerge={handleModalMergeCategory}
        category={categoryModalCategory}
        categories={categories}
      />

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0 gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30 overflow-hidden">
                 {siteSettings.favicon ? (
                    <img src={siteSettings.favicon} alt="" className="w-full h-full object-cover" />
                 ) : (
                    "C"
                 )}
             </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
              {siteSettings.navTitle || 'CloudNav'}
            </span>
        </div>

        <div
            className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide"
            onContextMenu={(e) => {
                const target = e.target as HTMLElement;
                const categoryItem = target.closest('[data-category-item]');
                const isSidebarButton = target.closest('button');
                if (!categoryItem && !isSidebarButton && authToken) {
                    e.preventDefault();
                    e.stopPropagation();
                    let x = e.clientX;
                    let y = e.clientY;
                    if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                    if (y + 180 > window.innerHeight) y = window.innerHeight - 190;
                    // Close other context menus
                    setContextMenu(null);
                    setCategoryContextMenu(null);
                    setCategorySectionMenu({ x, y, categoryId: 'sidebar' });
                }
            }}
        >
            <button
              onClick={() => scrollToCategory('all')}
              onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSorting || categoryModalOpen) return;
                  let x = e.clientX;
                  let y = e.clientY;
                  if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                  if (y + 250 > window.innerHeight) y = window.innerHeight - 260;
                  // Close other context menus
                  setContextMenu(null);
                  setCategorySectionMenu(null);
                  setCategoryContextMenu({ x, y, category: null });
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeCategory === 'all'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>全部链接</span>
            </button>

            <div className="flex items-center justify-between pt-6 pb-3 px-4 h-8">
               <span className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
               {isSortingCategory === 'all' ? (
                   <button
                      onClick={handleSaveCategorySort}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded-full text-xs font-medium transition-colors"
                   >
                      确认
                   </button>
               ) : null}
            </div>

            <div className="categories-section relative space-y-1">
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {categories.map(cat => {
                            const isSorting = isSortingCategory === 'all';
                            return <SortableCategoryItem key={cat.id} cat={cat} isSorting={isSorting} />;
                        })}
                    </SortableContext>
                    <DragOverlay>
                      {activeId ? (
                        <div className="w-full bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-300 dark:border-blue-600 flex items-center gap-3 px-4 py-2.5 shadow-2xl pointer-events-none">
                          {(() => {
                            const cat = categories.find(c => c.id === activeId);
                            if (!cat) return null;
                            const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                            const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                            return (
                              <>
                                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                                  {isLocked ? <Lock size={16} className="text-amber-500" /> : (isEmoji ? <span className="text-base leading-none">{cat.icon}</span> : <Icon name={cat.icon} size={16} className="text-blue-600 dark:text-blue-400" />)}
                                </div>
                                <span className="truncate flex-1 text-left text-blue-600 dark:text-blue-400 font-medium">{cat.name}</span>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            {authToken && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                        title="导入书签"
                    >
                        <Upload size={14} />
                        <span>导入</span>
                    </button>
                    <button
                        onClick={() => setIsBackupModalOpen(true)}
                        className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                        title="备份与恢复"
                    >
                        <CloudCog size={14} />
                        <span>备份</span>
                    </button>
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                        title="AI 设置"
                    >
                        <Settings size={14} />
                        <span>设置</span>
                    </button>
                </div>
            )}
            
            <div className="flex items-center justify-between text-xs px-2 mt-2">
               <div className="flex items-center gap-1 text-slate-400">
                 {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                 {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                 {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                 {authToken ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
               </div>
               <a 
                 href={GITHUB_REPO_URL} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                 title="Fork this project on GitHub"
               >
                 <GitFork size={14} />
                 <span>Fork 项目</span>
               </a>
            </div>
        </div>
      </aside>

      {/* Category Context Menu */}
      {categoryContextMenu && authToken && (
        <div
          key="category-context-menu"
          ref={categoryContextMenuRef}
          className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-48 py-2 flex flex-col animate-in fade-in zoom-in duration-100"
          style={{ top: categoryContextMenu.y, left: categoryContextMenu.x, position: 'fixed' }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <PlusSquare size={16} className="text-slate-400"/>
            <span>添加</span>
          </button>
          <button
            onClick={handleSortCategory}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <Move size={16} className="text-slate-400"/>
            <span>排序</span>
          </button>
          {categoryContextMenu.category && (
            <>
              <button
                onClick={() => handleRenameCategory(categoryContextMenu.category)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <Edit2 size={16} className="text-slate-400"/>
                <span>编辑</span>
              </button>
              <button
                onClick={() => handleMergeCategory(categoryContextMenu.category)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <Merge size={16} className="text-slate-400"/>
                <span>合并</span>
              </button>
              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
              <button
                onClick={() => handleDeleteCategory(categoryContextMenu.category.id)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <Trash2 size={16} />
                <span>删除</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Category Section Context Menu (for empty space) */}
      {categorySectionMenu && authToken && (
        <div
          key={`category-section-menu-${categorySectionMenu.categoryId}`}
          ref={categorySectionMenuRef}
          className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-40 py-2 flex flex-col animate-in fade-in zoom-in duration-100"
          style={{ top: categorySectionMenu.y, left: categorySectionMenu.x, position: 'fixed' }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {categorySectionMenu.categoryId === 'sidebar' ? (
            <>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  handleAddCategory();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <PlusSquare size={16} className="text-slate-400"/>
                <span>添加</span>
              </button>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  handleSortCategory();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <Move size={16} className="text-slate-400"/>
                <span>排序</span>
              </button>
            </>
          ) : categorySectionMenu.categoryId === 'pinned' ? (
            <>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  setDefaultCategoryId(undefined);
                  setEditingLink(undefined);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <PlusSquare size={16} className="text-slate-400"/>
                <span>添加</span>
              </button>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  setIsSortingLinks('pinned');
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <Move size={16} className="text-slate-400"/>
                <span>排序</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  setDefaultCategoryId(categorySectionMenu.categoryId);
                  setEditingLink(undefined);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <PlusSquare size={16} className="text-slate-400"/>
                <span>添加</span>
              </button>
              <button
                onClick={() => {
                  setCategorySectionMenu(null);
                  setIsSortingLinks(categorySectionMenu.categoryId);
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <Move size={16} className="text-slate-400"/>
                <span>排序</span>
              </button>
            </>
          )}
        </div>
      )}

      <main
          ref={mainRef}
          className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative"
      >
        <div
            className="flex-1 overflow-y-auto scroll-smooth"
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Check if right-click was on a link card
                const target = e.target as HTMLElement;
                const linkCard = target.closest('a[href]');
                if (!linkCard) {
                    // Right-click was on empty space
                    let x = e.clientX;
                    let y = e.clientY;
                    if (x + 160 > window.innerWidth) x = window.innerWidth - 170;
                    // Adjust y position if menu would be cut off at bottom
                    const menuHeight = 100; // Approximate menu height
                    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
                    // Determine if click is in pinned section or category section
                    const targetElement = e.target as HTMLElement;
                    const section = targetElement.closest('section');
                    const pinnedSection = section?.querySelector('h2')?.textContent?.includes('置顶 / 常用') ?? false;
                    // Close other context menus
                    setContextMenu(null);
                    setCategoryContextMenu(null);
                    if (pinnedSection) {
                        setCategorySectionMenu({ x, y, categoryId: 'pinned' });
                    } else if (activeCategory === 'all') {
                        // All links mode: use the section ID to determine which category
                        if (section && section.id?.startsWith('cat-')) {
                            const categoryId = section.id.replace('cat-', '');
                            setCategorySectionMenu({ x, y, categoryId });
                        }
                    } else {
                        // Single category mode: use the active category for all empty space
                        setCategorySectionMenu({ x, y, categoryId: activeCategory });
                    }
                }
            }}
        >
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>

            {/* Redesigned Search Bar */}
            <div className="relative w-full max-w-xl hidden sm:flex items-center gap-3">
                {/* Search Mode Toggle (Pill) */}
                <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-full flex items-center shrink-0">
                    <button
                        onClick={() => setSearchMode('local')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                            searchMode === 'local' 
                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        站内
                    </button>
                    <button
                        onClick={() => setSearchMode('external')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                            searchMode === 'external' 
                            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        站外
                    </button>
                </div>

                {/* Search Input */}
                <div ref={searchEngineSelectorRef} className="flex-1 relative flex items-center group">
                    <form onSubmit={handleSearchSubmit} className="w-full relative flex items-center">
                        {searchMode === 'external' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowEngineSelector(!showEngineSelector)}
                                    className="absolute left-3 z-10 flex items-center justify-center hover:scale-105 transition-transform"
                                    title="切换搜索引擎"
                                >
                                    {activeExternalEngine?.icon?.startsWith('http') ? (
                                        <img src={activeExternalEngine.icon} className="w-5 h-5 rounded-full object-cover" />
                                    ) : (
                                        <Search size={18} className="text-slate-600 dark:text-slate-400" />
                                    )}
                                </button>

                                {/* Search Engine Selector Dropdown */}
                                {showEngineSelector && (
                                    <div className="absolute left-0 top-full mt-2 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                                        {externalEngines.map(engine => (
                                            <button
                                                key={engine.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveEngineId(engine.id);
                                                    setShowEngineSelector(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    activeEngineId === engine.id
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {engine.icon?.startsWith('http') ? (
                                                    <img src={engine.icon} className="w-4 h-4 rounded-full object-cover" />
                                                ) : (
                                                    <Search size={16} />
                                                )}
                                                <span>{engine.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    <input
                        ref={searchInputRef}
                        type="text"
                        id="search-input"
                        name="search"
                        placeholder={searchMode === 'local' ? "搜索书签..." : `在 ${activeExternalEngine?.name} 搜索...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-full text-sm dark:text-white placeholder-slate-400 outline-none transition-all focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 ${
                            searchMode === 'external' ? 'pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700' : 'pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                    />
                    {searchMode === 'local' && (
                        <div className="absolute left-3 text-slate-400 pointer-events-none">
                            <Search size={16} />
                        </div>
                    )}

                        {/* Visual Indicator for Search */}
                        {searchQuery && (
                            <button type="submit" className="absolute right-2 p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-full hover:bg-blue-200 transition-colors">
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </form>
                </div>

                {/* Settings Gear (Visible only for External, outside search box) */}
                {searchMode === 'external' && authToken && (
                    <button
                        onClick={() => setIsSearchSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors animate-in fade-in slide-in-from-left-2 duration-200"
                        title="管理搜索引擎"
                    >
                        <Settings size={18} />
                    </button>
                )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 mr-2">
                <button
                    onClick={() => updateData(links, categories, { ...siteSettings, cardStyle: 'simple' })}
                    title="简约模式"
                    className={`p-1.5 rounded transition-all ${siteSettings.cardStyle === 'simple' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <LayoutGrid size={16} />
                </button>
                <button
                    onClick={() => updateData(links, categories, { ...siteSettings, cardStyle: 'detailed' })}
                    title="详情模式"
                    className={`p-1.5 rounded transition-all ${siteSettings.cardStyle === 'detailed' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <List size={16} />
                </button>
            </div>

            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {authToken ? (
                <button onClick={handleLogout} className="hidden sm:flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <LogOut size={14} /> 退出
                </button>
            ) : (
                <button onClick={() => setIsAuthOpen(true)} className="hidden sm:flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <Cloud size={14} /> 登录
                </button>
            )}
          </div>
        </header>

        <div
            className="p-4 lg:p-8 space-y-8"
        >

            {/* 全部链接模式：置顶链接在最顶部显示 */}
            {activeCategory === 'all' && pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Pin size={16} className="text-blue-500 fill-blue-500" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                置顶 / 常用
                            </h2>
                        </div>
                        {isSortingLinks === 'pinned' && (
                            <button
                                onClick={handleSaveLinkSort}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                            >
                                确认
                            </button>
                        )}
                    </div>
                    {isSortingLinks === 'pinned' ? (
                        <DndContext sensors={sensors} onDragStart={handleLinkDragStart} onDragEnd={handleLinkDragEnd}>
                            <SortableContext items={pinnedLinks.map(l => l.id)} strategy={rectSortingStrategy}>
                                <div className={`grid gap-3 ${cardStyles[siteSettings.cardStyle]}`}>
                                    {pinnedLinks.map(link => <SortableLinkCard key={link.id} link={link} isSorting={true} />)}
                                </div>
                            </SortableContext>
                            <DragOverlay>
                              {activeId && renderDragOverlayCard(activeId)}
                            </DragOverlay>
                        </DndContext>
                    ) : (
                        <div className={`grid gap-3 ${cardStyles[siteSettings.cardStyle]}`}>
                            {pinnedLinks.map(link => renderLinkCard(link))}
                        </div>
                    )}
                </section>
            )}

            {/* 单独分类模式：置顶链接在该分类之前显示 */}
            {activeCategory !== 'all' && pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Pin size={16} className="text-blue-500 fill-blue-500" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                置顶 / 常用
                            </h2>
                        </div>
                        {isSortingLinks === 'pinned' && (
                            <button
                                onClick={handleSaveLinkSort}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                            >
                                确认
                            </button>
                        )}
                    </div>
                    {isSortingLinks === 'pinned' ? (
                        <DndContext sensors={sensors} onDragStart={handleLinkDragStart} onDragEnd={handleLinkDragEnd}>
                            <SortableContext items={pinnedLinks.map(l => l.id)} strategy={rectSortingStrategy}>
                                <div className={`grid gap-3 ${cardStyles[siteSettings.cardStyle]}`}>
                                    {pinnedLinks.map(link => <SortableLinkCard key={link.id} link={link} isSorting={true} />)}
                                </div>
                            </SortableContext>
                            <DragOverlay>
                              {activeId && renderDragOverlayCard(activeId)}
                            </DragOverlay>
                        </DndContext>
                    ) : (
                        <div className={`grid gap-3 ${cardStyles[siteSettings.cardStyle]}`}>
                            {pinnedLinks.map(link => renderLinkCard(link))}
                        </div>
                    )}
                </section>
            )}

            {categories.map(cat => {
                // 本地搜索时，显示所有匹配的分类；非搜索时根据 activeCategory 过滤
                if (searchQuery && searchMode === 'local') {
                    // 本地搜索模式：只显示有匹配链接的分类
                    let catLinks = searchResults.filter(l => l.categoryId === cat.id);
                    if (catLinks.length === 0) return null;
                } else if (activeCategory !== 'all' && activeCategory !== cat.id) {
                    return null;
                }

                let catLinks = searchResults.filter(l => l.categoryId === cat.id);
                const catOtherLinks = catLinks.filter(l => !l.pinned);
                const isLocked = cat.password && !authToken && !unlockedCategoryIds.has(cat.id);

                return (
                    <section
                        key={cat.id}
                        id={`cat-${cat.id}`}
                        className="scroll-mt-24"
                    >
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-2">
                                <div className="text-slate-400">
                                    {cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon) ? <span className="text-lg">{cat.icon}</span> : <Icon name={cat.icon} size={20} />}
                                </div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {cat.name}
                                </h2>
                                {isLocked && <Lock size={16} className="text-amber-500" />}
                             </div>
                             {isSortingLinks === cat.id && (
                                 <button
                                    onClick={handleSaveLinkSort}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                                 >
                                    确认
                                 </button>
                             )}
                        </div>

                        {isLocked ? (
                             <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
                                    <Lock size={24} />
                                </div>
                                <h3 className="text-slate-800 dark:text-slate-200 font-medium mb-1">私密目录</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">该分类已加密，需要验证密码才能查看内容</p>
                                <button
                                    onClick={() => setCatAuthModalData(cat)}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    输入密码解锁
                                </button>
                             </div>
                        ) : isSortingLinks === cat.id ? (
                                <DndContext sensors={sensors} onDragStart={handleLinkDragStart} onDragEnd={handleLinkDragEnd}>
                                    <SortableContext items={catLinks.map(l => l.id)} strategy={rectSortingStrategy}>
                                        <div className={`grid gap-3 ${cardStyles[siteSettings.cardStyle]}`}>
                                            {catLinks.map(link => <SortableLinkCard key={link.id} link={link} isSorting={true} />)}
                                        </div>
                                    </SortableContext>
                            <DragOverlay>
                              {activeId && renderDragOverlayCard(activeId)}
                            </DragOverlay>
                                </DndContext>
                            ) : (
                             <div className={`grid gap-3 ${catLinks.length === 0 ? '' : cardStyles[siteSettings.cardStyle]}`}>
                                {catLinks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        暂无链接
                                    </div>
                                ) : (
                                    catLinks.map(link => renderLinkCard(link))
                                )}
                             </div>
                            )}
                    </section>
                );
            })}
            
            {/* Empty State for Local Search */}
            {searchQuery && searchMode === 'local' && searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search size={40} className="opacity-30 mb-4" />
                    <p>没有找到相关内容</p>
                    <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-500 hover:underline">添加一个?</button>
                </div>
            )}

            <div className="h-20"></div>
        </div>
        </div>
      </main>

      <LinkModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); setDefaultCategoryId(undefined); }}
        onSave={editingLink ? handleEditLink : handleAddLink}
        categories={categories}
        existingLinks={links}
        initialData={editingLink || (prefillLink as LinkItem)}
        defaultCategoryId={defaultCategoryId}
        aiConfig={aiConfig}
      />
    </div>
    </>
  );
}

export default App;
