import React, { useState, useMemo, useEffect } from 'react';
import { Character, Location, VisualSpec, Book, ImageGenerationModelId } from '../types';
import { exportAssetsToHtml, exportAssetsToPdf } from '../services/exportService';
import { Loader2, Lock, Plus, RefreshCw, Trash2, User, AlertCircle, BookOpen, FileType, Sparkles } from 'lucide-react';

interface AssetLibraryProps {
  books: Book[];
  characters: Character[];
  locations: Location[];
  visualSpec: VisualSpec;
  imageModelId: ImageGenerationModelId;
  imageModels: Array<{ id: ImageGenerationModelId; label: string; description: string }>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  onGenerateAssetVisual: (description: string, type: 'character' | 'location', bookId: string, entityId: string, specOverride?: VisualSpec) => Promise<{ localUrl: string; remoteUrl: string }>;
  onDeleteCharacter: (characterId: string) => Promise<void>;
  onDeleteLocation: (locationId: string) => Promise<void>;
  onUpdateImageModel: (modelId: ImageGenerationModelId) => void;
  focusedBookId: string | null;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
  books,
  characters,
  locations,
  visualSpec,
  imageModelId,
  imageModels,
  setCharacters,
  setLocations,
  onGenerateAssetVisual,
  onDeleteCharacter,
  onDeleteLocation,
  onUpdateImageModel,
  focusedBookId,
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'locations'>('characters');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  useEffect(() => {
    if (focusedBookId) {
      setSelectedBookId(focusedBookId);
    }
  }, [focusedBookId]);

  const filteredCharacters = useMemo(() => selectedBookId === 'all' ? characters : characters.filter(c => c.bookId === selectedBookId), [characters, selectedBookId]);
  const filteredLocations = useMemo(() => selectedBookId === 'all' ? locations : locations.filter(l => l.bookId === selectedBookId), [locations, selectedBookId]);
  const visibleItems = activeTab === 'characters' ? filteredCharacters : filteredLocations;
  const generatingCount = visibleItems.filter(item => item.generationStatus === 'generating').length;
  const failedCount = visibleItems.filter(item => item.generationStatus === 'failed').length;

  const handleGenerateVisual = async (id: string, type: 'character' | 'location', desc: string) => {
    if (type === 'character') {
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, generationStatus: 'generating' } : c));
    } else {
      setLocations(prev => prev.map(l => l.id === id ? { ...l, generationStatus: 'generating' } : l));
    }

    try {
      const targetBookId = type === 'character'
        ? characters.find(c => c.id === id)?.bookId
        : locations.find(l => l.id === id)?.bookId;

      if (!targetBookId) throw new Error('未找到图片所属书籍');

      const { localUrl, remoteUrl } = await onGenerateAssetVisual(desc, type, targetBookId, id, visualSpec);
      if (type === 'character') setCharacters(prev => prev.map(c => c.id === id ? { ...c, imageUrl: localUrl, referenceImageUrl: remoteUrl, locked: true, generationStatus: 'success' } : c));
      else setLocations(prev => prev.map(l => l.id === id ? { ...l, imageUrl: localUrl, referenceImageUrl: remoteUrl, locked: true, generationStatus: 'success' } : l));
    } catch (e) {
      if (type === 'character') setCharacters(prev => prev.map(c => c.id === id ? { ...c, generationStatus: 'failed' } : c));
      else setLocations(prev => prev.map(l => l.id === id ? { ...l, generationStatus: 'failed' } : l));
      alert("生成失败。");
    }
  };

  const handleDeleteAsset = async (id: string, type: 'character' | 'location') => {
    try {
      if (type === 'character') {
        await onDeleteCharacter(id);
      } else {
        await onDeleteLocation(id);
      }
    } catch (error) {
      console.error(error);
      alert('删除失败，请稍后重试。');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">视觉世界观</h2>
            <p className="text-slate-500">管理故事世界的视觉世界观。</p>
        </div>
        <div className="flex items-center gap-2">
             <select value={imageModelId} onChange={(e) => onUpdateImageModel(e.target.value as ImageGenerationModelId)} className="px-3 py-2 rounded-lg border bg-white text-sm focus:ring-2 focus:ring-brand-500">
                {imageModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
             </select>
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

      {(generatingCount > 0 || failedCount > 0) && (
        <div className={`mb-6 rounded-2xl border px-4 py-3 flex items-center justify-between gap-4 ${generatingCount > 0 ? 'border-brand-200 bg-brand-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-3">
            {generatingCount > 0 ? <Loader2 className="animate-spin text-brand-600" size={20} /> : <AlertCircle className="text-amber-600" size={20} />}
            <div>
              {generatingCount > 0 && <div className="text-sm font-bold text-brand-800">正在为 {generatingCount} 个{activeTab === 'characters' ? '角色' : '地点'}生成形象</div>}
              {failedCount > 0 && <div className="text-sm text-amber-800">{failedCount} 个资产生成失败，可在卡片上重新尝试</div>}
            </div>
          </div>
          {generatingCount > 0 && <div className="text-xs font-medium text-brand-700">生成完成后会自动显示图片</div>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleItems.map((item: any) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden group">
            <div className="aspect-square bg-slate-100 relative">
              {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">{item.generationStatus === 'generating' ? null : <User size={48} />}</div>}

              {item.generationStatus === 'generating' && (
                <div className="absolute inset-0 bg-slate-900/55 flex flex-col items-center justify-center text-white">
                  <Loader2 className="animate-spin mb-3" size={28} />
                  <div className="text-sm font-bold">正在生成形象</div>
                  <div className="text-xs text-white/80 mt-1">生成完成后自动更新</div>
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleGenerateVisual(item.id, activeTab === 'characters' ? 'character' : 'location', item.visualSummary || item.description)}
                    disabled={item.generationStatus === 'generating'}
                    className="p-2 bg-white rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {item.generationStatus === 'generating' ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                  </button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold mb-1 flex justify-between items-center">{item.name} {item.locked && <Lock size={12} className="text-amber-500" />}</h3>
              <div className="mb-2 flex items-center gap-2">
                {item.generationStatus === 'generating' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold">生成中</span>}
                {item.generationStatus === 'failed' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-bold"><AlertCircle size={12} /> 失败</span>}
                {item.generationStatus === 'success' && item.imageUrl && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold"><Sparkles size={12} /> 已完成</span>}
              </div>
              <p className="text-xs text-slate-500 line-clamp-3 mb-3">{item.visualSummary || item.description}</p>
              <div className="flex justify-end border-t pt-2"><button onClick={() => void handleDeleteAsset(item.id, activeTab === 'characters' ? 'character' : 'location')} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>
            </div>
          </div>
        ))}
        <div className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 min-h-[300px]">
            <Plus size={32} className="mb-2" />
            <span className="text-xs text-center">阅读新章节时<br/>AI 会自动发现新世界观</span>
        </div>
      </div>
    </div>
  );
};
