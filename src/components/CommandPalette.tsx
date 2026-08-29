import React, { useEffect, useState } from 'react';
import { Search, FileText, Calendar, Zap, Bot, Loader2 } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { api } from '../api';

export function CommandPalette() {
  const { blocks, setActivePageId, setMainView, refreshBlocks } = useAppContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery('');
            setError(null);
          }
          return !o;
        });
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pages = blocks.filter(b => b.type === 'page' && (b.content || '').toLowerCase().includes(query.toLowerCase()));
  const isTaskIntent = query.match(/^schedule/i) || query.match(/\d+\s*(hour|hr|minute|min)/i);
  const showAction = query.trim().length > 0 && pages.length === 0 && isTaskIntent;

  const handlePageClick = (id: string) => {
    setActivePageId(id);
    setMainView('workspace');
    setOpen(false);
  };

  const handleActionClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.askAI([{ role: 'user', text: query }], blocks, false);
      await refreshBlocks();
      setOpen(false);
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to execute command');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]">
      <div className="bg-[#111113] w-full max-w-xl rounded-xl border border-[#2D2D30] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#1F1F21]">
          {loading ? (
             <Loader2 className="w-5 h-5 text-blue-400 mr-3 animate-spin" />
          ) : (
             <Search className="w-5 h-5 text-[#71717A] mr-3" />
          )}
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, Slash command or ask Gemini... (Cmd+K)"
            className="flex-1 bg-transparent border-none text-white focus:outline-none text-base placeholder:text-[#52525B]"
            disabled={loading}
          />
          <div className="px-2 py-1 bg-[#1A1A1C] rounded text-[10px] text-[#52525B] font-medium flex items-center gap-1">
            <Bot className="w-3 h-3" /> Gemini AI
          </div>
        </div>
        
        {error && (
           <div className="px-4 py-2 bg-red-900/30 border-b border-red-900/50 text-red-400 text-sm">
             {error}
           </div>
        )}

        <div className="p-2 space-y-1 overflow-y-auto max-h-[60vh]">
          {pages.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-[#52525B] uppercase tracking-wider">Pages</div>
              {pages.map(page => (
                <button key={page.id} onClick={() => handlePageClick(page.id)} className="w-full text-left px-3 py-3 rounded-lg hover:bg-[#1A1A1C] flex items-center gap-3 text-sm text-[#D1D1D1] transition-colors">
                  <div className="w-8 h-8 rounded-md bg-[#1F1F21] flex items-center justify-center border border-[#2D2D30]">
                    <FileText className="w-4 h-4 text-[#A1A1AA]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white">{page.content || 'Untitled'}</div>
                    <div className="text-xs text-[#71717A]">Workspace</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {showAction && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-[#52525B] uppercase tracking-wider">Suggested Actions</div>
              <button 
                onClick={handleActionClick} 
                disabled={loading}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-[#1A1A1C] flex items-center gap-3 text-sm text-[#D1D1D1] transition-colors disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  {loading ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Bot className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <div className="text-white">Run AI Command</div>
                  <div className="text-xs text-[#71717A]">"{query}"</div>
                </div>
              </button>
            </>
          )}

          {query.length > 0 && pages.length === 0 && !showAction && (
             <div className="px-4 py-8 text-center text-sm text-[#52525B]">
               No matching pages or commands found.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
