export type TabType = 'simulator' | 'code' | 'benchmark' | 'workflow' | 'architecture';

export type CollectionAction = 'Add' | 'Remove' | 'Move' | 'Reset';

export interface CollectionEvent {
  id: string;
  timestamp: string;
  action: CollectionAction;
  details: string;
  item?: string;
  oldIndex?: number;
  newIndex?: number;
  threadId?: number;
}

export interface QueueItem {
  id: string;
  value: string;
  addedAt: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  moveCount: number;
}

export interface BenchmarkResultItem {
  method: string;
  category: 'Add_Enqueue' | 'ConcurrentStress' | 'Reorder_Move' | 'TryTake_Dequeue';
  n: number;
  mean: string;
  error: string;
  stdDev: string;
  median: string;
  ratio: string;
  ratioSD: string;
  allocated: string;
  allocRatio: string;
}

export interface CSharpFileItem {
  id: string;
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
  category: 'core' | 'benchmarks' | 'tests' | 'workflows' | 'solution';
}
