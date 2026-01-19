import React, { useState, useEffect } from 'react';
import { X, Lock, Folder, Star, Heart, Home, Book, Code, Globe, Music, Video, Image, File, Link as LinkIcon, Settings, Search, Mail, Phone, User, Calendar, Clock, Map, Camera, Headphones, Terminal, Database, Server, Cloud, Download, Upload, Share, Copy, Trash, Edit, Check, Plus, Minus, Bookmark } from 'lucide-react';
import { Category } from '../types';

export type ModalMode = 'add' | 'edit' | 'merge';

interface CategoryModalProps {
  isOpen: boolean;
  mode: ModalMode;
  onClose: () => void;
  onAdd: (name: string, icon: string, password?: string) => void;
  onEdit: (categoryId: string, name: string, icon: string, password?: string) => void;
  onMerge: (sourceId: string, targetId: string) => void;
  category?: Category;
  categories: Category[];
}

const iconList = [
  'Folder', 'Star', 'Heart', 'Home', 'Book', 'Code', 'Globe', 'Music', 'Video', 'Image',
  'File', 'Link', 'Settings', 'Search', 'Mail', 'Phone', 'User', 'Calendar', 'Clock', 'Map',
  'Camera', 'Headphones', 'Terminal', 'Database', 'Server', 'Cloud', 'Download', 'Upload',
  'Share', 'Copy', 'Trash', 'Edit', 'Check', 'Plus', 'Minus', 'Bookmark'
];

const iconComponents: { [key: string]: any } = {
  Folder,
  Star,
  Heart,
  Home,
  Book,
  Code,
  Globe,
  Music,
  Video,
  Image,
  File,
  Link: LinkIcon,
  Settings,
  Search,
  Mail,
  Phone,
  User,
  Calendar,
  Clock,
  Map,
  Camera,
  Headphones,
  Terminal,
  Database,
  Server,
  Cloud,
  Download,
  Upload,
  Share,
  Copy,
  Trash,
  Edit,
  Check,
  Plus,
  Minus,
  Bookmark,
};

const IconDisplay = ({ iconName, size = 20 }: { iconName: string, size?: number }) => {
  const IconComponent = iconComponents[iconName];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  return <Folder size={size} />;
};

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  mode,
  onClose,
  onAdd,
  onEdit,
  onMerge,
  category,
  categories
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [password, setPassword] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && category) {
        setName(category.name);
        setIcon(category.icon || 'Folder');
        setPassword(category.password || '');
      } else if (mode === 'add') {
        setName('');
        setIcon('Folder');
        setPassword('');
      } else if (mode === 'merge' && category) {
        setMergeTargetId('');
      }
    }
  }, [isOpen, mode, category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'add') {
      onAdd(name, icon, password || undefined);
    } else if (mode === 'edit' && category) {
      onEdit(category.id, name, icon, password || undefined);
    } else if (mode === 'merge' && category) {
      onMerge(category.id, mergeTargetId);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'add': return '添加分类';
      case 'edit': return '编辑分类';
      case 'merge': return '合并分类';
    }
  };

  const availableCategories = categories.filter(c => {
    if (mode === 'merge' && category) {
      return c.id !== category.id;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold dark:text-white">{getTitle()}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {mode !== 'merge' && (
            <>
              {/* Name Input with Icon */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-slate-300">分类名称</label>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className={`shrink-0 w-10 h-10 rounded-lg border ${showIconPicker ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-all`}
                    title="点击选择图标"
                  >
                    <div className="text-blue-600 dark:text-blue-400">
                      <IconDisplay iconName={icon} size={20} />
                    </div>
                  </button>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="输入分类名称"
                    autoFocus
                  />
                </div>
                {showIconPicker && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                      {iconList.map((iconName) => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => { setIcon(iconName); setShowIconPicker(false); }}
                          className={`p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center ${
                            icon === iconName ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500' : ''
                          }`}
                        >
                          <div className="text-slate-600 dark:text-slate-300">
                            <IconDisplay iconName={iconName} size={16} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-slate-300">密码（选填）</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 pl-10 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="设置访问密码"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'merge' && category && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-slate-300">
                合并 <span className="text-blue-600 dark:text-blue-400 font-medium">{category.name}</span> 到：
              </label>
              <select
                required
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">选择目标分类</option>
                {availableCategories.map(cat => {
                  const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
                  return (
                    <option key={cat.id} value={cat.id}>
                      {isEmoji ? cat.icon : ''} {cat.name}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                注意：合并后，源分类的链接将全部移至目标分类，源分类将被删除。
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
            >
              {mode === 'merge' ? '确认合并' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;
