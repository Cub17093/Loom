import { Block } from './types';
import { auth } from './auth';

const getHeaders = () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.currentUser?.uid) {
    headers['X-User-Id'] = auth.currentUser.uid;
  }
  return headers;
};

export const api = {
  getBlocks: async (): Promise<Block[]> => {
    const res = await fetch('/api/blocks', { headers: getHeaders() });
    return res.json();
  },
  createBlock: async (block: Partial<Block>): Promise<Block> => {
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(block),
    });
    return res.json();
  },
  updateBlock: async (id: string, updates: Partial<Block>): Promise<Block> => {
    const res = await fetch('/api/blocks/' + id, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  deleteBlock: async (id: string): Promise<void> => {
    await fetch('/api/blocks/' + id, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },
  askAI: async (history: {role: string, text: string}[], contextBlocks: Block[], useThinking: boolean = false) => {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ history, contextBlocks, useThinking }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to communicate with AI');
    return data;
  },
  fastAI: async (action: string, text: string) => {
    const res = await fetch('/api/ai/fast-action', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to communicate with AI');
    return data;
  }
};
