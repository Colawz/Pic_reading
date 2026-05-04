
import React, { useEffect, useRef, useState } from 'react';
import { Book, VisualSpec } from '../types';
import { Book as BookIcon, ChevronRight, Plus, Upload, Image as ImageIcon, Camera, Sparkles, Loader2, Trash2, X } from 'lucide-react';

interface BookShelfProps {
  books: Book[];
  visualSpecs: VisualSpec[];
  defaultImportStyleId: string;
  onSelectBook: (book: Book) => void;
  onImportBook: (title: string, content: string, styleId: string, coverUrl?: string) => void;
  onUpdateBookCover: (bookId: string, coverUrl: string) => void;
  onGenerateBookCover: (title: string, content: string, styleId: string) => Promise<{ previewUrl: string; persistedUrlPromise: Promise<string> }>;
  onDeleteBook: (bookId: string) => void;
}

export const BookShelf: React.FC<BookShelfProps> = ({ books, visualSpecs, defaultImportStyleId, onSelectBook, onImportBook, onUpdateBookCover, onGenerateBookCover, onDeleteBook }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importContent, setImportContent] = useState('');
  const [importCoverUrl, setImportCoverUrl] = useState<string | undefined>(undefined);
  const [importStyleId, setImportStyleId] = useState(defaultImportStyleId);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isSyncingGeneratedCover, setIsSyncingGeneratedCover] = useState(false);
  const [generatedCoverNeedsLocalSync, setGeneratedCoverNeedsLocalSync] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateCoverInputRef = useRef<HTMLInputElement>(null);
  const pendingGeneratedCoverRef = useRef<Promise<string> | null>(null);
  const [updatingBookId, setUpdatingBookId] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }

    return '未知错误';
  };

  useEffect(() => {
    if (!showImportModal) {
      setImportStyleId(defaultImportStyleId);
    }
  }, [defaultImportStyleId, showImportModal]);

  const selectedImportStyle = visualSpecs.find(spec => spec.id === importStyleId) || visualSpecs[0];

  const resetImportForm = () => {
    pendingGeneratedCoverRef.current = null;
    setImportTitle('');
    setImportContent('');
    setImportCoverUrl(undefined);
    setImportStyleId(defaultImportStyleId);
    setIsGeneratingCover(false);
    setIsSyncingGeneratedCover(false);
    setGeneratedCoverNeedsLocalSync(false);
    setIsSubmittingImport(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isUpdate = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isUpdate && updatingBookId) {
          onUpdateBookCover(updatingBookId, result);
          setUpdatingBookId(null);
        } else {
          pendingGeneratedCoverRef.current = null;
          setImportCoverUrl(result);
          setIsSyncingGeneratedCover(false);
          setGeneratedCoverNeedsLocalSync(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTitle || !importContent) {
      return;
    }

    setIsSubmittingImport(true);
    try {
      let nextCoverUrl = importCoverUrl;
      const pendingGeneratedCover = pendingGeneratedCoverRef.current;

      if (pendingGeneratedCover) {
        try {
          nextCoverUrl = await pendingGeneratedCover;
        } catch (error) {
          console.error('Failed to finish generated cover sync before import:', error);
          alert('AI 封面保存到本地失败，请重新生成或手动上传封面后再导入。');
          return;
        }
        if (pendingGeneratedCoverRef.current === pendingGeneratedCover) {
          pendingGeneratedCoverRef.current = null;
          setImportCoverUrl(nextCoverUrl);
          setIsSyncingGeneratedCover(false);
          setGeneratedCoverNeedsLocalSync(false);
        }
      } else if (generatedCoverNeedsLocalSync) {
        alert('AI 封面还没有成功保存到本地，请重新生成或手动上传封面后再导入。');
        return;
      }

      onImportBook(importTitle, importContent, importStyleId, nextCoverUrl);
      resetImportForm();
      setShowImportModal(false);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!importTitle.trim() || !importContent.trim()) {
      return;
    }

    setIsGeneratingCover(true);
    setIsSyncingGeneratedCover(false);
    setGeneratedCoverNeedsLocalSync(false);
    try {
      const { previewUrl, persistedUrlPromise } = await onGenerateBookCover(importTitle.trim(), importContent.trim(), importStyleId);
      setImportCoverUrl(previewUrl);
      pendingGeneratedCoverRef.current = persistedUrlPromise;
      setIsSyncingGeneratedCover(true);
      setGeneratedCoverNeedsLocalSync(true);

      void persistedUrlPromise.then((localUrl) => {
        if (pendingGeneratedCoverRef.current !== persistedUrlPromise) {
          return;
        }

        pendingGeneratedCoverRef.current = null;
        setImportCoverUrl(localUrl);
        setIsSyncingGeneratedCover(false);
        setGeneratedCoverNeedsLocalSync(false);
      }).catch((error) => {
        if (pendingGeneratedCoverRef.current !== persistedUrlPromise) {
          return;
        }

        console.error('Failed to persist generated cover locally:', error);
        pendingGeneratedCoverRef.current = null;
        setIsSyncingGeneratedCover(false);
        setGeneratedCoverNeedsLocalSync(true);
        alert('封面预览已生成，但保存到本地失败。请重新生成或手动上传封面。');
      });
    } catch (error) {
      console.error('Failed to generate import cover:', error);
      alert(`封面生成失败：${getErrorMessage(error)}`);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const triggerUpdateCover = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    setUpdatingBookId(bookId);
    updateCoverInputRef.current?.click();
  };

  const handleDeleteBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    const confirmed = window.confirm(`确认删除《${book.title}》及其角色、地点、关系、插图和本地图片吗？`);
    if (!confirmed) return;
    onDeleteBook(book.id);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Hidden inputs for file upload */}
      <input type="file" ref={updateCoverInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, true)} />

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-serif font-bold text-slate-900 mb-4">书架</h1>
        <p className="text-slate-500 text-lg">选择一本书，开始您的智绘阅读之旅</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Import Card */}
        <div 
          onClick={() => setShowImportModal(true)}
          className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-all group min-h-[300px]"
        >
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus size={32} className="text-brand-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-1">导入故事</h3>
            <p className="text-slate-400 text-sm text-center">粘贴文本并上传封面，AI 为您配图</p>
        </div>

        {books.map(book => (
          <div 
            key={book.id}
            onClick={() => onSelectBook(book)}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-brand-300 transition-all transform hover:-translate-y-1 group relative"
          >
            {/* Cover Image Area */}
            <div className="h-56 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative overflow-hidden">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <>
                    <span className="text-6xl z-10 transition-transform duration-500 group-hover:scale-125">{book.coverEmoji}</span>
                    <div className="absolute -bottom-4 -right-4 opacity-10 text-9xl">
                        <BookIcon size={120} />
                    </div>
                  </>
                )}
                
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => triggerUpdateCover(e, book.id)}
                    className="p-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-slate-600 hover:bg-white hover:text-brand-600"
                    title="更换封面"
                  >
                    <Camera size={16} />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteBook(e, book)}
                    className="p-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-slate-600 hover:bg-white hover:text-red-600"
                    title="删除书籍"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold px-2 py-1 bg-brand-50 text-brand-700 rounded-full uppercase tracking-wider">
                    {book.genre}
                </span>
              </div>
              
              <h3 className="font-serif font-bold text-2xl text-slate-800 mb-1 group-hover:text-brand-600 transition-colors truncate">
                {book.title}
              </h3>
              <p className="text-slate-500 text-sm mb-4">by {book.author}</p>
              
              <div className="flex items-center text-sm font-medium text-brand-600 mt-4 group-hover:translate-x-1 transition-transform">
                开始阅读 <ChevronRight size={16} className="ml-1" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="font-bold text-xl text-slate-800">导入新故事</h3>
                   <button onClick={() => { resetImportForm(); setShowImportModal(false); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
               </div>
               <form onSubmit={handleImportSubmit} className="flex flex-col md:flex-row h-[500px]">
                   {/* Left side: Cover Upload */}
                   <div className="w-full md:w-1/3 bg-slate-100 border-r border-slate-200 p-6 flex flex-col items-center justify-center">
                       <label className="block text-sm font-bold text-slate-500 uppercase mb-4 w-full text-center">书籍封面</label>
                       <div 
                         onClick={() => fileInputRef.current?.click()}
                         className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${importCoverUrl ? 'border-brand-500' : 'border-slate-300 hover:border-brand-400 hover:bg-white'}`}
                       >
                           {importCoverUrl ? (
                             <img src={importCoverUrl} className="w-full h-full object-cover" />
                           ) : (
                             <>
                               {isGeneratingCover ? (
                                 <>
                                   <Loader2 size={40} className="text-brand-500 mb-3 animate-spin" />
                                   <span className="text-xs text-brand-500 font-medium px-4 text-center">正在生成书籍封面...</span>
                                 </>
                               ) : (
                                 <>
                                   <ImageIcon size={48} className="text-slate-300 mb-2" />
                                   <span className="text-xs text-slate-400 font-medium px-4 text-center">点击上传封面图片<br/>(建议比例 3:4)</span>
                                 </>
                               )}
                             </>
                           )}
                       </div>
                       <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, false)} />
                       <div className="mt-3 flex w-full flex-col gap-2">
                         <button
                           type="button"
                           onClick={handleGenerateCover}
                           disabled={isGeneratingCover || !importTitle.trim() || !importContent.trim()}
                           className="w-full rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-600 shadow-sm transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                         >
                           {isGeneratingCover ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                           {isGeneratingCover ? '封面生成中...' : 'AI 生成封面'}
                         </button>
                         {isSyncingGeneratedCover && (
                           <div className="text-[11px] leading-relaxed text-brand-600 text-center">
                             已显示封面预览，正在后台保存本地图片...
                           </div>
                         )}
                         {!isSyncingGeneratedCover && generatedCoverNeedsLocalSync && importCoverUrl?.startsWith('http') && (
                           <div className="text-[11px] leading-relaxed text-amber-600 text-center">
                             当前仅为临时预览图，请重新生成或手动上传后再导入。
                           </div>
                         )}
                         {importCoverUrl && (
                           <button
                             type="button"
                             onClick={() => {
                               pendingGeneratedCoverRef.current = null;
                               setImportCoverUrl(undefined);
                               setIsSyncingGeneratedCover(false);
                               setGeneratedCoverNeedsLocalSync(false);
                             }}
                             className="text-xs text-red-500 font-bold hover:underline"
                           >
                             移除封面
                           </button>
                         )}
                       </div>
                   </div>

                   {/* Right side: Title & Content */}
                   <div className="flex-1 p-6 flex flex-col">
                       <div className="mb-4 shrink-0">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">书籍标题</label>
                           <input 
                             type="text" 
                             value={importTitle}
                             onChange={e => setImportTitle(e.target.value)}
                             className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                             placeholder="例如：卖算力的小女孩"
                             required
                           />
                       </div>
                       <div className="mb-4 shrink-0">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">绘图风格</label>
                           <select
                             value={importStyleId}
                             onChange={e => setImportStyleId(e.target.value)}
                             className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white text-sm font-medium"
                           >
                             {visualSpecs.map(spec => (
                               <option key={spec.id} value={spec.id}>{spec.label}</option>
                             ))}
                           </select>
                           {selectedImportStyle && (
                             <p className="mt-2 text-xs leading-relaxed text-slate-500">
                               该风格将用于本书后续插图和 AI 封面生成。当前：{selectedImportStyle.label}
                             </p>
                           )}
                       </div>
                       <div className="flex-1 flex flex-col">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">故事内容</label>
                           <textarea 
                             value={importContent}
                             onChange={e => setImportContent(e.target.value)}
                             className="flex-1 w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none text-sm leading-relaxed font-serif"
                             placeholder="在这里粘贴小说或故事内容..."
                             required
                           />
                       </div>
                       <div className="mt-6 flex justify-end gap-3 shrink-0">
                           <button type="button" onClick={() => { resetImportForm(); setShowImportModal(false); }} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                           <button type="submit" disabled={isSubmittingImport || isGeneratingCover} className="px-8 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                               {isSubmittingImport ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                               {isSubmittingImport ? '正在导入...' : '导入并开始阅读'}
                           </button>
                       </div>
                   </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};
