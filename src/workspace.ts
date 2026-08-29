import { getAccessToken } from './auth';
import { api } from './api';

export const workspaceApi = {
  createCalendarEvent: async (title: string, startISO: string, endISO: string) => {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch('/api/workspace/calendar/event', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, startISO, endISO })
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Calendar error: ' + (data.error || 'Failed to create event.'));
      return null;
    }
    return data;
  },
  updateCalendarEvent: async (eventId: string, title: string, startISO: string, endISO: string) => {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch('/api/workspace/calendar/event/' + eventId, {
      method: 'PUT',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, startISO, endISO })
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Calendar error: ' + (data.error || 'Failed to update event.'));
      return null;
    }
    return data;
  },
  importDriveFiles: async (parentId: string) => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/workspace/drive', { headers: { Authorization: 'Bearer ' + token } });
    const files = await res.json();
    return Promise.all(files.map((f: any) => 
      api.createBlock({
        type: 'drive',
        content: f.name,
        parentId,
        properties: { mimeType: f.mimeType, link: f.webViewLink }
      })
    ));
  },
  importGmail: async (parentId: string) => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/workspace/gmail', { headers: { Authorization: 'Bearer ' + token } });
    const emails = await res.json();
    return Promise.all(emails.map((msg: any) => {
      const subject = msg.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
      return api.createBlock({
        type: 'gmail',
        content: subject,
        parentId,
        properties: { snippet: msg.snippet, id: msg.id }
      });
    }));
  },
  importCalendar: async (parentId: string) => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/workspace/calendar', { headers: { Authorization: 'Bearer ' + token } });
    const events = await res.json();
    return Promise.all(events.map((e: any) => 
      api.createBlock({
        type: 'calendar',
        content: e.summary || 'Busy',
        parentId,
        properties: { start: e.start?.dateTime, end: e.end?.dateTime, link: e.htmlLink }
      })
    ));
  },
  importTasks: async (parentId: string) => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/workspace/tasks', { headers: { Authorization: 'Bearer ' + token } });
    const tasks = await res.json();
    return Promise.all(tasks.map((t: any) => 
      api.createBlock({
        type: 'task',
        content: t.title || 'Untitled Task',
        parentId,
        properties: { status: t.status === 'needsAction' ? 'todo' : 'done', notes: t.notes }
      })
    ));
  },
  importDocs: async (parentId: string) => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/workspace/docs', { headers: { Authorization: 'Bearer ' + token } });
    const docs = await res.json();
    return Promise.all(docs.map((d: any) => 
      api.createBlock({
        type: 'drive',
        content: d.name || 'Untitled Doc',
        parentId,
        properties: { mimeType: 'application/vnd.google-apps.document', link: d.webViewLink }
      })
    ));
  }
};
