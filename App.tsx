
import React, { useState } from 'react';
import { Book, Character, Location, Illustration, VisualSpec, ViewMode, Relationship } from './types';
import { VISUAL_PRESETS, SAMPLE_BOOKS, createBook } from './constants';
import { Layout } from './components/Layout';
import { Reader } from './components/Reader';
import { AssetLibrary } from './components/AssetLibrary';
import { BookShelf } from './components/BookShelf';
import { SocialNetwork } from './components/SocialNetwork';
import { generateAssetVisual } from './services/geminiService';
import { Plus, Trash2, Sparkles, Wand2 } from 'lucide-react';

const INITIAL_CHARACTERS: Character[] = [
  // 三打白骨精
  {
    id: "char-wukong",
    bookId: "book-white-bone",
    name: "孙悟空",
    description: "齐天大圣，火眼金睛，忠心耿耿但性格刚烈。",
    visualSummary: "猴王形象，身穿虎皮裙，手持金箍棒，头戴紧箍儿，目光如炬。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "char-tangseng",
    bookId: "book-white-bone",
    name: "唐僧",
    description: "一心取经的僧人，慈悲但有时肉眼凡胎，易听谗言。",
    visualSummary: "身披锦襴袈裟，头戴毗卢帽，骑着白龙马，面容慈祥却带着愁容。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "char-bajie",
    bookId: "book-white-bone",
    name: "猪八戒",
    description: "贪吃懒做，常在师父面前搬弄是非。",
    visualSummary: "猪头人身，挺着大肚子，手持九齿钉耙，穿着黑色僧衣。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "char-shaseng",
    bookId: "book-white-bone",
    name: "沙和尚",
    description: "诚恳老实，挑担牵马，是师徒中的调和剂。",
    visualSummary: "身材高大，络腮胡须，项挂骷髅念珠，手持降妖宝杖，神情憨厚。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "char-white-bone",
    bookId: "book-white-bone",
    name: "白骨精",
    description: "诡计多端的尸魔，能变幻各种形态迷惑人心。",
    visualSummary: "美貌女子/老妪/老翁三变，本相是一具刻有“白骨夫人”字样的骷髅，妖气森森。",
    locked: true,
    generationStatus: 'success'
  },
  // 龟兔赛跑
  {
    id: "char-rabbit",
    bookId: "book-tortoise-hare",
    name: "兔子",
    description: "骄傲自大，跑得飞快但缺乏毅力。",
    visualSummary: "一只活泼好动的兔子，拟人化，长耳朵，神气活现。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "char-turtle",
    bookId: "book-tortoise-hare",
    name: "乌龟",
    description: "踏实稳重，虽然跑得慢但持之以恒。",
    visualSummary: "一只憨厚的老龟，背着厚厚的壳，眼神坚定且从容。",
    locked: true,
    generationStatus: 'success'
  }
];

const INITIAL_LOCATIONS: Location[] = [
  {
    id: "loc-tiger-ridge",
    bookId: "book-white-bone",
    name: "白虎岭",
    description: "荒山野岭，地势险峻，妖气弥漫。",
    visualSummary: "怪石嶙峋的山岭，枯木横生，阴云密布，透着一股杀气。",
    locked: true,
    generationStatus: 'success'
  },
  {
    id: "loc-forest-track",
    bookId: "book-tortoise-hare",
    name: "森林赛道",
    description: "森林中的小路，终点是一棵大树。",
    visualSummary: "阳光明媚的森林小径，路边长满野花，尽头是一棵枝繁叶茂的大槐树。",
    locked: true,
    generationStatus: 'success'
  }
];

const INITIAL_RELATIONSHIPS: Relationship[] = [
  // 孙悟空的关系
  {
    id: "rel-wb-1",
    bookId: "book-white-bone",
    sourceId: "char-wukong",
    targetId: "char-tangseng",
    type: "师徒",
    description: "悟空尽力保护师父，唐僧却因误会和八戒的挑拨而多次责罚甚至驱逐他。"
  },
  {
    id: "rel-wb-2",
    bookId: "book-white-bone",
    sourceId: "char-wukong",
    targetId: "char-bajie",
    type: "师兄弟",
    description: "八戒多次在唐僧面前诬陷悟空，导致师徒关系破裂，悟空对八戒既气愤又无奈。"
  },
  {
    id: "rel-wb-3",
    bookId: "book-white-bone",
    sourceId: "char-wukong",
    targetId: "char-white-bone",
    type: "死敌",
    description: "悟空三次识破并打击白骨精的变化，最终将其消灭。"
  },
  {
    id: "rel-wb-4",
    bookId: "book-white-bone",
    sourceId: "char-wukong",
    targetId: "char-shaseng",
    type: "师兄弟",
    description: "沙僧在悟空被驱逐时虽未极力挽留，但平日里悟空对沙僧较为信任。"
  },
  
  // 唐僧的关系
  {
    id: "rel-wb-5",
    bookId: "book-white-bone",
    sourceId: "char-tangseng",
    targetId: "char-bajie",
    type: "师徒",
    description: "唐僧偏听偏信八戒的谗言，认为八戒憨厚老实。"
  },
  {
    id: "rel-wb-6",
    bookId: "book-white-bone",
    sourceId: "char-tangseng",
    targetId: "char-shaseng",
    type: "师徒",
    description: "唐僧认为沙僧忠厚老实，是值得信赖的徒弟。"
  },
  {
    id: "rel-wb-7",
    bookId: "book-white-bone",
    sourceId: "char-tangseng",
    targetId: "char-white-bone",
    type: "猎物",
    description: "唐僧肉眼凡胎，被白骨精变化的假象所迷惑，将其视为无辜百姓。"
  },

  // 猪八戒的关系
  {
    id: "rel-wb-8",
    bookId: "book-white-bone",
    sourceId: "char-bajie",
    targetId: "char-shaseng",
    type: "师兄弟",
    description: "两人平时一起挑担牵马，八戒常把重活推给沙僧。"
  },
  {
    id: "rel-wb-9",
    bookId: "book-white-bone",
    sourceId: "char-bajie",
    targetId: "char-white-bone",
    type: "被诱惑",
    description: "八戒见白骨精变化的女子美貌，动了凡心，极力在师父面前为'女子'辩护。"
  },

  // 沙和尚的关系
  {
    id: "rel-wb-10",
    bookId: "book-white-bone",
    sourceId: "char-shaseng",
    targetId: "char-white-bone",
    type: "敌对",
    description: "沙僧虽然法力不及悟空，但也站在保护师父的一方，对妖精保持警惕。"
  },

  // 白骨精的关系
  {
    id: "rel-wb-11",
    bookId: "book-white-bone",
    sourceId: "char-white-bone",
    targetId: "char-wukong",
    type: "忌惮",
    description: "白骨精深知孙悟空法力高强，只能通过离间计来对付他。"
  },
  {
    id: "rel-wb-12",
    bookId: "book-white-bone",
    sourceId: "char-white-bone",
    targetId: "char-tangseng",
    type: "贪欲",
    description: "白骨精一心想吃唐僧肉以求长生不老。"
  },
  {
    id: "rel-wb-13",
    bookId: "book-white-bone",
    sourceId: "char-white-bone",
    targetId: "char-bajie",
    type: "利用",
    description: "白骨精利用八戒的贪吃好色和对悟空的嫉妒，成功离间了师徒关系。"
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('home');
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [availableSpecs, setAvailableSpecs] = useState<VisualSpec[]>(VISUAL_PRESETS);
  const [visualSpec, setVisualSpec] = useState<VisualSpec>(VISUAL_PRESETS[0]);
  const [characters, setCharacters] = useState<Character[]>(INITIAL_CHARACTERS);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELATIONSHIPS);
  const [illustrations, setIllustrations] = useState<Record<string, Illustration>>({});
  const [newStyle, setNewStyle] = useState<Partial<VisualSpec>>({
    label: '',
    promptStyle: '',
    cameraLanguage: 'cinematic composition',
    negatives: 'text, watermark, logo, blur'
  });

  const currentBook = books.find(b => b.id === currentBookId) || null;

  const handleSelectBook = (book: Book) => {
      setCurrentBookId(book.id);
      const bookPreset = availableSpecs.find(p => p.id === book.visualSpecId);
      if (bookPreset) setVisualSpec(bookPreset);
      setView('reader');
  };

  const handleUpdateBookCover = (bookId: string, coverUrl: string) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, coverUrl } : b));
  };

  const handleUpdateBookStyle = (bookId: string, styleId: string) => {
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, visualSpecId: styleId } : b));
      const newSpec = availableSpecs.find(p => p.id === styleId);
      if (newSpec) setVisualSpec(newSpec);
  };

  const handleOpenAssetsView = (bookId?: string) => {
      if (bookId) {
        setCurrentBookId(bookId);
      }
      setView('assets');
  };

  const handleImportBook = (title: string, content: string, coverUrl?: string) => {
      const newBook = createBook(`imported-${Date.now()}`, title, "未知作者", "自定义", "📚", availableSpecs[0].id, content);
      if (coverUrl) newBook.coverUrl = coverUrl;
      setBooks(prev => [newBook, ...prev]);
      handleSelectBook(newBook);
  };

  const handleAddIllustration = (ill: Illustration) => setIllustrations(prev => ({ ...prev, [ill.paragraphId]: ill }));
  
  const handleUpdateIllustration = (paragraphId: string, updates: Partial<Illustration>) => setIllustrations(prev => {
      const existing = prev[paragraphId];
      if(!existing) return prev;
      return { ...prev, [paragraphId]: { ...existing, ...updates } };
  });

  const handleDiscoverCharacter = async (char: Partial<Character>): Promise<string | undefined> => {
      const charName = char.name?.trim() || "";
      const existing = characters.find(c => 
        c.bookId === char.bookId && 
        c.name.trim().toLowerCase() === charName.toLowerCase()
      );
      
      let targetId = existing?.id || `char-${Date.now()}-${Math.random()}`;
      
      if (!existing) {
        const newChar: Character = { 
          id: targetId, 
          bookId: char.bookId!, 
          name: charName, 
          description: char.description || "新发现的角色", 
          visualSummary: char.visualSummary || `${charName}的视觉设定`,
          locked: false,
          generationStatus: 'generating' 
        };
        setCharacters(prev => [...prev, newChar]);
      } else {
        setCharacters(prev => prev.map(c => c.id === targetId ? { ...c, generationStatus: 'generating' } : c));
      }

      try {
        const visualSummary = existing ? (existing.visualSummary || existing.description) : char.visualSummary!;
        const imageUrl = await generateAssetVisual(visualSummary, 'character', visualSpec);
        setCharacters(prev => prev.map(c => c.id === targetId ? { ...c, imageUrl, locked: true, generationStatus: 'success' } : c));
        return imageUrl;
      } catch (e) {
        setCharacters(prev => prev.map(c => c.id === targetId ? { ...c, generationStatus: 'failed' } : c));
      }
  };

  const handleDiscoverLocation = async (loc: Partial<Location>) => {
      const locName = loc.name?.trim() || "";
      const existing = locations.find(l => 
        l.bookId === loc.bookId && 
        l.name.trim().toLowerCase() === locName.toLowerCase()
      );
      
      let targetId = existing?.id || `loc-${Date.now()}-${Math.random()}`;

      if (!existing) {
        const newLoc: Location = { 
          id: targetId, 
          bookId: loc.bookId!, 
          name: locName, 
          description: loc.description || "新发现的地点", 
          visualSummary: loc.visualSummary || `${locName}的视觉形象`,
          locked: false,
          generationStatus: 'generating' 
        };
        setLocations(prev => [...prev, newLoc]);
      } else {
        setLocations(prev => prev.map(l => l.id === targetId ? { ...l, generationStatus: 'generating' } : l));
      }

      try {
        const visualSummary = existing ? (existing.visualSummary || existing.description) : loc.visualSummary!;
        const imageUrl = await generateAssetVisual(visualSummary, 'location', visualSpec);
        setLocations(prev => prev.map(l => l.id === targetId ? { ...l, imageUrl, locked: true, generationStatus: 'success' } : l));
      } catch (e) {
        setLocations(prev => prev.map(l => l.id === targetId ? { ...l, generationStatus: 'failed' } : l));
      }
  };

  const handleDiscoverRelationships = (newRels: Relationship[]) => {
      setRelationships(prev => {
          const combined = [...prev];
          newRels.forEach(nr => {
              const exists = combined.some(r => r.bookId === nr.bookId && 
                  ((r.sourceId === nr.sourceId && r.targetId === nr.targetId) || 
                   (r.sourceId === nr.targetId && r.targetId === nr.sourceId)));
              if (!exists) combined.push(nr);
          });
          return combined;
      });
  };

  const handleAddRelationship = (rel: Relationship) => setRelationships(prev => [...prev, rel]);
  const handleUpdateRelationship = (id: string, updates: Partial<Relationship>) => setRelationships(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const handleDeleteRelationship = (id: string) => setRelationships(prev => prev.filter(r => r.id !== id));

  const handleAddCustomStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStyle.label && newStyle.promptStyle) {
      const spec: VisualSpec = { id: `custom-${Date.now()}`, label: newStyle.label!, promptStyle: newStyle.promptStyle!, cameraLanguage: newStyle.cameraLanguage || 'cinematic composition', negatives: newStyle.negatives || '' };
      setAvailableSpecs(prev => [...prev, spec]);
      setNewStyle({ label: '', promptStyle: '', cameraLanguage: 'cinematic composition', negatives: 'text, watermark, logo, blur' });
    }
  };

  const handleDeleteStyle = (id: string) => {
    if (VISUAL_PRESETS.some(p => p.id === id)) return;
    setAvailableSpecs(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === 'home' && <BookShelf books={books} onSelectBook={handleSelectBook} onImportBook={handleImportBook} onUpdateBookCover={handleUpdateBookCover} />}
      {view === 'reader' && currentBook && (
        <Reader 
          book={currentBook}
          characters={characters.filter(c => c.bookId === currentBook.id)}
          locations={locations.filter(l => l.bookId === currentBook.id)}
          visualSpec={visualSpec}
          availableSpecs={availableSpecs}
          illustrations={illustrations}
          onAddIllustration={handleAddIllustration}
          onUpdateIllustration={handleUpdateIllustration}
          onDiscoverCharacter={handleDiscoverCharacter}
          onDiscoverLocation={handleDiscoverLocation}
          onDiscoverRelationships={handleDiscoverRelationships}
          onUpdateBookStyle={handleUpdateBookStyle}
          onOpenAssetsView={handleOpenAssetsView}
        />
      )}
      {view === 'assets' && <AssetLibrary books={books} characters={characters} locations={locations} visualSpec={visualSpec} setCharacters={setCharacters} setLocations={setLocations} focusedBookId={currentBookId} />}
      {view === 'relationships' && (
        <SocialNetwork 
          books={books} 
          characters={characters} 
          relationships={relationships} 
          onAddRelationship={handleAddRelationship}
          onUpdateRelationship={handleUpdateRelationship} 
          onDeleteRelationship={handleDeleteRelationship}
        />
      )}
      {view === 'settings' && (
        <div className="p-8 max-w-5xl mx-auto pb-24">
            <div className="mb-10 text-center md:text-left"><h2 className="text-3xl font-bold text-slate-900 mb-2">绘图风格管理</h2><p className="text-slate-500">管理内置风格或创建属于你自己的独特视觉语言。</p></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-8">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus className="text-brand-500" size={20} /> 新建自定义风格</h3>
                        <form onSubmit={handleAddCustomStyle} className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">风格名称</label><input value={newStyle.label} onChange={e => setNewStyle(prev => ({...prev, label: e.target.value}))} placeholder="如：赛博朋克" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm" required /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">提示词核心</label><textarea value={newStyle.promptStyle} onChange={e => setNewStyle(prev => ({...prev, promptStyle: e.target.value}))} placeholder="描述画面的核心艺术特征..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none h-24 text-sm resize-none" required /></div>
                            <button type="submit" className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg flex items-center justify-center gap-2"><Sparkles size={18} /> 保存并启用</button>
                        </form>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">当前可用风格 ({availableSpecs.length})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {availableSpecs.map(preset => {
                            const isDefault = VISUAL_PRESETS.some(p => p.id === preset.id);
                            return (
                                <div key={preset.id} className={`p-5 rounded-2xl border-2 transition-all relative group flex flex-col justify-between ${visualSpec.id === preset.id ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'}`}>
                                    <div><div className="flex justify-between items-start mb-2"><h4 className="font-bold text-slate-800 flex items-center gap-2">{preset.label}{isDefault && <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] text-slate-500 rounded font-normal">内置</span>}</h4>{!isDefault && <button onClick={(e) => { e.stopPropagation(); handleDeleteStyle(preset.id); }} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>}</div><p className="text-xs text-slate-500 mb-4 line-clamp-3 italic leading-relaxed">"{preset.promptStyle}"</p></div>
                                    <button onClick={() => setVisualSpec(preset)} className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${visualSpec.id === preset.id ? 'bg-brand-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-brand-100 hover:text-brand-600'}`}>{visualSpec.id === preset.id ? '当前首选' : '设为默认'}</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
