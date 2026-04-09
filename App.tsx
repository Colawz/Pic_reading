
import React, { useEffect, useRef, useState } from 'react';
import { Book, Character, Location, Illustration, VisualSpec, ViewMode, Relationship, ImageGenerationModelId, ImageGenerationStats, NarrativeFacts, StoredImageRecord, RelationshipChatState } from './types';
import { VISUAL_PRESETS, SAMPLE_BOOKS, createBook, IMAGE_GENERATION_MODELS } from './constants';
import { Layout } from './components/Layout';
import { Reader } from './components/Reader';
import { AssetLibrary } from './components/AssetLibrary';
import { BookShelf } from './components/BookShelf';
import { SocialNetwork } from './components/SocialNetwork';
import { analyzeRelationshipsFromReadingProgress, generateAssetVisual, generateBookCover, generateIllustration } from './services/aiService';
import { checkGeneratedImageLocally, deleteGeneratedImageLocally, findGeneratedImageLocally, isLocalPicDbUrl, normalizeGeneratedImageLocally, saveGeneratedImageLocally } from './services/localImageService';
import { loadPersistedAppState, savePersistedAppState, saveStoredImageRecords } from './services/storageService';
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

const DEFAULT_VISUAL_SPEC = VISUAL_PRESETS[0];
const DEFAULT_IMAGE_MODEL_ID: ImageGenerationModelId = IMAGE_GENERATION_MODELS[0].id;
const DEFAULT_IMAGE_GENERATION_STATS: ImageGenerationStats = {
  total: 0,
  assets: 0,
  illustrations: 0,
  byModel: {
    'doubao-seedream-4-5-251128': 0,
    'doubao-seedream-5-0-260128': 0,
  },
  lastGeneratedAt: null,
};

const findBookIdByParagraphId = (books: Book[], paragraphId: string) => {
  for (const book of books) {
    for (const chapter of book.chapters) {
      if (chapter.paragraphs.some(paragraph => paragraph.id === paragraphId)) {
        return book.id;
      }
    }
  }

  return undefined;
};

const buildStoredImageRecords = (
  books: Book[],
  characters: Character[],
  locations: Location[],
  illustrations: Record<string, Illustration>
): StoredImageRecord[] => {
  const now = new Date().toISOString();

  const characterRecords = characters
    .filter(character => character.imageUrl || character.referenceImageUrl)
    .map<StoredImageRecord>(character => ({
      id: `character:${character.id}`,
      bookId: character.bookId,
      sourceType: 'character',
      sourceId: character.id,
      localUrl: character.imageUrl,
      remoteUrl: character.referenceImageUrl,
      status: character.generationStatus === 'success' ? 'completed' : (character.generationStatus || 'pending'),
      createdAt: now,
      updatedAt: now,
    }));

  const locationRecords = locations
    .filter(location => location.imageUrl || location.referenceImageUrl)
    .map<StoredImageRecord>(location => ({
      id: `location:${location.id}`,
      bookId: location.bookId,
      sourceType: 'location',
      sourceId: location.id,
      localUrl: location.imageUrl,
      remoteUrl: location.referenceImageUrl,
      status: location.generationStatus === 'success' ? 'completed' : (location.generationStatus || 'pending'),
      createdAt: now,
      updatedAt: now,
    }));

  const illustrationRecords = Object.values(illustrations)
    .filter(illustration => illustration.imageUrl)
    .map<StoredImageRecord>(illustration => ({
      id: `illustration:${illustration.id}`,
      bookId: findBookIdByParagraphId(books, illustration.paragraphId) || 'unknown-book',
      sourceType: 'illustration',
      sourceId: illustration.paragraphId,
      localUrl: illustration.imageUrl,
      status: illustration.status,
      createdAt: now,
      updatedAt: now,
    }));

  return [...characterRecords, ...locationRecords, ...illustrationRecords];
};

const getBookStorageFolderName = (books: Book[], bookId: string) =>
  books.find(book => book.id === bookId)?.title?.trim() || bookId;

const getAssetFileStem = (name?: string) => name?.trim() || '未命名资产';

const getIllustrationFileStem = (books: Book[], paragraphId: string) => {
  for (const book of books) {
    for (const chapter of book.chapters) {
      const paragraphIndex = chapter.paragraphs.findIndex((paragraph) => paragraph.id === paragraphId);
      if (paragraphIndex >= 0) {
        return `${chapter.title}-第${paragraphIndex + 1}段`;
      }
    }
  }
  return paragraphId;
};

const isUsableLocalUrl = async (localUrl?: string) => {
  if (!isLocalPicDbUrl(localUrl)) {
    return false;
  }
  return checkGeneratedImageLocally({ localUrl }).catch(() => false);
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('home');
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [availableSpecs, setAvailableSpecs] = useState<VisualSpec[]>(VISUAL_PRESETS);
  const [visualSpec, setVisualSpec] = useState<VisualSpec>(DEFAULT_VISUAL_SPEC);
  const [characters, setCharacters] = useState<Character[]>(INITIAL_CHARACTERS);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELATIONSHIPS);
  const [relationshipChats, setRelationshipChats] = useState<Record<string, RelationshipChatState>>({});
  const [illustrations, setIllustrations] = useState<Record<string, Illustration>>({});
  const [imageModelId, setImageModelId] = useState<ImageGenerationModelId>(DEFAULT_IMAGE_MODEL_ID);
  const [imageGenerationStats, setImageGenerationStats] = useState<ImageGenerationStats>(DEFAULT_IMAGE_GENERATION_STATS);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [newStyle, setNewStyle] = useState<Partial<VisualSpec>>({
    label: '',
    promptStyle: '',
    cameraLanguage: 'cinematic composition',
    negatives: 'text, watermark, logo, blur'
  });
  const hasHydratedRef = useRef(false);
  const hasReconciledImagesRef = useRef(false);

  const currentBook = books.find(b => b.id === currentBookId) || null;
  const currentImageModel = IMAGE_GENERATION_MODELS.find(model => model.id === imageModelId) || IMAGE_GENERATION_MODELS[0];

  useEffect(() => {
    let cancelled = false;

    const hydrateApp = async () => {
      try {
        const persistedState = await loadPersistedAppState();
        if (cancelled) return;

        if (persistedState) {
          const nextBooks = persistedState.books?.length ? persistedState.books : SAMPLE_BOOKS;
          const nextSpecs = persistedState.availableSpecs?.length ? persistedState.availableSpecs : VISUAL_PRESETS;
          const nextCurrentBookId = persistedState.currentBookId ?? null;
          const preferredVisualSpecId = persistedState.preferredVisualSpecId ?? nextBooks[0]?.visualSpecId ?? DEFAULT_VISUAL_SPEC.id;
          const resolvedSpec =
            nextSpecs.find(spec => spec.id === preferredVisualSpecId) ||
            nextSpecs.find(spec => spec.id === nextBooks.find(book => book.id === nextCurrentBookId)?.visualSpecId) ||
            nextSpecs[0] ||
            DEFAULT_VISUAL_SPEC;

          setBooks(nextBooks);
          setAvailableSpecs(nextSpecs);
          setCharacters(persistedState.characters || INITIAL_CHARACTERS);
          setLocations(persistedState.locations || INITIAL_LOCATIONS);
          setRelationships(persistedState.relationships || INITIAL_RELATIONSHIPS);
          setRelationshipChats(persistedState.relationshipChats || {});
          setIllustrations(persistedState.illustrations || {});
          setCurrentBookId(nextCurrentBookId);
          setVisualSpec(resolvedSpec);
          setImageModelId(persistedState.imageModelId || DEFAULT_IMAGE_MODEL_ID);
          setImageGenerationStats(persistedState.imageGenerationStats || DEFAULT_IMAGE_GENERATION_STATS);
        } else {
          setBooks(SAMPLE_BOOKS);
          setAvailableSpecs(VISUAL_PRESETS);
          setCharacters(INITIAL_CHARACTERS);
          setLocations(INITIAL_LOCATIONS);
          setRelationships(INITIAL_RELATIONSHIPS);
          setRelationshipChats({});
          setIllustrations({});
          setCurrentBookId(null);
          setVisualSpec(DEFAULT_VISUAL_SPEC);
          setImageModelId(DEFAULT_IMAGE_MODEL_ID);
          setImageGenerationStats(DEFAULT_IMAGE_GENERATION_STATS);
        }
      } catch (error) {
        console.error("Failed to hydrate app state from IndexedDB:", error);
      } finally {
        if (!cancelled) {
          hasHydratedRef.current = true;
          setIsBootstrapping(false);
        }
      }
    };

    void hydrateApp();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const persist = async () => {
      try {
        const imageRecords = buildStoredImageRecords(books, characters, locations, illustrations);
        await Promise.all([
          savePersistedAppState({
            books,
            availableSpecs,
            characters,
            locations,
            relationships,
            relationshipChats,
            illustrations,
            currentBookId,
            preferredVisualSpecId: visualSpec.id,
            imageModelId,
            imageGenerationStats,
          }),
          saveStoredImageRecords(imageRecords),
        ]);
      } catch (error) {
        console.error("Failed to persist app state to IndexedDB:", error);
      }
    };

    void persist();
  }, [books, availableSpecs, characters, locations, relationships, relationshipChats, illustrations, currentBookId, visualSpec.id, imageModelId, imageGenerationStats]);

  useEffect(() => {
    if (!hasHydratedRef.current || hasReconciledImagesRef.current) return;
    hasReconciledImagesRef.current = true;

    const reconcilePersistedImages = async () => {
      try {
        const bookUpdates = await Promise.all(books.map(async (book) => {
          if (!book.coverUrl) {
            return null;
          }

          const bookFolder = book.title.trim() || book.id;
          let nextCoverUrl = book.coverUrl;
          const indexedLocalUrl = await findGeneratedImageLocally({
            bookFolder,
            category: 'covers',
            subcategory: 'books',
            fileStem: '封面',
          }).catch(() => null);

          if (indexedLocalUrl) {
            nextCoverUrl = indexedLocalUrl;
          }

          if (isLocalPicDbUrl(nextCoverUrl)) {
            nextCoverUrl = (await normalizeGeneratedImageLocally({
              localUrl: nextCoverUrl,
              targetBookFolder: bookFolder,
              category: 'covers',
              subcategory: 'books',
              fileStem: '封面',
            }).catch(() => ({ localUrl: nextCoverUrl }))).localUrl;
          }

          const localExists = await isUsableLocalUrl(nextCoverUrl);
          if (localExists) {
            return nextCoverUrl !== book.coverUrl ? { id: book.id, coverUrl: nextCoverUrl } : null;
          }

          return null;
        }));

        if (bookUpdates.some(Boolean)) {
          setBooks(prev => prev.map(book => {
            const update = bookUpdates.find(item => item?.id === book.id);
            return update ? { ...book, coverUrl: update.coverUrl } : book;
          }));
        }

        const characterUpdates = await Promise.all(characters.map(async (character) => {
          const bookFolder = getBookStorageFolderName(books, character.bookId);
          const fileStem = getAssetFileStem(character.name);
          let nextLocalUrl = character.imageUrl;
          const indexedLocalUrl = await findGeneratedImageLocally({
            bookFolder,
            category: 'assets',
            subcategory: 'characters',
            fileStem,
          }).catch(() => null);

          if (indexedLocalUrl) {
            nextLocalUrl = indexedLocalUrl;
          }

          if (isLocalPicDbUrl(nextLocalUrl)) {
            nextLocalUrl = (await normalizeGeneratedImageLocally({
              localUrl: nextLocalUrl!,
              targetBookFolder: bookFolder,
              category: 'assets',
              subcategory: 'characters',
              fileStem,
            }).catch(() => ({ localUrl: nextLocalUrl! }))).localUrl;
          }

          const remoteUrl = character.referenceImageUrl || (!isLocalPicDbUrl(character.imageUrl) ? character.imageUrl : undefined);
          if (!remoteUrl) {
            return nextLocalUrl !== character.imageUrl ? { id: character.id, localUrl: nextLocalUrl } : null;
          }

          const localExists = await isUsableLocalUrl(nextLocalUrl);

          if (localExists) {
            return nextLocalUrl !== character.imageUrl ? { id: character.id, localUrl: nextLocalUrl, remoteUrl } : null;
          }

          const { localUrl } = await saveGeneratedImageLocally({
            remoteUrl,
            bookId: bookFolder,
            category: 'assets',
            subcategory: 'characters',
            fileStem,
          });

          return { id: character.id, localUrl, remoteUrl };
        }));

        if (characterUpdates.some(Boolean)) {
          setCharacters(prev => prev.map(character => {
            const update = characterUpdates.find(item => item?.id === character.id);
            return update ? { ...character, imageUrl: update.localUrl, referenceImageUrl: update.remoteUrl } : character;
          }));
        }

        const locationUpdates = await Promise.all(locations.map(async (location) => {
          const bookFolder = getBookStorageFolderName(books, location.bookId);
          const fileStem = getAssetFileStem(location.name);
          let nextLocalUrl = location.imageUrl;
          const indexedLocalUrl = await findGeneratedImageLocally({
            bookFolder,
            category: 'assets',
            subcategory: 'locations',
            fileStem,
          }).catch(() => null);

          if (indexedLocalUrl) {
            nextLocalUrl = indexedLocalUrl;
          }

          if (isLocalPicDbUrl(nextLocalUrl)) {
            nextLocalUrl = (await normalizeGeneratedImageLocally({
              localUrl: nextLocalUrl!,
              targetBookFolder: bookFolder,
              category: 'assets',
              subcategory: 'locations',
              fileStem,
            }).catch(() => ({ localUrl: nextLocalUrl! }))).localUrl;
          }

          const remoteUrl = location.referenceImageUrl || (!isLocalPicDbUrl(location.imageUrl) ? location.imageUrl : undefined);
          if (!remoteUrl) {
            return nextLocalUrl !== location.imageUrl ? { id: location.id, localUrl: nextLocalUrl } : null;
          }

          const localExists = await isUsableLocalUrl(nextLocalUrl);

          if (localExists) {
            return nextLocalUrl !== location.imageUrl ? { id: location.id, localUrl: nextLocalUrl, remoteUrl } : null;
          }

          const { localUrl } = await saveGeneratedImageLocally({
            remoteUrl,
            bookId: bookFolder,
            category: 'assets',
            subcategory: 'locations',
            fileStem,
          });

          return { id: location.id, localUrl, remoteUrl };
        }));

        if (locationUpdates.some(Boolean)) {
          setLocations(prev => prev.map(location => {
            const update = locationUpdates.find(item => item?.id === location.id);
            return update ? { ...location, imageUrl: update.localUrl, referenceImageUrl: update.remoteUrl } : location;
          }));
        }

        const illustrationEntries = Object.values(illustrations);
        const illustrationUpdates = await Promise.all(illustrationEntries.map(async (illustration) => {
          let currentUrl = illustration.imageUrl;
          if (!currentUrl) {
            return null;
          }

          const bookId = findBookIdByParagraphId(books, illustration.paragraphId);
          const fileStem = getIllustrationFileStem(books, illustration.paragraphId);
          if (bookId) {
            const indexedLocalUrl = await findGeneratedImageLocally({
              bookFolder: getBookStorageFolderName(books, bookId),
              category: 'illustrations',
              subcategory: 'paragraphs',
              fileStem,
            }).catch(() => null);

            if (indexedLocalUrl) {
              currentUrl = indexedLocalUrl;
            }
          }

          if (isLocalPicDbUrl(currentUrl) && bookId) {
            const bookFolder = getBookStorageFolderName(books, bookId);
            currentUrl = (await normalizeGeneratedImageLocally({
              localUrl: currentUrl,
              targetBookFolder: bookFolder,
              category: 'illustrations',
              subcategory: 'paragraphs',
              fileStem,
            }).catch(() => ({ localUrl: currentUrl }))).localUrl;
          }

          const isLocalUrl = isLocalPicDbUrl(currentUrl);
          const localExists = await isUsableLocalUrl(currentUrl);

          if (isLocalUrl && localExists) {
            return currentUrl !== illustration.imageUrl ? { paragraphId: illustration.paragraphId, localUrl: currentUrl } : null;
          }

          if (isLocalUrl) {
            return null;
          }

          if (!bookId) {
            return null;
          }

          const { localUrl } = await saveGeneratedImageLocally({
            remoteUrl: currentUrl,
            bookId: getBookStorageFolderName(books, bookId),
            category: 'illustrations',
            subcategory: 'paragraphs',
            fileStem,
          });

          return { paragraphId: illustration.paragraphId, localUrl };
        }));

        if (illustrationUpdates.some(Boolean)) {
          setIllustrations(prev => {
            const next = { ...prev };
            illustrationUpdates.forEach(update => {
              if (update && next[update.paragraphId]) {
                next[update.paragraphId] = {
                  ...next[update.paragraphId],
                  imageUrl: update.localUrl,
                };
              }
            });
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to reconcile persisted local images:', error);
      }
    };

    void reconcilePersistedImages();
  }, [books, characters, locations, illustrations]);

  const incrementImageGenerationStats = (category: 'asset' | 'illustration', modelId: ImageGenerationModelId) => {
    setImageGenerationStats(prev => ({
      total: prev.total + 1,
      assets: prev.assets + (category === 'asset' ? 1 : 0),
      illustrations: prev.illustrations + (category === 'illustration' ? 1 : 0),
      byModel: {
        ...prev.byModel,
        [modelId]: (prev.byModel[modelId] || 0) + 1,
      },
      lastGeneratedAt: new Date().toISOString(),
    }));
  };

  const handleGenerateAssetVisual = async (
    description: string,
    type: 'character' | 'location',
    bookId: string,
    fileStem: string,
    specOverride?: VisualSpec
  ) => {
    const remoteUrl = await generateAssetVisual(description, type, specOverride || visualSpec, imageModelId);
    const { localUrl } = await saveGeneratedImageLocally({
      remoteUrl,
      bookId: getBookStorageFolderName(books, bookId),
      category: 'assets',
      subcategory: type === 'character' ? 'characters' : 'locations',
      fileStem: getAssetFileStem(fileStem),
    });
    incrementImageGenerationStats('asset', imageModelId);
    return { localUrl, remoteUrl };
  };

  const handleGenerateIllustration = async (
    bookId: string,
    paragraphId: string,
    facts: NarrativeFacts,
    spec: VisualSpec,
    illustrationCharacters: Character[],
    illustrationLocations: Location[],
    originalText?: string,
    customRequirement?: string
  ) => {
    const { imageUrl: remoteUrl, promptUsed } = await generateIllustration(
      facts,
      spec,
      illustrationCharacters,
      illustrationLocations,
      imageModelId,
      originalText,
      customRequirement
    );
    const { localUrl } = await saveGeneratedImageLocally({
      remoteUrl,
      bookId: getBookStorageFolderName(books, bookId),
      category: 'illustrations',
      subcategory: 'paragraphs',
      fileStem: getIllustrationFileStem(books, paragraphId),
    });
    incrementImageGenerationStats('illustration', imageModelId);
    return { imageUrl: localUrl, promptUsed };
  };

  const handleGenerateImportBookCover = async (title: string, content: string) => {
    const remoteUrl = await generateBookCover(title, content, visualSpec, imageModelId);
    const { localUrl } = await saveGeneratedImageLocally({
      remoteUrl,
      bookId: title.trim() || 'untitled-book',
      category: 'covers',
      subcategory: 'books',
      fileStem: '封面',
    });
    incrementImageGenerationStats('asset', imageModelId);
    return localUrl;
  };

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

  const handleDeleteBook = async (bookId: string) => {
    const targetBook = books.find(book => book.id === bookId);
    if (!targetBook) return;

    const paragraphIds = targetBook.chapters.flatMap(chapter => chapter.paragraphs.map(paragraph => paragraph.id));
    const relatedIllustrations = paragraphIds
      .map(paragraphId => illustrations[paragraphId])
      .filter((illustration): illustration is Illustration => Boolean(illustration));
    const relatedCharacters = characters.filter(character => character.bookId === bookId);
    const relatedLocations = locations.filter(location => location.bookId === bookId);
    const localImages = [
      targetBook.coverUrl,
      ...relatedIllustrations.map(item => item.imageUrl),
      ...relatedCharacters.map(item => item.imageUrl),
      ...relatedLocations.map(item => item.imageUrl),
    ];

    await Promise.all(localImages.map((localUrl) => cleanupLocalImage(localUrl)));

    setBooks(prev => prev.filter(book => book.id !== bookId));
    setCharacters(prev => prev.filter(character => character.bookId !== bookId));
    setLocations(prev => prev.filter(location => location.bookId !== bookId));
    setRelationships(prev => prev.filter(relationship => relationship.bookId !== bookId));
    setRelationshipChats(prev => {
      const next = { ...prev };
      delete next[bookId];
      return next;
    });
    setIllustrations(prev => {
      const next = { ...prev };
      paragraphIds.forEach((paragraphId) => {
        delete next[paragraphId];
      });
      return next;
    });

    if (currentBookId === bookId) {
      setCurrentBookId(null);
      setView('home');
    }
  };

  const handleAddIllustration = (ill: Illustration) => setIllustrations(prev => ({ ...prev, [ill.paragraphId]: ill }));

  const cleanupLocalImage = async (localUrl?: string) => {
    if (!localUrl || !localUrl.startsWith('/pic_db/')) {
      return;
    }

    try {
      await deleteGeneratedImageLocally({ localUrl });
    } catch (error) {
      console.error('Failed to delete local generated image:', error);
    }
  };

  const handleDeleteIllustration = async (paragraphId: string) => {
    const target = illustrations[paragraphId];
    await cleanupLocalImage(target?.imageUrl);
    setIllustrations(prev => {
      const next = { ...prev };
      delete next[paragraphId];
      return next;
    });
  };
  
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
        const { localUrl, remoteUrl } = await handleGenerateAssetVisual(visualSummary, 'character', char.bookId!, charName);
        setCharacters(prev => prev.map(c => c.id === targetId ? { ...c, imageUrl: localUrl, referenceImageUrl: remoteUrl, locked: true, generationStatus: 'success' } : c));
        return localUrl;
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
        const { localUrl, remoteUrl } = await handleGenerateAssetVisual(visualSummary, 'location', loc.bookId!, locName);
        setLocations(prev => prev.map(l => l.id === targetId ? { ...l, imageUrl: localUrl, referenceImageUrl: remoteUrl, locked: true, generationStatus: 'success' } : l));
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

  const handleGenerateRelationshipsFromBook = async (bookId: string) => {
    const targetBook = books.find(book => book.id === bookId);
    if (!targetBook) {
      throw new Error('未找到对应书籍。');
    }

    const generatedChapterIndex = targetBook.chapters.reduce((latestIndex, chapter, chapterIndex) => {
      const hasCompletedIllustration = chapter.paragraphs.some(paragraph => {
        const illustration = illustrations[paragraph.id];
        return illustration?.status === 'completed' && Boolean(illustration.imageUrl);
      });
      return hasCompletedIllustration ? chapterIndex : latestIndex;
    }, -1);

    if (generatedChapterIndex < 0) {
      throw new Error('这本书还没有已生图章节，暂时无法按阅读进度生成关系图。');
    }

    const scopedCharacters = characters.filter(character => character.bookId === bookId);
    if (scopedCharacters.length < 2) {
      throw new Error('当前书籍角色数量不足，至少需要两个角色才能生成关系图。');
    }

    const chapterScope = targetBook.chapters.slice(0, generatedChapterIndex + 1);
    const readingText = chapterScope
      .map(chapter => `${chapter.title}\n${chapter.paragraphs.map(paragraph => paragraph.text).join('\n')}`)
      .join('\n\n');

    const generatedRelationships = await analyzeRelationshipsFromReadingProgress(
      readingText,
      scopedCharacters,
      targetBook.chapters[generatedChapterIndex].title
    );

    const nextRelationships: Relationship[] = generatedRelationships.map((relationship, index) => ({
      id: `rel-llm-${bookId}-${Date.now()}-${index}`,
      bookId,
      sourceId: relationship.sourceId!,
      targetId: relationship.targetId!,
      type: relationship.type || '关联',
      description: relationship.description || '',
    }));

    setRelationships(prev => [
      ...prev.filter(relationship => relationship.bookId !== bookId),
      ...nextRelationships,
    ]);

    return {
      chapterTitle: targetBook.chapters[generatedChapterIndex].title,
      relationshipCount: nextRelationships.length,
      scopeLabel: `这是到${targetBook.chapters[generatedChapterIndex].title}为止的角色关系图`,
    };
  };

  const handleAddRelationship = (rel: Relationship) => setRelationships(prev => [...prev, rel]);
  const handleUpdateRelationship = (id: string, updates: Partial<Relationship>) => setRelationships(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const handleDeleteRelationship = (id: string) => setRelationships(prev => prev.filter(r => r.id !== id));
  const handleUpdateRelationshipChat = (bookId: string, chatState: RelationshipChatState) => {
    setRelationshipChats(prev => ({ ...prev, [bookId]: chatState }));
  };

  const handleDeleteCharacter = async (characterId: string) => {
    const target = characters.find(character => character.id === characterId);
    await cleanupLocalImage(target?.imageUrl);
    setCharacters(prev => prev.filter(character => character.id !== characterId));
  };

  const handleDeleteLocation = async (locationId: string) => {
    const target = locations.find(location => location.id === locationId);
    await cleanupLocalImage(target?.imageUrl);
    setLocations(prev => prev.filter(location => location.id !== locationId));
  };

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

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-8 py-10 text-center max-w-sm w-full">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">正在加载阅读空间</h1>
          <p className="text-sm text-slate-500">正在从本地数据库恢复书籍、世界观和插图状态。</p>
        </div>
      </div>
    );
  }

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === 'home' && <BookShelf books={books} onSelectBook={handleSelectBook} onImportBook={handleImportBook} onUpdateBookCover={handleUpdateBookCover} onGenerateBookCover={handleGenerateImportBookCover} onDeleteBook={handleDeleteBook} />}
      {view === 'reader' && currentBook && (
        <Reader 
          book={currentBook}
          characters={characters.filter(c => c.bookId === currentBook.id)}
          locations={locations.filter(l => l.bookId === currentBook.id)}
          visualSpec={visualSpec}
          availableSpecs={availableSpecs}
          imageModelId={imageModelId}
          imageModels={IMAGE_GENERATION_MODELS}
          illustrations={illustrations}
          onAddIllustration={handleAddIllustration}
          onDeleteIllustration={handleDeleteIllustration}
          onUpdateIllustration={handleUpdateIllustration}
          onDiscoverCharacter={handleDiscoverCharacter}
          onDiscoverLocation={handleDiscoverLocation}
          onDiscoverRelationships={handleDiscoverRelationships}
          onUpdateBookStyle={handleUpdateBookStyle}
          onUpdateImageModel={setImageModelId}
          onGenerateIllustration={handleGenerateIllustration}
          onOpenAssetsView={handleOpenAssetsView}
        />
      )}
      {view === 'assets' && (
        <AssetLibrary
          books={books}
          characters={characters}
          locations={locations}
          visualSpec={visualSpec}
          imageModelId={imageModelId}
          imageModels={IMAGE_GENERATION_MODELS}
          setCharacters={setCharacters}
          setLocations={setLocations}
          onGenerateAssetVisual={handleGenerateAssetVisual}
          onDeleteCharacter={handleDeleteCharacter}
          onDeleteLocation={handleDeleteLocation}
          onUpdateImageModel={setImageModelId}
          focusedBookId={currentBookId}
        />
      )}
      {view === 'relationships' && (
        <SocialNetwork 
          books={books} 
          characters={characters} 
          relationships={relationships} 
          relationshipChats={relationshipChats}
          illustrations={illustrations}
          onAddRelationship={handleAddRelationship}
          onUpdateRelationship={handleUpdateRelationship} 
          onDeleteRelationship={handleDeleteRelationship}
          onGenerateRelationshipsFromBook={handleGenerateRelationshipsFromBook}
          onUpdateRelationshipChat={handleUpdateRelationshipChat}
        />
      )}
      {view === 'settings' && (
        <div className="p-8 max-w-5xl mx-auto pb-24">
            <div className="mb-10 text-center md:text-left"><h2 className="text-3xl font-bold text-slate-900 mb-2">绘图风格管理</h2><p className="text-slate-500">管理内置风格或创建属于你自己的独特视觉语言。</p></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-8 space-y-6">
                        <div>
                          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Wand2 className="text-brand-500" size={20} /> 图片模型</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">当前模型</label>
                              <select value={imageModelId} onChange={e => setImageModelId(e.target.value as ImageGenerationModelId)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white">
                                {IMAGE_GENERATION_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                              </select>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{currentImageModel.description}</p>
                          </div>
                        </div>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus className="text-brand-500" size={20} /> 新建自定义风格</h3>
                        <form onSubmit={handleAddCustomStyle} className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">风格名称</label><input value={newStyle.label} onChange={e => setNewStyle(prev => ({...prev, label: e.target.value}))} placeholder="如：赛博朋克" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm" required /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">提示词核心</label><textarea value={newStyle.promptStyle} onChange={e => setNewStyle(prev => ({...prev, promptStyle: e.target.value}))} placeholder="描述画面的核心艺术特征..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none h-24 text-sm resize-none" required /></div>
                            <button type="submit" className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg flex items-center justify-center gap-2"><Sparkles size={18} /> 保存并启用</button>
                        </form>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">生图统计</h3>
                          <p className="text-sm text-slate-500 mt-1">统计当前浏览器内已成功发起的图片生成次数。</p>
                        </div>
                        <div className="text-xs text-slate-400">当前模型：{currentImageModel.label}</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100"><div className="text-xs text-slate-400 mb-1">总生图数</div><div className="text-2xl font-bold text-slate-900">{imageGenerationStats.total}</div></div>
                        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100"><div className="text-xs text-slate-400 mb-1">段落插图</div><div className="text-2xl font-bold text-slate-900">{imageGenerationStats.illustrations}</div></div>
                        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100"><div className="text-xs text-slate-400 mb-1">资产设定图</div><div className="text-2xl font-bold text-slate-900">{imageGenerationStats.assets}</div></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {IMAGE_GENERATION_MODELS.map(model => (
                          <div key={model.id} className={`rounded-xl border p-4 ${imageModelId === model.id ? 'border-brand-200 bg-brand-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-slate-900">{model.label}</div>
                                <div className="text-xs text-slate-500 mt-1">{model.description}</div>
                              </div>
                              <div className="text-2xl font-bold text-slate-900">{imageGenerationStats.byModel[model.id] || 0}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {imageGenerationStats.lastGeneratedAt && <div className="text-xs text-slate-400 mt-4">最近一次生图：{new Date(imageGenerationStats.lastGeneratedAt).toLocaleString()}</div>}
                    </div>
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
