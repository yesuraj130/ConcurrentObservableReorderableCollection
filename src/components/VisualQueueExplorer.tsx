import React from 'react';
import { QueueItem, CollectionEvent } from '../types';
import { 
  Plus, 
  Minus, 
  ArrowLeftRight, 
  Shuffle, 
  RotateCcw, 
  Sparkles, 
  Info, 
  Search, 
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VisualQueueExplorerProps {
  items: QueueItem[];
  setItems: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  addEvent: (event: Omit<CollectionEvent, 'id' | 'timestamp'>) => void;
}

export const VisualQueueExplorer: React.FC<VisualQueueExplorerProps> = ({
  items,
  setItems,
  addEvent,
}) => {
  const [newItemValue, setNewItemValue] = React.useState('');
  const [selectedSource, setSelectedSource] = React.useState<string>('');
  const [selectedTarget, setSelectedTarget] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Add item
  const handleAdd = (val?: string) => {
    const valueToAdd = (val || newItemValue).trim();
    if (!valueToAdd) {
      showFeedback('error', 'Please enter a value to add');
      return;
    }

    // Check if already exists in collection
    const existingIndex = items.findIndex(i => i.value.toLowerCase() === valueToAdd.toLowerCase());

    if (existingIndex !== -1) {
      // Relocate existing item to tail as per C# ConcurrentObservableReorderableCollection specs
      const existingItem = items[existingIndex];
      const newItems = [...items.filter((_, idx) => idx !== existingIndex), existingItem];
      setItems(newItems);
      addEvent({
        action: 'Move',
        details: `Add("${valueToAdd}") relocated existing item to tail`,
        item: valueToAdd,
        oldIndex: existingIndex,
        newIndex: newItems.length - 1,
      });
      showFeedback('info', `Item "${valueToAdd}" already existed; relocated to tail (index ${newItems.length - 1})`);
    } else {
      const newItem: QueueItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        value: valueToAdd,
        addedAt: Date.now(),
        priority: 'normal',
        moveCount: 0,
      };

      const newItems = [...items, newItem];
      setItems(newItems);
      addEvent({
        action: 'Add',
        details: `Add("${newItem.value}") appended to tail`,
        item: newItem.value,
        newIndex: newItems.length - 1,
      });
      showFeedback('success', `Added "${newItem.value}" at index ${newItems.length - 1}`);
    }

    setNewItemValue('');
  };

  // TryTake (FIFO Dequeue)
  const handleTryTake = () => {
    if (items.length === 0) {
      showFeedback('error', 'TryTake() returned false: Collection is empty');
      return;
    }

    const head = items[0];
    const newItems = items.slice(1);
    setItems(newItems);

    addEvent({
      action: 'Remove',
      details: `TryTake(out item) successfully dequeued head item "${head.value}"`,
      item: head.value,
      oldIndex: 0,
    });

    if (selectedSource === head.id) setSelectedSource('');
    if (selectedTarget === head.id) setSelectedTarget('');

    showFeedback('success', `TryTake(out T item) dequeued "${head.value}" from head`);
  };

  // MoveBefore
  const handleMoveBefore = () => {
    if (!selectedSource || !selectedTarget) {
      showFeedback('error', 'Select both a Source item and Target item to move');
      return;
    }

    if (selectedSource === selectedTarget) {
      showFeedback('error', 'MoveBefore returned false: Source and Target cannot be identical');
      return;
    }

    const srcIdx = items.findIndex(i => i.id === selectedSource);
    const tgtIdx = items.findIndex(i => i.id === selectedTarget);

    if (srcIdx === -1 || tgtIdx === -1) {
      showFeedback('error', 'Item not found in collection');
      return;
    }

    // If source is already immediately before target, no-op
    if (srcIdx === tgtIdx - 1) {
      showFeedback('info', `MoveBefore returned true: "${items[srcIdx].value}" is already immediately before "${items[tgtIdx].value}"`);
      return;
    }

    const srcItem = { ...items[srcIdx], moveCount: items[srcIdx].moveCount + 1 };
    const temp = items.filter((_, idx) => idx !== srcIdx);
    const newTgtIdx = temp.findIndex(i => i.id === selectedTarget);

    const newItems = [
      ...temp.slice(0, newTgtIdx),
      srcItem,
      ...temp.slice(newTgtIdx),
    ];

    const newIdx = newItems.findIndex(i => i.id === selectedSource);
    setItems(newItems);

    addEvent({
      action: 'Move',
      details: `MoveBefore("${srcItem.value}", "${items[tgtIdx].value}")`,
      item: srcItem.value,
      oldIndex: srcIdx,
      newIndex: newIdx,
    });

    showFeedback('success', `Moved "${srcItem.value}" immediately before "${items[tgtIdx].value}" (index ${srcIdx} -> ${newIdx})`);
  };

  // MoveAfter
  const handleMoveAfter = () => {
    if (!selectedSource || !selectedTarget) {
      showFeedback('error', 'Select both a Source item and Target item to move');
      return;
    }

    if (selectedSource === selectedTarget) {
      showFeedback('error', 'MoveAfter returned false: Source and Target cannot be identical');
      return;
    }

    const srcIdx = items.findIndex(i => i.id === selectedSource);
    const tgtIdx = items.findIndex(i => i.id === selectedTarget);

    if (srcIdx === -1 || tgtIdx === -1) {
      showFeedback('error', 'Item not found in collection');
      return;
    }

    // If source is already immediately after target, no-op
    if (srcIdx === tgtIdx + 1) {
      showFeedback('info', `MoveAfter returned true: "${items[srcIdx].value}" is already immediately after "${items[tgtIdx].value}"`);
      return;
    }

    const srcItem = { ...items[srcIdx], moveCount: items[srcIdx].moveCount + 1 };
    const temp = items.filter((_, idx) => idx !== srcIdx);
    const newTgtIdx = temp.findIndex(i => i.id === selectedTarget);

    const newItems = [
      ...temp.slice(0, newTgtIdx + 1),
      srcItem,
      ...temp.slice(newTgtIdx + 1),
    ];

    const newIdx = newItems.findIndex(i => i.id === selectedSource);
    setItems(newItems);

    addEvent({
      action: 'Move',
      details: `MoveAfter("${srcItem.value}", "${items[tgtIdx].value}")`,
      item: srcItem.value,
      oldIndex: srcIdx,
      newIndex: newIdx,
    });

    showFeedback('success', `Moved "${srcItem.value}" immediately after "${items[tgtIdx].value}" (index ${srcIdx} -> ${newIdx})`);
  };

  // Clear
  const handleClear = () => {
    if (items.length === 0) return;
    setItems([]);
    setSelectedSource('');
    setSelectedTarget('');
    addEvent({
      action: 'Reset',
      details: 'Clear() purged all nodes and reset collection',
    });
    showFeedback('info', 'Collection cleared (NotifyCollectionChangedAction.Reset dispatched)');
  };

  // Seed Data Presets
  const seedPresets = (preset: 'tasks' | 'jobs' | 'orders') => {
    let sampleData: string[] = [];
    if (preset === 'tasks') {
      sampleData = ['Task-Alpha', 'Task-Beta', 'Task-Gamma', 'Task-Delta', 'Task-Epsilon'];
    } else if (preset === 'jobs') {
      sampleData = ['RenderPipeline', 'DatabaseBackup', 'ComputeShaders', 'SendDigestEmail', 'IndexSearchDocs'];
    } else {
      sampleData = ['Order #1042', 'Order #1043', 'VIP Order #1044', 'Order #1045', 'Express Order #1046'];
    }

    const newQueue: QueueItem[] = sampleData.map((val, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      value: val,
      addedAt: Date.now() + idx,
      priority: val.includes('VIP') || val.includes('Express') ? 'critical' : 'normal',
      moveCount: 0,
    }));

    setItems(newQueue);
    addEvent({
      action: 'Reset',
      details: `Loaded preset: ${preset} (${newQueue.length} items)`,
    });
    showFeedback('success', `Loaded ${newQueue.length} sample items`);
  };

  const filteredItems = searchQuery
    ? items.filter(i => i.value.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  return (
    <div className="space-y-5">
      {/* Control Action Panel */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Interactive Method Controls
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Execute live collection operations and observe atomic mutations and event dispatches.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-slate-400 uppercase mr-1">Presets:</span>
            <button
              onClick={() => seedPresets('tasks')}
              className="px-2 py-1 rounded text-xs bg-[#1E293B] border border-[#334155]/60 text-slate-300 hover:text-slate-100 hover:bg-[#334155] font-mono cursor-pointer transition-colors"
            >
              Task Queue
            </button>
            <button
              onClick={() => seedPresets('jobs')}
              className="px-2 py-1 rounded text-xs bg-[#1E293B] border border-[#334155]/60 text-slate-300 hover:text-slate-100 hover:bg-[#334155] font-mono cursor-pointer transition-colors"
            >
              Worker Jobs
            </button>
            <button
              onClick={() => seedPresets('orders')}
              className="px-2 py-1 rounded text-xs bg-[#1E293B] border border-[#334155]/60 text-slate-300 hover:text-slate-100 hover:bg-[#334155] font-mono cursor-pointer transition-colors"
            >
              Priority Orders
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {/* Add(T item) */}
          <div className="p-3 rounded bg-[#1E293B]/40 border-l-2 border-blue-500 border border-[#1E293B] flex flex-col justify-between hover:bg-[#1E293B]/60 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <code className="font-mono text-xs font-bold text-blue-300">Add(T item)</code>
                <span className="text-[9px] bg-slate-800 text-blue-300 px-1.5 py-0.2 rounded font-mono">O(1)</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                Appends item to tail; relocates to tail if item already exists.
              </p>
              <input
                type="text"
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Urgent Task"
                className="w-full text-xs font-mono px-2 py-1 bg-[#0B0F19] text-slate-200 border border-[#1E293B] focus:border-blue-500 rounded focus:outline-none mb-2"
              />
            </div>
            <button
              id="add-item-btn"
              onClick={() => handleAdd()}
              className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold cursor-pointer active:scale-98 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Execute Add()
            </button>
          </div>

          {/* TryTake(out T item) */}
          <div className="p-3 rounded bg-[#1E293B]/40 border-l-2 border-emerald-500 border border-[#1E293B] flex flex-col justify-between hover:bg-[#1E293B]/60 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <code className="font-mono text-xs font-bold text-emerald-300">TryTake(out T)</code>
                <span className="text-[9px] bg-slate-800 text-emerald-300 px-1.5 py-0.2 rounded font-mono">O(1)</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                Dequeues and returns the head item (FIFO order).
              </p>
              <div className="p-1.5 bg-[#0B0F19] rounded border border-[#1E293B] mb-2 text-xs font-mono">
                <span className="text-slate-500 text-[10px]">Current Head: </span>
                <span className="font-semibold text-slate-200 truncate">
                  {items.length > 0 ? items[0].value : '<empty>'}
                </span>
              </div>
            </div>
            <button
              id="try-take-btn"
              onClick={handleTryTake}
              disabled={items.length === 0}
              className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded text-xs font-semibold cursor-pointer active:scale-98 transition-all"
            >
              <Minus className="w-3.5 h-3.5" /> Execute TryTake()
            </button>
          </div>

          {/* MoveBefore & MoveAfter Controls */}
          <div className="p-3 rounded bg-[#1E293B]/40 border-l-2 border-orange-500 border border-[#1E293B] lg:col-span-2 flex flex-col justify-between hover:bg-[#1E293B]/60 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <code className="font-mono text-xs font-bold text-orange-300">
                  MoveBefore &amp; MoveAfter
                </code>
                <span className="text-[9px] bg-slate-800 text-orange-300 px-1.5 py-0.2 rounded font-mono">O(1) Reordering</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                Select source and target items to reposition instantaneously.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-2 font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Source:
                  </label>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="w-full text-xs px-2 py-1 bg-[#0B0F19] text-slate-200 border border-[#1E293B] focus:border-blue-500 rounded focus:outline-none"
                  >
                    <option value="">Select source...</option>
                    {items.map((it, idx) => (
                      <option key={it.id} value={it.id}>
                        [{idx}] {it.value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Target:
                  </label>
                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="w-full text-xs px-2 py-1 bg-[#0B0F19] text-slate-200 border border-[#1E293B] focus:border-blue-500 rounded focus:outline-none"
                  >
                    <option value="">Select target...</option>
                    {items.map((it, idx) => (
                      <option key={it.id} value={it.id}>
                        [{idx}] {it.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="move-before-btn"
                onClick={handleMoveBefore}
                disabled={!selectedSource || !selectedTarget || selectedSource === selectedTarget}
                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#1E293B] hover:bg-orange-600 border border-orange-500/40 hover:border-orange-600 disabled:opacity-40 text-orange-200 hover:text-white rounded text-xs font-semibold cursor-pointer active:scale-98 transition-all"
              >
                <ArrowLeftRight className="w-3 h-3" /> MoveBefore()
              </button>
              <button
                id="move-after-btn"
                onClick={handleMoveAfter}
                disabled={!selectedSource || !selectedTarget || selectedSource === selectedTarget}
                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#1E293B] hover:bg-orange-600 border border-orange-500/40 hover:border-orange-600 disabled:opacity-40 text-orange-200 hover:text-white rounded text-xs font-semibold cursor-pointer active:scale-98 transition-all"
              >
                <ArrowLeftRight className="w-3 h-3" /> MoveAfter()
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`mt-3 p-2 rounded text-xs flex items-center gap-2 border font-mono ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : feedback.type === 'error'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                  : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : feedback.type === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visual Doubly-Linked Node Pipeline */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Live Collection State (Doubly-Linked List &amp; Hash Map)
            </h3>
            <span className="text-[10px] bg-[#1E293B] text-slate-300 border border-[#334155]/60 px-1.5 py-0.2 rounded font-mono font-medium">
              Count = {items.length}
            </span>
            <span className="text-[10px] bg-[#1E293B] text-slate-300 border border-[#334155]/60 px-1.5 py-0.2 rounded font-mono font-medium">
              IsEmpty = {items.length === 0 ? 'true' : 'false'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find item (Contains)..."
                className="text-xs pl-7 pr-2 py-1 bg-[#0B0F19] border border-[#1E293B] rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 font-mono"
              />
            </div>

            <button
              onClick={handleClear}
              disabled={items.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 rounded cursor-pointer disabled:opacity-30 transition-colors font-mono"
            >
              <RotateCcw className="w-3 h-3" /> Clear()
            </button>
          </div>
        </div>

        {/* Nodes Flow */}
        <div className="min-h-[130px] p-3 bg-[#0B0F19] rounded border border-[#1E293B] overflow-x-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Info className="w-5 h-5 text-slate-600 mb-1" />
              <p className="text-xs text-slate-400 font-medium">Collection is currently empty (IsEmpty = true)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Use Add(item) or choose a sample preset above to populate nodes.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1 min-w-max">
              {/* Head Pointer Indicator */}
              <div className="flex flex-col items-center mr-1">
                <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-950 border border-blue-700/50 px-1.5 py-0.2 rounded">
                  HEAD
                </span>
                <span className="text-[9px] text-slate-500 font-mono">↓</span>
              </div>

              {filteredItems.map((item, index) => {
                const isHead = index === 0;
                const isTail = index === items.length - 1;
                const isSelectedSrc = selectedSource === item.id;
                const isSelectedTgt = selectedTarget === item.id;

                return (
                  <React.Fragment key={item.id}>
                    <motion.div
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className={`relative w-44 rounded p-2.5 border transition-all ${
                        isSelectedSrc
                          ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500'
                          : isSelectedTgt
                          ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                          : 'border-[#1E293B] bg-[#0F172A] hover:border-[#334155]'
                      }`}
                    >
                      {/* Node Header info */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-[#1E293B] text-slate-300">
                          [{index}]
                        </span>
                        <div className="flex items-center gap-1">
                          {isHead && (
                            <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-950 border border-blue-800/50 px-1 rounded">
                              HEAD
                            </span>
                          )}
                          {isTail && (
                            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800/50 px-1 rounded">
                              TAIL
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Value display */}
                      <div className="font-mono text-xs font-bold text-slate-100 truncate mb-1" title={item.value}>
                        {item.value}
                      </div>

                      {/* Node metadata */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#1E293B] font-mono">
                        <span className="text-slate-500">#{item.id.slice(-4)}</span>
                        {item.moveCount > 0 && (
                          <span className="text-orange-400">
                            {item.moveCount} reorders
                          </span>
                        )}
                      </div>

                      {/* Quick Select Buttons */}
                      <div className="grid grid-cols-2 gap-1 mt-1.5 font-mono">
                        <button
                          onClick={() => setSelectedSource(isSelectedSrc ? '' : item.id)}
                          className={`text-[9px] py-0.5 rounded font-medium cursor-pointer transition-colors ${
                            isSelectedSrc
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#1E293B] text-slate-300 hover:bg-[#334155]'
                          }`}
                        >
                          {isSelectedSrc ? 'Source ✓' : 'Set Src'}
                        </button>
                        <button
                          onClick={() => setSelectedTarget(isSelectedTgt ? '' : item.id)}
                          className={`text-[9px] py-0.5 rounded font-medium cursor-pointer transition-colors ${
                            isSelectedTgt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#1E293B] text-slate-300 hover:bg-[#334155]'
                          }`}
                        >
                          {isSelectedTgt ? 'Target ✓' : 'Set Tgt'}
                        </button>
                      </div>
                    </motion.div>

                    {/* Bi-directional pointer connector */}
                    {!isTail && (
                      <div className="flex flex-col items-center justify-center px-0.5 text-slate-600">
                        <span className="text-[8px] font-mono text-slate-500 leading-none">→</span>
                        <div className="w-3 h-0.5 bg-[#1E293B] my-0.5" />
                        <span className="text-[8px] font-mono text-slate-500 leading-none">←</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Tail Pointer Indicator */}
              <div className="flex flex-col items-center ml-1">
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                  TAIL
                </span>
                <span className="text-[9px] text-slate-500 font-mono">↓</span>
              </div>
            </div>
          )}
        </div>

        {/* Legend / Info bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-[#1E293B] text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span>Source Node (Selected for Move)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Target Node (Reference Anchor)</span>
            </span>
          </div>
          <span className="text-slate-500">
            Hash map indexing enables direct O(1) node reference lookup.
          </span>
        </div>
      </div>
    </div>
  );
};
