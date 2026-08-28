export type BlockType = 'space' | 'page' | 'paragraph' | 'task' | 'gmail' | 'drive' | 'calendar' | 'table' | 'event' | 'database-view' | 'workflow' | 'workflow-run';

export interface Block {
  id: string;
  type: BlockType;
  content: string; // Text or serialized content
  properties: Record<string, any>;
  references: string[]; // Edges to other blocks
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
}
