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
  targetFramework: 'net6.0' | 'net48';
  itemCount: number;
  mean: string;
  meanNs: number;
  error: string;
  stdDev: string;
  ratio: string;
  gen0: string;
  gen1: string;
  allocated: string;
  allocatedBytes: number;
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
