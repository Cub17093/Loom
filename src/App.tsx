import React from 'react';
import { AppProvider, useAppContext } from './AppContext';
import { LeftRail } from './components/LeftRail';
import { Canvas } from './components/Canvas';
import { AIPanel } from './components/AIPanel';
import { CalendarView } from './components/CalendarView';
import { FlowView } from './components/FlowView';

function MainContent() {
  const { mainView } = useAppContext();
  return (
    <>
      <LeftRail />
      {mainView === 'workspace' && <Canvas />}
      {mainView === 'calendar' && <CalendarView />}
      {mainView === 'flow' && <FlowView />}
      <AIPanel />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen bg-[#0A0A0B] text-[#D1D1D1] font-sans overflow-hidden" style={{ backgroundColor: '#0A0A0B' }}>
        <MainContent />
      </div>
    </AppProvider>
  );
}
