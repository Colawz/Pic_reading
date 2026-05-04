
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Book, Character, Location, Illustration, VisualSpec, Relationship, ReaderSettings, ImageGenerationModelId, NarrativeFacts, RelationshipChatState, ChatMessage } from '../types';
import { analyzeNarrative, scanChapterForAssets, analyzeRelationships, chatWithBookRole } from '../services/aiService';
import { exportBookToHtml, exportBookToPdf } from '../services/exportService';
import { BatchActionsModal } from './BatchActionsModal';
import { Wand2, AlertCircle, Settings2, Loader2, ChevronLeft, ChevronRight, ScanSearch, CheckCircle2, Circle, Layers, Palette, X, UserPlus, Info, Type, Trash2, Bot, MessageCircle, Send, BookOpen, Download, FileText, FileType } from 'lucide-react';

interface ReaderProps {
  books: Book[];
  book: Book;
  characters: Character[];
  locations: Location[];
  relationships: Relationship[];
  relationshipChat?: RelationshipChatState;
  visualSpec: VisualSpec;
  availableSpecs: VisualSpec[];
  imageModelId: ImageGenerationModelId;
  imageModels: Array<{ id: ImageGenerationModelId; label: string; description: string }>;
  illustrations: Record<string, Illustration>;
  onAddIllustration: (ill: Illustration) => void;
  onDeleteIllustration: (paragraphId: string) => void;
  onUpdateIllustration: (paragraphId: string, updates: Partial<Illustration>) => void;
  onDiscoverCharacter: (char: Character) => Promise<string | undefined>;
  onDiscoverLocation: (loc: Location) => Promise<void>;
  onDiscoverRelationships: (rels: Relationship[]) => void;
  onUpdateBookStyle: (bookId: string, styleId: string) => void;
  onUpdateImageModel: (modelId: ImageGenerationModelId) => void;
  onGenerateIllustration: (bookId: string, paragraphId: string, facts: NarrativeFacts, spec: VisualSpec, illustrationCharacters: Character[], illustrationLocations: Location[], originalText?: string, customRequirement?: string) => Promise<{ imageUrl: string; promptUsed: string }>;
  onSelectBook: (book: Book) => void;
  onOpenAssetsView: (bookId?: string) => void;
  onUpdateRelationshipChat: (bookId: string, chatState: RelationshipChatState) => void;
}

export const Reader: React.FC<ReaderProps> = ({
  books,
  book, characters, locations, visualSpec, availableSpecs, imageModelId, imageModels, illustrations,
  relationships, relationshipChat,
  onAddIllustration, onDeleteIllustration, onUpdateIllustration, onDiscoverCharacter, onDiscoverLocation, onDiscoverRelationships, onUpdateBookStyle, onUpdateImageModel, onGenerateIllustration, onSelectBook, onOpenAssetsView, onUpdateRelationshipChat
}) => {
  const BATCH_CONCURRENCY = 3;
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>({ wordInterval: 300, preGenerate: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const latestCharactersRef = useRef(characters);
  const latestLocationsRef = useRef(locations);
  const [currentPage, setCurrentPage] = useState(0);
  const PARAGRAPHS_PER_PAGE = 5;

  const [isScanning, setIsScanning] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResults, setScanResults] = useState<{characters: Partial<Character>[], locations: Partial<Location>[]}>({ characters: [], locations: [] });
  const [selectedScanItems, setSelectedScanItems] = useState<Record<string, boolean>>({});
  const [isCreatingAssets, setIsCreatingAssets] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isGeneratingMissingAssets, setIsGeneratingMissingAssets] = useState(false);
  const [activeGenerationMap, setActiveGenerationMap] = useState<Record<string, boolean>>({});
  const [missingActionMode, setMissingActionMode] = useState<'generate' | 'skip' | null>(null);
  const [batchStageLabel, setBatchStageLabel] = useState('正在绘制...');
  const [customRequirements, setCustomRequirements] = useState<Record<string, string>>({});
  const [requirementEditorMap, setRequirementEditorMap] = useState<Record<string, boolean>>({});
  const autoResumingPendingRef = useRef<Record<string, boolean>>({});
  const [focusedSidebarCharacterId, setFocusedSidebarCharacterId] = useState<string | null>(null);
  const [chatRole, setChatRole] = useState<string>('companion');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);

  // Missing Character Modal State
  const [pendingGenerationQueue, setPendingGenerationQueue] = useState<Array<{
    task: { chIdx: number; pIdx: number };
    missingChars: string[];
  }>>([]);

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
  const isScienceBook = book.genre.includes("科普") || book.genre.includes("科学");
  const currentPendingGeneration = pendingGenerationQueue[0] || null;
  const queuedGenerationCount = Math.max(0, pendingGenerationQueue.length - 1);
  const currentBookRelationships = useMemo(() => relationships.filter(relationship => relationship.bookId === book.id), [relationships, book.id]);
  const latestIllustratedChapterIndex = useMemo(() => {
    return book.chapters.reduce((latestIndex, chapter, chapterIndex) => {
      const hasCompletedIllustration = chapter.paragraphs.some(paragraph => {
        const illustration = illustrations[paragraph.id];
        return illustration?.status === 'completed' && Boolean(illustration.imageUrl);
      });
      return hasCompletedIllustration ? chapterIndex : latestIndex;
    }, -1);
  }, [book, illustrations]);
  const readingScopeLabel = useMemo(() => {
    if (latestIllustratedChapterIndex < 0) return '';
    return `这是到${book.chapters[latestIllustratedChapterIndex].title}为止的角色关系图`;
  }, [book, latestIllustratedChapterIndex]);
  const focusedSidebarCharacter = useMemo(() => {
    if (focusedSidebarCharacterId) {
      return characters.find(character => character.id === focusedSidebarCharacterId) || characters[0];
    }
    return characters[0];
  }, [characters, focusedSidebarCharacterId]);
  const currentChatCharacter = useMemo(
    () => characters.find(character => character.id === chatRole),
    [characters, chatRole]
  );

  useEffect(() => {
    latestCharactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    latestLocationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    setFocusedSidebarCharacterId(null);
    setChatInput('');
    setChatRole('companion');
    setChatMessages(
      relationshipChat?.messages?.length
        ? relationshipChat.messages
        : [
            {
              role: 'assistant',
              assistantMode: 'companion',
              content: '可以问我剧情理解、人物关系，也可以切换成书中角色和你对话。'
            }
          ]
    );
  }, [book.id, relationshipChat]);

  useEffect(() => {
    const pendingIllustrations = Object.values(illustrations).filter(
      (illustration) =>
        illustration.status === 'pending' &&
        currentChapter.paragraphs.some((paragraph) => paragraph.id === illustration.paragraphId)
    );

    pendingIllustrations.forEach((illustration) => {
      const paragraph = currentChapter.paragraphs.find((item) => item.id === illustration.paragraphId);
      if (!paragraph) return;
      if (activeGenerationMap[paragraph.id]) return;
      if (pendingGenerationQueue.some((item) => item.task.pIdx === currentChapter.paragraphs.indexOf(paragraph))) return;
      if (autoResumingPendingRef.current[paragraph.id]) return;

      autoResumingPendingRef.current[paragraph.id] = true;
      setTaskActive(paragraph.id, true);

      void runGenerationTask(createGenerationTask(currentChapterIndex, currentChapter.paragraphs.indexOf(paragraph)), {
        interactive: false,
      }).finally(() => {
        setTaskActive(paragraph.id, false);
        delete autoResumingPendingRef.current[paragraph.id];
      });
    });
  }, [illustrations, characters, locations, pendingGenerationQueue, currentChapter]);

  useEffect(() => {
    const hasAssets = characters.length > 0;
    if (!hasAssets && !isScanning && !showScanModal && currentPage === 0) handleScanAssets();
  }, [book.id]);

  const normalizeName = (value: string) => value.trim().toLowerCase();

  const findCharacterMatch = (pool: Character[], name: string) => {
    const normalizedSearch = normalizeName(name);
    return pool.find(c => {
      const normalizedTarget = normalizeName(c.name);
      return normalizedSearch === normalizedTarget || normalizedSearch.includes(normalizedTarget) || normalizedTarget.includes(normalizedSearch);
    });
  };

  const getParagraphContext = (chapterIndex: number, paragraphIndex: number) => {
    const chapter = book.chapters[chapterIndex];
    return chapter.paragraphs
      .slice(Math.max(0, paragraphIndex - 5), paragraphIndex + 3)
      .map(p => p.text)
      .join("\n");
  };

  const upsertIllustrationAsGenerating = (paragraphId: string) => {
    if (!illustrations[paragraphId]) {
      onAddIllustration({ id: `ill-${Date.now()}-${Math.random()}`, paragraphId, status: 'generating' });
    } else {
      onUpdateIllustration(paragraphId, { status: 'generating', error: undefined });
    }
  };

  const getMissingCharacterNames = (facts: { characters: string[] }, pool: Character[]) => {
    return Array.from(new Set(facts.characters.filter(name => {
      const match = findCharacterMatch(pool, name);
      return !match || !match.imageUrl;
    })));
  };

  const mergeGeneratedCharacters = (
    pool: Character[],
    generated: Array<{ name: string; imageUrl?: string }>
  ) => {
    return pool.map(char => {
      const match = generated.find(item => normalizeName(item.name) === normalizeName(char.name) && item.imageUrl);
      return match ? { ...char, imageUrl: match.imageUrl, locked: true, generationStatus: 'success' } : char;
    });
  };

  type GenerationTask = {
    chIdx: number;
    pIdx: number;
    paragraph: Book['chapters'][number]['paragraphs'][number];
  };

  type AnalyzedTask = GenerationTask & {
    facts: Awaited<ReturnType<typeof analyzeNarrative>>;
    missingCharacterNames: string[];
  };

  const createGenerationTask = (chIdx: number, pIdx: number): GenerationTask => ({
    chIdx,
    pIdx,
    paragraph: book.chapters[chIdx].paragraphs[pIdx],
  });

  const setTaskActive = (paragraphId: string, active: boolean) => {
    setActiveGenerationMap(prev => {
      if (active) {
        return { ...prev, [paragraphId]: true };
      }
      const next = { ...prev };
      delete next[paragraphId];
      return next;
    });
  };

  const analyzeGenerationTask = async (
    task: GenerationTask,
    characterPool: Character[],
    locationPool: Location[]
  ): Promise<AnalyzedTask> => {
    upsertIllustrationAsGenerating(task.paragraph.id);
    const facts = await analyzeNarrative(
      task.paragraph.text,
      getParagraphContext(task.chIdx, task.pIdx),
      characterPool,
      locationPool
    );
    onUpdateIllustration(task.paragraph.id, { extractedFacts: facts });

    return {
      ...task,
      facts,
      missingCharacterNames: getMissingCharacterNames(facts, characterPool),
    };
  };

  const renderGenerationTask = async (
    task: AnalyzedTask,
    characterPool: Character[],
    locationPool: Location[]
  ) => {
    const customRequirement = customRequirements[task.paragraph.id]?.trim() || undefined;
    const { imageUrl, promptUsed } = await onGenerateIllustration(
      book.id,
      task.paragraph.id,
      task.facts,
      visualSpec,
      characterPool,
      locationPool,
      isScienceBook ? task.paragraph.text : undefined,
      customRequirement
    );
    onUpdateIllustration(task.paragraph.id, { status: 'completed', imageUrl, promptUsed });
  };

  const runWithConcurrency = async <T,>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>
  ) => {
    let cursor = 0;
    const workerCount = Math.min(limit, items.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    }));
  };

  const runInOrderedBatches = async <T,>(
    items: T[],
    batchSize: number,
    worker: (item: T, index: number) => Promise<void>
  ) => {
    for (let start = 0; start < items.length; start += batchSize) {
      const batch = items.slice(start, start + batchSize);
      await Promise.all(
        batch.map((item, offset) => worker(item, start + offset))
      );
    }
  };

  const ensureCharacterAssets = async (names: string[], characterPool: Character[]) => {
    const uniqueNames = Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));
    const tasks = uniqueNames.map(async (name) => {
      const existing = findCharacterMatch(characterPool, name);
      if (existing?.imageUrl) {
        return { name: existing.name, imageUrl: existing.imageUrl };
      }

      const imageUrl = await onDiscoverCharacter(
        existing || {
          id: `char-${Date.now()}-${Math.random()}`,
          bookId: book.id,
          name,
          description: "新发现角色",
          visualSummary: `${name}的样貌`,
          locked: false
        } as Character
      );

      return { name: existing?.name || name, imageUrl };
    });

    const settled = await Promise.allSettled(tasks);
    const generated = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    return mergeGeneratedCharacters(characterPool, generated);
  };

  const runGenerationTask = async (
    task: GenerationTask,
    options?: {
      characterPool?: Character[];
      locationPool?: Location[];
      interactive?: boolean;
      skipCharCheck?: boolean;
    }
  ) => {
    const characterPool = options?.characterPool || latestCharactersRef.current;
    const locationPool = options?.locationPool || latestLocationsRef.current;
    const interactive = options?.interactive !== false;

    try {
      const analyzedTask = await analyzeGenerationTask(task, characterPool, locationPool);

      if (!options?.skipCharCheck && analyzedTask.missingCharacterNames.length > 0) {
        if (interactive) {
          onUpdateIllustration(task.paragraph.id, { status: 'pending' });
          setPendingGenerationQueue(prev => {
            const alreadyQueued = prev.some(item => item.task.chIdx === task.chIdx && item.task.pIdx === task.pIdx);
            if (alreadyQueued) return prev;
            return [...prev, {
              task: { chIdx: task.chIdx, pIdx: task.pIdx },
              missingChars: analyzedTask.missingCharacterNames
            }];
          });
          return;
        }

        const nextCharacterPool = await ensureCharacterAssets(analyzedTask.missingCharacterNames, characterPool);
        await renderGenerationTask(analyzedTask, nextCharacterPool, locationPool);
        return;
      }

      await renderGenerationTask(analyzedTask, characterPool, locationPool);
    } catch (error: any) {
      onUpdateIllustration(task.paragraph.id, { status: 'failed', error: error.message || "生成失败" });
    }
  };

  const handleScanAssets = async () => {
      setIsScanning(true);
      try {
        const text = currentChapter.paragraphs.map(p => p.text).join("\n");
        const [results, foundRels] = await Promise.all([
          scanChapterForAssets(text),
          analyzeRelationships(text, characters),
        ]);
        
        // 只要库中已有该名称的角色，即便没图，也不再将其列为“扫描发现的新世界观”
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

        if (foundRels.length > 0) {
          onDiscoverRelationships(foundRels.map(r => ({ ...r, id: `rel-${Date.now()}`, bookId: book.id } as Relationship)));
        }
        
        if (filteredCharacters.length > 0 || filteredLocations.length > 0) {
          setShowScanModal(true);
        }
      } finally {
        setIsScanning(false);
      }
  };

  const handleGenerate = async (chIdx: number, pIdx: number) => {
      const task = createGenerationTask(chIdx, pIdx);
      if (activeGenerationMap[task.paragraph.id]) return;
      setTaskActive(task.paragraph.id, true);
      try {
        await runGenerationTask(task);
      } finally {
        setTaskActive(task.paragraph.id, false);
      }
  };

  const handleStartBatch = async (interval: number, scope: 'chapter' | 'next_n' | 'all', nValue: number) => {
    setIsBatchProcessing(true);
    setBatchStageLabel('正在分析段落...');

    try {
      const chapterIndexes =
        scope === 'all'
          ? book.chapters.map((_, idx) => idx)
          : scope === 'next_n'
            ? book.chapters
                .map((_, idx) => idx)
                .slice(currentChapterIndex, Math.min(book.chapters.length, currentChapterIndex + nValue))
            : [currentChapterIndex];

      const targets = chapterIndexes.flatMap(chIdx =>
        book.chapters[chIdx].paragraphs
          .map((paragraph, pIdx) => ({ paragraph, task: createGenerationTask(chIdx, pIdx), pIdx }))
          .filter(({ pIdx, paragraph }) => (pIdx + 1) % interval === 0 && (!illustrations[paragraph.id] || illustrations[paragraph.id].status === 'failed'))
          .map(({ task }) => task)
      );

      setBatchProgress({ current: 0, total: targets.length });

      if (targets.length === 0) {
        setShowBatchModal(false);
        return;
      }

      const analyzedTargets = new Array<AnalyzedTask>(targets.length);

      await runWithConcurrency(targets, BATCH_CONCURRENCY, async (task, index) => {
        const analyzedTask = await analyzeGenerationTask(task, latestCharactersRef.current, latestLocationsRef.current);
        analyzedTargets[index] = analyzedTask;
      });

      const orderedAnalyzedTargets = analyzedTargets.filter(Boolean);
      const missingNames = Array.from(new Set(orderedAnalyzedTargets.flatMap(target => target.missingCharacterNames)));
      setBatchStageLabel(missingNames.length > 0 ? '正在补全缺失角色设定...' : '正在生成插图...');
      const batchCharacters = missingNames.length > 0
        ? await ensureCharacterAssets(missingNames, latestCharactersRef.current)
        : latestCharactersRef.current;
      const batchLocations = latestLocationsRef.current;

      setBatchStageLabel('正在生成插图...');
      await runInOrderedBatches(orderedAnalyzedTargets, BATCH_CONCURRENCY, async (task) => {
        try {
          await renderGenerationTask(task, batchCharacters, batchLocations);
        } catch (error: any) {
          onUpdateIllustration(task.paragraph.id, { status: 'failed', error: error.message || "生成失败" });
        } finally {
          setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      });

      setShowBatchModal(false);
    } finally {
      setIsBatchProcessing(false);
      setBatchStageLabel('正在绘制...');
    }
  };

  const handleExport = (mode: 'full' | 'generated_chapters', format: 'html' | 'pdf') => {
    if (format === 'html') exportBookToHtml(book, illustrations, mode);
    else exportBookToPdf(book, illustrations, mode);
  };

  const handleSettingsExport = (mode: 'full' | 'generated_chapters', format: 'html' | 'pdf') => {
    handleExport(mode, format);
    setShowSettings(false);
  };

  const handleGenMissingChars = async () => {
    if (!currentPendingGeneration) return;
    const charNames = [...currentPendingGeneration.missingChars];
    setIsGeneratingMissingAssets(true);
    setMissingActionMode('generate');
    onOpenAssetsView(book.id);

    try {
      const refreshedCharacters = await ensureCharacterAssets(charNames, latestCharactersRef.current);
      await runGenerationTask(createGenerationTask(currentPendingGeneration.task.chIdx, currentPendingGeneration.task.pIdx), {
        skipCharCheck: true,
        characterPool: refreshedCharacters,
        locationPool: latestLocationsRef.current
      });
      setPendingGenerationQueue(prev => prev.slice(1));
    } finally {
      setIsGeneratingMissingAssets(false);
      setMissingActionMode(null);
    }
  };

  const handleConfirmScanResults = async () => {
    setIsCreatingAssets(true);
    const characterTasks = scanResults.characters
      .filter(c => selectedScanItems[`char-${c.name}`])
      .map(c => onDiscoverCharacter({
        id: `char-${Date.now()}-${Math.random()}`,
        bookId: book.id,
        name: c.name!,
        description: "AI扫描发现",
        visualSummary: c.visualSummary!,
        locked: false
      } as Character));

    const locationTasks = scanResults.locations
      .filter(l => selectedScanItems[`loc-${l.name}`])
      .map(l => onDiscoverLocation({
        id: `loc-${Date.now()}-${Math.random()}`,
        bookId: book.id,
        name: l.name!,
        description: "AI扫描发现",
        visualSummary: l.visualSummary!,
        locked: false
      } as Location));

    setShowScanModal(false);
    onOpenAssetsView(book.id);
    void Promise.allSettled([...characterTasks, ...locationTasks]).finally(() => {
      setIsCreatingAssets(false);
    });
  };

  const handleSkipMissingChars = () => {
    if (!currentPendingGeneration) return;
    setMissingActionMode('skip');
    void runGenerationTask(createGenerationTask(currentPendingGeneration.task.chIdx, currentPendingGeneration.task.pIdx), { skipCharCheck: true });
    setPendingGenerationQueue(prev => prev.slice(1));
    setTimeout(() => setMissingActionMode(null), 0);
  };

  const toggleRequirementEditor = (paragraphId: string) => {
    setRequirementEditorMap(prev => ({ ...prev, [paragraphId]: !prev[paragraphId] }));
  };

  const handleSendChat = async () => {
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isChatting) return;

    const nextHistory: ChatMessage[] = [...chatMessages, { role: 'user', content: trimmedInput }];
    setChatMessages(nextHistory);
    setChatInput('');
    setIsChatting(true);

    const roleCharacter = chatRole === 'companion' ? undefined : characters.find(character => character.id === chatRole);

    try {
      const roleRelationships = roleCharacter
        ? currentBookRelationships.filter(rel => rel.sourceId === roleCharacter.id || rel.targetId === roleCharacter.id)
        : currentBookRelationships;
      const scopedChapters = roleCharacter
        ? (latestIllustratedChapterIndex >= 0 ? book.chapters.slice(0, latestIllustratedChapterIndex + 1) : [])
        : book.chapters;
      const bookText = scopedChapters
        .map(chapter => `${chapter.title}\n${chapter.paragraphs.map(paragraph => paragraph.text).join('\n')}`)
        .join('\n\n');

      const reply = await chatWithBookRole({
        bookTitle: book.title,
        bookText,
        roleMode: roleCharacter ? 'character' : 'companion',
        roleCharacter,
        relatedRelationships: roleRelationships,
        history: nextHistory,
        userMessage: trimmedInput,
        readingScopeLabel: roleCharacter ? readingScopeLabel : `整本《${book.title}》`,
        hasReadingProgress: latestIllustratedChapterIndex >= 0,
      });

      setChatMessages(prev => {
        const nextMessages: ChatMessage[] = [
          ...prev,
          {
            role: 'assistant',
            content: reply,
            assistantMode: roleCharacter ? 'character' : 'companion',
            assistantCharacterId: roleCharacter?.id,
          }
        ];
        onUpdateRelationshipChat(book.id, {
          messages: nextMessages,
          scopeLabel: readingScopeLabel,
        });
        return nextMessages;
      });
    } catch (error: any) {
      setChatMessages(prev => {
        const nextMessages: ChatMessage[] = [
          ...prev,
          {
            role: 'assistant',
            content: error?.message || '对话失败，请稍后重试。',
            assistantMode: roleCharacter ? 'character' : 'companion',
            assistantCharacterId: roleCharacter?.id,
          }
        ];
        onUpdateRelationshipChat(book.id, {
          messages: nextMessages,
          scopeLabel: readingScopeLabel,
        });
        return nextMessages;
      });
    } finally {
      setIsChatting(false);
    }
  };

  const handleClearChat = () => {
    const initialMessages: ChatMessage[] = [
      {
        role: 'assistant',
        assistantMode: 'companion',
        content: '可以问我剧情理解、人物关系，也可以切换成书中角色和你对话。'
      }
    ];
    setChatMessages(initialMessages);
    setChatInput('');
    onUpdateRelationshipChat(book.id, {
      messages: initialMessages,
      scopeLabel: readingScopeLabel,
    });
  };

  const getAssistantAvatar = (message: ChatMessage) => {
    if (message.assistantMode === 'character' && message.assistantCharacterId) {
      return characters.find(character => character.id === message.assistantCharacterId);
    }
    return null;
  };

  return (
    <div className="box-border flex h-full w-full flex-col overflow-hidden px-6 py-8 xl:px-8 2xl:px-10">
      {/* Missing Character Modal */}
      {currentPendingGeneration && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">缺失角色形象</h3>
                <p className="text-sm text-slate-500 mb-6">场景中涉及角色：<b>{currentPendingGeneration.missingChars.join(", ")}</b>。<br/>世界观中尚未生成这些角色的形象。为了保证视觉一致性，建议先完善世界观。</p>
                {queuedGenerationCount > 0 && <div className="mb-4 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">当前还有 {queuedGenerationCount} 个待处理生图任务在排队。</div>}
                <div className="flex flex-col gap-3">
                  <button onClick={handleGenMissingChars} disabled={isGeneratingMissingAssets} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:bg-brand-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isGeneratingMissingAssets && missingActionMode === 'generate' && <Loader2 size={16} className="animate-spin" />}
                    {isGeneratingMissingAssets && missingActionMode === 'generate' ? '生成中...' : '生成形象设定并继续'}
                  </button>
                  <button onClick={handleSkipMissingChars} disabled={isGeneratingMissingAssets} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isGeneratingMissingAssets && missingActionMode === 'skip' && <Loader2 size={16} className="animate-spin" />}
                    {isGeneratingMissingAssets && missingActionMode === 'skip' ? '绘制中...' : '不生成设定直接绘制'}
                  </button>
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
                    <h3 className="text-xl font-bold">扫描发现新视觉设定</h3>
                    <div className="text-xs text-slate-400">已自动过滤库中已有设定</div>
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
                      <button onClick={() => setShowScanModal(false)} disabled={isCreatingAssets} className="px-4 py-2 font-medium text-slate-600 disabled:opacity-50">忽略</button>
                      <button onClick={handleConfirmScanResults} disabled={isCreatingAssets} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md hover:bg-brand-700 transition-colors disabled:bg-brand-300 disabled:cursor-not-allowed flex items-center gap-2">
                        {isCreatingAssets && <Loader2 size={16} className="animate-spin" />}
                        {isCreatingAssets ? '正在跳转到世界观...' : '确认并建立设定库'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <BatchActionsModal
        book={book}
        currentChapterIndex={currentChapterIndex}
        imageModelId={imageModelId}
        imageModels={imageModels}
        isOpen={showBatchModal}
        isProcessing={isBatchProcessing}
        stageLabel={batchStageLabel}
        progress={batchProgress}
        onClose={() => setShowBatchModal(false)}
        onStartBatch={handleStartBatch}
        onUpdateImageModel={onUpdateImageModel}
        onExport={handleExport}
      />

      <div className="grid flex-1 min-h-0 items-start gap-6 2xl:grid-cols-[260px_minmax(760px,1fr)_360px] xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="h-full min-h-0 overflow-y-auto pr-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-bold text-slate-900">我的书架</div>
                <div className="text-xs text-slate-400">在阅读页直接切换作品</div>
              </div>
              <button
                onClick={() => onSelectBook(book)}
                className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                阅读中
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {books.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectBook(item)}
                  className={`group overflow-hidden rounded-2xl border text-left transition-all ${item.id === book.id ? 'border-brand-300 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div className="aspect-[3/4] bg-slate-100 overflow-hidden">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-4xl">{item.coverEmoji || '📘'}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.title}</div>
                    <div className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                      {item.id === book.id ? `${currentChapter.title} · 第 ${currentPage + 1} 页` : item.chapters[0]?.title || '待阅读'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 h-full min-h-0">
          <div className="min-w-0 h-full min-h-0 rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-brand-500">
                    <BookOpen size={14} />
                    阅读工作台
                  </div>
                  <h1 className="mt-2 text-3xl font-serif font-bold text-slate-900">{book.title}</h1>
                  <p className="mt-1 text-sm text-slate-400">{currentChapter.title} · 第 {currentPage + 1} 页</p>
                </div>
                <div className="relative flex flex-wrap gap-2">
                  <button onClick={() => setShowStylePicker(true)} className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:text-brand-600 flex items-center gap-2"><Palette size={16} /><span>{visualSpec.label}</span></button>
                  <button onClick={handleScanAssets} disabled={isScanning} className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:text-brand-600 flex items-center gap-2 disabled:opacity-50">{isScanning ? <Loader2 className="animate-spin" size={16} /> : <ScanSearch size={16} />}<span>扫描设定</span></button>
                  <button onClick={() => setShowBatchModal(true)} className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:text-brand-600 flex items-center gap-2"><Layers size={16} /><span>批量生图</span></button>
                  <button onClick={() => setShowSettings(!showSettings)} className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:text-brand-600 flex items-center gap-2 transition-all"><Settings2 size={16} /><span>设置</span></button>

                  {showSettings && (
                    <div className="absolute right-0 top-14 w-80 bg-white rounded-xl shadow-xl border p-5 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">图片模型</label>
                          <select value={imageModelId} onChange={e => onUpdateImageModel(e.target.value as ImageGenerationModelId)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                            {imageModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                          </select>
                          <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded mt-2">
                            {imageModels.find(model => model.id === imageModelId)?.description}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700"><Download size={16} /> 导出书籍</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleSettingsExport('full', 'html')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                            >
                              <FileText size={18} className="mb-2 text-slate-400" />
                              <div className="text-xs font-bold text-slate-700">完整 HTML</div>
                              <div className="mt-1 text-[10px] text-slate-400">整本图文下载</div>
                            </button>
                            <button
                              onClick={() => handleSettingsExport('full', 'pdf')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                            >
                              <FileType size={18} className="mb-2 text-brand-500" />
                              <div className="text-xs font-bold text-slate-700">完整 PDF</div>
                              <div className="mt-1 text-[10px] text-slate-400">打印保存分享</div>
                            </button>
                            <button
                              onClick={() => handleSettingsExport('generated_chapters', 'html')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-green-300 hover:bg-green-50"
                            >
                              <FileText size={18} className="mb-2 text-green-500" />
                              <div className="text-xs font-bold text-slate-700">精选 HTML</div>
                              <div className="mt-1 text-[10px] text-slate-400">仅含配图章节</div>
                            </button>
                            <button
                              onClick={() => handleSettingsExport('generated_chapters', 'pdf')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-green-300 hover:bg-green-50"
                            >
                              <FileType size={18} className="mb-2 text-green-500" />
                              <div className="text-xs font-bold text-slate-700">精选 PDF</div>
                              <div className="mt-1 text-[10px] text-slate-400">配图章节排版</div>
                            </button>
                          </div>
                          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-400">
                            PDF 会打开系统打印面板，可选择“存储为 PDF”。
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              {currentParagraphs.map((paragraph, index) => {
                const pIdx = currentPage * PARAGRAPHS_PER_PAGE + index;
                const wordData = paragraphWordData[pIdx];
                const ill = illustrations[paragraph.id];
            const customRequirement = customRequirements[paragraph.id] || '';
            const isRequirementEditorOpen = !!requirementEditorMap[paragraph.id];
            const interval = settings.wordInterval;
            const isIntervalReached = interval > 0 && Math.floor(wordData.start / interval) < Math.floor(wordData.end / interval);
            const isFirstPar = pIdx === 0 && interval > 0;
            const shouldShowSuggestControl = isIntervalReached || isFirstPar;

                return (
                  <div key={paragraph.id} className="group mb-8">
                <p className={`font-serif text-xl leading-loose text-slate-800 mb-4 hover:bg-brand-50 rounded px-2 -mx-2 cursor-pointer transition-colors ${activeParagraphId === paragraph.id ? 'bg-brand-50 shadow-sm' : ''}`} onClick={() => setActiveParagraphId(paragraph.id)}>{paragraph.text}</p>
                <div className="my-6">
                  {ill ? (
                    <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm group/ill">
                      {ill.status === 'generating' && <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse"><Wand2 className="animate-spin mb-2 text-brand-500" size={32} />正在为您构思画面...</div>}
                      {ill.status === 'pending' && (
                        <div className="h-64 flex flex-col items-center justify-center text-amber-500 bg-amber-50/30 px-6 text-center">
                          <Info size={32} className="mb-2" />
                          <div className="font-medium">等待角色设定加载...</div>
                          <div className="mt-2 text-xs text-amber-600/80">角色设定补齐后会自动继续生成。</div>
                          <button
                            onClick={() => handleGenerate(currentChapterIndex, pIdx)}
                            disabled={!!activeGenerationMap[paragraph.id]}
                            className="mt-4 rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {activeGenerationMap[paragraph.id] ? '继续生成中...' : '手动继续生成'}
                          </button>
                        </div>
                      )}
                      {ill.status === 'completed' && ill.imageUrl && (
                        <div className="relative">
                          <img src={ill.imageUrl} className="w-full h-auto object-cover max-h-[550px] transition-transform duration-700 group-hover/ill:scale-[1.02]" />
                          <div className="absolute top-4 right-4 flex items-start gap-2">
                            <div className="relative">
                              <button
                                onClick={() => toggleRequirementEditor(paragraph.id)}
                                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-sm backdrop-blur transition-colors ${isRequirementEditorOpen ? 'bg-white text-slate-900' : 'bg-white/90 text-slate-700 hover:bg-white'} `}
                                title="打开本张图片操作"
                              >
                                <Settings2 size={16} />
                                <span>{customRequirement.trim() ? '本张设置' : '图片操作'}</span>
                              </button>
                              {isRequirementEditorOpen && (
                                <div className="absolute right-0 top-12 z-10 w-[320px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-800">本张生图要求</div>
                                      <div className="text-[11px] text-slate-400">留空则完全按系统自动分析生成</div>
                                    </div>
                                    <button
                                      onClick={() => toggleRequirementEditor(paragraph.id)}
                                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                      title="收起"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <input
                                    value={customRequirement}
                                    onChange={(e) => setCustomRequirements(prev => ({ ...prev, [paragraph.id]: e.target.value }))}
                                    placeholder="例如：低机位、人物居中、突出表情"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-300"
                                  />
                                  <div className="mt-2 text-[11px] text-slate-400">
                                    {customRequirement.trim().length > 0 ? `当前将附加 ${customRequirement.trim().length} 个字的本张要求` : '未填写附加要求'}
                                  </div>
                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => onDeleteIllustration(paragraph.id)}
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                    >
                                      删除
                                    </button>
                                    <button
                                      disabled={!!activeGenerationMap[paragraph.id]}
                                      onClick={() => handleGenerate(currentChapterIndex, pIdx)}
                                      className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      重生成
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover/ill:opacity-100 transition-opacity">
                             {ill.extractedFacts && <p className="text-white text-xs italic">场景: {ill.extractedFacts.location} | 氛围: {ill.extractedFacts.mood}</p>}
                          </div>
                        </div>
                      )}
                      {ill.status === 'failed' && <div className="p-8 text-red-400 bg-red-50 flex flex-col items-center text-center"><AlertCircle size={32} className="mb-2" /><span className="font-bold">生成失败</span>{ill.error && <p className="text-xs mt-2 max-w-md break-words opacity-80">{ill.error}</p>}<button onClick={() => handleGenerate(currentChapterIndex, pIdx)} className="mt-4 px-6 py-2 bg-red-100 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors">重新尝试</button></div>}
                    </div>
                  ) : (
                    <div className={`transition-all duration-300 ${shouldShowSuggestControl || isRequirementEditorOpen ? 'opacity-100 mb-10' : 'opacity-0 h-0 overflow-hidden group-hover:h-12 group-hover:opacity-100'}`}>
                        <div className={`border-2 border-dashed rounded-2xl transition-colors ${shouldShowSuggestControl || isRequirementEditorOpen ? 'border-brand-200 bg-brand-50/30 p-4' : 'border-slate-100 p-3'}`}>
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
                              <button disabled={!!activeGenerationMap[paragraph.id]} onClick={() => handleGenerate(currentChapterIndex, pIdx)} className={`flex items-center justify-center gap-3 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${shouldShowSuggestControl ? 'text-brand-600 hover:text-brand-700 hover:scale-105' : 'text-slate-300 hover:text-brand-500 text-xs'}`}>
                                <Wand2 size={shouldShowSuggestControl ? 24 : 16} className={shouldShowSuggestControl ? 'animate-pulse' : ''} />
                                <span>{shouldShowSuggestControl ? `AI 建议生图点 (${wordData.start}字处)` : '在此处生图'}</span>
                              </button>
                              <button
                                onClick={() => toggleRequirementEditor(paragraph.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${customRequirement.trim() ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
                              >
                                {isRequirementEditorOpen ? '收起要求' : '本张要求'}
                              </button>
                            </div>
                            {isRequirementEditorOpen && (
                              <div className="flex w-full items-center gap-2">
                                <input
                                  value={customRequirement}
                                  onChange={(e) => setCustomRequirements(prev => ({ ...prev, [paragraph.id]: e.target.value }))}
                                  placeholder="可为空，例如：低机位、人物居中、突出表情"
                                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-300"
                                />
                              </div>
                            )}
                          </div>
                          {isRequirementEditorOpen && (
                            <div className="mt-2 text-center text-[11px] text-slate-400 px-1">
                              {customRequirement.trim().length > 0 ? `当前将附加 ${customRequirement.trim().length} 个字的本张要求` : '留空则完全按系统自动分析生成'}
                            </div>
                          )}
                        </div>
                    </div>
                  )}
                </div>
                  </div>
                );
              })}

              <div className="mt-8 pt-6 border-t flex items-center justify-between">
                <button onClick={() => currentPage > 0 && setCurrentPage(currentPage - 1)} disabled={currentPage === 0} className="flex items-center gap-2 px-6 py-2 bg-white border rounded-xl text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"><ChevronLeft size={20} /> 上一页</button>
                <div className="text-sm font-medium text-slate-400 bg-slate-100 px-4 py-1 rounded-full">{currentPage + 1} / {totalPages}</div>
                <button onClick={() => currentPage < totalPages - 1 && setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages - 1} className="flex items-center gap-2 px-6 py-2 bg-white border rounded-xl text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm">下一页 <ChevronRight size={20} /></button>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex min-h-0 basis-1/3 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-bold text-slate-900">角色设定</div>
                <div className="text-xs text-slate-400">当前书籍的主要角色视觉卡片</div>
              </div>
              <button
                onClick={() => onOpenAssetsView(book.id)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >
                查看全部
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {characters.slice(0, 4).map(character => (
                <div
                  key={character.id}
                  className={`w-full rounded-2xl border p-3 text-left transition-all ${focusedSidebarCharacter?.id === character.id ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <button
                    onClick={() => setFocusedSidebarCharacterId(character.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100 shrink-0">
                        {character.imageUrl ? <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-slate-300"><Bot size={20} /></div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800">{character.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{character.visualSummary || character.description}</div>
                      </div>
                    </div>
                  </button>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => onOpenAssetsView(book.id)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700"
                    >
                      打开角色设定
                    </button>
                  </div>
                </div>
              ))}
              {characters.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
                  还没有角色设定，扫描章节后会自动补充。
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 basis-2/3 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <MessageCircle size={16} />
                    AI 伴读对话
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {currentChatCharacter
                      ? `当前角色可知范围：${readingScopeLabel ? `截至${book.chapters[latestIllustratedChapterIndex].title}` : '尚未形成阅读进度'}`
                      : `当前作品：《${book.title}》`}
                  </div>
                </div>
                <button
                  onClick={handleClearChat}
                  disabled={isChatting}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  清空
                </button>
              </div>
              <div className="mt-3">
                <select
                  value={chatRole}
                  onChange={(e) => setChatRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="companion">AI 伴读</option>
                  {characters.map(character => (
                    <option key={character.id} value={character.id}>{`扮演：${character.name}`}</option>
                  ))}
                </select>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                  {currentChatCharacter
                    ? `当前将以“${currentChatCharacter.name}”的身份回答，并结合角色设定、已知社会关系和当前阅读进度作答。`
                    : '当前将以伴读身份回答，可以解释剧情、梳理人物关系并陪伴阅读。'}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-4 space-y-3">
              {chatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' ? (
                    <div className="flex max-w-[92%] items-start gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-900 text-white flex items-center justify-center shadow-sm">
                        {(() => {
                          const avatarCharacter = getAssistantAvatar(message);
                          return avatarCharacter?.imageUrl
                            ? <img src={avatarCharacter.imageUrl} alt={avatarCharacter.name} className="h-full w-full object-cover" />
                            : <Bot size={18} />;
                        })()}
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-medium text-slate-500">
                          {(() => {
                            const avatarCharacter = getAssistantAvatar(message);
                            return avatarCharacter ? avatarCharacter.name : 'AI 伴读';
                          })()}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[88%] rounded-2xl bg-brand-600 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                      {message.content}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  rows={2}
                  placeholder="输入你想问的问题..."
                  className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button
                  onClick={() => void handleSendChat()}
                  disabled={!chatInput.trim() || isChatting}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isChatting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
