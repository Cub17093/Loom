import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;
app.use(express.json({ limit: '50mb' }));

// --- AI Initialization ---
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// --- Simple Local JSON Graph DB ---
const DB_FILE = path.join(process.cwd(), 'blocks_db.json');

export type BlockType = 'space' | 'page' | 'paragraph' | 'task' | 'table' | 'gmail' | 'drive' | 'calendar' | 'event' | 'database-view' | 'workflow';

export interface Block {
  id: string;
  type: BlockType;
  content: string; // Text or serialized content
  properties: Record<string, any>;
  references: string[]; // Edges to other blocks
  parentId?: string | null;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

let blocks: Record<string, Block> = {};

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      blocks = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse DB', e);
    }
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(blocks, null, 2));
}

loadDb();

// --- API Routes ---

// Get all blocks (graph view / initial load)
app.get('/api/blocks', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest';
  let userBlocks = Object.values(blocks).filter(b => b.userId === userId);
  
  if (userBlocks.length === 0) {
    const spaceId = `space-${userId}`;
    const pageId = `page-${userId}`;
    const paragraphId = `para-${userId}`;

    blocks[spaceId] = { id: spaceId, type: 'space', content: 'Personal Workspace', properties: {}, references: [pageId], parentId: null, userId, createdAt: Date.now(), updatedAt: Date.now() };
    blocks[pageId] = { id: pageId, type: 'page', content: 'Q3 Planning', properties: {}, references: [paragraphId], parentId: spaceId, userId, createdAt: Date.now(), updatedAt: Date.now() };
    blocks[paragraphId] = { id: paragraphId, type: 'paragraph', content: 'Welcome to your private workspace! Your data is isolated to your account.', properties: {}, references: [], parentId: pageId, userId, createdAt: Date.now(), updatedAt: Date.now() };
    
    saveDb();
    userBlocks = [blocks[spaceId], blocks[pageId], blocks[paragraphId]];
  }

  res.json(userBlocks);
});

// Update a block
app.put('/api/blocks/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'guest';
  
  if (!blocks[id] || blocks[id].userId !== userId) {
    return res.status(404).json({ error: 'Block not found or unauthorized' });
  }
  blocks[id] = { ...blocks[id], ...updates, updatedAt: Date.now() };
  saveDb();
  res.json(blocks[id]);
});

// Create a block
app.post('/api/blocks', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest';
  const { id, type, content, properties, references, parentId } = req.body;
  const newBlock: Block = {
    id: id || "block-" + Date.now() + "-" + Math.floor(Math.random()*1000),
    type: type || 'paragraph',
    content: content || '',
    properties: properties || {},
    references: references || [],
    parentId: parentId || null,
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  blocks[newBlock.id] = newBlock;
  
  if (parentId && blocks[parentId] && blocks[parentId].userId === userId) {
    if (!blocks[parentId].references.includes(newBlock.id)) {
       blocks[parentId].references.push(newBlock.id);
    }
  }

  saveDb();
  res.json(newBlock);
});

// Delete a block
app.delete('/api/blocks/:id', (req, res) => {
  const id = req.params.id;
  const userId = (req.headers['x-user-id'] as string) || 'guest';
  
  if (!blocks[id] || blocks[id].userId !== userId) {
    return res.status(404).json({ error: 'Block not found or unauthorized' });
  }
  
  // Recursively delete children
  function deleteRecursive(blockId: string) {
    const block = blocks[blockId];
    if (block && block.userId === userId) {
      for (const childId of block.references) {
        deleteRecursive(childId);
      }
      delete blocks[blockId];
    }
  }

  deleteRecursive(id);
  
  // Remove references to this block from remaining blocks
  for (const block of Object.values(blocks)) {
    if (block.userId === userId) {
      block.references = block.references.filter((ref) => ref !== id);
    }
  }
  saveDb();
  res.json({ success: true });
});

async function runChronos(tasks: any[], token: string, timezone: string = 'America/New_York') {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return { scheduledTasks: [], warnings: [] };

  const timeMin = new Date().toISOString();
  const timeMaxDate = new Date();
  timeMaxDate.setDate(timeMaxDate.getDate() + 7); // fetch up to 7 days to be safe for 3-day scheduling
  const timeMax = timeMaxDate.toISOString();

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
    headers: { Authorization: token },
  });

  const data = await response.json();
  const events = data.items || [];
  
  let busyPeriods: any[] = events.map((e: any) => ({
    start: new Date(e.start.dateTime || e.start.date).getTime(),
    end: new Date(e.end.dateTime || e.end.date).getTime(),
    isGCal: true
  })).filter((s: any) => !isNaN(s.start) && !isNaN(s.end));

  const priorityWeight: Record<string, number> = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const pA = priorityWeight[a.properties?.priority] || 0;
    const pB = priorityWeight[b.properties?.priority] || 0;
    if (pA !== pB) return pB - pA;
    
    const dA = a.properties?.dueDate ? new Date(a.properties.dueDate).getTime() : Infinity;
    const dB = b.properties?.dueDate ? new Date(b.properties.dueDate).getTime() : Infinity;
    return dA - dB;
  });

  const scheduledTasks: any[] = [];
  const warnings: string[] = [];
  const nowMs = Date.now();
  const maxMs = nowMs + 3 * 24 * 60 * 60 * 1000; // Schedule within 3 days

  const getFreeGaps = (isUrgent: boolean) => {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: 'numeric', hour12: false });
    let workingIntervals: {start: number, end: number}[] = [];
    let currentInterval: {start: number, end: number} | null = null;

    for (let t = nowMs; t < maxMs; t += 15 * 60000) {
      const str = formatter.format(new Date(t));
      const parts = str.split(', ');
      if(parts.length < 2) continue;
      
      const weekday = parts[0];
      let hour = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
      if (str.includes('12') && str.toLowerCase().includes('am')) hour = 0;

      const isWeekend = weekday === 'Sat' || weekday === 'Sun';
      const isWorkingHour = hour >= 9 && hour < 18; // 9am - 6pm

      if (isWorkingHour && (!isWeekend || isUrgent)) {
        if (currentInterval) {
          currentInterval.end = t + 15 * 60000;
        } else {
          currentInterval = { start: t, end: t + 15 * 60000 };
        }
      } else {
        if (currentInterval) {
          workingIntervals.push(currentInterval);
          currentInterval = null;
        }
      }
    }
    if (currentInterval) workingIntervals.push(currentInterval);

    let gaps: { start: number, end: number, prevBusy?: any, nextBusy?: any }[] = [...workingIntervals];
    for (const busy of busyPeriods) {
      const newGaps: { start: number, end: number, prevBusy?: any, nextBusy?: any }[] = [];
      for (const gap of gaps) {
        if (busy.start < gap.end && busy.end > gap.start) {
          if (gap.start < busy.start) {
            newGaps.push({ start: gap.start, end: busy.start, prevBusy: gap.prevBusy, nextBusy: busy });
          }
          if (busy.end < gap.end) {
            newGaps.push({ start: busy.end, end: gap.end, prevBusy: busy, nextBusy: gap.nextBusy });
          }
        } else {
          newGaps.push(gap);
        }
      }
      gaps = newGaps;
    }
    return gaps;
  };

  for (const task of sortedTasks) {
    const isUrgent = task.properties?.dueDate && (new Date(task.properties.dueDate).getTime() - nowMs < 3 * 24 * 60 * 60 * 1000);
    const gaps = getFreeGaps(!!isUrgent);

    const durationMins = task.properties?.estimatedDurationMinutes || 30;
    let remainingMs = durationMins * 60 * 1000;
    const isSplittable = task.properties?.isSplittable === true;
    const minChunkMs = (task.properties?.minimumChunkMinutes || 15) * 60 * 1000;

    let bestGap = null;
    let bestScore = Infinity;

    for (const gap of gaps) {
      if (gap.end - gap.start >= remainingMs) {
        let score = gap.start;
        
        const taskTag = task.properties?.tag;
        const taskPriority = task.properties?.priority;
        
        const prev = gap.prevBusy;
        if (prev && !prev.isGCal) {
           if ((taskTag && prev.tag === taskTag) || (taskPriority && prev.priority === taskPriority)) {
             score -= 2 * 60 * 60 * 1000; 
           }
        }
        const next = gap.nextBusy;
        if (next && !next.isGCal) {
           if ((taskTag && next.tag === taskTag) || (taskPriority && next.priority === taskPriority)) {
             score -= 2 * 60 * 60 * 1000; 
           }
        }

        if (score < bestScore) {
          bestScore = score;
          bestGap = gap;
        }
      }
    }

    if (bestGap) {
      const start = bestGap.start;
      const end = start + remainingMs;
      scheduledTasks.push({
        id: task.id,
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd: new Date(end).toISOString(),
      });
      busyPeriods.push({ start, end, isGCal: false, priority: task.properties?.priority, tag: task.properties?.tag });
    } else if (isSplittable) {
      const chunks = [];
      for (const gap of gaps) {
         if (remainingMs <= 0) break;
         const gapDuration = gap.end - gap.start;
         if (gapDuration >= minChunkMs) {
           const takeMs = Math.min(gapDuration, remainingMs);
           const start = gap.start;
           const end = start + takeMs;
           chunks.push({ start, end });
           remainingMs -= takeMs;
           busyPeriods.push({ start, end, isGCal: false, priority: task.properties?.priority, tag: task.properties?.tag });
         }
      }

      if (remainingMs <= 0) {
        chunks.forEach((c, idx) => {
          scheduledTasks.push({
            id: task.id,
            scheduledStart: new Date(c.start).toISOString(),
            scheduledEnd: new Date(c.end).toISOString(),
            chunkIndex: idx + 1,
            chunkTotal: chunks.length
          });
        });
      } else {
         warnings.push(`Task "${task.content}" could not be fully scheduled \u2014 extend the scheduling window or reduce workload.`);
      }
    } else {
      warnings.push(`Task "${task.content}" could not be fully scheduled \u2014 no single slot large enough. Extend the scheduling window or mark as splittable.`);
    }
  }

  return { scheduledTasks, warnings };
}

// --- Chronos Routes ---
app.post('/api/chronos/schedule', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { tasks, timezone } = req.body;
    const { scheduledTasks, warnings } = await runChronos(tasks, token, timezone || 'America/New_York');
    res.json({ scheduledTasks, warnings });
  } catch (error: any) {
    console.error('Chronos Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Pipeline Routes ---
app.post('/api/pipelines/run/:workflowId', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'guest';
    const token = req.headers.authorization;
    const { workflowId } = req.params;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const workflow = blocks[workflowId];
    if (!workflow || workflow.userId !== userId || workflow.type !== 'workflow') {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const nodes = workflow.properties?.nodes || [];
    const triggerNode = nodes.find((n: any) => n.type === 'trigger.gmail');
    const conditionNode = nodes.find((n: any) => n.type === 'condition.contains');
    const actionNode = nodes.find((n: any) => n.type === 'action.createTask');

    // Helper to log runs
    const logRun = (success: boolean, message: string, createdTaskId: string | null = null) => {
      const timestamp = Date.now();
      const runBlock = {
        id: "run-" + timestamp + "-" + Math.floor(Math.random()*1000),
        type: 'workflow-run',
        content: `Run at ${new Date(timestamp).toLocaleString()}`,
        properties: { workflowId, timestamp, success, message, createdTaskId },
        references: [],
        parentId: workflowId,
        userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      blocks[runBlock.id] = runBlock as any;
      
      const runs = Object.values(blocks).filter((b: any) => b.type === 'workflow-run' && b.parentId === workflowId);
      runs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      if (runs.length > 20) {
        runs.slice(20).forEach((b: any) => delete blocks[b.id]);
      }
      saveDb();
    };

    if (!triggerNode || !actionNode) {
      return res.status(400).json({ error: 'Missing required nodes (trigger and action)' });
    }

    // 1. Check trigger
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5`, {
      headers: { Authorization: token },
    });
    const data = await response.json();
    let triggeredMessage = null;

    if (data.messages && data.messages.length > 0) {
      for (const m of data.messages) {
        const detailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + m.id, {
          headers: { Authorization: token },
        });
        const detailData = await detailRes.json();
        
        const subjectHeader = detailData.payload?.headers?.find((h: any) => h.name === 'Subject');
        const subject = subjectHeader ? subjectHeader.value : '';
        const snippet = detailData.snippet || '';
        
        let triggerPassed = true;
        if (triggerNode.config?.filter && !subject.toLowerCase().includes(triggerNode.config.filter.toLowerCase()) && !snippet.toLowerCase().includes(triggerNode.config.filter.toLowerCase())) {
          triggerPassed = false;
        }

        if (triggerPassed) {
          triggeredMessage = detailData;
          break;
        }
      }
    }

    if (!triggeredMessage) {
      logRun(true, 'No trigger matched (checked last 5 emails).');
      return res.json({ success: true, message: 'No trigger matched (checked last 5 emails).', createdTask: null });
    }

    // 2. Check condition
    if (conditionNode && conditionNode.config?.value) {
       const snippet = (triggeredMessage.snippet || '').toLowerCase();
       const conditionValue = conditionNode.config.value.toLowerCase();
       if (!snippet.includes(conditionValue)) {
           logRun(true, 'Trigger matched, but condition not met.');
           return res.json({ success: true, message: 'Trigger matched, but condition not met.', createdTask: null });
       }
    }

    // 3. Execute action
    const newTask: Block = {
      id: "block-" + Date.now() + "-" + Math.floor(Math.random()*1000),
      type: 'task',
      content: actionNode.config?.title || 'Automated Task',
      properties: {
        status: 'todo',
        estimatedDurationMinutes: parseInt(actionNode.config?.duration) || 30,
        priority: actionNode.config?.priority || 'medium',
        anchoring: 'fluid',
        source: 'pipeline',
      },
      references: [],
      parentId: workflow.parentId || null,
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    blocks[newTask.id] = newTask;
    
    let runMessage = 'Workflow executed successfully.';
    if (token) {
      const timezone = req.body?.timezone || 'America/New_York';
      const { scheduledTasks } = await runChronos([newTask], token, timezone);
      if (scheduledTasks.length > 0 && scheduledTasks[0].properties.scheduledStart) {
        runMessage = `Created task '${newTask.content}', scheduled for ${new Date(scheduledTasks[0].properties.scheduledStart).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
      } else {
        runMessage = `Created task '${newTask.content}' (Unscheduled: Could not find time slot)`;
      }
    } else {
      runMessage = `Created task '${newTask.content}' (Unscheduled: No calendar access)`;
    }

    logRun(true, runMessage, newTask.id);

    res.json({ success: true, message: runMessage, createdTask: newTask });

  } catch (error: any) {
    console.error('Pipeline Error:', error);
    // Try to log the error if possible
    try {
       const userId = (req.headers['x-user-id'] as string) || 'guest';
       const timestamp = Date.now();
       const runBlock = {
         id: "run-" + timestamp + "-" + Math.floor(Math.random()*1000),
         type: 'workflow-run',
         content: `Run at ${new Date(timestamp).toLocaleString()}`,
         properties: { workflowId: req.params.workflowId, timestamp, success: false, message: error.message, createdTaskId: null },
         references: [],
         parentId: req.params.workflowId,
         userId,
         createdAt: timestamp,
         updatedAt: timestamp,
       };
       blocks[runBlock.id] = runBlock as any;
       saveDb();
    } catch(e) {}
    res.status(500).json({ error: error.message });
  }
});

// --- AI Routes ---

// Chatbot / Ask Mode
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { history, contextBlocks, useThinking, timezone } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'guest';
    const token = req.headers.authorization;
    
    // Assemble context
    let contextStr = 'Context:\n';
    let groundedMode = 'full';
    let groundedCount = contextBlocks?.length || 0;

    if (contextBlocks && contextBlocks.length > 40) {
      groundedMode = 'summarized';
      
      const activeTasks: any[] = [];
      const dbBlocks: any[] = [];
      const otherBlocks: any[] = [];
      
      const now = Date.now();
      const next7Days = now + 7 * 24 * 60 * 60 * 1000;
      
      for (const b of contextBlocks) {
        if (b.type === 'task') {
          const isDone = b.properties?.status === 'done';
          const dueDate = b.properties?.dueDate ? new Date(b.properties.dueDate).getTime() : null;
          const isNearTerm = dueDate && dueDate >= now && dueDate <= next7Days;
          if (!isDone || isNearTerm) {
            activeTasks.push(b);
          } else {
            otherBlocks.push(b);
          }
        } else if (b.type === 'database-view') {
          dbBlocks.push(b);
        } else {
          otherBlocks.push(b);
        }
      }
      
      contextStr += `[SUMMARIZED WORKSPACE VIEW]\n\n`;
      contextStr += `=== HIGH PRIORITY / ACTIVE TASKS ===\n`;
      if (activeTasks.length > 0) {
        contextStr += activeTasks.map(b => `[Task - ${b.id}] ${b.content} ${JSON.stringify(b.properties)}`).join('\n') + '\n\n';
      } else {
        contextStr += `(No active tasks found)\n\n`;
      }
      
      contextStr += `=== DATABASE VIEWS ===\n`;
      if (dbBlocks.length > 0) {
        contextStr += dbBlocks.map(b => `[Database - ${b.id}] ${b.content} (Metadata: ${JSON.stringify(b.properties)})`).join('\n') + '\n\n';
      } else {
        contextStr += `(No database views found)\n\n`;
      }
      
      if (otherBlocks.length > 0) {
        try {
          const otherStr = otherBlocks.map(b => `[${b.type}] ${b.content}`).join('\n').substring(0, 30000);
          const compressRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Compress the following workspace blocks into a concise structured digest. Highlight key topics, recurring themes, page titles, and notable entities. Do not list everything verbatim, just provide a high-level map of what exists in this workspace.\n\n${otherStr}`,
          });
          contextStr += `=== WORKSPACE DIGEST ===\n${compressRes.text}\n\n`;
        } catch (err) {
          console.warn("Failed to compress other blocks:", err);
          contextStr += `=== WORKSPACE DIGEST ===\n(Failed to generate digest for ${otherBlocks.length} older/archived blocks)\n\n`;
        }
      }
    } else if (contextBlocks && contextBlocks.length > 0) {
      contextStr += contextBlocks.map((b: any) => "[" + b.type + " - " + b.id + "] " + b.content + " " + JSON.stringify(b.properties)).join('\n');
    }

    const modelName = useThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';
    const baseSysInstruct = groundedMode === 'summarized' 
      ? "You are the AI assistant for Project Synapse, a universal block-based workspace. You are currently in Global Graph mode and are seeing a summarized digest of the workspace (not literally every block). If the user references something too specific that is not present in the summary, politely ask a clarifying question. Use function calling to execute commands requested by the user."
      : "You are the AI assistant for Project Synapse, a universal block-based workspace. Use the provided block context to answer questions, or use function calling to execute commands requested by the user.";
    
    const config: any = {
      systemInstruction: baseSysInstruct + "\n\n" + contextStr,
    };

    const contents = history.map((msg: any) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const functionDeclarations = [
      {
        name: 'create_task',
        description: 'Create a new fluid task in the workspace',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            estimatedDurationMinutes: { type: Type.INTEGER },
            priority: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            anchoring: { type: Type.STRING }
          },
          required: ["title"]
        }
      },
      {
        name: 'update_task_status',
        description: 'Update the status of an existing task block',
        parameters: {
          type: Type.OBJECT,
          properties: {
            blockId: { type: Type.STRING },
            status: { type: Type.STRING }
          },
          required: ["blockId", "status"]
        }
      },
      {
        name: 'schedule_fluid_tasks',
        description: 'Schedule unscheduled fluid tasks using Chronos engine',
        parameters: {
          type: Type.OBJECT,
          properties: {
            dummy: { type: Type.STRING, description: "Ignore this parameter" }
          }
        }
      }
    ];

    if (useThinking) {
      config.thinkingConfig = { thinkingLevel: 2 }; // HIGH
      config.tools = [{ functionDeclarations }];
    } else {
      config.tools = [{ googleSearch: {} }, { functionDeclarations }];
      config.toolConfig = { includeServerSideToolInvocations: true };
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
    } catch (apiError: any) {
      if ((apiError.message?.includes('429') || apiError.message?.includes('RESOURCE_EXHAUSTED')) && useThinking) {
        console.warn('Pro model rate limited (429), falling back to Flash...');
        config.thinkingConfig = undefined;
        response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents,
          config,
        });
      } else {
        throw apiError;
      }
    }

    const functionCalls = response.functionCalls;
    const actionsTaken: any[] = [];
    
    if (functionCalls && functionCalls.length > 0) {
      const functionResponseParts: any[] = [];
      
      for (const call of functionCalls) {
        if (call.name === 'create_task') {
          const { title, estimatedDurationMinutes, priority, dueDate, anchoring } = call.args as any;
          const newBlock: Block = {
            id: "block-" + Date.now() + "-" + Math.floor(Math.random()*1000),
            type: 'task',
            content: title || 'Automated Task',
            properties: {
              status: 'todo',
              estimatedDurationMinutes: estimatedDurationMinutes || 30,
              priority: priority || 'medium',
              anchoring: anchoring || 'fluid',
              dueDate,
              source: 'ai'
            },
            references: [],
            parentId: `space-${userId}`,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          blocks[newBlock.id] = newBlock;
          if (blocks[`space-${userId}`]) {
            blocks[`space-${userId}`].references.push(newBlock.id);
          }
          saveDb();
          
          let scheduledStart = null;
          if (token) {
            const { scheduledTasks } = await runChronos([newBlock], token, timezone || 'America/New_York');
            if (scheduledTasks.length > 0 && scheduledTasks[0].properties.scheduledStart) {
              scheduledStart = scheduledTasks[0].properties.scheduledStart;
            }
          }

          if (scheduledStart) {
            actionsTaken.push({ type: 'created_and_scheduled_task', blockId: newBlock.id, title, scheduledStart });
          } else {
            actionsTaken.push({ type: 'created_task', blockId: newBlock.id, title });
          }
          
          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: { success: true, id: newBlock.id, title, scheduledStart }
            }
          });
        } else if (call.name === 'update_task_status') {
          const { blockId, status } = call.args as any;
          if (blocks[blockId] && blocks[blockId].userId === userId) {
            blocks[blockId] = { ...blocks[blockId], properties: { ...blocks[blockId].properties, status }, updatedAt: Date.now() };
            saveDb();
            actionsTaken.push({ type: 'update_task_status', blockId, status });
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { success: true, blockId, status }
              }
            });
          } else {
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { success: false, error: 'block not found or unauthorized' }
              }
            });
          }
        } else if (call.name === 'schedule_fluid_tasks') {
          if (!token) {
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { success: false, error: 'User has not provided calendar access token' }
              }
            });
          } else {
            // Find user's unscheduled tasks
            const userTasks = Object.values(blocks).filter(b => b.userId === userId && b.type === 'task' && !b.properties?.scheduledStart && (!b.properties?.status || b.properties.status === 'todo') && (b.properties?.anchoring === 'fluid' || !b.properties?.anchoring));
            try {
              const { scheduledTasks } = await runChronos(userTasks, token, timezone || 'America/New_York');
              for (const sched of scheduledTasks) {
                if (blocks[sched.id]) {
                  blocks[sched.id].properties.scheduledStart = sched.scheduledStart;
                  blocks[sched.id].properties.scheduledEnd = sched.scheduledEnd;
                }
              }
              saveDb();
              actionsTaken.push({ type: 'scheduled_tasks', count: scheduledTasks.length });
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true, count: scheduledTasks.length }
                }
              });
            } catch (err: any) {
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { success: false, error: err.message }
                }
              });
            }
          }
        }
      }

      const secondCallContents = [
        ...contents,
        response.candidates?.[0]?.content || { role: 'model', parts: response.functionCalls.map((fc: any) => ({ functionCall: fc })) },
        { role: 'user', parts: functionResponseParts }
      ];

      // Second call to get natural language confirmation
      let response2;
      try {
        response2 = await ai.models.generateContent({
          model: modelName,
          contents: secondCallContents,
          config: { ...config, tools: [] }, // avoid loop
        });
      } catch (apiError2: any) {
        if ((apiError2.message?.includes('429') || apiError2.message?.includes('RESOURCE_EXHAUSTED')) && useThinking) {
          console.warn('Pro model rate limited (429) on step 2, falling back to Flash...');
          const fallbackConfig = { ...config, tools: [] };
          fallbackConfig.thinkingConfig = undefined;
          response2 = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: secondCallContents,
            config: fallbackConfig,
          });
        } else {
          throw apiError2;
        }
      }

      return res.json({ result: response2.text, actionsTaken, groundedMode, groundedCount });
    }

    res.json({ result: response.text, actionsTaken: [], groundedMode, groundedCount });
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('AI Rate limit exceeded (429).');
      return res.status(429).json({ error: "I'm receiving too many requests right now and my circuits are a bit overloaded. Could you give me a few seconds to catch my breath?" });
    } else {
      console.error('AI Ask Error:', error.message || error);
    }
    res.status(500).json({ error: error.message });
  }
});

// Fast AI Action (Summarize / Rewrite) - Flash Lite
app.post('/api/ai/fast-action', async (req, res) => {
  try {
    const { action, text } = req.body;
    let prompt = '';
    if (action === 'summarize') prompt = "Summarize the following text concisely:\n\n" + text;
    else if (action === 'rewrite') prompt = "Rewrite the following text to be more professional and clear:\n\n" + text;
    else prompt = action + ":\n\n" + text;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });
    res.json({ result: response.text });
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('AI Rate limit exceeded (429).');
      return res.status(429).json({ error: "I'm receiving too many requests right now. Let me catch my breath for a second before we continue." });
    } else {
      console.error('AI Fast Action Error:', error.message || error);
    }
    res.status(500).json({ error: error.message });
  }
});

// Prompt-to-Pipeline Compiler
app.post('/api/ai/compile-pipeline', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const systemInstruction = `You are an AI that compiles natural language into a structured JSON workflow for Project Synapse.
You must respond with ONLY raw JSON, with no markdown formatting (e.g. no \`\`\`json or \`\`\`).
The output JSON must exactly match this schema:
{
  "nodes": [
    { "id": "string", "type": "string", "config": {} }
  ],
  "edges": [
    { "from": "node_id", "to": "node_id" }
  ]
}

Available node types and their required config:
- trigger.gmail: { filter: string }
- condition.contains: { value: string }
- action.createTask: { title: string, duration: number, priority: 'low'|'medium'|'high'|'critical' }

Connect them in order (trigger -> condition -> action).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    let jsonStr = response.text || '';
    
    // Defensive parsing: strip markdown fences if the model still outputs them
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    
    try {
      const compiled = JSON.parse(jsonStr);
      if (!compiled.nodes || !compiled.edges) {
        throw new Error("Missing nodes or edges array");
      }
      res.json(compiled);
    } catch (parseError) {
      console.error("Failed to parse pipeline JSON:", jsonStr);
      res.status(500).json({ error: "Failed to compile pipeline: Invalid JSON format from AI." });
    }
  } catch (error: any) {
    console.error('AI Compile Pipeline Error:', error.message || error);
    res.status(500).json({ error: error.message });
  }
});

// --- Workspace Integration Routes ---
// The client will pass the Google OAuth token in the Authorization header.

app.get('/api/workspace/drive', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,webViewLink)', {
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data.files || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/gmail', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
      headers: { Authorization: token },
    });
    const data = await response.json();
    
    if (!data.messages) return res.json([]);

    // Fetch details for the messages
    const messages = await Promise.all(data.messages.map(async (m: any) => {
      const detailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + m.id, {
        headers: { Authorization: token },
      });
      return await detailRes.json();
    }));

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/calendar', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const timeMin = new Date().toISOString();
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=" + timeMin + "&maxResults=10&singleEvents=true&orderBy=startTime", {
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data.items || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workspace/calendar/event', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const { title, startISO, endISO } = req.body;
    
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: 'POST',
      headers: { 
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title || 'Synapse Task',
        start: { dateTime: startISO },
        end: { dateTime: endISO }
      })
    });
    
    if (response.status === 403) {
      return res.status(403).json({ error: 'Missing calendar write scope. Please reconnect with full permissions.' });
    }
    
    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: data.error?.message || 'Failed to create event' });
    }
    
    res.json({ id: data.id, htmlLink: data.htmlLink });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/workspace/calendar/event/:eventId', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const { eventId } = req.params;
    const { title, startISO, endISO } = req.body;
    
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events/" + eventId, {
      method: 'PUT',
      headers: { 
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title || 'Synapse Task',
        start: { dateTime: startISO },
        end: { dateTime: endISO }
      })
    });
    
    if (response.status === 403) {
      return res.status(403).json({ error: 'Missing calendar write scope. Please reconnect with full permissions.' });
    }
    
    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: data.error?.message || 'Failed to update event' });
    }
    
    res.json({ id: data.id, htmlLink: data.htmlLink });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/tasks', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    // First get the default task list
    const listsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
      headers: { Authorization: token },
    });
    const listsData = await listsRes.json();
    const defaultList = listsData.items?.[0];
    
    if (!defaultList) return res.json([]);
    
    // Then get tasks from that list
    const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultList.id}/tasks?showCompleted=false&maxResults=10`, {
      headers: { Authorization: token },
    });
    const tasksData = await tasksRes.json();
    res.json(tasksData.items || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/docs', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    // Use Drive API to find recent Google Docs
    const response = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&pageSize=5&orderBy=modifiedTime desc&fields=files(id,name,webViewLink)", {
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data.files || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log("Server running on http://localhost:" + PORT);
  });
}

startServer();
