import React, { useState, useEffect, useRef } from 'react';
import { Book, Character, Location, VisualSpec, Illustration, Paragraph, ReaderSettings } from '../types';
import { analyzeNarrative, generateIllustration, scanChapterForAssets } from '../services/geminiService';
import { exportBookToHtml, exportBookToPdf } from '../services/exportService';
import { BatchActionsModal } from './BatchActionsModal';
import { VISUAL_PRESETS } from '../constants';
import { Wand2, AlertCircle, Settings2, PlayCircle, Loader2, ChevronLeft, ChevronRight, ScanSearch, CheckCircle2, Circle, Layers, Palette, X } from 'lucide-react';

interface ReaderProps {
  book: Book;
  characters: Character[];
  locations: Location[];
  visualSpec: VisualSpec;
  illustrations: Record<string, Illustration>;
  onAddIllustration: (ill: Illustration) => void;
  onUpdateIllustration: (id: string, updates: Partial<Illustration>) => void;
  onDiscoverCharacter: (char: Character) => void;
  onDiscoverLocation: (loc: Location) => void;
  onUpdateBookStyle: (bookId: string, styleId: string) => void;
}

export const Reader: React.FC<ReaderProps> = ({
  book,
  characters,
  locations,
  visualSpec,
  illustrations,
  onAddIllustration,
  onUpdateIllustration,
  onDiscoverCharacter,
  onDiscoverLocation,
  onUpdateBookStyle
}) => {
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>({ generationInterval: 0, preGenerate: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const processingRef = useRef(false);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const PARAGRAPHS_PER_PAGE = 5;

  const [isScanning, setIsScanning] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResults, setScanResults] = useState<{characters: Partial<Character>[], locations: Partial<Location>[]}>({ characters: [], locations: [] });
  const [selectedScanItems, setSelectedScanItems] = useState<Record<string, boolean>>({});

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const currentChapter = book.chapters[currentChapterIndex];
  const totalPages = Math.ceil(currentChapter.paragraphs.length / PARAGRAPHS_PER_PAGE);
  const currentParagraphs = currentChapter.paragraphs.slice(currentPage * PARAGRAPHS_PER_PAGE, (currentPage + 1) * PARAGRAPHS_PER_PAGE);

  useEffect(() => {
    const hasAssets = characters.some(c => c.bookId === book.id) || locations.some(l => l.bookId === book.id);
    if (!hasAssets && !isScanning && !showScanModal && currentPage === 0) handleScanAssets();
  }, [book.id]);

  const handleScanAssets = async () => {
      setIsScanning(true);
      const text = currentChapter.paragraphs.map(p => p.text).join("\n");
      const results = await scanChapterForAssets(text);
      setScanResults(results);
      const sel: Record<string, boolean> = {};
      results.characters.forEach(c => sel[`char-${c.name}`] = true);
      results.locations.forEach(l => sel[`loc-${l.name}`] = true);
      setSelectedScanItems(sel);
      setIsScanning(false);
      if (results.characters.length > 0 || results.locations.length > 0) setShowScanModal(true);
  };

  const confirmScanAssets = () => {
      scanResults.characters.forEach(c => {
          if (selectedScanItems[`char-${c.name}`] && c.name) onDiscoverCharacter({ id: `char-${Date.now()}-${Math.random()}`, bookId: book.id, name: c.name, description: "扫描发现", visualSummary: c.visualSummary || `${c.name}的样貌`, locked: false } as Character);
      });
      scanResults.locations.forEach(l => {
          if (selectedScanItems[`loc-${l.name}`] && l.name) onDiscoverLocation({ id: `loc-${Date.now()}-${Math.random()}`, bookId: book.id, name: l.name, description: "扫描发现", visualSummary: l.visualSummary || `${l.name}的景象`, locked: false } as Location);
      });
      setShowScanModal(false);
  };

  const executeGeneration = async (chapterIndex: number, paragraphIndex: number) => {
    const chapter = book.chapters[chapterIndex];
    const paragraph = chapter.paragraphs[paragraphIndex];
    if (illustrations[paragraph.id]?.status === 'generating' || illustrations[paragraph.id]?.status === 'completed') return;
    let illId = illustrations[paragraph.id]?.id || `ill-${Date.now()}-${Math.random()}`;
    if (!illustrations[paragraph.id]) onAddIllustration({ id: illId, paragraphId: paragraph.id, status: 'generating' });
    else onUpdateIllustration(illId, { status: 'generating', error: undefined });

    try {
      const facts = await analyzeNarrative(paragraph.text, currentChapter.paragraphs.slice(Math.max(0, paragraphIndex-10), paragraphIndex+5).map(p => p.text).join("\n"), characters, locations);
      onUpdateIllustration(illId, { extractedFacts: facts });
      const imageUrl = await generateIllustration(facts, visualSpec, characters, locations);
      onUpdateIllustration(illId, { status: 'completed', imageUrl: imageUrl });
    } catch (error: any) {
      onUpdateIllustration(illId, { status: 'failed', error: error.message || "生成失败，请重试。" });
    }
  }

  const handleGenerate = async (chIdx: number, pIdx: number) => {
      processingRef.current = true;
      await executeGeneration(chIdx, pIdx);
      processingRef.current = false;
  };

  const handleStartBatch = async (interval: number, scope: any, nValue: number) => {
    setIsBatchProcessing(true);
    const targets: { chIdx: number; pIdx: number }[] = [];
    const addTargets = (chIdx: number) => {
        if (chIdx >= book.chapters.length) return;
        book.chapters[chIdx].paragraphs.forEach((p, idx) => {
            if ((idx + 1) % interval === 0 && (!illustrations[p.id] || illustrations[p.id].status === 'failed')) targets.push({ chIdx, pIdx: idx });
        });
    };
    if (scope === 'chapter') addTargets(currentChapterIndex);
    else if (scope === 'all') book.chapters.forEach((_, i) => addTargets(i));
    else for(let i = 0; i < nValue; i++) addTargets(currentChapterIndex + i);

    setBatchProgress({ current: 0, total: targets.length });
    for (const t of targets) {
        if (!isBatchProcessing) break;
        await executeGeneration(t.chIdx, t.pIdx);
        setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        await new Promise(r => setTimeout(r, 500));
    }
    setIsBatchProcessing(false); setShowBatchModal(false);
  };

  const handleExport = (mode: 'full' | 'generated_chapters', format: 'html' | 'pdf') => {
      if (format === 'html') exportBookToHtml(book, illustrations, mode);
      else exportBookToPdf(book, illustrations, mode);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 relative min-h-full flex flex-col">
      {/* Assets Discovery Modal */}
      {showScanModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100"><h3 className="text-xl font-bold">发现新资产</h3><p className="text-sm text-slate-500">检测到以下潜在角色或地点，是否添加？</p></div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {scanResults.characters.map((c, i) => (
                        <div key={`c-${i}`} onClick={() => setSelectedScanItems(p => ({...p, [`char-${c.name}`]: !p[`char-${c.name}`]}))} className={`p-3 rounded-lg border cursor-pointer ${selectedScanItems[`char-${c.name}`] ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                            <div className="font-bold flex items-center gap-2">{selectedScanItems[`char-${c.name}`] ? <CheckCircle2 size={16} className="text-brand-600" /> : <Circle size={16} className="text-slate-300" />} {c.name}</div>
                            <div className="text-xs text-slate-500 mt-1">{c.visualSummary}</div>
                        </div>
                    ))}
                    {scanResults.locations.map((l, i) => (
                         <div key={`l-${i}`} onClick={() => setSelectedScanItems(p => ({...p, [`loc-${l.name}`]: !p[`loc-${l.name}`]}))} className={`p-3 rounded-lg border cursor-pointer ${selectedScanItems[`loc-${l.name}`] ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                            <div className="font-bold flex items-center gap-2">{selectedScanItems[`loc-${l.name}`] ? <CheckCircle2 size={16} className="text-brand-600" /> : <Circle size={16} className="text-slate-300" />} {l.name}</div>
                            <div className="text-xs text-slate-500 mt-1">{l.visualSummary}</div>
                        </div>
                    ))}
                  </div>
                  <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setShowScanModal(false)} className="px-4 py-2 text-slate-500">忽略</button>
                      <button onClick={confirmScanAssets} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-medium">确认添加</button>
                  </div>
              </div>
          </div>
      )}

      {/* Style Picker Modal */}
      {showStylePicker && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-serif font-bold text-xl text-slate-800">修改本书风格</h3>
                      <button onClick={() => setShowStylePicker(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 gap-3">
                      {VISUAL_PRESETS.map(preset => (
                          <div 
                              key={preset.id}
                              onClick={() => {
                                  onUpdateBookStyle(book.id, preset.id);
                                  setShowStylePicker(false);
                              }}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${visualSpec.id === preset.id ? 'border-brand-500 bg-brand-50' : 'border-slate-100 hover:border-slate-300'}`}
                          >
                              <div>
                                  <h4 className="font-bold text-slate-800">{preset.label}</h4>
                                  <p className="text-xs text-slate-500 mt-1">{preset.promptStyle.split(',').slice(0, 2).join(',')}...</p>
                              </div>
                              {visualSpec.id === preset.id && <CheckCircle2 className="text-brand-600" size={20} />}
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t bg-slate-50 text-center text-xs text-slate-400 italic">
                      修改风格仅影响后续生成的插图，已生成的图片将保留原样。
                  </div>
              </div>
          </div>
      )}

      <BatchActionsModal book={book} currentChapterIndex={currentChapterIndex} isOpen={showBatchModal} isProcessing={isBatchProcessing} progress={batchProgress} onClose={() => setShowBatchModal(false)} onStartBatch={handleStartBatch} onExport={handleExport} />

      {/* Reader Controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
         <button onClick={() => setShowStylePicker(true)} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 flex items-center gap-2 text-sm px-3 shadow-sm transition-all hover:shadow-md">
             <Palette size={16} /> <span className="hidden sm:inline">{visualSpec.label}</span>
         </button>
         <button onClick={handleScanAssets} disabled={isScanning} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 flex items-center gap-2 text-sm px-3 shadow-sm transition-all hover:shadow-md">
             {isScanning ? <Loader2 className="animate-spin" size={16} /> : <ScanSearch size={16} />} <span className="hidden sm:inline">扫描资产</span>
         </button>
         <button onClick={() => setShowBatchModal(true)} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 flex items-center gap-2 text-sm px-3 shadow-sm transition-all hover:shadow-md">
             <Layers size={16} /> <span className="hidden sm:inline">批量/导出</span>
         </button>
         <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 transition-all shadow-sm"><Settings2 size={20} /></button>
         {showSettings && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border p-4 z-30">
                <h3 className="font-bold text-sm mb-3">阅读建议设置</h3>
                <label className="text-xs text-slate-500 block mb-2">生图建议密度 (段落间隔)</label>
                <div className="grid grid-cols-4 gap-1">
                    {[0, 5, 10, 15].map(v => (
                        <button key={v} onClick={() => setSettings(s => ({...s, generationInterval: v}))} className={`py-1 text-xs rounded border ${settings.generationInterval === v ? 'bg-brand-500 text-white' : 'bg-slate-50'}`}>{v === 0 ? '关' : v}</button>
                    ))}
                </div>
            </div>
         )}
      </div>

      <div className="mb-8 text-center pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-serif font-bold text-slate-900">{book.title}</h1>
        <p className="text-slate-400 text-sm mt-1">{currentChapter.title} • 第 {currentPage + 1} / {totalPages} 页</p>
      </div>

      <div className="flex-1">
          {currentParagraphs.map((paragraph, index) => {
            const gIdx = currentPage * PARAGRAPHS_PER_PAGE + index;
            const ill = Object.values(illustrations).find(i => i.paragraphId === paragraph.id);
            const scheduled = settings.generationInterval > 0 && (gIdx + 1) % settings.generationInterval === 0;

            return (
              <div key={paragraph.id} className="group mb-8">
                <p className={`font-serif text-xl leading-loose text-slate-800 mb-4 hover:bg-yellow-50 rounded px-2 -mx-2 cursor-pointer transition-colors ${activeParagraphId === paragraph.id ? 'bg-yellow-50 shadow-sm' : ''}`} onClick={() => setActiveParagraphId(paragraph.id)}>{paragraph.text}</p>
                {!ill && scheduled && (
                    <div className="my-4 flex justify-center"><button onClick={() => handleGenerate(currentChapterIndex, gIdx)} className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-full text-sm font-medium hover:bg-brand-100 transition-colors"><PlayCircle size={16} /> 规划建议点：生图</button></div>
                )}
                <div className="my-6">
                  {ill ? (
                    <div className="relative rounded-lg overflow-hidden bg-slate-100 border shadow-sm">
                      {ill.status === 'generating' && <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse"><Wand2 className="animate-spin mb-2 text-brand-500" size={32} />绘制中...</div>}
                      {ill.status === 'completed' && ill.imageUrl && <img src={ill.imageUrl} className="w-full h-auto object-cover max-h-[500px]" />}
                      {ill.status === 'failed' && <div className="p-6 flex flex-col items-center text-red-400 bg-red-50 text-center"><AlertCircle size={24} /><span className="text-sm font-bold mt-2">生成失败</span><p className="text-[10px] mt-1">{ill.error}</p><button onClick={() => handleGenerate(currentChapterIndex, gIdx)} className="mt-3 px-3 py-1 bg-red-100 rounded text-xs hover:bg-red-200">重试</button></div>}
                    </div>
                  ) : (
                    <div className={`h-10 border border-dashed border-slate-200 rounded-lg flex items-center justify-center transition-opacity ${activeParagraphId === paragraph.id && !scheduled ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${scheduled ? 'hidden' : ''}`}>
                        <button onClick={() => handleGenerate(currentChapterIndex, gIdx)} className="flex items-center gap-2 text-slate-400 hover:text-brand-600 text-xs font-medium"><Wand2 size={14} /> 为本段生图</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
          <button onClick={() => currentPage > 0 && setCurrentPage(currentPage - 1)} disabled={currentPage === 0} className="flex items-center gap-2 px-4 py-2 text-slate-600 disabled:opacity-30 transition-opacity"><ChevronLeft size={20} /> 上一页</button>
          <span className="text-sm text-slate-400">Page {currentPage + 1} / {totalPages}</span>
          <button onClick={() => currentPage < totalPages - 1 && setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages - 1} className="flex items-center gap-2 px-4 py-2 text-slate-600 disabled:opacity-30 transition-opacity">下一页 <ChevronRight size={20} /></button>
      </div>
    </div>
  );
};