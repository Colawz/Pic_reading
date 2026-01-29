
import React, { useState, useMemo } from 'react';
import { Character, Relationship, Book } from '../types';
import { User, Share2, Info, ArrowRight, Edit2, Check, X } from 'lucide-react';

interface SocialNetworkProps {
  books: Book[];
  characters: Character[];
  relationships: Relationship[];
  onUpdateRelationship: (id: string, updates: Partial<Relationship>) => void;
}

export const SocialNetwork: React.FC<SocialNetworkProps> = ({
  books,
  characters,
  relationships,
  onUpdateRelationship
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || 'all');
  const [focusedCharId, setFocusedCharId] = useState<string | null>(null);
  
  // Editing state
  const [editingRelId, setEditingRelId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const filteredBooks = books;
  
  const bookCharacters = useMemo(() => 
    selectedBookId === 'all' ? characters : characters.filter(c => c.bookId === selectedBookId),
    [characters, selectedBookId]
  );

  const bookRelationships = useMemo(() => 
    selectedBookId === 'all' ? relationships : relationships.filter(r => r.bookId === selectedBookId),
    [relationships, selectedBookId]
  );

  const activeChar = useMemo(() => 
    bookCharacters.find(c => c.id === focusedCharId) || bookCharacters[0],
    [bookCharacters, focusedCharId]
  );

  // Radiant Graph Layout Logic (Simple Circle)
  const relatedLinks = useMemo(() => {
    if (!activeChar) return [];
    return bookRelationships.filter(r => r.sourceId === activeChar.id || r.targetId === activeChar.id);
  }, [activeChar, bookRelationships]);

  const radiantNodes = useMemo(() => {
    if (!activeChar) return [];
    const neighbors = new Set<string>();
    relatedLinks.forEach(rel => {
      neighbors.add(rel.sourceId === activeChar.id ? rel.targetId : rel.sourceId);
    });
    return bookCharacters.filter(c => neighbors.has(c.id));
  }, [activeChar, bookCharacters, relatedLinks]);

  const handleStartEdit = (rel: Relationship) => {
    setEditingRelId(rel.id);
    setEditType(rel.type);
    setEditDesc(rel.description);
  };

  const handleCancelEdit = () => {
    setEditingRelId(null);
  };

  const handleSaveEdit = () => {
    if (editingRelId) {
      onUpdateRelationship(editingRelId, {
        type: editType,
        description: editDesc
      });
      setEditingRelId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">角色社会关系图</h2>
            <p className="text-slate-500">追踪角色之间的羁绊、冲突与成长轨迹。</p>
        </div>
        <select 
          value={selectedBookId} 
          onChange={(e) => {
            setSelectedBookId(e.target.value);
            setFocusedCharId(null);
          }} 
          className="px-3 py-2 rounded-lg border bg-white text-sm focus:ring-2 focus:ring-brand-500"
        >
          {filteredBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden min-h-[600px]">
        {/* Left: Character List */}
        <div className="w-64 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shrink-0">
          <div className="p-4 border-b bg-slate-50 font-bold text-sm text-slate-700">角色列表</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {bookCharacters.map(char => (
              <button
                key={char.id}
                onClick={() => setFocusedCharId(char.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  (focusedCharId === char.id || (!focusedCharId && activeChar?.id === char.id))
                    ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                  {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" /> : <User className="p-1 text-slate-300" />}
                </div>
                <span className="font-medium truncate">{char.name}</span>
              </button>
            ))}
            {bookCharacters.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  阅读新章节时 AI 会自动发现角色并记录关系。
                </div>
            )}
          </div>
        </div>

        {/* Center: Radiant Graph */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-500 flex items-center gap-2">
            <Share2 size={12} /> 点击角色或节点切换视角
          </div>

          <div className="flex-1 relative flex items-center justify-center">
            {activeChar ? (
              <div className="relative w-full h-full">
                {/* SVG for connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {radiantNodes.map((node, i) => {
                    const angle = (i / radiantNodes.length) * 2 * Math.PI;
                    const radius = 180;
                    const x2 = `calc(50% + ${Math.cos(angle) * radius}px)`;
                    const y2 = `calc(50% + ${Math.sin(angle) * radius}px)`;
                    
                    return (
                      <line 
                        key={node.id} 
                        x1="50%" y1="50%" 
                        x2={x2} y2={y2} 
                        stroke="#cbd5e1" 
                        strokeWidth="2" 
                        strokeDasharray="5,5"
                        className="animate-pulse"
                      />
                    );
                  })}
                </svg>

                {/* Nodes */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Central Node */}
                  <div className="z-20 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-brand-500 shadow-xl overflow-hidden bg-white mb-2 scale-110 transition-transform hover:scale-125">
                       {activeChar.imageUrl ? <img src={activeChar.imageUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 text-slate-300" />}
                    </div>
                    <div className="bg-brand-600 text-white px-4 py-1 rounded-full font-bold shadow-lg">{activeChar.name}</div>
                  </div>

                  {/* Satellite Nodes */}
                  {radiantNodes.map((node, i) => {
                    const angle = (i / radiantNodes.length) * 2 * Math.PI;
                    const radius = 180;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const relationship = relatedLinks.find(r => r.sourceId === node.id || r.targetId === node.id);

                    return (
                      <div 
                        key={node.id} 
                        className="absolute z-10 flex flex-col items-center group cursor-pointer"
                        style={{ transform: `translate(${x}px, ${y}px)` }}
                        onClick={() => setFocusedCharId(node.id)}
                      >
                        <div className="w-16 h-16 rounded-full border-2 border-slate-200 shadow-md overflow-hidden bg-white group-hover:border-brand-400 transition-all group-hover:scale-110">
                           {node.imageUrl ? <img src={node.imageUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-slate-200" />}
                        </div>
                        <div className="mt-2 bg-white px-2 py-0.5 rounded border border-slate-100 text-[10px] font-bold text-slate-600 shadow-sm group-hover:bg-brand-50 group-hover:text-brand-700">{node.name}</div>
                        
                        {/* Relationship Label Floating */}
                        <div className="absolute -top-10 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                          {relationship?.type || '关联'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-slate-300 flex flex-col items-center gap-4">
                <Share2 size={64} className="opacity-20" />
                <p className="text-sm font-medium">暂无角色数据，请在阅读器中扫描资产</p>
              </div>
            )}
          </div>

          {/* Bottom Relationship Log */}
          <div className="h-48 border-t bg-slate-50 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b bg-white flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
               <Info size={14} /> 关系详情: {activeChar?.name}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {relatedLinks.map(rel => {
                const isEditing = editingRelId === rel.id;
                const otherId = rel.sourceId === activeChar?.id ? rel.targetId : rel.sourceId;
                const otherChar = bookCharacters.find(c => c.id === otherId);
                
                return (
                  <div key={rel.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-start gap-3 shadow-sm hover:border-slate-300 transition-colors">
                    {isEditing ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input 
                            value={editType} 
                            onChange={e => setEditType(e.target.value)} 
                            className="text-[10px] font-bold px-2 py-1 border rounded bg-slate-50 focus:ring-1 focus:ring-brand-500 outline-none w-24" 
                            placeholder="关系类型"
                          />
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            {activeChar?.name} <ArrowRight size={10} className="text-slate-300" /> {otherChar?.name}
                          </div>
                        </div>
                        <textarea 
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)}
                          className="w-full text-[11px] text-slate-600 p-2 border rounded bg-slate-50 focus:ring-1 focus:ring-brand-500 outline-none min-h-[40px] leading-relaxed"
                          placeholder="描述角色间的联系..."
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X size={16} />
                          </button>
                          <button 
                            onClick={handleSaveEdit}
                            className="p-1 text-brand-600 hover:text-brand-700 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-bold shrink-0">{rel.type}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 flex items-center justify-between gap-1 group/item">
                            <span className="flex items-center gap-1">
                              {activeChar?.name} <ArrowRight size={10} className="text-slate-300" /> {otherChar?.name}
                            </span>
                            <button 
                              onClick={() => handleStartEdit(rel)}
                              className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-brand-600 transition-all p-1"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed">{rel.description}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {relatedLinks.length === 0 && activeChar && (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                    尚未发现该角色的具体社会关系...
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
