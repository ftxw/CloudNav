
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Pin, AlertTriangle, Wand2, Image as ImageIcon } from 'lucide-react';
import { LinkItem, Category, AIConfig } from '../types';
import { generateLinkDescription, suggestCategory } from '../services/geminiService';

// 图标 URL 转 base64 的辅助函数
const convertIconToBase64 = async (iconUrl: string): Promise<string> => {
    if (!iconUrl) return '';

    console.log('开始转换图标:', iconUrl);

    // 如果已经是 base64 格式,直接返回
    if (iconUrl.startsWith('data:image')) {
        console.log('图标已经是 base64 格式');
        return iconUrl;
    }

    // 如果不是 HTTP/HTTPS URL,直接返回原值
    if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
        console.log('图标不是 HTTP URL,直接返回');
        return iconUrl;
    }

    try {
        const response = await fetch(`/api/icon?url=${encodeURIComponent(iconUrl)}`);
        console.log('图标转换响应状态:', response.status);

        if (!response.ok) {
            console.error('图标转换失败,状态码:', response.status);
            return iconUrl;
        }

        const data = await response.json();
        console.log('图标转换结果:', data.dataUrl ? '成功' : '失败');

        return data.dataUrl || iconUrl;
    } catch (e) {
        console.error('图标转换异常:', e);
        return iconUrl;
    }
};

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Omit<LinkItem, 'id' | 'createdAt'>) => void;
  categories: Category[];
  existingLinks?: LinkItem[];
  initialData?: LinkItem;
  defaultCategoryId?: string;
  aiConfig: AIConfig;
}

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onSave, categories, existingLinks, initialData, defaultCategoryId, aiConfig }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [iconUrl, setIconUrl] = useState(''); // 输入框的值
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'common');
  const [pinned, setPinned] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [isSaving, setIsSaving] = useState(false); // 添加保存状态

  // 预览图标：编辑时显示原有图标，添加时显示当前 iconUrl（如果有的话）
  const previewIcon = initialData ? (iconUrl || initialData.icon) : iconUrl;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setUrl(initialData.url);
        setDescription(initialData.description || '');
        setCategoryId(initialData.categoryId);
        setPinned(initialData.pinned || false);
        // 编辑时图标 URL 输入框默认为空
        setIconUrl('');
      } else {
        setTitle('');
        setUrl('');
        setIconUrl('');
        setDescription('');
        setCategoryId(defaultCategoryId || categories[0]?.id || 'common');
        setPinned(false);
      }
      setDuplicateWarning('');
    }
  }, [isOpen, initialData, defaultCategoryId, categories]);

  // Logic to fetch icon
  const fetchIconFromUrl = (targetUrl: string) => {
      if (!targetUrl) return;
      try {
        let normalizedUrl = targetUrl;
        if (!targetUrl.startsWith('http')) {
            normalizedUrl = 'https://' + targetUrl;
        }

        // Use favicon.org.cn API
        const newIcon = `https://favicon.org.cn/get.php?url=${encodeURIComponent(normalizedUrl)}&size=128&key=usr-09b4268ccbf0b297611dc1a02fde7f739eec7ac3`;

        setIconUrl(newIcon);
      } catch (e) {
          // invalid url
      }
  };

  const handleUrlBlur = () => {
      if (!url) return;

      let normalizedUrl = url;
      if (!url.startsWith('http')) {
          normalizedUrl = 'https://' + url;
          setUrl(normalizedUrl);
      }

      // Check Duplicate
      if (existingLinks && !initialData) {
          const exists = existingLinks.some(l => {
              const u1 = l.url.replace(/\/$/, '').toLowerCase();
              const u2 = normalizedUrl.replace(/\/$/, '').toLowerCase();
              return u1 === u2;
          });
          if (exists) {
              setDuplicateWarning('注意：该链接已存在！');
          } else {
              setDuplicateWarning('');
          }
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
        // 编辑模式下，如果图标 URL 为空，则保留原有图标
        let iconToSave = initialData && !iconUrl ? initialData.icon : iconUrl;

        console.log('保存前的图标:', {
            isEdit: !!initialData,
            iconUrl: iconUrl,
            initialIcon: initialData?.icon,
            iconToSave: iconToSave
        });

        // 如果有新的图标 URL,先转换为 base64
        if (iconToSave && iconToSave.startsWith('http')) {
            console.log('检测到 HTTP 图标 URL,开始转换...');
            iconToSave = await convertIconToBase64(iconToSave);

            // 如果转换失败（返回的仍然是 http URL），清空图标
            if (iconToSave && iconToSave.startsWith('http')) {
                console.warn('图标转换失败，将使用默认图标');
                iconToSave = '';
            } else {
                console.log('图标转换成功,base64 长度:', iconToSave?.length);
            }
        } else {
            console.log('无需转换图标,类型:', iconToSave?.substring(0, 20));
        }

        const saveData = { title, url, description, categoryId, pinned, icon: iconToSave };
        console.log('准备保存的数据:', saveData);

        await onSave(saveData);

        // 确保 onSave 完成后再关闭模态框
        requestAnimationFrame(() => {
            onClose();
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAIAssist = async () => {
    if (!url || !title) return;
    if (!aiConfig.apiKey) {
        alert("请先点击侧边栏左下角设置图标配置 AI API Key");
        return;
    }

    setIsGenerating(true);
    try {
        const descPromise = generateLinkDescription(title, url, aiConfig);
        const catPromise = suggestCategory(title, url, categories, aiConfig);
        const [desc, cat] = await Promise.all([descPromise, catPromise]);
        
        if (desc) setDescription(desc);
        if (cat) setCategoryId(cat);
    } catch (e) {
    } finally {
        setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold dark:text-white">
            {initialData ? '编辑链接' : '添加新链接'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">URL 链接</label>
            <div className="relative">
                <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    className={`w-full p-2 rounded-lg border ${duplicateWarning ? 'border-amber-500 focus:ring-amber-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'} dark:bg-slate-700 dark:text-white focus:ring-2 outline-none transition-all`}
                    placeholder="https://..."
                />
                {duplicateWarning && (
                    <div className="absolute right-2 top-2 text-amber-500 animate-pulse" title={duplicateWarning}>
                        <AlertTriangle size={20} />
                    </div>
                )}
            </div>
            {duplicateWarning && <p className="text-xs text-amber-500 mt-1">{duplicateWarning}</p>}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">标题</label>
            <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="网站名称"
            />
          </div>

          {/* Icon Section */}
          <div>
             <label className="block text-sm font-medium mb-1 dark:text-slate-300">图标 URL</label>
             <div className="flex gap-2">
                 {/* Preview - 添加时默认显示 Image 图标，编辑时与卡片图标保持一致 */}
                 <div className="shrink-0 w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase overflow-hidden">
                    {previewIcon ? (
                         <img
                            src={previewIcon}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerText = title.charAt(0);
                            }}
                         />
                    ) : initialData ? (
                        title.charAt(0)
                    ) : (
                        <ImageIcon size={18} className="text-slate-400 dark:text-slate-500" />
                    )}
                 </div>

                 {/* Input - 编辑时默认为空 */}
                 <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    className="flex-1 p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/icon.png"
                 />

                 {/* Button */}
                 <button
                    type="button"
                    onClick={() => fetchIconFromUrl(url)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
                 >
                    <Wand2 size={14} /> 获取图标
                 </button>
             </div>
          </div>

          {/* Description & Category */}
          <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium dark:text-slate-300">描述 (选填)</label>
                    {(title && url) && (
                        <button
                            type="button"
                            onClick={handleAIAssist}
                            disabled={isGenerating}
                            className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI 自动填写
                        </button>
                    )}
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
                  placeholder="简短描述..."
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-slate-300">分类</label>
                    <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-11 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    </select>
                </div>
                <button
                    type="button"
                    onClick={() => setPinned(!pinned)}
                    className={`flex items-center gap-2 px-4 h-11 rounded-lg border transition-all ${
                        pinned
                        ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
                    }`}
                >
                    <Pin size={16} className={pinned ? "fill-current" : ""} />
                    <span className="text-sm font-medium">置顶</span>
                </button>
              </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                </>
              ) : (
                '保存链接'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkModal;
