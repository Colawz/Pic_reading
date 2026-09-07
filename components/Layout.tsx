
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
      <aside className="hidden md:flex w-20 lg:w-64 bg-white border-r border-slate-200 flex-col justify-between z-10">
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
              <span className="hidden lg:block ml-3 font-medium">世界观</span>
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
                <p className="mt-1">Created by Colawz</p>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative pb-20 md:pb-0">
        <div className={`h-full ${currentView === 'reader' ? 'overflow-hidden' : 'overflow-y-auto scroll-smooth'}`}>
            {children}
        </div>
      </main>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          <button
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${currentView === 'home' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
          >
            <Home size={18} />
            <span className="mt-1">书架</span>
          </button>
          <button
            onClick={() => onNavigate('reader')}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${currentView === 'reader' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
          >
            <BookOpen size={18} />
            <span className="mt-1">阅读</span>
          </button>
          <button
            onClick={() => onNavigate('assets')}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${currentView === 'assets' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
          >
            <Image size={18} />
            <span className="mt-1">世界观</span>
          </button>
          <button
            onClick={() => onNavigate('relationships')}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${currentView === 'relationships' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
          >
            <Share2 size={18} />
            <span className="mt-1">关系网</span>
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${currentView === 'settings' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}
          >
            <Settings size={18} />
            <span className="mt-1">设置</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
