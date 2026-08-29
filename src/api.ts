import { Block } from './types';
import { auth, getAccessToken } from './auth';

const getHeaders = async () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.currentUser?.uid) {
    headers['X-User-Id'] = auth.currentUser.uid;
  }
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

export const api = {
  getBlocks: async (): Promise<Block[]> => {
    const headers = await getHeaders();
    const res = await fetch('/api/blocks', { headers });
    return res.json();
  },
  createBlock: async (block: Partial<Block>): Promise<Block> => {
    const headers = await getHeaders();
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers,
      body: JSON.stringify(block),
    });
    return res.json();
  },
  updateBlock: async (id: string, updates: Partial<Block>): Promise<Block> => {
    const headers = await getHeaders();
    const res = await fetch('/api/blocks/' + id, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  deleteBlock: async (id: string): Promise<void> => {
    const headers = await getHeaders();
    await fetch('/api/blocks/' + id, {
      method: 'DELETE',
      headers,
    });
  },
  askAI: async (history: {role: string, text: string}[], contextBlocks: Block[], useThinking: boolean = false) => {
    const headers = await getHeaders();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers,
      body: JSON.stringify({ history, contextBlocks, useThinking, timezone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to communicate with AI');
    return data;
  },
  fastAI: async (action: string, text: string) => {
    const headers = await getHeaders();
    const res = await fetch('/api/ai/fast-action', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to communicate with AI');
    return data;
  }
};
