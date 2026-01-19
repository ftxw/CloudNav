
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import AuthModal from './components/AuthModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchSettingsModal from './components/SearchSettingsModal';

const GITHUB_REPO_URL = 'https://github.com/sese972010/CloudNav-';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_ENGINES_KEY = 'cloudnav_search_engines';

function App() {
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
  
  // Site Settings - Initialized with defaults to prevent crash
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
      title: 'CloudNav - 我的导航',
      navTitle: '云航 CloudNav',
      favicon: '',
      cardStyle: 'detailed'
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Search Engine Selector State
  const [showEngineSelector, setShowEngineSelector] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, link: LinkItem | null } | null>(null);

  // Category Context Menu State
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number, y: number, category: Category | null } | null>(null);

  // Category Sort Mode
  const [isSortingCategory, setIsSortingCategory] = useState<string | null>(null);

  // Category Rename Mode
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [editingPasswordValue, setEditingPasswordValue] = useState('');
  const [editingIconValue, setEditingIconValue] = useState('');

  // Add Category Mode
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPassword, setNewCategoryPassword] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');

  // Icon Picker
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<'rename' | 'add' | null>(null);
  const [selectedIcon, setSelectedIcon] = useState('');

  const iconList = [
    'Folder', 'Star', 'Heart', 'Home', 'Book', 'Code', 'Globe', 'Music', 'Video', 'Image',
    'File', 'Link', 'Settings', 'Search', 'Mail', 'Phone', 'User', 'Calendar', 'Clock', 'Map',
    'Camera', 'Headphones', 'Terminal', 'Database', 'Server', 'Cloud', 'Download', 'Upload',
    'Share', 'Copy', 'Cut', 'Trash', 'Edit', 'Check', 'X', 'Plus', 'Minus', 'Bookmark'
  ];

  // Merge Category Mode
  const [isMergingCategory, setIsMergingCategory] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  // Drag and Drop Sort State
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

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
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');

  const mainRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const categoryContextMenuRef = useRef<HTMLDivElement>(null);
  const searchEngineSelectorRef = useRef<HTMLDivElement>(null);

  // --- Category Operations ---

  const handleAddCategory = () => {
      if (!authToken) { setIsAuthOpen(true); return; }
      setIsAddingCategory(true);
      setNewCategoryName('');
      setNewCategoryPassword('');
      setCategoryContextMenu(null);
  };

  const handleSortCategory = () => {
      if (!authToken) { setIsAuthOpen(true); return; }
      setIsSortingCategory('all');
      setCategoryContextMenu(null);
  };

  const handleRenameCategory = (cat: Category) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      setRenamingCategoryId(cat.id);
      setRenamingValue(cat.name);
      setEditingPasswordValue(cat.password || '');
      setEditingIconValue(cat.icon);
      setCategoryContextMenu(null);
  };

  const handleMergeCategory = (cat: Category) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      setIsMergingCategory(cat.id);
      setMergeTargetId('');
      setCategoryContextMenu(null);
  };

  const handleConfirmMerge = () => {
      if (!isMergingCategory || !mergeTargetId) return;
      if (isMergingCategory === mergeTargetId) return;

      const targetCat = categories.find(c => c.id === mergeTargetId);
      if (!targetCat) return;

      const newLinks = links.map(l =>
          l.categoryId === isMergingCategory ? { ...l, categoryId: targetCat.id } : l
      );
      const newCategories = categories.filter(c => c.id !== isMergingCategory);
      updateData(newLinks, newCategories);
      setIsMergingCategory(null);
      setMergeTargetId('');
  };

  const handleCancelMerge = () => {
      setIsMergingCategory(null);
      setMergeTargetId('');
  };

  const handleDeleteCategory = (catId: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }

      const cat = categories.find(c => c.id === catId);
      if (!cat) return;

      if (confirm(`确定要删除分类"${cat.name}"及其所有链接吗？`)) {
          const newCategories = categories.filter(c => c.id !== catId);
          const newLinks = links.filter(l => l.categoryId !== catId);
          updateData(newLinks, newCategories);
      }
      setCategoryContextMenu(null);
  };

  const handleSaveCategorySort = () => {
      setIsSortingCategory(null);
  };

  const handleConfirmAddCategory = () => {
      if (!newCategoryName.trim()) return;

      const newCategory: Category = {
          id: Date.now().toString(),
          name: newCategoryName.trim(),
          icon: newCategoryIcon || 'Folder',
          password: newCategoryPassword.trim() || undefined
      };

      const newCategories = [...categories, newCategory];
      updateData(links, newCategories);
      setIsAddingCategory(false);
      setNewCategoryName('');
      setNewCategoryPassword('');
      setNewCategoryIcon('');
  };

  const handleCancelAddCategory = () => {
      setIsAddingCategory(false);
      setNewCategoryName('');
      setNewCategoryPassword('');
      setNewCategoryIcon('');
  };

  const handleOpenIconPicker = (target: 'rename' | 'add') => {
      setIconPickerTarget(target);
      setSelectedIcon(target === 'rename' ? editingIconValue : newCategoryIcon);
      setIconPickerOpen(true);
  };

  const handleSelectIcon = (icon: string) => {
      setSelectedIcon(icon);
      if (iconPickerTarget === 'rename') {
          setEditingIconValue(icon);
      } else {
          setNewCategoryIcon(icon);
      }
      setIconPickerOpen(false);
      setIconPickerTarget(null);
  };

  const handleConfirmRename = () => {
      if (!renamingCategoryId || !renamingValue.trim()) return;
      const newCategories = categories.map(cat =>
          cat.id === renamingCategoryId ? { ...cat, name: renamingValue.trim(), password: editingPasswordValue.trim() || undefined, icon: editingIconValue } : cat
      );
      updateData(links, newCategories);
      setRenamingCategoryId(null);
      setRenamingValue('');
      setEditingPasswordValue('');
      setEditingIconValue('');
  };

  const handleCancelRename = () => {
      setRenamingCategoryId(null);
      setRenamingValue('');
      setEditingPasswordValue('');
      setEditingIconValue('');
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, catId: string) => {
      setDraggedCategoryId(catId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', catId);

      // 设置拖拽时的视觉效果
      const target = e.currentTarget;
      target.classList.add('dragging');
      target.classList.add('drag-item');
  };

  const handleDragOver = (e: React.DragEvent, targetCatId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedCategoryId || draggedCategoryId === targetCatId) return;

      // 只更新拖拽悬停状态，不改变数组顺序
      setDragOverCategoryId(targetCatId);
  };

  const handleDragLeave = (e: React.DragEvent, targetCatId: string) => {
      // 当离开元素且不是进入子元素时才移除效果
      if (dragOverCategoryId === targetCatId) {
          const relatedTarget = e.relatedTarget as HTMLElement;
          const currentTarget = e.currentTarget;
          if (!currentTarget.contains(relatedTarget)) {
              setDragOverCategoryId(null);
          }
      }
  };

  const handleDrop = (e: React.DragEvent, targetCatId: string) => {
      e.preventDefault();

      if (!draggedCategoryId || draggedCategoryId === targetCatId) {
          setDragOverCategoryId(null);
          return;
      }

      // 在放置时才更新数组顺序
      const newCategories = [...categories];
      const draggedIndex = newCategories.findIndex(c => c.id === draggedCategoryId);
      const targetIndex = newCategories.findIndex(c => c.id === targetCatId);

      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          const draggedItem = newCategories[draggedIndex];
          newCategories.splice(draggedIndex, 1);
          newCategories.splice(targetIndex, 0, draggedItem);
          updateData(links, newCategories);
      }

      setDragOverCategoryId(null);
      setDraggedCategoryId(null);

      const target = e.currentTarget;
      target.classList.remove('drag-over');
  };

  const handleDragEnd = (e: React.DragEvent, catId: string) => {
      const target = e.currentTarget;
      target.classList.remove('dragging');
      target.classList.remove('drag-over');
      target.classList.remove('drag-item');

      setDragOverCategoryId(null);
      setDraggedCategoryId(null);
  };

  // --- Helpers ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLinks(parsed.links || INITIAL_LINKS);
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

  const updateData = (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings = siteSettings) => {
      setLinks(newLinks);
      setCategories(newCategories);
      setSiteSettings(newSettings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings }));
      if (authToken) {
          syncToCloud(newLinks, newCategories, newSettings, authToken);
      }
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
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setCategories(data.categories || DEFAULT_CATEGORIES);
                    if (data.settings) setSiteSettings(prev => ({ ...prev, ...data.settings }));
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

  useEffect(() => {
      document.title = siteSettings.title || 'CloudNav';
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link && siteSettings.favicon) {
          link.href = siteSettings.favicon;
      }
  }, [siteSettings]);

  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (openMenuId) setOpenMenuId(null);
          if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
             setContextMenu(null);
          }
          // Close category context menu when clicking outside
          if (categoryContextMenu && categoryContextMenuRef.current && !categoryContextMenuRef.current.contains(e.target as Node)) {
              setCategoryContextMenu(null);
          }
          // Close merge modal when clicking outside (handled by modal's backdrop click)
          // Close search engine selector when clicking outside
          if (showEngineSelector && searchEngineSelectorRef.current && !searchEngineSelectorRef.current.contains(e.target as Node)) {
              setShowEngineSelector(false);
          }
          // Close icon picker when clicking outside
          if (iconPickerOpen) {
              const target = e.target as Node;
              const iconPickerElement = document.querySelector('[data-icon-picker="true"]');
              if (iconPickerElement && !iconPickerElement.contains(target)) {
                  setIconPickerOpen(false);
                  setIconPickerTarget(null);
              }
          }
          // Cancel editing/adding when clicking outside
          if (renamingCategoryId) {
              const target = e.target as Node;
              const editingElement = document.querySelector(`[data-editing="${renamingCategoryId}"]`);
              if (editingElement && !editingElement.contains(target)) {
                  handleCancelRename();
              }
          }
          if (isAddingCategory) {
              const target = e.target as Node;
              const addingElement = document.querySelector('[data-adding="true"]');
              if (addingElement && !addingElement.contains(target)) {
                  handleCancelAddCategory();
              }
          }
      };

      const handleScroll = () => {
         if (contextMenu) setContextMenu(null);
         if (categoryContextMenu) setCategoryContextMenu(null);
         if (showEngineSelector) setShowEngineSelector(false);
      };

      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);

      const handleGlobalContextMenu = (e: MouseEvent) => {
          // Only close menus if clicking outside of them
          if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
              setContextMenu(null);
          }
          if (categoryContextMenu && categoryContextMenuRef.current && !categoryContextMenuRef.current.contains(e.target as Node)) {
              setCategoryContextMenu(null);
          }
      }
      window.addEventListener('contextmenu', handleGlobalContextMenu);

      return () => {
          window.removeEventListener('click', handleClickOutside);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('contextmenu', handleGlobalContextMenu);
      }
  }, [openMenuId, contextMenu, categoryContextMenu, showEngineSelector, iconPickerOpen, renamingCategoryId, isAddingCategory]);

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

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    updateData([newLink, ...links], categories);
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
      if (!authToken) { setIsAuthOpen(true); return; }
      const updated = links.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l);
      updateData(updated, categories);
  };
  
  const handleCopyLink = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleSaveAIConfig = (config: AIConfig, newSiteSettings: SiteSettings) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      if (authToken) {
          updateData(links, categories, newSiteSettings);
      } else {
          setSiteSettings(newSiteSettings);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories, settings: newSiteSettings }));
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

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
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
  };

  const isCategoryLocked = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.password) return false;
      return !unlockedCategoryIds.has(catId);
  };

  const pinnedLinks = useMemo(() => {
      // 始终显示所有置顶链接
      return links.filter(l => l.pinned === true && !isCategoryLocked(l.categoryId));
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
      
      const isSimple = siteSettings.cardStyle === 'simple';

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
                // Boundary adjustment
                if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
                if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
                setContextMenu({ x, y, link });
                return false;
            }}
            className={`group relative flex flex-col ${isSimple ? 'p-2' : 'p-3'} bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-slate-750`}
            title={link.description || link.url}
        >
            <div className={`flex items-center gap-3 ${isSimple ? '' : 'mb-1.5'} pr-6`}>
                <div className={`${isSimple ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-lg bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden`}>
                    {iconDisplay}
                </div>
                <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.title}
                </h3>
            </div>
            {!isSimple && (
                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 h-4 w-full overflow-hidden">
                    {link.description || <span className="opacity-0">.</span>}
                </div>
            )}
        </a>
      );
  };

  return (
    <>
      <style>{`
        .dragging {
          opacity: 0.4;
          transform: scale(0.95);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          cursor: grabbing !important;
        }
        .drag-over {
          border: 2px dashed #3b82f6 !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
        }
        .drag-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .drag-item:not(.dragging) {
          cursor: move;
        }
        .drag-item:not(.dragging):hover {
          background-color: rgba(59, 130, 246, 0.05);
        }
      `}</style>
      <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      
      {/* Right Click Context Menu */}
      {contextMenu && (
          <div 
             ref={contextMenuRef}
             className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-600 w-44 py-2 flex flex-col animate-in fade-in zoom-in duration-100 overflow-hidden"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()}
             onContextMenu={(e) => e.preventDefault()}
          >
             <button onClick={() => { handleCopyLink(contextMenu.link!.url); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Copy size={16} className="text-slate-400"/> <span>复制链接</span>
             </button>
             <button onClick={() => { setQrCodeLink(contextMenu.link); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <QrCode size={16} className="text-slate-400"/> <span>显示二维码</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(contextMenu.link!); setIsModalOpen(true); setContextMenu(null); }}} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Edit2 size={16} className="text-slate-400"/> <span>编辑链接</span>
             </button>
             <button onClick={() => { togglePin(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Pin size={16} className={contextMenu.link!.pinned ? "fill-current text-blue-500" : "text-slate-400"}/> <span>{contextMenu.link!.pinned ? '取消置顶' : '置顶'}</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { handleDeleteLink(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-left">
                 <Trash2 size={16}/> <span>删除链接</span>
             </button>
          </div>
      )}

      {/* Merge Category Modal */}
      {isMergingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelMerge}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCancelMerge}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Merge size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">合并分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                将此分类的所有链接合并到目标分类
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  选择目标分类
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  autoFocus
                >
                  <option value="">请选择...</option>
                  {categories
                    .filter(c => c.id !== isMergingCategory)
                    .map(cat => {
                      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {isEmoji ? cat.icon + ' ' : ''}{cat.name}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeTargetId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/30"
                >
                  确认合并
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrCodeLink && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrCodeLink(null)}>
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg text-slate-800">{qrCodeLink.title}</h3>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeLink.url)}`} 
                        alt="QR Code" 
                        className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs text-slate-500 max-w-[200px] truncate">{qrCodeLink.url}</p>
              </div>
          </div>
      )}

      {/* Merge Category Modal */}
      {isMergingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelMerge}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCancelMerge}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Merge size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">合并分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                将此分类的所有链接合并到目标分类
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  选择目标分类
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  autoFocus
                >
                  <option value="">请选择...</option>
                  {categories
                    .filter(c => c.id !== isMergingCategory)
                    .map(cat => {
                      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {isEmoji ? cat.icon + ' ' : ''}{cat.name}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeTargetId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/30"
                >
                  确认合并
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Link Confirmation Modal */}
      {deleteLinkConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={() => setDeleteLinkConfirm(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteLinkConfirm(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">温馨提示</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                确定要删除此链接吗？
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
                {deleteLinkConfirm.title}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleConfirmDeleteLink}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
              >
                确认删除
              </button>
              <button
                onClick={() => setDeleteLinkConfirm(null)}
                className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Category Modal */}
      {isMergingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelMerge}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCancelMerge}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Merge size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">合并分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                将此分类的所有链接合并到目标分类
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  选择目标分类
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  autoFocus
                >
                  <option value="">请选择...</option>
                  {categories
                    .filter(c => c.id !== isMergingCategory)
                    .map(cat => {
                      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {isEmoji ? cat.icon + ' ' : ''}{cat.name}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeTargetId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/30"
                >
                  确认合并
                </button>
              </div>
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
        authToken={authToken}
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
               {isSortingCategory === 'all' ? (
                   <button
                      onClick={handleSaveCategorySort}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                   >
                      确认
                   </button>
               ) : null}
            </div>

            {categories.map(cat => {
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
                const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                const isRenaming = renamingCategoryId === cat.id;
                const isSorting = isSortingCategory === 'all';

                return (
                  <div
                    key={cat.id}
                    draggable={isSorting}
                    onDragStart={(e) => handleDragStart(e, cat.id)}
                    onDragOver={(e) => handleDragOver(e, cat.id)}
                    onDragLeave={(e) => handleDragLeave(e, cat.id)}
                    onDrop={(e) => handleDrop(e, cat.id)}
                    onDragEnd={(e) => handleDragEnd(e, cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative drag-item ${
                      activeCategory === cat.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    } ${isSorting ? 'cursor-move' : ''} ${draggedCategoryId === cat.id ? 'dragging' : ''} ${dragOverCategoryId === cat.id ? 'drag-over' : ''}`}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isSorting || isRenaming || isAddingCategory || isMergingCategory) return;
                        let x = e.clientX;
                        let y = e.clientY;
                        // Boundary adjustment
                        if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                        if (y + 250 > window.innerHeight) y = window.innerHeight - 260;
                        setCategoryContextMenu({ x, y, category: cat });
                    }}
                  >
                    {isRenaming ? (
                        <div data-editing={renamingCategoryId} className="w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    onClick={() => handleOpenIconPicker('rename')}
                                    className="p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                                    title="点击更换图标"
                                >
                                    {isEmoji ? (
                                        <span className="text-base leading-none">{editingIconValue}</span>
                                    ) : (
                                        <Icon name={editingIconValue} size={16} />
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={renamingValue}
                                    onChange={(e) => setRenamingValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleConfirmRename();
                                        if (e.key === 'Escape') handleCancelRename();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="分类名称"
                                    className="flex-1 min-w-0 bg-white dark:bg-slate-700 text-sm px-2 py-1 rounded border border-blue-300 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Lock size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="password"
                                        value={editingPasswordValue}
                                        onChange={(e) => setEditingPasswordValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleConfirmRename();
                                            if (e.key === 'Escape') handleCancelRename();
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="密码(可选)"
                                        className="w-full bg-white dark:bg-slate-700 text-sm pl-8 pr-2 py-1 rounded border border-blue-300 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors shrink-0"
                                >
                                    确认
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex items-center gap-3" onClick={() => !isSorting && scrollToCategory(cat.id)} onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isSorting || isRenaming || isAddingCategory || isMergingCategory) return;
                            let x = e.clientX;
                            let y = e.clientY;
                            if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                            if (y + 250 > window.innerHeight) y = window.innerHeight - 260;
                            setCategoryContextMenu({ x, y, category: cat });
                        }}>
                            <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${activeCategory === cat.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              {isLocked ? <Lock size={16} className="text-amber-500" /> : (isEmoji ? <span className="text-base leading-none">{cat.icon}</span> : <Icon name={cat.icon} size={16} />)}
                            </div>
                            <span className="truncate flex-1 text-left">{cat.name}</span>
                        </div>
                    )}
                  </div>
                );
            })}

            {/* Add Category Form */}
            {isAddingCategory && (
                <div data-adding="true" className="px-4 py-2.5 space-y-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmAddCategory();
                                if (e.key === 'Escape') handleCancelAddCategory();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="分类名称"
                            className="flex-1 bg-white dark:bg-slate-700 text-sm px-2 py-1 rounded border border-blue-300 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); handleConfirmAddCategory(); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors shrink-0"
                        >
                            确认
                        </button>
                    </div>
                    <div className="relative">
                        <Lock size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="password"
                            value={newCategoryPassword}
                            onChange={(e) => setNewCategoryPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmAddCategory();
                                if (e.key === 'Escape') handleCancelAddCategory();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="密码(可选)"
                            className="w-full bg-white dark:bg-slate-700 text-sm pl-8 pr-2 py-1 rounded border border-blue-300 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            )}
        </div>

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
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsSettingsModalOpen(true); }}
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

      {/* Category Context Menu */}
      {categoryContextMenu && (
        <div
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
            <span>添加分类</span>
          </button>
          <button
            onClick={handleSortCategory}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <Move size={16} className="text-slate-400"/>
            <span>排序</span>
          </button>
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
            <span>合并到</span>
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
          <button
            onClick={() => handleDeleteCategory(categoryContextMenu.category.id)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <Trash2 size={16} />
            <span>删除</span>
          </button>
        </div>
      )}

      {/* Merge Category Modal */}
      {isMergingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelMerge}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCancelMerge}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Merge size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">合并分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                将此分类的所有链接合并到目标分类
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  选择目标分类
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  autoFocus
                >
                  <option value="">请选择...</option>
                  {categories
                    .filter(c => c.id !== isMergingCategory)
                    .map(cat => {
                      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {isEmoji ? cat.icon + ' ' : ''}{cat.name}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeTargetId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/30"
                >
                  确认合并
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Icon Picker Modal */}
      {iconPickerOpen && (
        <div
          data-icon-picker="true"
          className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 animate-in fade-in zoom-in duration-200 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">选择图标</h3>
            <button
              onClick={() => { setIconPickerOpen(false); setIconPickerTarget(null); }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
            {iconList.map((icon) => {
              const isEmoji = icon.length <= 4 && !/^[a-zA-Z]+$/.test(icon);
              return (
                <button
                  key={icon}
                  onClick={() => handleSelectIcon(icon)}
                  className={`p-3 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center ${
                    selectedIcon === icon ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''
                  }`}
                  title={icon}
                >
                  {isEmoji ? (
                    <span className="text-xl">{icon}</span>
                  ) : (
                    <Icon name={icon} size={20} className="text-slate-600 dark:text-slate-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Merge Category Modal */}
      {isMergingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelMerge}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCancelMerge}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Merge size={32} />
              </div>
              <h2 className="text-xl font-bold dark:text-white">合并分类</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                将此分类的所有链接合并到目标分类
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  选择目标分类
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  autoFocus
                >
                  <option value="">请选择...</option>
                  {categories
                    .filter(c => c.id !== isMergingCategory)
                    .map(cat => {
                      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {isEmoji ? cat.icon + ' ' : ''}{cat.name}
                        </option>
                      );
                    })
                  }
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMerge}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!mergeTargetId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/30"
                >
                  确认合并
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main
          ref={mainRef}
          className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative"
      >
        <div className="flex-1 overflow-y-auto scroll-smooth">
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

                {/* Settings Gear (Visible only for External) */}
                {searchMode === 'external' && (
                    <button
                        onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsSearchSettingsOpen(true); }}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors animate-in fade-in slide-in-from-left-2 duration-200"
                        title="管理搜索引擎"
                    >
                        <Settings size={18} />
                    </button>
                )}

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
                        placeholder={searchMode === 'local' ? "搜索书签..." : `在 ${activeExternalEngine?.name} 搜索...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-full text-sm dark:text-white placeholder-slate-400 outline-none transition-all focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 ${
                            searchMode === 'external' ? 'pl-10 pr-16 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700' : 'pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700'
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
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 mr-2">
                <button 
                    onClick={() => authToken && updateData(links, categories, { ...siteSettings, cardStyle: 'simple' })}
                    title="简约模式"
                    className={`p-1.5 rounded transition-all ${siteSettings.cardStyle === 'simple' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <LayoutGrid size={16} />
                </button>
                <button 
                    onClick={() => authToken && updateData(links, categories, { ...siteSettings, cardStyle: 'detailed' })}
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

            <button
              onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setIsModalOpen(true); }}}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
            >
              <Plus size={16} /> <span className="hidden sm:inline">添加</span>
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 space-y-8">

            {/* 全部链接模式：置顶链接在最顶部显示 */}
            {activeCategory === 'all' && pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Pin size={16} className="text-blue-500 fill-blue-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            置顶 / 常用
                        </h2>
                    </div>
                    <div className={`grid gap-3 ${siteSettings.cardStyle === 'simple' ? 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}`}>
                        {pinnedLinks.map(link => renderLinkCard(link))}
                    </div>
                </section>
            )}

            {/* 单独分类模式：置顶链接在该分类之前显示 */}
            {activeCategory !== 'all' && pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Pin size={16} className="text-blue-500 fill-blue-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            置顶 / 常用
                        </h2>
                    </div>
                    <div className={`grid gap-3 ${siteSettings.cardStyle === 'simple' ? 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}`}>
                        {pinnedLinks.map(link => renderLinkCard(link))}
                    </div>
                </section>
            )}

            {categories.map(cat => {
                // 当选择特定分类时，只显示该分类；否则显示所有分类
                if (activeCategory !== 'all' && activeCategory !== cat.id) return null;

                let catLinks = searchResults.filter(l => l.categoryId === cat.id);
                const catOtherLinks = catLinks.filter(l => !l.pinned);
                const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);

                // Logic Fix: If External Search, do NOT hide categories based on links
                // Because external search doesn't filter links.
                // However, the user probably wants to see the links grid even when typing for external search
                // Current logic: if search query exists AND local search -> filter.
                // If search query exists AND external search -> show all (searchResults returns all).

                if (searchQuery && searchMode === 'local' && catLinks.length === 0) return null;

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
                             <div className={`grid gap-3 ${catLinks.length === 0 ? '' : siteSettings.cardStyle === 'simple' ? 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}`}>
                                {catLinks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm italic">
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
        onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
        onSave={editingLink ? handleEditLink : handleAddLink}
        categories={categories}
        existingLinks={links}
        initialData={editingLink || (prefillLink as LinkItem)}
        aiConfig={aiConfig}
      />
    </div>
    </>
  );
}

export default App;
