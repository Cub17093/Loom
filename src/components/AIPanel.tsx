import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { Sparkles, Send, Brain, Bot, Network, FileSearch, Trash2, CheckCircle2, PanelRightClose } from 'lucide-react';
import { api } from '../api';

export function AIPanel() {
  const { blocks, activePageId, refreshBlocks, setIsAIPanelOpen } = useAppContext();
  const [mode, setMode] = useState<'ask' | 'notebook'>('ask');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user'|'ai', text: string, actionsTaken?: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [lastGrounding, setLastGrounding] = useState<{mode: string, count: number} | null>(null);

  // Clear conversation when context changes (Bug #8 fix)
  useEffect(() => {
    setHistory([]);
    setLastGrounding(null);
  }, [activePageId, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const newHistory = [...history, { role: 'user' as const, text: userText }];
    setHistory(newHistory);
    setLoading(true);

    try {
      let contextBlocks = [];
      if (mode === 'ask' && activePageId) {
        contextBlocks = blocks.filter(b => b.id === activePageId || b.parentId === activePageId);
      } else if (mode === 'notebook') {
        contextBlocks = blocks;
      }

      const res = await api.askAI(newHistory, contextBlocks, useThinking);
      setHistory((prev) => [...prev, { role: 'ai', text: res.result, actionsTaken: res.actionsTaken }]);
      
      if (res.groundedMode !== undefined && res.groundedCount !== undefined) {
        setLastGrounding({ mode: res.groundedMode, count: res.groundedCount });
      }
      
      if (res.actionsTaken && res.actionsTaken.length > 0) {
        await refreshBlocks();
      }
    } catch (err: any) {
      const errorMsg = err.message || "My circuits are a bit scrambled, I encountered an unexpected error.";
      setHistory((prev) => [...prev, { role: 'ai', text: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-72 bg-[#0D0D0E] border-l border-[#1F1F21] flex flex-col h-full">
      <div className="p-4 border-b border-[#1F1F21] flex items-center justify-between relative bg-gradient-to-r from-[#0D0D0E] to-[#151517]">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsAIPanelOpen(false)} className="p-1 text-[#52525B] hover:text-white transition-colors" title="Close AI panel">
            <PanelRightClose className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-1">
            <Bot className="w-3 h-3 text-blue-400" /> GEMINI ORCHESTRATION
          </div>
        </div>
        
        {history.length > 0 && (
          <button 
            onClick={() => {
              setHistory([]);
              setLastGrounding(null);
            }}
            title="Clear Conversation"
            className="p-1.5 text-[#52525B] hover:text-white bg-[#151517] rounded-md transition-colors border border-[#1F1F21]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-[#1F1F21] flex flex-col gap-2 relative">
        <div className="flex justify-center gap-1">
          <button onClick={() => setMode('ask')} className={"flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded " + (mode === 'ask' ? 'text-white bg-[#1A1A1C]' : 'text-[#52525B] hover:text-white')}>Context</button>
          <button onClick={() => setMode('notebook')} className={"flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded " + (mode === 'notebook' ? 'text-white bg-[#1A1A1C]' : 'text-[#52525B] hover:text-white')}>Global Graph</button>
        </div>
        <div className="text-center text-[10px] text-[#52525B]">
          {lastGrounding ? (
            <>Grounded on {lastGrounding.count} blocks ({lastGrounding.mode})</>
          ) : (
            <>
              Grounded on {
                mode === 'ask' && activePageId 
                  ? blocks.filter(b => b.id === activePageId || b.parentId === activePageId).length 
                  : blocks.length
              } blocks ({(mode === 'notebook' && blocks.length > 40) ? 'summarized' : 'full'})
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
        {history.length === 0 ? (
          <div className="text-center text-[#52525B] py-10">
            {mode === 'ask' ? <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" /> : <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-50" />}
            <p>{mode === 'ask' ? 'Ask me anything about this page.' : 'Ask me anything across all your spaces.'}</p>
          </div>
        ) : (
          history.map((msg, i) => (
            <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={"max-w-[90%] rounded-lg p-4 text-xs leading-relaxed " + (msg.role === 'user' ? 'bg-[#1A1A1C] border border-[#2D2D30] text-white' : 'bg-[#111113] border border-[#1F1F21] text-[#A1A1AA]')}>
                {msg.text}
                {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-[#1F1F21] pt-3">
                    {msg.actionsTaken.map((act: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded w-fit border border-blue-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {act.type === 'created_task' && `Created task: ${act.title}`}
                          {act.type === 'created_and_scheduled_task' && `Created and scheduled task: ${act.title}`}
                          {act.type === 'update_task_status' && `Updated task status to ${act.status}`}
                          {act.type === 'scheduled_tasks' && `Scheduled ${act.count} tasks`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#111113] border border-[#1F1F21] rounded-lg p-4 text-[#A1A1AA] flex gap-1">
              <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#1F1F21]">
        <label className="flex items-center gap-2 text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors mb-3 cursor-pointer select-none">
          <input type="checkbox" checked={useThinking} onChange={(e) => setUseThinking(e.target.checked)} className="rounded border-[#2D2D30] bg-[#0A0A0B] text-blue-500 focus:ring-blue-500/20" />
          <Brain className="w-3.5 h-3.5" /> High Thinking
        </label>
        <form onSubmit={handleSubmit} className="flex relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up..."
            className="w-full bg-[#0A0A0B] border border-[#1F1F21] rounded p-2 px-3 text-[11px] italic text-[#D1D1D1] placeholder:text-[#52525B] focus:outline-none focus:border-[#2D2D30] transition-colors pr-8"
          />
          <button type="submit" disabled={!input.trim() || loading} className="absolute right-2 top-2 text-[#52525B] hover:text-[#D1D1D1] disabled:opacity-50 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
