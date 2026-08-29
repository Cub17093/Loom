import { getAccessToken } from "../auth";
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../AppContext';
import { CheckSquare, Type, MoreVertical, Import, Cloud, Plus, ChevronUp, ChevronDown, Calendar, Database, FileText, Zap, Bot } from 'lucide-react';
import { workspaceApi } from '../workspace';

export function Canvas() {
  const { blocks, activePageId, updateBlock, createBlock, deleteBlock, setActivePageId, activeSpaceId } = useAppContext();
  const [importing, setImporting] = useState(false);
  const [slashMenuId, setSlashMenuId] = useState<string | null>(null);

  if (!activePageId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0B]">
        <div className="text-center text-[#52525B]">
          <p>Select a page or create a new one to start writing.</p>
        </div>
      </div>
    );
  }

  const page = blocks.find((b) => b.id === activePageId);
  const children = blocks.filter((b) => b.parentId === activePageId).sort((a, b) => a.createdAt - b.createdAt);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateBlock(activePageId, { content: e.target.value });
  };

  const addParagraph = async () => {
    await createBlock({
      type: 'paragraph',
      content: '',
      parentId: activePageId,
    });
  };

  const handleBlockChange = (id: string, content: string) => {
    if (content.endsWith('/')) {
      setSlashMenuId(id);
    } else {
      setSlashMenuId(null);
    }
    updateBlock(id, { content });
  };

  const executeSlashCommand = async (type: string, id: string) => {
    setSlashMenuId(null);
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    
    // Remove the trailing slash
    const cleanContent = block.content.slice(0, -1);
    
    if (type === 'task') {
      updateBlock(id, { type: 'task', content: cleanContent, properties: { status: 'todo' } });
    } else if (type === 'event') {
      updateBlock(id, { type: 'event', content: cleanContent || 'New Event', properties: { date: new Date().toISOString() } });
    } else if (type === 'database-view') {
      updateBlock(id, { type: 'database-view', content: cleanContent || 'Database View' });
    } else if (type === 'sub-page') {
      const newPage = await createBlock({
        type: 'page',
        content: cleanContent || 'Untitled Sub-Page',
        parentId: activePageId,
      });
      // Delete the placeholder block
      deleteBlock(id);
      setActivePageId(newPage.id);
    }
  };

  const convertToTask = (id: string) => {
    updateBlock(id, { type: 'task', properties: { status: 'todo' } });
  };

  const handleImport = async (source: 'drive' | 'gmail' | 'calendar' | 'tasks' | 'docs') => {
    if (!await getAccessToken()) {
      alert('Please sign in with Google in the sidebar before importing data.');
      return;
    }
    setImporting(true);
    try {
      if (source === 'drive') await workspaceApi.importDriveFiles(activePageId);
      if (source === 'gmail') await workspaceApi.importGmail(activePageId);
      if (source === 'calendar') await workspaceApi.importCalendar(activePageId);
      if (source === 'tasks') await workspaceApi.importTasks(activePageId);
      if (source === 'docs') await workspaceApi.importDocs(activePageId);
    } catch (e) {
      console.error(e);
      alert('Import failed. Your session may have expired. Please sign out and sign back in.');
    } finally {
      setImporting(false);
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const current = children[index];
      const previous = children[index - 1];
      const tempTime = current.createdAt;
      updateBlock(current.id, { createdAt: previous.createdAt });
      updateBlock(previous.id, { createdAt: tempTime });
    } else if (direction === 'down' && index < children.length - 1) {
      const current = children[index];
      const next = children[index + 1];
      const tempTime = current.createdAt;
      updateBlock(current.id, { createdAt: next.createdAt });
      updateBlock(next.id, { createdAt: tempTime });
    }
  };

  return (
    <div className="flex-1 bg-[#0A0A0B] overflow-y-auto relative">
      {/* Header / Breadcrumbs */}
      <header className="h-14 border-b border-[#1F1F21] px-8 flex items-center justify-between sticky top-0 bg-[#0A0A0B]/90 backdrop-blur z-10">
        <div className="flex items-center gap-2 text-xs text-[#52525B]">
          <span>Spaces</span>
          <span>/</span>
          <span className="text-white">{page?.content || 'Untitled'}</span>
        </div>
      </header>
      
      <div className="max-w-3xl mx-auto py-16 px-8">
        <input
          type="text"
          value={page?.content || ''}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="text-4xl font-serif font-light text-white mb-8 tracking-tight italic bg-transparent border-none w-full focus:outline-none placeholder:text-[#3F3F46]"
        />

        <div className="flex flex-wrap gap-2 mb-8 border-b border-[#1F1F21] pb-6">
          <button onClick={() => handleImport('drive')} disabled={importing} className="bg-[#1F1F21] text-white px-3 py-1.5 rounded border border-[#2D2D30] hover:bg-[#2D2D30] transition-colors text-xs flex items-center gap-2">
            <Cloud className="w-3 h-3" /> Import Drive
          </button>
          <button onClick={() => handleImport('gmail')} disabled={importing} className="bg-[#1F1F21] text-white px-3 py-1.5 rounded border border-[#2D2D30] hover:bg-[#2D2D30] transition-colors text-xs flex items-center gap-2">
            <Import className="w-3 h-3" /> Import Gmail
          </button>
          <button onClick={() => handleImport('calendar')} disabled={importing} className="bg-[#1F1F21] text-white px-3 py-1.5 rounded border border-[#2D2D30] hover:bg-[#2D2D30] transition-colors text-xs flex items-center gap-2">
            <Import className="w-3 h-3" /> Import Calendar
          </button>
          <button onClick={() => handleImport('tasks')} disabled={importing} className="bg-[#1F1F21] text-white px-3 py-1.5 rounded border border-[#2D2D30] hover:bg-[#2D2D30] transition-colors text-xs flex items-center gap-2">
            <CheckSquare className="w-3 h-3" /> Import Tasks
          </button>
          <button onClick={() => handleImport('docs')} disabled={importing} className="bg-[#1F1F21] text-white px-3 py-1.5 rounded border border-[#2D2D30] hover:bg-[#2D2D30] transition-colors text-xs flex items-center gap-2">
            <Type className="w-3 h-3" /> Import Docs
          </button>
        </div>

        <div className="space-y-4">
          {children.map((block, index) => (
            <div key={block.id} className={"group relative flex items-start gap-3 " + (block.type === 'task' ? 'p-4 bg-[#111113] border border-[#1F1F21] rounded-lg mb-2' : 'py-1')}>
              <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 flex flex-col items-center">
                <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="text-[#3F3F46] hover:text-white disabled:opacity-30 p-0.5">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveBlock(index, 'down')} disabled={index === children.length - 1} className="text-[#3F3F46] hover:text-white disabled:opacity-30 p-0.5">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              
              {block.type === 'task' && (
                <button
                  onClick={() => updateBlock(block.id, { properties: { ...block.properties, status: block.properties?.status === 'done' ? 'todo' : 'done' } })}
                  className={"mt-1 flex-shrink-0 w-5 h-5 border rounded flex items-center justify-center transition-colors " + (block.properties?.status === 'done' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-[#3F3F46] hover:border-[#52525B]')}
                >
                  {block.properties?.status === 'done' && <CheckSquare className="w-3.5 h-3.5" />}
                </button>
              )}
              {block.type === 'event' && <div className="mt-1 p-1 bg-[#1A1A1C] rounded border border-[#2D2D30]"><Calendar className="w-4 h-4 text-blue-400" /></div>}
              {block.type === 'database-view' && <div className="mt-1 p-1 bg-[#1A1A1C] rounded border border-[#2D2D30]"><Database className="w-4 h-4 text-purple-400" /></div>}
              {block.type === 'drive' && <div className="mt-1 p-1 bg-[#1A1A1C] rounded border border-[#2D2D30]"><Cloud className="w-4 h-4 text-[#A1A1AA]" /></div>}

              <div className="flex-1 relative flex flex-col">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, e.target.value)}
                    placeholder={block.type === 'paragraph' ? "Type '/' for commands" : ''}
                    className={"w-full bg-transparent border-none focus:outline-none focus:bg-[#1A1A1C] rounded p-1 transition-colors " + (
                      block.type === 'task' 
                        ? (block.properties?.status === 'done' ? 'line-through text-[#52525B]' : 'text-white font-medium text-sm')
                        : 'text-lg leading-relaxed text-[#A1A1AA] font-serif placeholder:text-[#3F3F46] placeholder:font-sans placeholder:text-sm'
                    )}
                  />
                  {block.type === 'task' && block.properties?.source === 'pipeline' && (
                    <div title="Created by automation" className="flex items-center justify-center p-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shrink-0">
                      <Zap className="w-3 h-3" />
                    </div>
                  )}
                  {block.type === 'task' && block.properties?.source === 'ai' && (
                    <div title="Created by AI assistant" className="flex items-center justify-center p-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Bot className="w-3 h-3" />
                    </div>
                  )}
                </div>
                
                {block.type === 'event' && block.properties?.date && (
                   <span className="text-xs text-[#52525B] ml-1 mt-1 font-sans">
                     {new Date(block.properties.date).toLocaleDateString()}
                   </span>
                )}
                {block.type === 'database-view' && (
                   <div className="mt-4 w-full border border-[#2D2D30] rounded-xl overflow-hidden bg-[#0A0A0B] flex flex-col font-sans">
                     <div className="flex border-b border-[#2D2D30] bg-[#111113]">
                       <button className="px-4 py-2 text-sm text-white border-b-2 border-blue-500 font-medium">Kanban</button>
                       <button className="px-4 py-2 text-sm text-[#71717A] hover:text-[#A1A1AA]">Table</button>
                       <button className="px-4 py-2 text-sm text-[#71717A] hover:text-[#A1A1AA]">Timeline</button>
                     </div>
                     <div className="p-4 flex gap-4 overflow-x-auto min-h-[200px]">
                       {/* Column 1 */}
                       <div className="flex-1 min-w-[250px] bg-[#111113] p-3 rounded-lg border border-[#1F1F21]">
                         <div className="flex justify-between items-center mb-3">
                           <h4 className="text-xs font-bold text-[#A1A1AA]">TO DO <span className="text-[#52525B] ml-1">3</span></h4>
                           <Plus className="w-3 h-3 text-[#52525B]" />
                         </div>
                         <div className="space-y-2">
                           <div className="bg-[#1A1A1C] border border-[#2D2D30] p-3 rounded shadow-sm">
                             <div className="text-sm text-white mb-2">Finalize Q4 AI Infrastructure Specs</div>
                             <div className="flex gap-2">
                               <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] border border-red-500/20">P1_CRITICAL</span>
                               <span className="px-1.5 py-0.5 rounded bg-[#2D2D30] text-[#A1A1AA] text-[10px]">90m</span>
                             </div>
                           </div>
                           <div className="bg-[#1A1A1C] border border-[#2D2D30] p-3 rounded shadow-sm">
                             <div className="text-sm text-white mb-2">Review UI Wireframes</div>
                             <div className="flex gap-2">
                               <span className="px-1.5 py-0.5 rounded bg-[#2D2D30] text-[#A1A1AA] text-[10px]">30m</span>
                             </div>
                           </div>
                         </div>
                       </div>

                       {/* Column 2 */}
                       <div className="flex-1 min-w-[250px] bg-[#111113] p-3 rounded-lg border border-[#1F1F21]">
                         <div className="flex justify-between items-center mb-3">
                           <h4 className="text-xs font-bold text-blue-400">IN PROGRESS <span className="text-[#52525B] ml-1">1</span></h4>
                           <Plus className="w-3 h-3 text-[#52525B]" />
                         </div>
                         <div className="space-y-2">
                           <div className="bg-[#1A1A1C] border border-[#2D2D30] p-3 rounded shadow-sm">
                             <div className="text-sm text-white mb-2">API Middleware Implementation</div>
                             <div className="flex gap-2">
                               <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px] border border-yellow-500/20">P2_HIGH</span>
                               <span className="px-1.5 py-0.5 rounded bg-[#2D2D30] text-[#A1A1AA] text-[10px]">120m</span>
                             </div>
                           </div>
                         </div>
                       </div>

                       {/* Column 3 */}
                       <div className="flex-1 min-w-[250px] bg-[#111113] p-3 rounded-lg border border-[#1F1F21]">
                         <div className="flex justify-between items-center mb-3">
                           <h4 className="text-xs font-bold text-purple-400">SCHEDULED (CHRONOS) <span className="text-[#52525B] ml-1">2</span></h4>
                           <Plus className="w-3 h-3 text-[#52525B]" />
                         </div>
                         <div className="space-y-2">
                           <div className="bg-[#1A1A1C] border border-purple-500/30 p-3 rounded shadow-sm">
                             <div className="text-sm text-white mb-2">Chronos Engine Test</div>
                             <div className="flex items-center gap-1.5 text-xs text-purple-400 mt-2">
                               <Calendar className="w-3 h-3" />
                               Today, 09:30 AM
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                )}
                {slashMenuId === block.id && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#111113] border border-[#1F1F21] rounded-lg shadow-xl z-50 overflow-hidden text-sm">
                    <div className="p-2 text-xs font-semibold text-[#52525B] uppercase tracking-wider">Basic Blocks</div>
                    <button onClick={() => executeSlashCommand('task', block.id)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1C] flex items-center gap-3 text-white transition-colors">
                      <CheckSquare className="w-4 h-4 text-[#A1A1AA]" /> Task
                    </button>
                    <button onClick={() => executeSlashCommand('sub-page', block.id)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1C] flex items-center gap-3 text-white transition-colors">
                      <FileText className="w-4 h-4 text-[#A1A1AA]" /> Sub-Page
                    </button>
                    <button onClick={() => executeSlashCommand('event', block.id)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1C] flex items-center gap-3 text-white transition-colors">
                      <Calendar className="w-4 h-4 text-[#A1A1AA]" /> Event
                    </button>
                    <button onClick={() => executeSlashCommand('database-view', block.id)} className="w-full text-left px-4 py-2 hover:bg-[#1A1A1C] flex items-center gap-3 text-white transition-colors">
                      <Database className="w-4 h-4 text-[#A1A1AA]" /> Database View
                    </button>
                  </div>
                )}
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                {block.type === 'paragraph' && (
                  <button onClick={() => convertToTask(block.id)} className="p-1.5 text-[#52525B] hover:text-white hover:bg-[#1A1A1C] rounded transition-colors" title="Turn into task">
                    <CheckSquare className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => deleteBlock(block.id)} className="p-1.5 text-[#52525B] hover:text-red-400 hover:bg-[#1A1A1C] rounded transition-colors" title="Delete block">
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addParagraph}
          className="mt-8 text-[#52525B] hover:text-white flex items-center gap-2 text-sm p-2 transition-colors font-serif"
        >
          <Plus className="w-4 h-4" /> Add block
        </button>
      </div>
    </div>
  );
}
