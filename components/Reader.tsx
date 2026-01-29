
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Book, Character, Location, Illustration, VisualSpec, Relationship, ReaderSettings } from '../types';
import { analyzeNarrative, generateIllustration, scanChapterForAssets, analyzeRelationships } from '../services/geminiService';
import { exportBookToHtml, exportBookToPdf } from '../services/exportService';
import { BatchActionsModal } from './BatchActionsModal';
import { Wand2, AlertCircle, Settings2, PlayCircle, Loader2, ChevronLeft, ChevronRight, ScanSearch, CheckCircle2, Circle, Layers, Palette, X, UserPlus, Info, Type } from 'lucide-react';

interface ReaderProps {
  book: Book;
  characters: Character[];
  locations: Location[];
  visualSpec: VisualSpec;
  availableSpecs: VisualSpec[];
  illustrations: Record<string, Illustration>;
  onAddIllustration: (ill: Illustration) => void;
  onUpdateIllustration: (paragraphId: string, updates: Partial<Illustration>) => void;
  onDiscoverCharacter: (char: Character) => Promise<string | undefined>;
  onDiscoverLocation: (loc: Location) => void;
  onDiscoverRelationships: (rels: Relationship[]) => void;
  onUpdateBookStyle: (bookId: string, styleId: string) => void;
}

export const Reader: React.FC<ReaderProps> = ({
  book, characters, locations, visualSpec, availableSpecs, illustrations,
  onAddIllustration, onUpdateIllustration, onDiscoverCharacter, onDiscoverLocation, onDiscoverRelationships, onUpdateBookStyle
}) => {
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>({ wordInterval: 300, preGenerate: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const processingRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(0);
  const PARAGRAPHS_PER_PAGE = 5;

  const [isScanning, setIsScanning] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResults, setScanResults] = useState<{characters: Partial<Character>[], locations: Partial<Location>[]}>({ characters: [], locations: [] });
  const [selectedScanItems, setSelectedScanItems] = useState<Record<string, boolean>>({});

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Missing Character Modal State
  const [missingChars, setMissingChars] = useState<string[]>([]);
  const [pendingGenParams, setPendingGenParams] = useState<{chIdx: number, pIdx: number} | null>(null);

  const currentChapterIndex = 0; 
  const currentChapter = book.chapters[currentChapterIndex];
  
  const paragraphWordData = useMemo(() => {
    let cumulative = 0;
    return currentChapter.paragraphs.map(p => {
      const start = cumulative;
      cumulative += p.text.length;
      return { id: p.id, start, end: cumulative };
    });
  }, [currentChapter]);

  const totalPages = Math.ceil(currentChapter.paragraphs.length / PARAGRAPHS_PER_PAGE);
  const currentParagraphs = currentChapter.paragraphs.slice(currentPage * PARAGRAPHS_PER_PAGE, (currentPage + 1) * PARAGRAPHS_PER_PAGE);

  useEffect(() => {
    const hasAssets = characters.length > 0;
    if (!hasAssets && !isScanning && !showScanModal && currentPage === 0) handleScanAssets();
  }, [book.id]);

  const handleScanAssets = async () => {
      setIsScanning(true);
      const text = currentChapter.paragraphs.map(p => p.text).join("\n");
      const results = await scanChapterForAssets(text);
      
      // 只要库中已有该名称的角色，即便没图，也不再将其列为“扫描发现的新资产”
      const filteredCharacters = (results.characters || []).filter(sc => {
          const scName = (sc.name || "").trim().toLowerCase();
          return !characters.some(c => c.name.trim().toLowerCase() === scName);
      });
      const filteredLocations = (results.locations || []).filter(sl => {
          const slName = (sl.name || "").trim().toLowerCase();
          return !locations.some(l => l.name.trim().toLowerCase() === slName);
      });

      setScanResults({ characters: filteredCharacters, locations: filteredLocations });
      
      const sel: Record<string, boolean> = {};
      filteredCharacters.forEach(c => sel[`char-${c.name}`] = true);
      filteredLocations.forEach(l => sel[`loc-${l.name}`] = true);
      setSelectedScanItems(sel);

      const foundRels = await analyzeRelationships(text, characters);
      if (foundRels.length > 0) onDiscoverRelationships(foundRels.map(r => ({ ...r, id: `rel-${Date.now()}`, bookId: book.id } as Relationship)));
      
      setIsScanning(false);
      if (filteredCharacters.length > 0 || filteredLocations.length > 0) setShowScanModal(true);
  };

  const executeGeneration = async (chapterIndex: number, paragraphIndex: number, skipCharCheck = false) => {
    const chapter = book.chapters[chapterIndex];
    const paragraph = chapter.paragraphs[paragraphIndex];
    
    if (!illustrations[paragraph.id]) {
      onAddIllustration({ id: `ill-${Date.now()}`, paragraphId: paragraph.id, status: 'generating' });
    } else {
      onUpdateIllustration(paragraph.id, { status: 'generating', error: undefined });
    }

    try {
      const facts = await analyzeNarrative(paragraph.text, currentChapter.paragraphs.slice(Math.max(0, paragraphIndex-5), paragraphIndex+3).map(p => p.text).join("\n"), characters, locations);
      onUpdateIllustration(paragraph.id, { extractedFacts: facts });

      if (!skipCharCheck) {
        // 健壮匹配检测
        const detectedButNoAsset = facts.characters.filter(name => {
          const normalizedSearch = name.trim().toLowerCase();
          const match = characters.find(c => {
            const normalizedTarget = c.name.trim().toLowerCase();
            return normalizedSearch === normalizedTarget || normalizedSearch.includes(normalizedTarget) || normalizedTarget.includes(normalizedSearch);
          });
          return !match || !match.imageUrl;
        });

        if (detectedButNoAsset.length > 0) {
          onUpdateIllustration(paragraph.id, { status: 'pending' });
          setMissingChars(detectedButNoAsset);
          setPendingGenParams({ chIdx: chapterIndex, pIdx: paragraphIndex });
          return;
        }
      }

      const imageUrl = await generateIllustration(facts, visualSpec, characters, locations);
      onUpdateIllustration(paragraph.id, { status: 'completed', imageUrl: imageUrl });
    } catch (error: any) {
      onUpdateIllustration(paragraph.id, { status: 'failed', error: error.message || "生成失败" });
    }
  }

  const handleGenerate = async (chIdx: number, pIdx: number) => {
      if (processingRef.current) return;
      processingRef.current = true;
      await executeGeneration(chIdx, pIdx);
      processingRef.current = false;
  };

  const handleStartBatch = async (interval: number, scope: any, nValue: number) => {
    setIsBatchProcessing(true);
    const targets: { chIdx: number; pIdx: number }[] = [];
    book.chapters[currentChapterIndex].paragraphs.forEach((p, idx) => {
        if ((idx + 1) % interval === 0 && (!illustrations[p.id] || illustrations[p.id].status === 'failed')) targets.push({ chIdx: currentChapterIndex, pIdx: idx });
    });
    setBatchProgress({ current: 0, total: targets.length });
    for (const t of targets) { await executeGeneration(t.chIdx, t.pIdx); setBatchProgress(prev => ({ ...prev, current: prev.current + 1 })); }
    setIsBatchProcessing(false); setShowBatchModal(false);
  };

  const handleExport = (mode: 'full' | 'generated_chapters', format: 'html' | 'pdf') => {
    if (format === 'html') exportBookToHtml(book, illustrations, mode);
    else exportBookToPdf(book, illustrations, mode);
  };

  const handleGenMissingChars = async () => {
    if (!pendingGenParams) return;
    const charNames = [...missingChars];
    setMissingChars([]); 
    
    for (const name of charNames) {
      const existing = characters.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (!existing) {
        await onDiscoverCharacter({ id: `char-${Date.now()}-${Math.random()}`, bookId: book.id, name: name.trim(), description: "新发现角色", visualSummary: `${name.trim()}的样貌`, locked: false } as Character);
      } else if (!existing.imageUrl) {
        await onDiscoverCharacter(existing);
      }
    }
    
    executeGeneration(pendingGenParams.chIdx, pendingGenParams.pIdx, true);
    setPendingGenParams(null);
  };

  const handleSkipMissingChars = () => {
    if (!pendingGenParams) return;
    executeGeneration(pendingGenParams.chIdx, pendingGenParams.pIdx, true);
    setMissingChars([]);
    setPendingGenParams(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 relative min-h-full flex flex-col">
      {/* Missing Character Modal */}
      {missingChars.length > 0 && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">缺失角色形象设定</h3>
                <p className="text-sm text-slate-500 mb-6">场景中涉及角色：<b>{missingChars.join(", ")}</b>。<br/>资产库中尚未生成这些角色的形象。为了保证视觉一致性，建议先建立资产。</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleGenMissingChars} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors">生成形象资产并继续</button>
                  <button onClick={handleSkipMissingChars} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">不生成资产直接绘制</button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Style Picker */}
      {showStylePicker && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                      <h3 className="font-serif font-bold text-xl text-slate-800">修改本书风格</h3>
                      <button onClick={() => setShowStylePicker(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 gap-3">
                      {availableSpecs.map(preset => (
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
              </div>
          </div>
      )}

      {/* Asset Discovery Modal */}
      {showScanModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold">扫描发现新视觉资产</h3>
                    <div className="text-xs text-slate-400">已自动过滤库中已有资产</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {scanResults.characters.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">新角色</h4>
                        <div className="space-y-2">
                          {scanResults.characters.map((c, i) => (
                              <div key={i} onClick={() => setSelectedScanItems(p => ({...p, [`char-${c.name}`]: !p[`char-${c.name}`]}))} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedScanItems[`char-${c.name}`] ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                  <div className="font-bold flex items-center gap-2">{selectedScanItems[`char-${c.name}`] ? <CheckCircle2 size={16} className="text-brand-600" /> : <Circle size={16} />} {c.name}</div>
                                  <div className="text-xs text-slate-500">{c.visualSummary}</div>
                              </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {scanResults.locations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">新地点</h4>
                        <div className="space-y-2">
                          {scanResults.locations.map((l, i) => (
                              <div key={i} onClick={() => setSelectedScanItems(p => ({...p, [`loc-${l.name}`]: !p[`loc-${l.name}`]}))} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedScanItems[`loc-${l.name}`] ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                  <div className="font-bold flex items-center gap-2">{selectedScanItems[`loc-${l.name}`] ? <CheckCircle2 size={16} className="text-brand-600" /> : <Circle size={16} />} {l.name}</div>
                                  <div className="text-xs text-slate-500">{l.visualSummary}</div>
                              </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setShowScanModal(false)} className="px-4 py-2 font-medium text-slate-600">忽略</button>
                      <button onClick={() => { 
                        scanResults.characters.forEach(c => { if (selectedScanItems[`char-${c.name}`]) onDiscoverCharacter({ id: `char-${Date.now()}-${Math.random()}`, bookId: book.id, name: c.name!, description: "AI扫描发现", visualSummary: c.visualSummary!, locked: false }); });
                        scanResults.locations.forEach(l => { if (selectedScanItems[`loc-${l.name}`]) onDiscoverLocation({ id: `loc-${Date.now()}-${Math.random()}`, bookId: book.id, name: l.name!, description: "AI扫描发现", visualSummary: l.visualSummary!, locked: false }); });
                        setShowScanModal(false);
                      }} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md hover:bg-brand-700 transition-colors">确认并建立形象库</button>
                  </div>
              </div>
          </div>
      )}

      <BatchActionsModal book={book} currentChapterIndex={currentChapterIndex} isOpen={showBatchModal} isProcessing={isBatchProcessing} progress={batchProgress} onClose={() => setShowBatchModal(false)} onStartBatch={handleStartBatch} onExport={handleExport} />

      <div className="absolute top-4 right-4 z-20 flex gap-2">
         <button onClick={() => setShowStylePicker(true)} className="p-2 bg-white rounded-lg border text-sm px-3 shadow-sm hover:text-brand-600 flex items-center gap-2"><Palette size={16} /><span className="hidden sm:inline">{visualSpec.label}</span></button>
         <button onClick={handleScanAssets} disabled={isScanning} className="p-2 bg-white rounded-lg border text-sm px-3 shadow-sm hover:text-brand-600 flex items-center gap-2">{isScanning ? <Loader2 className="animate-spin" size={16} /> : <ScanSearch size={16} />}<span className="hidden sm:inline">扫描资产</span></button>
         <button onClick={() => setShowBatchModal(true)} className="p-2 bg-white rounded-lg border text-sm px-3 shadow-sm hover:text-brand-600 flex items-center gap-2"><Layers size={16} /><span className="hidden sm:inline">批量/导出</span></button>
         <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white rounded-lg border shadow-sm hover:text-brand-600 transition-all"><Settings2 size={20} /></button>
         
         {showSettings && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border p-5 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-slate-700"><Type size={16} /> 阅读生图设置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">生图频率 (每隔多少字)</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[0, 300, 500, 1000].map(v => (
                            <button key={v} onClick={() => setSettings(s => ({...s, wordInterval: v}))} className={`py-1.5 text-xs rounded-lg border transition-all ${settings.wordInterval === v ? 'bg-brand-500 text-white border-brand-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>{v === 0 ? '手动' : v}</button>
                        ))}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded">
                    {settings.wordInterval === 0 ? '仅在手动点击时生图' : `每隔约 ${settings.wordInterval} 字出现生图控件`}
                  </div>
                </div>
            </div>
         )}
      </div>

      <div className="mb-8 text-center pb-4 border-b">
        <h1 className="text-2xl font-serif font-bold text-slate-900">{book.title}</h1>
        <p className="text-slate-400 text-sm mt-1">{currentChapter.title} • 第 {currentPage + 1} 页</p>
      </div>

      <div className="flex-1">
          {currentParagraphs.map((paragraph, index) => {
            const pIdx = currentPage * PARAGRAPHS_PER_PAGE + index;
            const wordData = paragraphWordData[pIdx];
            const ill = illustrations[paragraph.id];
            const interval = settings.wordInterval;
            const isIntervalReached = interval > 0 && Math.floor(wordData.start / interval) < Math.floor(wordData.end / interval);
            const isFirstPar = pIdx === 0 && interval > 0;
            const shouldShowSuggestControl = isIntervalReached || isFirstPar;

            return (
              <div key={paragraph.id} className="group mb-8">
                <p className={`font-serif text-xl leading-loose text-slate-800 mb-4 hover:bg-brand-50 rounded px-2 -mx-2 cursor-pointer transition-colors ${activeParagraphId === paragraph.id ? 'bg-brand-50 shadow-sm' : ''}`} onClick={() => setActiveParagraphId(paragraph.id)}>{paragraph.text}</p>
                <div className="my-6">
                  {ill ? (
                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm group/ill">
                      {ill.status === 'generating' && <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse"><Wand2 className="animate-spin mb-2 text-brand-500" size={32} />正在为您构思画面...</div>}
                      {ill.status === 'pending' && <div className="h-64 flex flex-col items-center justify-center text-amber-500 bg-amber-50/30"><Info size={32} className="mb-2" />等待角色设定加载...</div>}
                      {ill.status === 'completed' && ill.imageUrl && (
                        <div className="relative">
                          <img src={ill.imageUrl} className="w-full h-auto object-cover max-h-[550px] transition-transform duration-700 group-hover/ill:scale-[1.02]" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover/ill:opacity-100 transition-opacity">
                             {ill.extractedFacts && <p className="text-white text-xs italic">场景: {ill.extractedFacts.location} | 氛围: {ill.extractedFacts.mood}</p>}
                          </div>
                        </div>
                      )}
                      {ill.status === 'failed' && <div className="p-8 text-red-400 bg-red-50 flex flex-col items-center text-center"><AlertCircle size={32} className="mb-2" /><span className="font-bold">生成失败</span><button onClick={() => handleGenerate(currentChapterIndex, pIdx)} className="mt-4 px-6 py-2 bg-red-100 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors">重新尝试</button></div>}
                    </div>
                  ) : (
                    <div className={`transition-all duration-300 ${shouldShowSuggestControl ? 'opacity-100 mb-10' : 'opacity-0 h-0 overflow-hidden group-hover:h-12 group-hover:opacity-100'}`}>
                        <div className={`flex items-center justify-center border-2 border-dashed rounded-2xl transition-colors ${shouldShowSuggestControl ? 'border-brand-200 bg-brand-50/30 py-6' : 'border-slate-100 py-2'}`}>
                          <button onClick={() => handleGenerate(currentChapterIndex, pIdx)} className={`flex items-center gap-3 font-bold transition-all ${shouldShowSuggestControl ? 'text-brand-600 hover:text-brand-700 hover:scale-105' : 'text-slate-300 hover:text-brand-500 text-xs'}`}>
                            <Wand2 size={shouldShowSuggestControl ? 24 : 16} className={shouldShowSuggestControl ? 'animate-pulse' : ''} />
                            <span>{shouldShowSuggestControl ? `AI 建议生图点 (${wordData.start}字处)` : '在此处生图'}</span>
                          </button>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <div className="mt-8 pt-6 border-t flex items-center justify-between">
          <button onClick={() => currentPage > 0 && setCurrentPage(currentPage - 1)} disabled={currentPage === 0} className="flex items-center gap-2 px-6 py-2 bg-white border rounded-xl text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"><ChevronLeft size={20} /> 上一页</button>
          <div className="text-sm font-medium text-slate-400 bg-slate-100 px-4 py-1 rounded-full">{currentPage + 1} / {totalPages}</div>
          <button onClick={() => currentPage < totalPages - 1 && setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages - 1} className="flex items-center gap-2 px-6 py-2 bg-white border rounded-xl text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm">下一页 <ChevronRight size={20} /></button>
      </div>
    </div>
  );
};
