import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Block } from './types';
import { api } from './api';

interface AppContextType {
  blocks: Block[];
  refreshBlocks: () => Promise<void>;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  createBlock: (block: Partial<Block>) => Promise<Block>;
  deleteBlock: (id: string) => Promise<void>;
  activeSpaceId: string | null;
  setActiveSpaceId: (id: string | null) => void;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  mainView: 'workspace' | 'calendar' | 'flow';
  setMainView: (view: 'workspace' | 'calendar' | 'flow') => void;
  isLeftRailOpen: boolean;
  setIsLeftRailOpen: (open: boolean) => void;
  isAIPanelOpen: boolean;
  setIsAIPanelOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() => localStorage.getItem('loom_active_space'));
  const [activePageId, setActivePageId] = useState<string | null>(() => localStorage.getItem('loom_active_page'));
  const [mainView, setMainView] = useState<'workspace' | 'calendar' | 'flow'>('workspace');
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const debounceMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (activeSpaceId) localStorage.setItem('loom_active_space', activeSpaceId);
    else localStorage.removeItem('loom_active_space');
  }, [activeSpaceId]);

  useEffect(() => {
    if (activePageId) localStorage.setItem('loom_active_page', activePageId);
    else localStorage.removeItem('loom_active_page');
  }, [activePageId]);

  const refreshBlocks = async () => {
    const data = await api.getBlocks();
    setBlocks(data);
    if (!activeSpaceId && data.find((b) => b.type === 'space')) {
      const space = data.find((b) => b.type === 'space');
      setActiveSpaceId(space?.id || null);
    }
  };

  useEffect(() => {
    refreshBlocks();
  }, []);

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b)));
    
    if (debounceMap.current[id]) clearTimeout(debounceMap.current[id]);
    debounceMap.current[id] = setTimeout(() => {
      api.updateBlock(id, updates).catch(console.error);
    }, 500);
  };

  const createBlock = async (block: Partial<Block>) => {
    const newBlock = await api.createBlock(block);
    setBlocks((prev) => [...prev, newBlock]);
    return newBlock;
  };

  const deleteBlock = async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await api.deleteBlock(id).catch(console.error);
  };

  return (
    <AppContext.Provider
      value={{
        blocks,
        refreshBlocks,
        updateBlock,
        createBlock,
        deleteBlock,
        activeSpaceId,
        setActiveSpaceId,
        activePageId,
        setActivePageId,
        mainView,
        setMainView,
        isLeftRailOpen,
        setIsLeftRailOpen,
        isAIPanelOpen,
        setIsAIPanelOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};
