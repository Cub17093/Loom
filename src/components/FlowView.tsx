import { getAccessToken } from "../auth";
import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { Play, Plus, ArrowRight, Zap, Settings2, SplitSquareHorizontal, Bot, History, ChevronUp, ChevronDown, CheckCircle2, XCircle, X } from 'lucide-react';
import { Block } from '../types';

export function FlowView() {
  const { blocks, createBlock, updateBlock, activeSpaceId, setActivePageId, setMainView } = useAppContext();
  const workflows = blocks.filter(b => b.type === 'workflow');

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);
  const workflowRuns = activeWorkflow 
    ? blocks.filter(b => b.type === 'workflow-run' && b.parentId === activeWorkflow.id).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const handleGenerateWorkflow = async () => {
    if (!activeSpaceId) {
      alert("Please select a Space first to hold your workflow.");
      return;
    }
    if (!aiPrompt) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/compile-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      
      if (data.error) {
        alert("Failed to compile pipeline: " + data.error);
        return;
      }
      
      if (!data.nodes || !data.edges) {
        alert("Invalid response from AI.");
        return;
      }
      
      const confirmStr = data.nodes.map((n: any) => n.type).join(' -> ');
      if (!window.confirm("Generated pipeline:\n" + confirmStr + "\n\nSave and open this workflow?")) {
        return;
      }

      const wf = await createBlock({
        type: 'workflow',
        content: 'AI Generated Automation',
        properties: {
          nodes: data.nodes,
          edges: data.edges
        },
        parentId: activeSpaceId
      });
      setActiveWorkflowId(wf.id);
      setAiPrompt('');
    } catch (e: any) {
      alert("Error generating flow: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!activeSpaceId) {
      alert("Please select a Space first to hold your workflow.");
      return;
    }
    const wf = await createBlock({
      type: 'workflow',
      content: 'New Automation',
      properties: {
        nodes: [
          { id: 'n1', type: 'trigger.gmail', config: { filter: '' } },
          { id: 'n2', type: 'condition.contains', config: { value: '' } },
          { id: 'n3', type: 'action.createTask', config: { title: 'Automated Task', duration: 30, priority: 'medium' } }
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3' }
        ]
      },
      parentId: activeSpaceId
    });
    setActiveWorkflowId(wf.id);
  };

  const handleTestRun = async () => {
    if (!activeWorkflow) return;
    
    const token = await getAccessToken();
    if (!token) {
      alert('Please connect Google account first.');
      return;
    }
    
    try {
      const res = await fetch(`/api/pipelines/run/${activeWorkflow.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      });
      const data = await res.json();
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }
      
      updateBlock(activeWorkflow.id, { 
        properties: { 
          ...activeWorkflow.properties, 
          lastRun: Date.now(), 
          status: 'success' 
        } 
      });
      alert(data.message + (data.createdTask ? ' Created task: ' + data.createdTask.content : ''));
    } catch (e: any) {
      alert('Simulation failed: ' + e.message);
    }
  };

  const updateNodeConfig = (nodeId: string, newConfig: any) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.properties?.nodes?.map((n: any) => 
      n.id === nodeId ? { ...n, config: { ...n.config, ...newConfig } } : n
    ) || [];
    updateBlock(activeWorkflow.id, {
      properties: { ...activeWorkflow.properties, nodes: newNodes }
    });
  };

  const handleAddNode = (type: string) => {
    if (!activeWorkflow) return;
    
    let defaultConfig = {};
    if (type === 'trigger.gmail') defaultConfig = { filter: '' };
    if (type === 'condition.contains') defaultConfig = { value: '' };
    if (type === 'action.createTask') defaultConfig = { title: 'Automated Task', duration: 30, priority: 'medium' };

    const newNodes = [
      ...(activeWorkflow.properties?.nodes || []),
      { id: `n${Date.now()}`, type, config: defaultConfig }
    ];
    
    // Automatically connect from the previous last node if there is one
    const newEdges = [...(activeWorkflow.properties?.edges || [])];
    const prevNodes = activeWorkflow.properties?.nodes || [];
    if (prevNodes.length > 0) {
      newEdges.push({ from: prevNodes[prevNodes.length - 1].id, to: newNodes[newNodes.length - 1].id });
    }

    updateBlock(activeWorkflow.id, {
      properties: { ...activeWorkflow.properties, nodes: newNodes, edges: newEdges }
    });
    setIsAddMenuOpen(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    const newNodes = activeWorkflow.properties?.nodes?.filter((n: any) => n.id !== nodeId) || [];
    // Remove any edges connected to this node
    const newEdges = activeWorkflow.properties?.edges?.filter((e: any) => e.from !== nodeId && e.to !== nodeId) || [];
    
    updateBlock(activeWorkflow.id, {
      properties: { ...activeWorkflow.properties, nodes: newNodes, edges: newEdges }
    });
  };

  return (
    <div className="flex-1 bg-[#0A0A0B] overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-[#1F1F21] flex justify-between items-center bg-[#0A0A0B] gap-4">
        <h1 className="text-xl font-medium text-white shrink-0">Automations</h1>
        <div className="flex items-center gap-2 flex-1 max-w-xl mx-4">
          <input
            type="text"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Describe an automation to generate..."
            className="flex-1 bg-[#111113] border border-[#2D2D30] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
          <button 
            onClick={handleGenerateWorkflow} 
            disabled={isGenerating || !aiPrompt}
            className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-purple-500/30 whitespace-nowrap disabled:opacity-50"
          >
            <Bot className="w-4 h-4" /> {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <button onClick={handleCreateWorkflow} className="flex items-center gap-2 bg-[#1A1A1C] hover:bg-[#2D2D30] text-white px-3 py-1.5 rounded text-sm transition-colors border border-[#2D2D30] shrink-0">
          <Plus className="w-4 h-4" /> New Flow
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Workflow List */}
        <div className="w-64 border-r border-[#1F1F21] bg-[#0D0D0E] p-4 overflow-y-auto space-y-2 shrink-0">
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

            <div className="flex flex-col items-center w-full max-w-xl pb-32">
              {activeWorkflow.properties?.nodes?.map((node: any, index: number) => (
                <React.Fragment key={node.id}>
                  {index > 0 && (
                    <>
                      <div className="h-8 border-l-2 border-[#2D2D30] my-2"></div>
                      <ArrowRight className="w-5 h-5 text-[#3F3F46] rotate-90 mb-2" />
                    </>
                  )}
                  
                  {node.type === 'trigger.gmail' && (
                    <div className="w-full bg-[#111113] border border-[#2D2D30] rounded-xl p-5 shadow-lg relative group">
                      <button onClick={() => handleDeleteNode(node.id)} className="absolute top-3 right-3 text-[#71717A] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0A0A0B] border border-[#2D2D30] rounded-full flex items-center justify-center">
                        <Zap className="w-3 h-3 text-yellow-500" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1 pl-4">Trigger: Gmail</h3>
                      <p className="text-xs text-[#71717A] pl-4">When new email arrives...</p>
                      <div className="mt-4 pl-4">
                        <input type="text" value={node.config?.filter || ''} onChange={(e) => updateNodeConfig(node.id, { filter: e.target.value })} placeholder="Subject or body contains..." className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-full focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  )}

                  {node.type === 'condition.contains' && (
                    <div className="w-full bg-[#111113] border border-[#2D2D30] rounded-xl p-5 shadow-lg relative group">
                      <button onClick={() => handleDeleteNode(node.id)} className="absolute top-3 right-3 text-[#71717A] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0A0A0B] border border-[#2D2D30] rounded-full flex items-center justify-center">
                        <SplitSquareHorizontal className="w-3 h-3 text-green-400" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1 pl-4">Condition Node</h3>
                      <p className="text-xs text-[#71717A] pl-4">If email snippet contains...</p>
                      <div className="mt-4 pl-4 space-y-3">
                        <input type="text" value={node.config?.value || ''} onChange={(e) => updateNodeConfig(node.id, { value: e.target.value })} placeholder="e.g. invoice" className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-full focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  )}

                  {node.type === 'action.createTask' && (
                    <div className="w-full bg-[#111113] border border-[#2D2D30] rounded-xl p-5 shadow-lg relative group">
                      <button onClick={() => handleDeleteNode(node.id)} className="absolute top-3 right-3 text-[#71717A] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0A0A0B] border border-[#2D2D30] rounded-full flex items-center justify-center">
                        <Settings2 className="w-3 h-3 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1 pl-4">Action: Create Fluid Task</h3>
                      <p className="text-xs text-[#71717A] pl-4">Do this...</p>
                      <div className="mt-4 pl-4 space-y-3">
                        <input type="text" value={node.config?.title || ''} onChange={(e) => updateNodeConfig(node.id, { title: e.target.value })} placeholder="Task title" className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-full focus:outline-none focus:border-blue-500" />
                        <div className="flex gap-2">
                          <input type="number" value={node.config?.duration || ''} onChange={(e) => updateNodeConfig(node.id, { duration: e.target.value })} placeholder="Duration (mins)" className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-1/2 focus:outline-none focus:border-blue-500" />
                          <select value={node.config?.priority || ''} onChange={(e) => updateNodeConfig(node.id, { priority: e.target.value })} className="bg-[#1A1A1C] border border-[#2D2D30] text-sm text-white rounded p-2 w-1/2 focus:outline-none focus:border-blue-500">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}

              <div className="relative flex justify-center w-full mt-8 mb-8">
                <button 
                  onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                  className="p-2 rounded-full border border-dashed border-[#3F3F46] text-[#71717A] hover:text-white hover:border-[#71717A] hover:bg-[#111113] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
                {isAddMenuOpen && (
                  <div className="absolute top-12 z-10 w-48 bg-[#1A1A1C] border border-[#2D2D30] rounded-xl shadow-xl overflow-hidden flex flex-col p-1">
                    {!activeWorkflow.properties?.nodes?.some((n: any) => n.type === 'trigger.gmail') && (
                      <button 
                        onClick={() => handleAddNode('trigger.gmail')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2D2D30] rounded-lg transition-colors text-left"
                      >
                        <Zap className="w-4 h-4 text-yellow-500" /> Gmail Trigger
                      </button>
                    )}
                    {!activeWorkflow.properties?.nodes?.some((n: any) => n.type === 'condition.contains') && (
                      <button 
                        onClick={() => handleAddNode('condition.contains')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2D2D30] rounded-lg transition-colors text-left"
                      >
                        <SplitSquareHorizontal className="w-4 h-4 text-green-400" /> Condition Node
                      </button>
                    )}
                    {!activeWorkflow.properties?.nodes?.some((n: any) => n.type === 'action.createTask') && (
                      <button 
                        onClick={() => handleAddNode('action.createTask')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2D2D30] rounded-lg transition-colors text-left"
                      >
                        <Settings2 className="w-4 h-4 text-blue-400" /> Create Task Action
                      </button>
                    )}
                    {activeWorkflow.properties?.nodes?.length >= 3 && (
                       <div className="px-3 py-2 text-xs text-[#71717A] text-center italic">All node types added</div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full mt-4 border border-[#1F1F21] bg-[#111113] rounded-xl overflow-hidden shadow-lg">
                <button 
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className="w-full p-4 flex justify-between items-center text-sm font-medium text-white hover:bg-[#1A1A1C] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#A1A1AA]" /> Run History ({workflowRuns.length})
                  </div>
                  {isHistoryOpen ? <ChevronUp className="w-4 h-4 text-[#71717A]" /> : <ChevronDown className="w-4 h-4 text-[#71717A]" />}
                </button>
                {isHistoryOpen && (
                  <div className="border-t border-[#1F1F21] max-h-80 overflow-y-auto p-4 space-y-3 bg-[#0A0A0B]">
                    {workflowRuns.length === 0 ? (
                      <div className="text-xs text-[#52525B] text-center py-4">No runs recorded yet.</div>
                    ) : workflowRuns.map(run => (
                      <div key={run.id} className="flex gap-3 text-xs items-start bg-[#111113] p-3 rounded-lg border border-[#1F1F21]">
                        <div className="shrink-0 mt-0.5">
                          {run.properties?.success ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-[#A1A1AA] mb-1 font-sans">{new Date(run.createdAt).toLocaleString()}</div>
                          <div className="text-white text-sm">{run.properties?.message}</div>
                          {run.properties?.createdTaskId && (
                            <button 
                              onClick={() => {
                                const taskBlock = blocks.find(b => b.id === run.properties.createdTaskId);
                                if (taskBlock && taskBlock.parentId) {
                                  setActivePageId(taskBlock.parentId);
                                  setMainView('workspace');
                                }
                              }}
                              className="mt-3 text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium bg-blue-500/10 px-2.5 py-1.5 rounded border border-blue-500/20 w-fit transition-colors"
                            >
                              View Task <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
