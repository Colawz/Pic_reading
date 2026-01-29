export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  coverEmoji: string; // Simple placeholder for cover
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

export interface Character {
  id: string;
  bookId: string; // Linked to a specific book
  name: string;
  description: string;
  visualSummary: string; // Condensed string for prompts
  imageUrl?: string; // Reference image (e.g. generated turnaround)
  locked: boolean;
  generationStatus?: 'idle' | 'generating' | 'success' | 'failed';
}

export interface Location {
  id: string;
  bookId: string; // Linked to a specific book
  name: string;
  description: string;
  visualSummary: string;
  imageUrl?: string;
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

export interface NarrativeFacts {
  characters: string[];
  location: string;
  action: string;
  mood: string;
  objects: string[];
}

export interface ReaderSettings {
  generationInterval: number; // 0 = manual, 5, 10, 15
  preGenerate: boolean;
}

export type ViewMode = 'home' | 'reader' | 'assets' | 'settings';
