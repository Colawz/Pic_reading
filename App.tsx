import React, { useState } from 'react';
import { Book, Character, Location, Illustration, VisualSpec, ViewMode } from './types';
import { VISUAL_PRESETS, SAMPLE_BOOKS, createBook } from './constants';
import { Layout } from './components/Layout';
import { Reader } from './components/Reader';
import { AssetLibrary } from './components/AssetLibrary';
import { BookShelf } from './components/BookShelf';
import { generateAssetVisual } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<ViewMode>('home');
  
  // Book Data
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  
  // Active Visual Style (for the reader session)
  const [visualSpec, setVisualSpec] = useState<VisualSpec>(VISUAL_PRESETS[0]);
  
  // Assets
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  // Illustrations state: Map paragraphId -> Illustration
  const [illustrations, setIllustrations] = useState<Record<string, Illustration>>({});

  const currentBook = books.find(b => b.id === currentBookId) || null;

  // --- Handlers ---
  const handleSelectBook = (book: Book) => {
      setCurrentBookId(book.id);
      // Set the active visual spec to the book's preferred style
      const bookPreset = VISUAL_PRESETS.find(p => p.id === book.visualSpecId);
      if (bookPreset) {
          setVisualSpec(bookPreset);
      }
      setView('reader');
  };

  const handleUpdateBookStyle = (bookId: string, styleId: string) => {
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, visualSpecId: styleId } : b));
      const newSpec = VISUAL_PRESETS.find(p => p.id === styleId);
      if (newSpec) setVisualSpec(newSpec);
  };

  const handleImportBook = (title: string, content: string) => {
      const newBook = createBook(
          `imported-${Date.now()}`,
          title,
          "我 (Imported)",
          "自定义",
          "✨",
          "watercolor_storybook", // Default style
          content
      );
      setBooks(prev => [newBook, ...prev]);
      handleSelectBook(newBook);
  };

  const handleAddIllustration = (ill: Illustration) => {
    setIllustrations(prev => ({ ...prev, [ill.id]: ill }));
  };

  const handleUpdateIllustration = (id: string, updates: Partial<Illustration>) => {
    setIllustrations(prev => {
        const existing = prev[id];
        if(!existing) return prev;
        return {
            ...prev,
            [id]: { ...existing, ...updates }
        };
    });
  };

  const handleDiscoverCharacter = (char: Character) => {
      // 1. Add with generating status
      const newChar: Character = { ...char, generationStatus: 'generating' };
      setCharacters(prev => [...prev, newChar]);

      // 2. Trigger Generation
      generateAssetVisual(newChar.visualSummary, 'character', visualSpec)
        .then(imageUrl => {
             setCharacters(prev => prev.map(c => c.id === newChar.id ? { 
                 ...c, 
                 imageUrl, 
                 locked: true, 
                 generationStatus: 'success' 
             } : c));
        })
        .catch(err => {
             console.error("Auto-gen character failed", err);
             setCharacters(prev => prev.map(c => c.id === newChar.id ? { 
                 ...c, 
                 generationStatus: 'failed' 
             } : c));
        });
  };

  const handleDiscoverLocation = (loc: Location) => {
      // 1. Add with generating status
      const newLoc: Location = { ...loc, generationStatus: 'generating' };
      setLocations(prev => [...prev, newLoc]);

      // 2. Trigger Generation
      generateAssetVisual(newLoc.description, 'location', visualSpec)
         .then(imageUrl => {
             setLocations(prev => prev.map(l => l.id === newLoc.id ? { 
                 ...l, 
                 imageUrl, 
                 locked: true, 
                 generationStatus: 'success' 
             } : l));
        })
        .catch(err => {
             console.error("Auto-gen location failed", err);
             setLocations(prev => prev.map(l => l.id === newLoc.id ? { 
                 ...l, 
                 generationStatus: 'failed' 
             } : l));
        });
  };

  // Helper to ensure we have a book if we are in reader mode
  const renderReader = () => {
      if (!currentBook) {
          return <div className="p-8 text-center text-slate-500">请先从书架选择一本书。</div>;
      }
      return (
        <Reader 
          book={currentBook}
          characters={characters.filter(c => c.bookId === currentBook.id)}
          locations={locations.filter(l => l.bookId === currentBook.id)}
          visualSpec={visualSpec}
          illustrations={illustrations}
          onAddIllustration={handleAddIllustration}
          onUpdateIllustration={handleUpdateIllustration}
          onDiscoverCharacter={handleDiscoverCharacter}
          onDiscoverLocation={handleDiscoverLocation}
          onUpdateBookStyle={handleUpdateBookStyle}
        />
      );
  };

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === 'home' && (
          <BookShelf 
            books={books} 
            onSelectBook={handleSelectBook} 
            onImportBook={handleImportBook}
          />
      )}

      {view === 'reader' && renderReader()}

      {view === 'assets' && (
        <AssetLibrary 
            books={books}
            characters={characters}
            locations={locations}
            visualSpec={visualSpec}
            setCharacters={setCharacters}
            setLocations={setLocations}
        />
      )}

      {view === 'settings' && (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">默认风格设置</h2>
            <p className="text-slate-500 mb-6 text-sm">选择一个风格作为新导入书籍的默认风格。您可以在阅读时为每本书单独修改风格。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VISUAL_PRESETS.map(preset => (
                    <div 
                        key={preset.id}
                        onClick={() => setVisualSpec(preset)}
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${visualSpec.id === preset.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <h3 className="font-bold text-lg mb-2">{preset.label}</h3>
                        <p className="text-sm text-slate-600 mb-4">{preset.promptStyle}</p>
                        <div className="text-xs bg-white p-2 rounded border border-slate-100 text-slate-400">
                            镜头: {preset.cameraLanguage}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </Layout>
  );
};

export default App;