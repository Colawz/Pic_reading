
import React from 'react';
import { BookOpen, Image, Settings, Sparkles, Home, Share2 } from 'lucide-react';
import { ViewMode } from '../types';

interface LayoutProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-10">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
            <Sparkles className="text-brand-600" size={24} />
            <span className="hidden lg:block ml-3 font-bold text-lg tracking-tight text-slate-800">智绘阅读</span>
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => onNavigate('home')}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${currentView === 'home' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Home size={20} />
              <span className="hidden lg:block ml-3 font-medium">书架</span>
            </button>
            
            <button
              onClick={() => onNavigate('reader')}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${currentView === 'reader' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <BookOpen size={20} />
              <span className="hidden lg:block ml-3 font-medium">阅读</span>
            </button>
            <button
              onClick={() => onNavigate('assets')}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${currentView === 'assets' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Image size={20} />
              <span className="hidden lg:block ml-3 font-medium">资产库</span>
            </button>
            <button
              onClick={() => onNavigate('relationships')}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${currentView === 'relationships' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Share2 size={20} />
              <span className="hidden lg:block ml-3 font-medium">关系网</span>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Settings size={20} />
              <span className="hidden lg:block ml-3 font-medium">风格设置</span>
            </button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-100 hidden lg:block">
            <div className="text-xs text-slate-400">
                <p>v0.3.0 Beta</p>
                <p className="mt-1">Powered by Gemini</p>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative">
        <div className="h-full overflow-y-auto scroll-smooth">
            {children}
        </div>
      </main>
    </div>
  );
};
