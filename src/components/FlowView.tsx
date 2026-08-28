import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { Play, Plus, ArrowRight, Zap, Settings2 } from 'lucide-react';
import { Block } from '../types';

export function FlowView() {
  const { blocks, createBlock, updateBlock, activeSpaceId } = useAppContext();
  const workflows = blocks.filter(b => b.type === 'workflow');

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);

  const handleCreateWorkflow = async () => {
    if (!activeSpaceId) {
      alert("Please select a Space first to hold your workflow.");
      return;
    }
    const wf = await createBlock({
      type: 'workflow',
      content: 'New Automation',
      properties: {
        trigger: { type: 'manual' },
        actions: []
      },
      parentId: activeSpaceId
    });
    setActiveWorkflowId(wf.id);
  };

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  const handleTestRun = () => {
    if (activeWorkflow) {
      updateBlock(activeWorkflow.id, { 
        properties: { 
          ...activeWorkflow.properties, 
          lastRun: Date.now(), 
          status: 'success' 
        } 
      });
      alert('Test run initiated! (Simulation)');
    }
  };

  return (
    <div className="flex-1 bg-[#0A0A0B] overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-[#1F1F21] flex justify-between items-center bg-[#0A0A0B]">
        <h1 className="text-xl font-medium text-white">Automations</h1>
        <button onClick={handleCreateWorkflow} className="flex items-center gap-2 bg-[#1A1A1C] hover:bg-[#2D2D30] text-white px-3 py-1.5 rounded text-sm transition-colors border border-[#2D2D30]">
          <Plus className="w-4 h-4" /> New Flow
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Workflow List */}
        <div className="w-64 border-r border-[#1F1F21] bg-[#0D0D0E] p-4 overflow-y-auto space-y-2">
          {workflows.map(wf => (
            <button
              key={wf.id}
              onClick={() => setActiveWorkflowId(wf.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                activeWorkflowId === wf.id 
                  ? 'border-blue-500/50 bg-blue-500/10 text-white' 
                  : 'border-[#1F1F21] bg-[#111113] text-[#A1A1AA] hover:bg-[#1A1A1C]'
              }`}
            >
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="truncate text-sm">{wf.content}</span>
            </button>
          ))}
          {workflows.length === 0 && (
            <div className="text-center text-[#52525B] text-sm mt-8">No automations yet</div>
          )}
        </div>

        {/* Workflow Editor */}
        {activeWorkflow ? (
          <div className="flex-1 bg-[#0A0A0B] p-8 overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-2xl mb-12 flex justify-between items-center">
              <input 
                type="text" 
                value={activeWorkflow.content}
                onChange={e => updateBlock(activeWorkflow.id, { content: e.target.value })}
                className="bg-transparent text-2xl font-semibold text-white focus:outline-none border-b border-transparent focus:border-[#2D2D30]"
              />
              <div className="flex items-center gap-4">
                {activeWorkflow.properties?.lastRun && (
                  <span className="text-xs text-[#71717A]">
                    Last run: {new Date(activeWorkflow.properties.lastRun).toLocaleTimeString()}
                  </span>
                )}
                <button onClick={handleTestRun} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                  <Play className="w-4 h-4" /> Test Run
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 w-full max-w-xl">
              {/* Trigger Node */}
              <div className="w-full bg-[#111113] border border-[#2D2D30] rounded-xl p-5 shadow-lg relative group">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0A0A0B] border border-[#2D2D30] rounded-full flex items-center justify-center">
                  <Zap className="w-3 h-3 text-yellow-500" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1 pl-4">Trigger</h3>
                <p className="text-xs text-[#71717A] pl-4">When this happens...</p>
                <div className="mt-4 pl-4">
                  <select className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-full focus:outline-none focus:border-blue-500">
                    <option>Manual Execution</option>
                    <option>Scheduled Time (e.g. Daily 9AM)</option>
                    <option>New Email Arrives</option>
                    <option>Task Completed</option>
                  </select>
                </div>
              </div>

              <ArrowRight className="w-5 h-5 text-[#3F3F46] rotate-90" />

              {/* Action Node */}
              <div className="w-full bg-[#111113] border border-[#2D2D30] rounded-xl p-5 shadow-lg relative group">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0A0A0B] border border-[#2D2D30] rounded-full flex items-center justify-center">
                  <Settings2 className="w-3 h-3 text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1 pl-4">Action</h3>
                <p className="text-xs text-[#71717A] pl-4">Do this...</p>
                <div className="mt-4 pl-4 space-y-3">
                  <select className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-full focus:outline-none focus:border-blue-500">
                    <option>AI: Summarize Data</option>
                    <option>Create Workspace Page</option>
                    <option>Create Task</option>
                    <option>Send Email</option>
                  </select>
                </div>
              </div>

              <button className="mt-4 p-2 rounded-full border border-dashed border-[#3F3F46] text-[#71717A] hover:text-white hover:border-[#71717A] hover:bg-[#111113] transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#52525B]">
            Select or create an automation from the sidebar
          </div>
        )}
      </div>
    </div>
  );
}
