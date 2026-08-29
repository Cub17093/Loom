export type BlockType = 'space' | 'page' | 'paragraph' | 'task' | 'gmail' | 'drive' | 'calendar' | 'table' | 'event' | 'database-view' | 'workflow' | 'workflow-run';

export interface Block {
  id: string;
  type: BlockType;
  content: string; // Text or serialized content
  // Task properties may include:
  // estimatedDurationMinutes: number
  // priority: 'low' | 'medium' | 'high' | 'critical'
  // dueDate: string (ISO date)
  // anchoring: 'fixed' | 'bounded' | 'fluid'
  // scheduledStart: string (ISO datetime)
  // scheduledEnd: string (ISO datetime)
  // isSplittable: boolean
  // minimumChunkMinutes: number
  // tag: string
  properties: Record<string, any>;
  references: string[]; // Edges to other blocks
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
}
