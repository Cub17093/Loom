import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { Folder, FileText, Plus, Trash2, Pencil, Calendar, Workflow, LayoutGrid, ChevronRight, ChevronDown, PanelLeftClose } from 'lucide-react';
import { googleSignIn, initAuth, logout } from '../auth';
import { Block } from '../types';

export function LeftRail() {
  const { blocks, activeSpaceId, setActiveSpaceId, activePageId, setActivePageId, createBlock, updateBlock, deleteBlock, mainView, setMainView, setIsLeftRailOpen } = useAppContext();
  const [user, setUser] = React.useState<any>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const unsub = initAuth((u) => setUser(u), () => setUser(null));
    return () => unsub();
  }, []);

  const spaces = blocks.filter((b) => b.type === 'space');
  
  const toggleExpand = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    setExpandedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const handleCreateSpace = async () => {
    const block = await createBlock({
      type: 'space',
      content: 'Untitled Space',
      parentId: null,
    });
    setActiveSpaceId(block.id);
    setActivePageId(null);
    setMainView('workspace');
  };

  const handleCreatePage = async (parentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const block = await createBlock({
      type: 'page',
      content: 'Untitled Page',
      parentId: parentId,
    });
    setActivePageId(block.id);
    setMainView('workspace');
    if (parentId !== activeSpaceId) {
      setExpandedPages(prev => ({ ...prev, [parentId]: true }));
    }
  };

  const startEditing = (block: any) => {
    setEditingBlockId(block.id);
    setEditContent(block.content);
  };

  const saveEditing = (blockId: string) => {
    if (editContent.trim()) {
      updateBlock(blockId, { content: editContent.trim() });
    }
    setEditingBlockId(null);
  };

  const handleDelete = async (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this?')) {
      await deleteBlock(blockId);
      if (activeSpaceId === blockId) setActiveSpaceId(null);
      if (activePageId === blockId) setActivePageId(null);
    }
  };

  const handleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') {
        console.log('Sign in popup closed by user.');
      } else if (e?.code === 'auth/cancelled-popup-request') {
        console.log('Sign in popup request was cancelled (likely due to multiple clicks).');
      } else {
        console.error('Sign in error:', e);
      }
    }
  };

  const renderPageTree = (parentId: string, depth = 0) => {
    const childPages = blocks.filter((b) => b.type === 'page' && b.parentId === parentId);
    if (childPages.length === 0) return null;

    return (
      <div className="space-y-1">
        {childPages.map((page) => {
          const hasChildren = blocks.some((b) => b.type === 'page' && b.parentId === page.id);
          const isExpanded = expandedPages[page.id];
          
          return (
            <div key={page.id} className="relative group">
              {editingBlockId === page.id ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1C] rounded-md" style={{ paddingLeft: `${depth * 12 + 12}px` }}>
                  <FileText className="w-4 h-4 text-[#71717A]" />
                  <input
                    autoFocus
                    type="text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={() => saveEditing(page.id)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditing(page.id)}
                    className="bg-transparent text-sm text-white w-full focus:outline-none"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setActivePageId(page.id); setMainView('workspace'); }}
                  className={"w-full text-left py-2 rounded-md flex items-center gap-2 text-sm transition-colors pr-20 " + (
                    activePageId === page.id && mainView === 'workspace' ? 'bg-[#1A1A1C] text-white cursor-default' : 'text-[#71717A] hover:bg-[#151517]'
                  )}
                  style={{ paddingLeft: `${depth * 12 + 12}px` }}
                >
                  <div onClick={(e) => hasChildren ? toggleExpand(e, page.id) : undefined} className={`p-0.5 rounded-sm ${hasChildren ? 'hover:bg-[#2D2D30] cursor-pointer' : 'opacity-0'}`}>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{page.content}</span>
                </button>
              )}
              
              {editingBlockId !== page.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => handleCreatePage(page.id, e)} className="p-1 text-[#52525B] hover:text-white" title="Add sub-page">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); startEditing(page); }} className="p-1 text-[#52525B] hover:text-white">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => handleDelete(e, page.id)} className="p-1 text-[#52525B] hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              {isExpanded && renderPageTree(page.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-64 bg-[#0D0D0E] border-r border-[#1F1F21] flex flex-col h-full overflow-y-auto">
      <div className="p-6 border-b border-[#1F1F21] flex justify-between items-center">
        <h1 className="font-semibold text-white tracking-tight text-lg flex items-center gap-3">
          <div className="w-6 h-6 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-[#0A0A0B] rounded-full"></div>
          </div>
          SYNAPSE
        </h1>
        <button onClick={() => setIsLeftRailOpen(false)} className="p-1 text-[#52525B] hover:text-white transition-colors" title="Close sidebar">
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
      
      <div className="px-4 py-4 space-y-1 border-b border-[#1F1F21]">
         <button onClick={() => setMainView('workspace')} className={"w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition-colors " + (mainView === 'workspace' ? 'bg-[#1A1A1C] text-white' : 'text-[#71717A] hover:bg-[#151517]')}>
            <LayoutGrid className="w-4 h-4" /> Workspace
         </button>
         <button onClick={() => setMainView('calendar')} className={"w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition-colors " + (mainView === 'calendar' ? 'bg-[#1A1A1C] text-white' : 'text-[#71717A] hover:bg-[#151517]')}>
            <Calendar className="w-4 h-4" /> Calendar
         </button>
         <button onClick={() => setMainView('flow')} className={"w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition-colors " + (mainView === 'flow' ? 'bg-[#1A1A1C] text-white' : 'text-[#71717A] hover:bg-[#151517]')}>
            <Workflow className="w-4 h-4" /> Automations
         </button>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-[10px] uppercase tracking-[0.15em] text-[#52525B]">Spaces</h2>
            <button onClick={handleCreateSpace} className="text-[#52525B] hover:text-white transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {spaces.map((space) => (
              <div key={space.id} className="relative group">
                {editingBlockId === space.id ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1C] rounded-md">
                    <Folder className="w-4 h-4 text-[#71717A]" />
                    <input
                      autoFocus
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onBlur={() => saveEditing(space.id)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEditing(space.id)}
                      className="bg-transparent text-sm text-white w-full focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveSpaceId(space.id); setActivePageId(null); setMainView('workspace'); }}
                    className={"w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition-colors pr-16 " + (
                      activeSpaceId === space.id && !activePageId && mainView === 'workspace' ? 'bg-[#1A1A1C] text-white cursor-default' : 'text-[#71717A] hover:bg-[#151517]'
                    )}
                  >
                    <Folder className="w-4 h-4" />
                    <span className="truncate">{space.content}</span>
                  </button>
                )}
                
                {editingBlockId !== space.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); startEditing(space); }} className="p-1 text-[#52525B] hover:text-white">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => handleDelete(e, space.id)} className="p-1 text-[#52525B] hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {activeSpaceId && (
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[10px] uppercase tracking-[0.15em] text-[#52525B]">Pages</h2>
              <button onClick={(e) => handleCreatePage(activeSpaceId, e)} className="text-[#52525B] hover:text-white transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {renderPageTree(activeSpaceId)}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#1F1F21]">
        {user ? (
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-[#52525B]">
            <div className="w-8 h-8 rounded bg-[#1F1F21] border border-[#2D2D30] overflow-hidden">
               {user.photoURL ? <img src={user.photoURL} alt={user.email} className="w-full h-full object-cover" /> : null}
            </div>
            <div className="flex-1 truncate">
              <div className="text-white font-medium truncate">{user.email}</div>
              <button onClick={logout} className="hover:text-white transition-colors mt-0.5">Sign out</button>
            </div>
          </div>
        ) : (
          <button onClick={handleSignIn} className="w-full flex items-center justify-center gap-2 bg-[#1F1F21] border border-[#2D2D30] rounded py-2 px-3 text-white hover:bg-[#2D2D30] transition-colors text-sm font-medium">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 opacity-80" />
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
