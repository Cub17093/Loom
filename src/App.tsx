import React from 'react';
import { AppProvider, useAppContext } from './AppContext';
import { LeftRail } from './components/LeftRail';
import { Canvas } from './components/Canvas';
import { AIPanel } from './components/AIPanel';
import { CalendarView } from './components/CalendarView';
import { FlowView } from './components/FlowView';
import { ChronosDock } from './components/ChronosDock';
import { CommandPalette } from './components/CommandPalette';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';

function MainContent() {
  const { mainView, isLeftRailOpen, setIsLeftRailOpen, isAIPanelOpen, setIsAIPanelOpen } = useAppContext();
  return (
    <div className="flex flex-col h-screen w-full relative">
      <div className="flex flex-1 overflow-hidden relative">
        {isLeftRailOpen && <LeftRail />}
        
        {!isLeftRailOpen && (
          <button 
            onClick={() => setIsLeftRailOpen(true)} 
            className="absolute left-4 top-4 z-40 p-2 bg-[#111113] border border-[#2D2D30] rounded-md shadow-lg text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1C] transition-colors"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {mainView === 'workspace' && <Canvas />}
          {mainView === 'calendar' && <CalendarView />}
          {mainView === 'flow' && <FlowView />}
        </div>
        
        {!isAIPanelOpen && (
          <button 
            onClick={() => setIsAIPanelOpen(true)} 
            className="absolute right-4 top-4 z-40 p-2 bg-[#111113] border border-[#2D2D30] rounded-md shadow-lg text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1C] transition-colors"
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>
        )}

        {isAIPanelOpen && <AIPanel />}
      </div>
      <ChronosDock />
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen w-screen bg-[#0A0A0B] text-[#D1D1D1] font-sans overflow-hidden" style={{ backgroundColor: '#0A0A0B' }}>
        <MainContent />
      </div>
    </AppProvider>
  );
}
