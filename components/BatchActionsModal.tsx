import React, { useState, useEffect } from 'react';
import { Book, ImageGenerationModelId } from '../types';
import { Download, Wand2, X, Calculator, Layers, FileText, CheckCircle2, Loader2, FileType } from 'lucide-react';

interface BatchActionsModalProps {
  book: Book;
  currentChapterIndex: number;
  imageModelId: ImageGenerationModelId;
  imageModels: Array<{ id: ImageGenerationModelId; label: string; description: string }>;
  isOpen: boolean;
  isProcessing: boolean;
  stageLabel: string;
  progress: { current: number; total: number };
  onClose: () => void;
  onStartBatch: (interval: number, scope: 'chapter' | 'next_n' | 'all', nValue: number) => void;
  onUpdateImageModel: (modelId: ImageGenerationModelId) => void;
  onExport: (mode: 'full' | 'generated_chapters', format: 'html' | 'pdf') => void;
}

export const BatchActionsModal: React.FC<BatchActionsModalProps> = ({
  book,
  currentChapterIndex,
  imageModelId,
  imageModels,
  isOpen,
  isProcessing,
  stageLabel,
  progress,
  onClose,
  onStartBatch,
  onUpdateImageModel,
  onExport
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'export'>('generate');
  const [interval, setInterval] = useState(5);
  const [scope, setScope] = useState<'chapter' | 'next_n' | 'all'>('chapter');
  const [nChapters, setNChapters] = useState(1);
  const [estimatedCount, setEstimatedCount] = useState(0);

  useEffect(() => {
    let paragraphsToScan = 0;
    if (scope === 'chapter') {
      paragraphsToScan = book.chapters[currentChapterIndex]?.paragraphs.length || 0;
    } else if (scope === 'all') {
      paragraphsToScan = book.chapters.reduce((acc, ch) => acc + ch.paragraphs.length, 0);
    } else if (scope === 'next_n') {
      for (let i = 0; i < nChapters; i++) {
        const idx = currentChapterIndex + i;
        if (idx < book.chapters.length) paragraphsToScan += book.chapters[idx].paragraphs.length;
      }
    }
    setEstimatedCount(Math.ceil(paragraphsToScan / interval));
  }, [book, currentChapterIndex, interval, scope, nChapters]);

  if (!isOpen) return null;
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-slate-800">批量操作 & 导出</h3>
          {!isProcessing && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
          )}
        </div>

        {!isProcessing && (
          <div className="flex border-b border-slate-100">
            <button onClick={() => setActiveTab('generate')} className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'generate' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Wand2 size={18} /> 批量生图
            </button>
            <button onClick={() => setActiveTab('export')} className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'export' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Download size={18} /> 导出书籍
            </button>
          </div>
        )}

        <div className="p-6">
          {isProcessing ? (
            <div className="text-center py-8">
               <div className="mb-6">
                 <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
                   <span>{stageLabel}</span>
                   <span>{percentage}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                 </div>
               </div>
               <div className="flex flex-col items-center gap-4">
                  {percentage < 100 ? <Loader2 className="animate-spin text-brand-500" size={48} /> : <CheckCircle2 className="text-green-500" size={48} />}
                  <h4 className="text-lg font-bold text-slate-800">{percentage < 100 ? stageLabel : '绘制完成！'}</h4>
                  <p className="text-slate-500 text-sm">已完成 {progress.current} / {progress.total} 张插图</p>
               </div>
            </div>
          ) : activeTab === 'generate' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">生图密度 (每几段生一张)</label>
                <input type="range" min="1" max="20" value={interval} onChange={(e) => setInterval(parseInt(e.target.value))} className="w-full accent-brand-500 mb-2" />
                <div className="text-center font-mono text-sm bg-slate-50 py-1 rounded border border-slate-100">每 {interval} 段</div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">生成范围</label>
                {['chapter', 'next_n', 'all'].map(s => (
                  <label key={s} className={`flex items-center p-3 rounded-lg border cursor-pointer ${scope === s ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <input type="radio" checked={scope === s} onChange={() => setScope(s as any)} />
                    <span className="ml-3 font-medium text-slate-700 capitalize">{s === 'chapter' ? '当前章节' : s === 'next_n' ? '预生成后续章' : '整本书'}</span>
                    {s === 'next_n' && scope === 'next_n' && (
                       <input type="number" min="1" value={nChapters} onChange={e => setNChapters(parseInt(e.target.value))} className="ml-auto w-12 border rounded text-center" />
                    )}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">图片模型</label>
                <select value={imageModelId} onChange={e => onUpdateImageModel(e.target.value as ImageGenerationModelId)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                  {imageModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <div className="text-xs text-slate-400 mt-2">{imageModels.find(model => model.id === imageModelId)?.description}</div>
              </div>
              <button onClick={() => onStartBatch(interval, scope, nChapters)} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-[0.98]">开始生成 ({estimatedCount} 张图)</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-brand-50 text-brand-800 text-sm rounded border border-brand-100">
                <b>PDF 导出</b> 将自动排版并保持图片清晰，适合保存和分享。
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => onExport('full', 'html')} className="p-4 border-2 rounded-xl flex flex-col items-center gap-2 hover:border-brand-500 hover:bg-brand-50 transition-all">
                  <FileText className="text-slate-400" size={32} />
                  <span className="font-bold text-sm">HTML (下载)</span>
                </button>
                <button onClick={() => onExport('full', 'pdf')} className="p-4 border-2 rounded-xl flex flex-col items-center gap-2 hover:border-brand-500 hover:bg-brand-50 transition-all">
                  <FileType className="text-brand-500" size={32} />
                  <span className="font-bold text-sm">PDF (专业排版)</span>
                </button>
              </div>
              <button onClick={() => onExport('generated_chapters', 'pdf')} className="w-full flex items-center gap-3 p-4 border-2 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all">
                <CheckCircle2 className="text-green-500" size={24} />
                <div className="text-left"><div className="font-bold text-sm text-slate-800">仅导出精选配图章 (PDF)</div><div className="text-[10px] text-slate-400">只导出包含 AI 插图的精彩片段</div></div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
