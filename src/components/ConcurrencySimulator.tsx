import React from 'react';
import { QueueItem, CollectionEvent } from '../types';
import { Play, Square, Cpu, Activity, Zap, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

interface ConcurrencySimulatorProps {
  items: QueueItem[];
  setItems: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  addEvent: (event: Omit<CollectionEvent, 'id' | 'timestamp'>) => void;
}

export const ConcurrencySimulator: React.FC<ConcurrencySimulatorProps> = ({
  items,
  setItems,
  addEvent,
}) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [producerThreads, setProducerThreads] = React.useState(3);
  const [consumerThreads, setConsumerThreads] = React.useState(2);
  const [reorderThreads, setReorderThreads] = React.useState(2);
  const [opsPerSec, setOpsPerSec] = React.useState(0);
  const [totalOperations, setTotalOperations] = React.useState(0);
  const [addCount, setAddCount] = React.useState(0);
  const [takeCount, setTakeCount] = React.useState(0);
  const [reorderCount, setReorderCount] = React.useState(0);
  const [contentionRatio, setContentionRatio] = React.useState(0.04); // simulated lock contention %

  const isRunningRef = React.useRef(isRunning);
  isRunningRef.current = isRunning;

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const opsWindowRef = React.useRef<number[]>([]);

  // Simulation loop
  React.useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!isRunningRef.current) return;

      const current = [...itemsRef.current];
      let newOps = 0;

      // 1. Producer operations
      for (let p = 0; p < producerThreads; p++) {
        if (Math.random() > 0.3) {
          const val = `Task-${Math.floor(Math.random() * 9000 + 1000)}`;
          const newItem: QueueItem = {
            id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            value: val,
            addedAt: Date.now(),
            priority: 'normal',
            moveCount: 0,
          };
          current.push(newItem);
          newOps++;
          setAddCount(c => c + 1);
          if (Math.random() > 0.8) {
            addEvent({
              action: 'Add',
              details: `Thread #${p + 1} added "${val}"`,
              item: val,
              newIndex: current.length - 1,
              threadId: p + 1,
            });
          }
        }
      }

      // 2. Consumer operations
      for (let c = 0; c < consumerThreads; c++) {
        if (current.length > 0 && Math.random() > 0.4) {
          const removed = current.shift();
          newOps++;
          setTakeCount(tc => tc + 1);
          if (removed && Math.random() > 0.8) {
            addEvent({
              action: 'Remove',
              details: `Thread #${producerThreads + c + 1} dequeued "${removed.value}"`,
              item: removed.value,
              oldIndex: 0,
              threadId: producerThreads + c + 1,
            });
          }
        }
      }

      // 3. Reorderer operations
      for (let r = 0; r < reorderThreads; r++) {
        if (current.length >= 3 && Math.random() > 0.4) {
          const srcIdx = Math.floor(Math.random() * current.length);
          let tgtIdx = Math.floor(Math.random() * current.length);
          if (srcIdx !== tgtIdx) {
            const [srcItem] = current.splice(srcIdx, 1);
            srcItem.moveCount += 1;
            current.splice(tgtIdx, 0, srcItem);
            newOps++;
            setReorderCount(rc => rc + 1);
            if (Math.random() > 0.85) {
              addEvent({
                action: 'Move',
                details: `Thread #${producerThreads + consumerThreads + r + 1} MoveBefore("${srcItem.value}", "${current[tgtIdx]?.value || 'head'}")`,
                item: srcItem.value,
                oldIndex: srcIdx,
                newIndex: tgtIdx,
                threadId: producerThreads + consumerThreads + r + 1,
              });
            }
          }
        }
      }

      // Keep max size bounded for browser rendering safety
      if (current.length > 25) {
        current.splice(20);
      }

      setItems(current);
      setTotalOperations(t => t + newOps);

      // Throughput calculation
      opsWindowRef.current.push(newOps);
      if (opsWindowRef.current.length > 5) opsWindowRef.current.shift();
      const sum = opsWindowRef.current.reduce((a, b) => a + b, 0);
      const computedOpsSec = Math.round((sum / (opsWindowRef.current.length * 0.15)) * 10);
      setOpsPerSec(computedOpsSec);

      // Lock contention calculation
      const activeThreads = producerThreads + consumerThreads + reorderThreads;
      setContentionRatio(Math.min(0.18, +(0.015 * activeThreads * (0.8 + Math.random() * 0.4)).toFixed(3)));
    }, 150);

    return () => clearInterval(interval);
  }, [isRunning, producerThreads, consumerThreads, reorderThreads]);

  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  const handleResetCounters = () => {
    setTotalOperations(0);
    setAddCount(0);
    setTakeCount(0);
    setReorderCount(0);
    setOpsPerSec(0);
  };

  return (
    <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
        <div>
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Multi-Threaded Concurrency Stress Harness
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Simulate concurrent worker threads calling Add(), TryTake(), and MoveBefore() simultaneously.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="toggle-simulation-btn"
            onClick={toggleSimulation}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all shadow-xs ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3 h-3 fill-current" /> Stop Simulation
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" /> Run Stress Test
              </>
            )}
          </button>

          <button
            onClick={handleResetCounters}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] rounded border border-[#1E293B] cursor-pointer transition-colors"
            title="Reset telemetry counters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thread Sliders and Live Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
        {/* Producer Threads */}
        <div className="p-2.5 bg-[#1E293B]/40 rounded border border-[#1E293B]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-200 text-[11px]">Producers (Add)</span>
            <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-1.5 py-0.2 rounded">
              {producerThreads} threads
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            value={producerThreads}
            onChange={(e) => setProducerThreads(Number(e.target.value))}
            className="w-full h-1 bg-[#0B0F19] rounded appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Calls collection.Add()
          </span>
        </div>

        {/* Consumer Threads */}
        <div className="p-2.5 bg-[#1E293B]/40 rounded border border-[#1E293B]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-200 text-[11px]">Consumers (TryTake)</span>
            <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800/40 px-1.5 py-0.2 rounded">
              {consumerThreads} threads
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            value={consumerThreads}
            onChange={(e) => setConsumerThreads(Number(e.target.value))}
            className="w-full h-1 bg-[#0B0F19] rounded appearance-none cursor-pointer accent-rose-500"
          />
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Calls collection.TryTake()
          </span>
        </div>

        {/* Reorderer Threads */}
        <div className="p-2.5 bg-[#1E293B]/40 rounded border border-[#1E293B]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-200 text-[11px]">Reorderers (Move)</span>
            <span className="font-mono text-[10px] font-bold text-orange-400 bg-orange-950/70 border border-orange-800/40 px-1.5 py-0.2 rounded">
              {reorderThreads} threads
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            value={reorderThreads}
            onChange={(e) => setReorderThreads(Number(e.target.value))}
            className="w-full h-1 bg-[#0B0F19] rounded appearance-none cursor-pointer accent-orange-500"
          />
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Calls MoveBefore / MoveAfter
          </span>
        </div>
      </div>

      {/* Telemetry Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
        <div className="p-2.5 bg-[#0B0F19] border border-[#1E293B] rounded">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-2.5 h-2.5 text-emerald-400" /> Throughput
          </div>
          <div className="text-base font-bold font-mono mt-0.5 text-emerald-400">
            {opsPerSec.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">ops/sec</span>
          </div>
        </div>

        <div className="p-2.5 bg-[#0B0F19] border border-[#1E293B] rounded">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Total Mutations
          </div>
          <div className="text-base font-bold font-mono mt-0.5 text-slate-100">
            {totalOperations.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 bg-[#0B0F19] border border-[#1E293B] rounded">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Add / Take Ratio
          </div>
          <div className="text-xs font-semibold font-mono mt-1 text-slate-200">
            +{addCount} / -{takeCount}
          </div>
        </div>

        <div className="p-2.5 bg-[#0B0F19] border border-[#1E293B] rounded">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            O(1) Moves
          </div>
          <div className="text-base font-bold font-mono mt-0.5 text-orange-400">
            {reorderCount.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 bg-[#0B0F19] border border-[#1E293B] rounded col-span-2 sm:col-span-1">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" /> Contention
          </div>
          <div className="text-xs font-bold font-mono mt-1 text-emerald-400">
            {(contentionRatio * 100).toFixed(1)}% <span className="text-[9px] font-normal text-slate-500">lock wait</span>
          </div>
        </div>
      </div>
    </div>
  );
};
