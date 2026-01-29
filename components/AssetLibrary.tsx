import React, { useState, useMemo } from 'react';
import { Character, Location, VisualSpec, Book } from '../types';
import { generateAssetVisual } from '../services/geminiService';
import { exportAssetsToHtml, exportAssetsToPdf } from '../services/exportService';
import { Loader2, Lock, Plus, RefreshCw, Trash2, User, MapPin, Download, AlertCircle, BookOpen, FileType } from 'lucide-react';

interface AssetLibraryProps {
  books: Book[];
  characters: Character[];
  locations: Location[];
  visualSpec: VisualSpec;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
  books,
  characters,
  locations,
  visualSpec,
  setCharacters,
  setLocations,
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'locations'>('characters');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const filteredCharacters = useMemo(() => selectedBookId === 'all' ? characters : characters.filter(c => c.bookId === selectedBookId), [characters, selectedBookId]);
  const filteredLocations = useMemo(() => selectedBookId === 'all' ? locations : locations.filter(l => l.bookId === selectedBookId), [locations, selectedBookId]);

  const handleGenerateVisual = async (id: string, type: 'character' | 'location', desc: string) => {
    setIsGenerating(id);
    try {
      const imageUrl = await generateAssetVisual(desc, type, visualSpec);
      if (type === 'character') setCharacters(prev => prev.map(c => c.id === id ? { ...c, imageUrl, locked: true, generationStatus: 'success' } : c));
      else setLocations(prev => prev.map(l => l.id === id ? { ...l, imageUrl, locked: true, generationStatus: 'success' } : l));
    } catch (e) { alert("生成失败。"); }
    finally { setIsGenerating(null); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">视觉资产库</h2>
            <p className="text-slate-500">管理故事世界的视觉一致性核心数据。</p>
        </div>
        <div className="flex items-center gap-2">
             <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} className="px-3 py-2 rounded-lg border bg-white text-sm focus:ring-2 focus:ring-brand-500">
                <option value="all">所有书籍</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
             </select>
             <div className="flex rounded-lg shadow-sm border overflow-hidden">
                <button onClick={() => selectedBookId !== 'all' ? exportAssetsToHtml(books.find(b => b.id === selectedBookId)!.title, filteredCharacters, filteredLocations) : alert("请先选一本书")} className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-50 border-r" title="导出 HTML"><BookOpen size={18} /></button>
                <button onClick={() => selectedBookId !== 'all' ? exportAssetsToPdf(books.find(b => b.id === selectedBookId)!.title, filteredCharacters, filteredLocations) : alert("请先选一本书")} className="px-3 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100" title="导出 PDF"><FileType size={18} /></button>
             </div>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-6">
            <button onClick={() => setActiveTab('characters')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'characters' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>角色 ({filteredCharacters.length})</button>
            <button onClick={() => setActiveTab('locations')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'locations' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>地点 ({filteredLocations.length})</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {(activeTab === 'characters' ? filteredCharacters : filteredLocations).map((item: any) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden group">
            <div className="aspect-square bg-slate-100 relative">
              {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">{item.generationStatus === 'generating' ? <Loader2 className="animate-spin text-brand-500" size={32} /> : <User size={48} />}</div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => handleGenerateVisual(item.id, activeTab === 'characters' ? 'character' : 'location', item.visualSummary || item.description)} className="p-2 bg-white rounded-full"><RefreshCw size={20} /></button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold mb-1 flex justify-between items-center">{item.name} {item.locked && <Lock size={12} className="text-amber-500" />}</h3>
              <p className="text-xs text-slate-500 line-clamp-3 mb-3">{item.visualSummary || item.description}</p>
              <div className="flex justify-end border-t pt-2"><button onClick={() => activeTab === 'characters' ? setCharacters(p => p.filter(c => c.id !== item.id)) : setLocations(p => p.filter(l => l.id !== item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>
            </div>
          </div>
        ))}
        <div className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 min-h-[300px]">
            <Plus size={32} className="mb-2" />
            <span className="text-xs text-center">阅读新章节时<br/>AI 会自动发现新资产</span>
        </div>
      </div>
    </div>
  );
};