import React from 'react';
import { 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Workflow, 
  CheckCircle2, 
  Zap, 
  GitBranch, 
  BookOpen, 
  Lock,
  Code2
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-5">
      {/* High-Level Architecture Overview */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
            Internal Architecture &amp; Data Structures
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mb-4 font-mono">
          <code className="text-blue-300 font-semibold">ConcurrentObservableReorderableCollection&lt;T&gt;</code> is built to satisfy three conflicting requirements simultaneously:
          <strong className="text-slate-100"> thread-safety</strong>, <strong className="text-slate-100">instantaneous O(1) reordering</strong>, and <strong className="text-slate-100">deadlock-safe observable UI notifications</strong> via <code className="text-slate-200">INotifyCollectionChanged</code>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded bg-[#0B0F19] border border-[#1E293B]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-100 font-mono">O(1) Node Indexing</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal font-mono">
              Combines an internal <code className="text-slate-200">LinkedList&lt;T&gt;</code> with a synchronized <code className="text-slate-200">Dictionary&lt;T, LinkedListNode&lt;T&gt;&gt;</code>. Locating source and target nodes happens in O(1) time without linear scanning.
            </p>
          </div>

          <div className="p-3 rounded bg-[#0B0F19] border border-[#1E293B]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-100 font-mono">Deadlock-Safe Event Dispatch</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal font-mono">
              State mutations are completed under lock, then event arguments are prepared and dispatched <strong>outside</strong> the critical lock section. This guarantees external UI thread subscribers cannot cause deadlocks.
            </p>
          </div>

          <div className="p-3 rounded bg-[#0B0F19] border border-[#1E293B]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-100 font-mono">Multi-Targeting (.NET 6 &amp; 4.8)</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal font-mono">
              Targets both modern cross-platform <code className="text-slate-200">net6.0</code> and legacy enterprise <code className="text-slate-200">net48</code> using conditional compilation symbols (<code className="text-slate-200">NET6_0_OR_GREATER</code>) and reference imports for <code className="text-slate-200">WindowsBase</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Deep Dive Section: MoveBefore & MoveAfter Mechanics */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 mb-2.5">
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          Reordering Mechanics (<code className="text-blue-300 font-mono text-[11px]">MoveBefore</code> &amp; <code className="text-blue-300 font-mono text-[11px]">MoveAfter</code>)
        </h3>

        <div className="bg-[#0B0F19] text-slate-200 p-3 rounded border border-[#1E293B] font-mono text-xs overflow-x-auto mb-3">
          <pre>{`// 1. O(1) Hash Map lookup for source and target node pointers
if (_nodeMap.TryGetValue(source, out var sourceNode) &&
    _nodeMap.TryGetValue(target, out var targetNode))
{
    // 2. Relink doubly-linked node pointers in O(1)
    _list.Remove(sourceNode);
    _list.AddBefore(targetNode, sourceNode); // or _list.AddAfter(targetNode, sourceNode);

    // 3. Snapshot indices for INotifyCollectionChanged
    collectionArgs = new NotifyCollectionChangedEventArgs(
        NotifyCollectionChangedAction.Move,
        source,
        newIndex,
        oldIndex);
}`}</pre>
        </div>

        <div className="text-xs text-slate-300 font-mono space-y-1.5">
          <p>
            <strong className="text-slate-100">Behavior on Duplicates or Identity:</strong> If <code className="text-slate-200">source == target</code> or either item does not exist, the method immediately returns <code className="text-slate-200">false</code> without firing spurious events.
          </p>
          <p>
            <strong className="text-slate-100">Behavior on Add:</strong> When calling <code className="text-slate-200">Add(item)</code>, if the item is already present in the collection, it is atomically relocated to the tail and an appropriate <code className="text-slate-200">NotifyCollectionChangedAction.Move</code> event is fired.
          </p>
        </div>
      </div>

      {/* CI & Benchmark Strategy */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 mb-2.5">
          <Workflow className="w-3.5 h-3.5 text-purple-400" />
          GitHub Actions Continuous Benchmark Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300 font-mono">
          <div className="p-3 bg-[#0B0F19] rounded border border-[#1E293B]">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Windows-Latest Runner Environment
            </h4>
            <p className="text-[11px] text-slate-400">
              By specifying <code className="text-slate-200">runs-on: windows-latest</code>, GitHub Actions supplies both the full .NET Framework 4.8 GAC and modern .NET 6/8 SDKs on the same runner host.
            </p>
          </div>

          <div className="p-3 bg-[#0B0F19] rounded border border-[#1E293B]">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Regression Alerting via github-action-benchmark
            </h4>
            <p className="text-[11px] text-slate-400">
              The workflow stores BenchmarkDotNet JSON reports into artifacts and compares pull request changes against the <code className="text-slate-200">main</code> baseline with a 130% threshold alert trigger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
