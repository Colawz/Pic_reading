
export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  coverEmoji: string; 
  coverUrl?: string; // 新增：自定义封面图片链接
  chapters: Chapter[];
  visualSpecId: string;
}

export interface Chapter {
  id: string;
  title: string;
  paragraphs: Paragraph[];
}

export interface Paragraph {
  id: string;
  text: string;
  chapterId: string;
}

export interface VisualSpec {
  id: string;
  label: string;
  promptStyle: string;
  cameraLanguage: string;
  negatives: string;
}

export type ImageGenerationModelId =
  | 'doubao-seedream-4-5-251128'
  | 'doubao-seedream-5-0-260128';

export interface ImageGenerationStats {
  total: number;
  assets: number;
  illustrations: number;
  byModel: Record<ImageGenerationModelId, number>;
  lastGeneratedAt: string | null;
}

export interface Character {
  id: string;
  bookId: string; 
  name: string;
  description: string;
  visualSummary: string; 
  imageUrl?: string;
  referenceImageUrl?: string;
  locked: boolean;
  generationStatus?: 'idle' | 'generating' | 'success' | 'failed';
}

export interface Relationship {
  id: string;
  bookId: string;
  sourceId: string; 
  targetId: string; 
  type: string;     
  description: string;
}

export interface Location {
  id: string;
  bookId: string; 
  name: string;
  description: string;
  visualSummary: string;
  imageUrl?: string;
  referenceImageUrl?: string;
  locked: boolean;
  generationStatus?: 'idle' | 'generating' | 'success' | 'failed';
}

export interface Illustration {
  id: string;
  paragraphId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  imageUrl?: string;
  promptUsed?: string;
  extractedFacts?: NarrativeFacts;
  error?: string;
}

export interface StoredImageRecord {
  id: string;
  bookId: string;
  sourceType: 'character' | 'location' | 'illustration';
  sourceId: string;
  localUrl?: string;
  remoteUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  assistantMode?: 'companion' | 'character';
  assistantCharacterId?: string;
}

export interface RelationshipChatState {
  messages: ChatMessage[];
  scopeLabel?: string;
}

export interface NarrativeFacts {
  characters: string[];
  location: string;
  action: string;
  mood: string;
  objects: string[];
}

export interface ReaderSettings {
  wordInterval: number; 
  preGenerate: boolean;
}

export type ViewMode = 'home' | 'reader' | 'assets' | 'relationships' | 'settings';
