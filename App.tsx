
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Upload, Moon, Sun, Menu, 
  Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle,
  Pin, Settings, Lock, CloudCog, Github, GitFork, MoreVertical
} from 'lucide-react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, WebDavConfig, AIConfig } from './types';
import { parseBookmarks } from './services/bookmarkParser';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';

// --- 配置项 ---
// 项目核心仓库地址
const GITHUB_REPO_URL = 'https://github.com/sese972010/CloudNav-';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all'); // Renamed from selectedCategory, used for sidebar highlight
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Menu State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // WebDAV Config State
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: '',
      username: '',
      password: '',
      enabled: false
  });

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      return {
          provider: 'gemini',
          // Try to use injected env if available, else empty.
          apiKey: process.env.API_KEY || '', 
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  // State for data pre-filled from Bookmarklet
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  
  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');

  const mainRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  
  // --- Helpers & Sync Logic ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLinks(parsed.links || INITIAL_LINKS);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories })
        });

        if (response.status === 401) {
            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
      // 1. Optimistic UI Update
      setLinks(newLinks);
      setCategories(newCategories);
      
      // 2. Save to Local Cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

      // 3. Sync to Cloud (if authenticated)
      if (authToken) {
          syncToCloud(newLinks, newCategories, authToken);
      }
  };

  // --- Effects ---

  useEffect(() => {
    // Theme init
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load Token
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    // Load WebDAV Config
    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        // Clean URL params to avoid re-triggering on refresh
        window.history.replaceState({}, '', window.location.pathname);
        
        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common' // Default, Modal will handle selection
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    // Initial Data Fetch
    const initData = async () => {
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setCategories(data.categories || DEFAULT_CATEGORIES);
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    return;
                }
            } 
        } catch (e) {
            console.warn("Failed to fetch from cloud, falling back to local.", e);
        }
        loadFromLocal();
    };

    initData();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (openMenuId) {
              setOpenMenuId(null);
          }
      };
      // Use capture to ensure we catch clicks anywhere
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Scroll Spy Effect
  useEffect(() => {
    const handleScroll = () => {
        if (isAutoScrollingRef.current) return;
        if (!mainRef.current) return;
        
        const scrollPosition = mainRef.current.scrollTop + 150; // Offset

        // If at top, highlight 'all'
        if (mainRef.current.scrollTop < 80) {
            setActiveCategory('all');
            return;
        }

        // Iterate sections to find visible one
        let currentCatId = 'all';
        for (const cat of categories) {
            const el = document.getElementById(`cat-${cat.id}`);
            if (el && el.offsetTop <= scrollPosition && (el.offsetTop + el.offsetHeight) > scrollPosition) {
                currentCatId = cat.id;
                break;
            }
        }
        
        if (currentCatId !== 'all') {
            setActiveCategory(currentCatId);
        }
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

  // --- Actions ---

  const handleLogin = async (password: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ links, categories })
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

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      // Merge categories: Avoid duplicate names/IDs
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

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    updateData([newLink, ...links], categories);
    // Clear prefill if any
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const updated = links.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l);
      updateData(updated, categories);
  };

  const handleSaveAIConfig = (config: AIConfig) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  };

  // --- Category Management & Security ---

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
          // Offset for sticky header
          const top = el.offsetTop - 80;
          mainRef.current?.scrollTo({ top, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
      }
  };

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
      // Unlock triggers re-render, content becomes visible
  };

  const handleUpdateCategories = (newCats: Category[], newLinks?: LinkItem[]) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      updateData(newLinks || links, newCats);
  };

  const handleDeleteCategory = (catId: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const newCats = categories.filter(c => c.id !== catId);
      // Move links to common or first available
      const targetId = 'common'; 
      const newLinks = links.map(l => l.categoryId === catId ? { ...l, categoryId: targetId } : l);
      
      // Ensure common exists if we deleted everything
      if (newCats.length === 0) {
          newCats.push(DEFAULT_CATEGORIES[0]);
      }
      
      updateData(newLinks, newCats);
  };

  // --- WebDAV Config ---
  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };

  // --- Filtering & Memo ---

  const isCategoryLocked = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.password) return false;
      return !unlockedCategoryIds.has(catId);
  };

  const pinnedLinks = useMemo(() => {
      // Don't show pinned links if they belong to a locked category
      return links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
  }, [links, categories, unlockedCategoryIds]);

  const searchResults = useMemo(() => {
    let result = links;
    
    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title.toLowerCase().includes(q) || 
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, searchQuery]);


  // --- Render Components ---

  const renderLinkCard = (link: LinkItem) => {
      const iconDisplay = link.icon ? (
         <img 
            src={link.icon} 
            alt="" 
            className="w-5 h-5 object-contain" 
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerText = link.title.charAt(0);
            }}
         />
      ) : link.title.charAt(0);

      const isMenuOpen = openMenuId === link.id;

      return (
        <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            // ADDED: Conditional z-index to handle dropdown overlap
            className={`group relative flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-slate-750 ${isMenuOpen ? 'z-50' : 'z-0'}`}
            title={link.description || link.url}
        >
            <div className="flex items-center gap-3 mb-1.5 pr-6">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 overflow-hidden">
                    {iconDisplay}
                </div>
                <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.title}
                </h3>
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
                {link.description || <span className="opacity-0">.</span>}
            </div>

            <div className="absolute top-2 right-2">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : link.id);
                    }}
                    className={`p-1 rounded-md transition-colors ${isMenuOpen ? 'bg-slate-100 dark:bg-slate-700 text-blue-500' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                    <MoreVertical size={16} />
                </button>
                
                {isMenuOpen && (
                    <div 
                        className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-100 dark:border-slate-600 z-50 py-1 flex flex-col animate-in fade-in zoom-in duration-200 origin-top-right"
                        onClick={(e) => {
                            e.preventDefault(); 
                            e.stopPropagation();
                        }}
                    >
                        <button
                            onClick={() => { togglePin(link.id); setOpenMenuId(null); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 w-full text-left"
                        >
                            <Pin size={12} className={link.pinned ? "fill-current text-blue-500" : ""} />
                            <span>{link.pinned ? '取消置顶' : '置顶'}</span>
                        </button>
                        <button
                            onClick={() => { setEditingLink(link); setIsModalOpen(true); setOpenMenuId(null); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 w-full text-left"
                        >
                            <Edit2 size={12} />
                            <span>编辑</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <button
                            onClick={() => { handleDeleteLink(link.id); setOpenMenuId(null); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 w-full text-left"
                        >
                            <Trash2 size={12} />
                            <span>删除</span>
                        </button>
                    </div>
                )}
            </div>
        </a>
      );
  };


  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      
      <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />
      
      <CategoryAuthModal 
        isOpen={!!catAuthModalData}
        category={catAuthModalData}
        onClose={() => setCatAuthModalData(null)}
        onUnlock={handleUnlockCategory}
      />

      <CategoryManagerModal 
        isOpen={isCatManagerOpen} 
        onClose={() => setIsCatManagerOpen(false)}
        categories={categories}
        links={links}
        onUpdateCategories={handleUpdateCategories}
        onDeleteCategory={handleDeleteCategory}
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
        onSave={handleSaveAIConfig}
        links={links}
        categories={categories}
        onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
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
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              云航 CloudNav
            </span>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            <button
              onClick={() => scrollToCategory('all')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeCategory === 'all' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>全部链接</span>
            </button>
            
            <div className="flex items-center justify-between pt-4 pb-2 px-4">
               <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
               <button 
                  onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); }}
                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="管理分类"
               >
                  <Settings size={14} />
               </button>
            </div>

            {categories.map(cat => {
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group ${
                      activeCategory === cat.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${activeCategory === cat.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {isLocked ? <Lock size={16} className="text-amber-500" /> : (isEmoji ? <span className="text-base leading-none">{cat.icon}</span> : <Icon name={cat.icon} size={16} />)}
                    </div>
                    <span className="truncate flex-1 text-left">{cat.name}</span>
                    {activeCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                  </button>
                );
            })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="grid grid-cols-3 gap-2 mb-2">
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="导入书签"
                >
                    <Upload size={14} />
                    <span>导入</span>
                </button>
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }}
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

      {/* Main Content */}
      <main 
          ref={mainRef}
          className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto relative scroll-smooth"
      >
        {/* Header */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>

            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700/50 border-none text-sm focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-slate-400 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!authToken && (
                <button onClick={() => setIsAuthOpen(true)} className="hidden sm:flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <Cloud size={14} /> 登录
                </button>
            )}

            <button
              onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setIsModalOpen(true); }}}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
            >
              <Plus size={16} /> <span className="hidden sm:inline">添加</span>
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="p-4 lg:p-8 space-y-8">
            
            {/* 1. Pinned Area */}
            {pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Pin size={16} className="text-blue-500 fill-blue-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            置顶 / 常用
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {pinnedLinks.map(link => renderLinkCard(link))}
                    </div>
                </section>
            )}

            {/* 2. Main List - Stacked Categories */}
            {categories.map(cat => {
                // Filter links for this category based on search
                let catLinks = searchResults.filter(l => l.categoryId === cat.id);
                // Security check
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                
                // If search is active and no links match, don't render category
                if (searchQuery && catLinks.length === 0) return null;

                return (
                    <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                             <div className="text-slate-400">
                                {cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon) ? <span className="text-lg">{cat.icon}</span> : <Icon name={cat.icon} size={20} />}
                             </div>
                             <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                 {cat.name}
                             </h2>
                             {isLocked && <Lock size={16} className="text-amber-500" />}
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
                        ) : (
                             <>
                                {catLinks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm italic">
                                        暂无链接
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                                        {catLinks.map(link => renderLinkCard(link))}
                                    </div>
                                )}
                             </>
                        )}
                    </section>
                );
            })}
            
            {/* Empty State for Search */}
            {searchQuery && searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search size={40} className="opacity-30 mb-4" />
                    <p>没有找到相关内容</p>
                    <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-500 hover:underline">添加一个?</button>
                </div>
            )}

            <div className="h-20"></div> {/* Bottom Spacer */}
        </div>
      </main>

      <LinkModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
        onSave={editingLink ? handleEditLink : handleAddLink}
        categories={categories}
        existingLinks={links}
        initialData={editingLink || (prefillLink as LinkItem)}
        aiConfig={aiConfig}
      />
    </div>
  );
}

export default App;
