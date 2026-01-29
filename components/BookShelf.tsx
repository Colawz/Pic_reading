import React, { useState } from 'react';
import { Book } from '../types';
import { Book as BookIcon, ChevronRight, Plus, Upload } from 'lucide-react';

interface BookShelfProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onImportBook: (title: string, content: string) => void;
}

export const BookShelf: React.FC<BookShelfProps> = ({ books, onSelectBook, onImportBook }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importContent, setImportContent] = useState('');

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (importTitle && importContent) {
      onImportBook(importTitle, importContent);
      setImportTitle('');
      setImportContent('');
      setShowImportModal(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
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
            <p className="text-slate-400 text-sm text-center">粘贴文本，AI 自动为你配图</p>
        </div>

        {books.map(book => (
          <div 
            key={book.id}
            onClick={() => onSelectBook(book)}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-brand-300 transition-all transform hover:-translate-y-1 group"
          >
            <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-6xl relative overflow-hidden">
                <span className="z-10">{book.coverEmoji}</span>
                <div className="absolute -bottom-4 -right-4 opacity-10 text-9xl">
                    <BookIcon size={120} />
                </div>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold px-2 py-1 bg-brand-50 text-brand-700 rounded-full uppercase tracking-wider">
                    {book.genre}
                </span>
              </div>
              
              <h3 className="font-serif font-bold text-2xl text-slate-800 mb-1 group-hover:text-brand-600 transition-colors">
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
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-bold text-xl text-slate-800">导入新故事</h3>
                   <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
               </div>
               <form onSubmit={handleImportSubmit} className="p-6">
                   <div className="mb-4">
                       <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                       <input 
                         type="text" 
                         value={importTitle}
                         onChange={e => setImportTitle(e.target.value)}
                         className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                         placeholder="例如：卖算力的小女孩"
                         required
                       />
                   </div>
                   <div className="mb-6">
                       <label className="block text-sm font-medium text-slate-700 mb-1">故事内容 (粘贴文本)</label>
                       <textarea 
                         value={importContent}
                         onChange={e => setImportContent(e.target.value)}
                         className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none h-64 resize-none"
                         placeholder="在这里粘贴小说或故事内容..."
                         required
                       />
                   </div>
                   <div className="flex justify-end gap-3">
                       <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">取消</button>
                       <button type="submit" className="px-5 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 flex items-center gap-2">
                           <Upload size={18} /> 导入并阅读
                       </button>
                   </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};