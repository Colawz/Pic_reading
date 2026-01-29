
import React, { useState, useMemo } from 'react';
import { Character, Relationship, Book } from '../types';
import { User, Share2, Info, ArrowRight, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';

interface SocialNetworkProps {
  books: Book[];
  characters: Character[];
  relationships: Relationship[];
  onAddRelationship: (rel: Relationship) => void;
  onUpdateRelationship: (id: string, updates: Partial<Relationship>) => void;
  onDeleteRelationship: (id: string) => void;
}

export const SocialNetwork: React.FC<SocialNetworkProps> = ({
  books,
  characters,
  relationships,
  onAddRelationship,
  onUpdateRelationship,
  onDeleteRelationship
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || 'all');
  const [focusedCharId, setFocusedCharId] = useState<string | null>(null);
  
  // Creation state
  const [isAddingRel, setIsAddingRel] = useState(false);
  const [newRelSourceId, setNewRelSourceId] = useState('');
  const [newRelTargetId, setNewRelTargetId] = useState('');
  const [newRelType, setNewRelType] = useState('');
  const [newRelDesc, setNewRelDesc] = useState('');

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

  const activeChar = useMemo(() => {
    if (focusedCharId) {
      return bookCharacters.find(c => c.id === focusedCharId);
    }
    return bookCharacters[0];
  }, [bookCharacters, focusedCharId]);

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRelSourceId && newRelTargetId && newRelType && newRelSourceId !== newRelTargetId) {
      const newRel: Relationship = {
        id: `rel-${Date.now()}`,
        bookId: selectedBookId === 'all' ? books[0].id : selectedBookId,
        sourceId: newRelSourceId,
        targetId: newRelTargetId,
        type: newRelType,
        description: newRelDesc
      };
      onAddRelationship(newRel);
      setIsAddingRel(false);
      setNewRelType('');
      setNewRelDesc('');
      setNewRelSourceId('');
      setNewRelTargetId('');
    }
  };

  // Node position constant
  const RADIUS = 220;

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">角色社会关系图</h2>
            <p className="text-slate-500">追踪角色之间的羁绊、冲突与成长轨迹。</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsAddingRel(true);
              setNewRelSourceId(activeChar?.id || '');
            }} 
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 transition-colors"
          >
            <Plus size={18} /> 新增关系
          </button>
          <select 
            value={selectedBookId} 
            onChange={(e) => {
              setSelectedBookId(e.target.value);
              setFocusedCharId(null);
            }} 
            className="px-3 py-2 rounded-lg border bg-white text-sm focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">所有书籍</option>
            {filteredBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden min-h-[600px]">
        {/* Left: Character List */}
        <div className="w-64 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shrink-0">
          <div className="p-4 border-b bg-slate-50 font-bold text-sm text-slate-700">选择视角</div>
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
                  暂无角色。阅读新章节时 AI 会自动发现。
                </div>
            )}
          </div>
        </div>

        {/* Center: Radiant Graph */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-500 flex items-center gap-2">
            <Share2 size={12} /> 点击角色节点切换视角
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {activeChar ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* SVG for connections - Fixed coordinate system */}
                <svg 
                  viewBox="-500 -500 1000 1000" 
                  className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                >
                  {radiantNodes.map((node, i) => {
                    const angle = (i / radiantNodes.length) * 2 * Math.PI;
                    const x = Math.cos(angle) * RADIUS;
                    const y = Math.sin(angle) * RADIUS;
                    
                    const relationship = relatedLinks.find(r => (r.sourceId === node.id && r.targetId === activeChar.id) || (r.targetId === node.id && r.sourceId === activeChar.id));
                    
                    return (
                      <g key={node.id}>
                        {/* Connection Line from center (0,0) to node (x,y) */}
                        <line 
                          x1="0" y1="0" 
                          x2={x} y2={y} 
                          stroke="#e2e8f0" 
                          strokeWidth="2.5" 
                          strokeDasharray="6,4"
                        />
                        {/* Relationship Label - Strictly centered on line */}
                        <g transform={`translate(${x / 2}, ${y / 2})`}>
                          <foreignObject 
                            x="-50" y="-14" 
                            width="100" 
                            height="28"
                            style={{ overflow: 'visible' }}
                          >
                            <div className="flex items-center justify-center h-full w-full pointer-events-auto">
                              <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-brand-600 shadow-sm whitespace-nowrap">
                                {relationship?.type || '关联'}
                              </span>
                            </div>
                          </foreignObject>
                        </g>
                      </g>
                    );
                  })}
                </svg>

                {/* Central Node */}
                <div className="absolute z-20 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full border-4 border-brand-500 shadow-2xl overflow-hidden bg-white mb-2 ring-4 ring-brand-50 ring-offset-2">
                     {activeChar.imageUrl ? <img src={activeChar.imageUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 text-slate-300" />}
                  </div>
                  <div className="bg-brand-600 text-white px-5 py-1.5 rounded-full font-bold shadow-lg text-sm tracking-wide">{activeChar.name}</div>
                </div>

                {/* Satellite Nodes */}
                {radiantNodes.map((node, i) => {
                  const angle = (i / radiantNodes.length) * 2 * Math.PI;
                  const x = Math.cos(angle) * RADIUS;
                  const y = Math.sin(angle) * RADIUS;

                  return (
                    <div 
                      key={node.id} 
                      className="absolute z-10 flex flex-col items-center group cursor-pointer transition-transform duration-300 hover:scale-105"
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      onClick={() => setFocusedCharId(node.id)}
                    >
                      <div className="w-16 h-16 rounded-full border-2 border-slate-200 shadow-lg overflow-hidden bg-white group-hover:border-brand-400 group-hover:shadow-brand-100 transition-all">
                         {node.imageUrl ? <img src={node.imageUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-slate-200" />}
                      </div>
                      <div className="mt-2.5 bg-white/90 backdrop-blur px-3 py-0.5 rounded-lg border border-slate-100 text-[11px] font-bold text-slate-700 shadow-sm group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:border-brand-200">
                        {node.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-300 flex flex-col items-center gap-4">
                <Share2 size={64} className="opacity-20" />
                <p className="text-sm font-medium">暂无角色数据，请在阅读器中扫描资产</p>
              </div>
            )}
          </div>

          {/* Bottom Relationship Log */}
          <div className="h-56 border-t bg-slate-50 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b bg-white flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
               <div className="flex items-center gap-2">
                 <Info size={14} /> 关系详情: {activeChar?.name}
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {relatedLinks.map(rel => {
                const isEditing = editingRelId === rel.id;
                const otherId = rel.sourceId === activeChar?.id ? rel.targetId : rel.sourceId;
                const otherChar = bookCharacters.find(c => c.id === otherId);
                
                return (
                  <div key={rel.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-4 shadow-sm group/item">
                    {isEditing ? (
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <input 
                            value={editType} 
                            onChange={e => setEditType(e.target.value)} 
                            className="text-xs font-bold px-3 py-1.5 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-brand-500 outline-none w-32" 
                            placeholder="如: 师徒"
                          />
                          <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {activeChar?.name} <ArrowRight size={12} className="text-slate-300" /> {otherChar?.name}
                          </div>
                        </div>
                        <textarea 
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)}
                          className="w-full text-xs text-slate-600 p-2.5 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-brand-500 outline-none min-h-[60px] leading-relaxed"
                          placeholder="描述具体互动..."
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={handleCancelEdit} className="px-3 py-1 text-slate-500 text-xs font-medium hover:bg-slate-100 rounded-lg">取消</button>
                          <button onClick={handleSaveEdit} className="px-3 py-1 bg-brand-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-brand-700">保存修改</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-[10px] font-bold border border-brand-100 shrink-0 self-start">{rel.type}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 flex items-center justify-between group/title">
                            <span className="flex items-center gap-2">
                              {activeChar?.name} <ArrowRight size={12} className="text-slate-300" /> {otherChar?.name}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                              <button onClick={() => handleStartEdit(rel)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => onDeleteRelationship(rel.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{rel.description}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {relatedLinks.length === 0 && activeChar && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                    <Share2 size={32} className="opacity-10 mb-2" />
                    <p className="text-xs italic">尚未定义该角色的任何关系。</p>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Relationship Modal */}
      {isAddingRel && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-bold text-lg text-slate-800">建立新关系</h3>
                   <button onClick={() => setIsAddingRel(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
               </div>
               <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色 A</label>
                        <select 
                          value={newRelSourceId} 
                          onChange={e => setNewRelSourceId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                          required
                        >
                          <option value="">请选择...</option>
                          {bookCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色 B</label>
                        <select 
                          value={newRelTargetId} 
                          onChange={e => setNewRelTargetId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                          required
                        >
                          <option value="">请选择...</option>
                          {bookCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">关系名称 (如: 夫妻, 宿敌)</label>
                       <input 
                         type="text" 
                         value={newRelType}
                         onChange={e => setNewRelType(e.target.value)}
                         className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                         placeholder="输入简短的关系标签"
                         required
                       />
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">关系描述</label>
                       <textarea 
                         value={newRelDesc}
                         onChange={e => setNewRelDesc(e.target.value)}
                         className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
                         placeholder="详细描述双方的互动或背景故事..."
                       />
                   </div>
                   <div className="pt-2 flex justify-end gap-3">
                       <button type="button" onClick={() => setIsAddingRel(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-50 rounded-lg transition-colors">取消</button>
                       <button type="submit" className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg shadow-lg hover:bg-brand-700 active:scale-[0.98] transition-all">创建连接</button>
                   </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};
