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

export type BlockType = 'space' | 'page' | 'paragraph' | 'task' | 'table' | 'gmail' | 'drive' | 'calendar';

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

// --- AI Routes ---

// Chatbot / Ask Mode
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { history, contextBlocks, useThinking } = req.body;
    
    // Assemble context
    let contextStr = 'Context:\n';
    if (contextBlocks && contextBlocks.length > 0) {
      contextStr += contextBlocks.map((b: any) => "[" + b.type + " - " + b.id + "] " + b.content + " " + JSON.stringify(b.properties)).join('\n');
    }

    let fullPrompt = contextStr + "\n\nConversation History:\n";
    for (const msg of history) {
      fullPrompt += (msg.role === 'user' ? 'User' : 'Assistant') + ": " + msg.text + "\n";
    }

    // Choose model based on whether high thinking is requested
    const modelName = useThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';
    const config: any = {
      systemInstruction: "You are the AI assistant for Loom, a universal block-based workspace. Use the provided block context to answer questions or generate content.",
    };

    if (useThinking) {
      config.thinkingConfig = { thinkingLevel: 2 }; // HIGH
    } else {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config,
    });

    res.json({ result: response.text });
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('AI Rate limit exceeded (429).');
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
    } else {
      console.error('AI Fast Action Error:', error.message || error);
    }
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
