import React from 'react';
import { Play, CheckCircle2, Terminal, AlertCircle, RefreshCw, Layers, ExternalLink, ShieldCheck } from 'lucide-react';

interface Step {
  id: string;
  name: string;
  command: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  logs: string[];
}

export const WorkflowSimulator: React.FC = () => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(-1);
  const [steps, setSteps] = React.useState<Step[]>([
    {
      id: 'step-1',
      name: 'Checkout Repository',
      command: 'uses: actions/checkout@v4',
      status: 'idle',
      logs: [
        'Syncing repository: your-org/ConcurrentObservableReorderableCollection',
        'Getting Git data from remote...',
        'HEAD is now at 8b4c291 Fix concurrent reorder event dispatching',
      ],
    },
    {
      id: 'step-2',
      name: 'Setup .NET SDK (6.0.x & 8.0.x)',
      command: 'uses: actions/setup-dotnet@v4',
      status: 'idle',
      logs: [
        'Resolved .NET 6.0.428 (x64) from global cache',
        'Resolved .NET 8.0.204 (x64) from global cache',
        '.NET Framework 4.8 runtime detected via Windows OS image',
      ],
    },
    {
      id: 'step-3',
      name: 'Restore Dependencies',
      command: 'dotnet restore ./benchmarks/ConcurrentObservableReorderableCollection.Benchmarks',
      status: 'idle',
      logs: [
        'Restoring packages for ConcurrentObservableReorderableCollection.csproj (net6.0;net48)...',
        'Restoring packages for ConcurrentObservableReorderableCollection.Benchmarks.csproj...',
        'Installed BenchmarkDotNet 0.14.0',
        'Installed BenchmarkDotNet.Diagnostics.Windows 0.14.0 (for net48)',
        'Restore completed in 842ms.',
      ],
    },
    {
      id: 'step-4',
      name: 'Build Benchmarks (Release)',
      command: 'dotnet build -c Release --no-restore',
      status: 'idle',
      logs: [
        'Microsoft (R) Build Engine version 17.8.3',
        'ConcurrentObservableReorderableCollection -> bin/Release/net6.0/ConcurrentObservableReorderableCollection.dll',
        'ConcurrentObservableReorderableCollection -> bin/Release/net48/ConcurrentObservableReorderableCollection.dll',
        'ConcurrentObservableReorderableCollection.Benchmarks -> bin/Release/net6.0/ConcurrentObservableReorderableCollection.Benchmarks.dll',
        'ConcurrentObservableReorderableCollection.Benchmarks -> bin/Release/net48/ConcurrentObservableReorderableCollection.Benchmarks.exe',
        'Build succeeded: 0 Warning(s), 0 Error(s)',
      ],
    },
    {
      id: 'step-5',
      name: 'Run BenchmarkDotNet (.NET 6.0)',
      command: 'dotnet run -c Release --no-build -f net6.0 -- --exporters json,brief',
      status: 'idle',
      logs: [
        '// ***** BenchmarkRunner: Start *****',
        '// Benchmark Process 12444 has started',
        '// Job: .NET 6.0.428 (X64), Hardware Intrinsics=AVX2',
        'Add_ReorderableCollection: Mean = 18.42 us, Gen0 = 3.9063, Allocated = 24.1 KB',
        'TryTake_ReorderableCollection: Mean = 14.08 us, Allocated = 0 B',
        'MoveBefore_HeadAndTail: Mean = 42.15 ns, Allocated = 0 B',
        'MoveAfter_MidToHead: Mean = 40.82 ns, Allocated = 0 B',
        'Exported results: BenchmarkDotNet.Artifacts/net6.0/results/*.json',
      ],
    },
    {
      id: 'step-6',
      name: 'Run BenchmarkDotNet (.NET Framework 4.8)',
      command: 'dotnet run -c Release --no-build -f net48 -- --exporters json,brief',
      status: 'idle',
      logs: [
        '// ***** BenchmarkRunner: Start (.NET Framework 4.8) *****',
        '// Job: Clr 4.8.9220.0 (X64), Legacy JIT/RyuJIT',
        'Add_ReorderableCollection: Mean = 26.85 us, Gen0 = 5.8594, Allocated = 36.8 KB',
        'TryTake_ReorderableCollection: Mean = 21.30 us, Allocated = 0 B',
        'MoveBefore_HeadAndTail: Mean = 61.40 ns, Allocated = 0 B',
        'MoveAfter_MidToHead: Mean = 58.90 ns, Allocated = 0 B',
        'Exported results: BenchmarkDotNet.Artifacts/net48/results/*.json',
      ],
    },
    {
      id: 'step-7',
      name: 'Output Benchmark Result Table to Step Summary',
      command: 'powershell: Extract markdown tables to $GITHUB_STEP_SUMMARY',
      status: 'idle',
      logs: [
        'Reading BenchmarkDotNet.Artifacts/results/*report-github.md...',
        'Generated GitHub Step Summary table for .NET 6.0 and .NET Framework 4.8',
        '| Method | Mean | Gen0 | Allocated |',
        '| MoveBefore_HeadAndTail | 42.15 ns | - | - |',
        '| MoveAfter_MidToHead | 40.82 ns | - | - |',
        'Appended benchmark markdown tables directly to GitHub Actions Summary.',
      ],
    },
  ]);

  const runWorkflow = () => {
    setIsRunning(true);
    setCurrentStepIndex(0);

    // Reset steps
    setSteps(prev => prev.map(s => ({ ...s, status: 'idle' })));

    let index = 0;
    const interval = setInterval(() => {
      if (index >= steps.length) {
        clearInterval(interval);
        setIsRunning(false);
        return;
      }

      setSteps(prev => prev.map((s, idx) => {
        if (idx < index) return { ...s, status: 'success' };
        if (idx === index) return { ...s, status: 'running' };
        return { ...s, status: 'idle' };
      }));

      setCurrentStepIndex(index);

      setTimeout(() => {
        setSteps(prev => prev.map((s, idx) => {
          if (idx <= index) return { ...s, status: 'success' };
          return s;
        }));
      }, 700);

      index++;
    }, 1100);
  };

  return (
    <div className="space-y-5">
      {/* Workflow Header Banner */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
              GitHub Actions Benchmark Runner (.github/workflows/benchmark.yml)
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800/50">
              windows-latest
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Automates BenchmarkDotNet across .NET 6.0 and .NET Framework 4.8 with continuous regression checks.
          </p>
        </div>

        <button
          id="trigger-workflow-btn"
          onClick={runWorkflow}
          disabled={isRunning}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-semibold cursor-pointer active:scale-98 transition-all shadow-xs shrink-0"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Running CI Pipeline...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              Trigger Workflow Run
            </>
          )}
        </button>
      </div>

      {/* Pipeline Steps Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Step list */}
        <div className="lg:col-span-5 space-y-1.5">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
            Workflow Execution Graph
          </h3>
          {steps.map((step, idx) => {
            const isSelected = currentStepIndex === idx || (currentStepIndex === -1 && idx === 0);
            return (
              <div
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                  step.status === 'running'
                    ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500'
                    : step.status === 'success'
                    ? 'border-emerald-800/50 bg-[#0F172A] hover:bg-[#1E293B]/50'
                    : 'border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {step.status === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : step.status === 'running' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-[#334155] flex items-center justify-center text-[9px] font-mono text-slate-400">
                        {idx + 1}
                      </div>
                    )}
                    <span className="font-semibold text-slate-200 text-xs">{step.name}</span>
                  </div>
                  <span className={`text-[9px] font-mono uppercase ${
                    step.status === 'success' ? 'text-emerald-400' : step.status === 'running' ? 'text-blue-400' : 'text-slate-500'
                  }`}>
                    {step.status}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1 pl-5.5 truncate">
                  {step.command}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Terminal Output Console */}
        <div className="lg:col-span-7 bg-[#0B0F19] rounded border border-[#1E293B] flex flex-col overflow-hidden shadow-xs">
          <div className="p-2.5 bg-[#0F172A] border-b border-[#1E293B] flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-200 text-xs">Step Logs: {currentStepIndex >= 0 ? steps[currentStepIndex].name : 'Workflow Terminal'}</span>
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Live Runner
            </span>
          </div>

          <div className="p-3 flex-1 font-mono text-xs text-slate-300 overflow-y-auto space-y-1 min-h-[340px] max-h-[400px]">
            {currentStepIndex >= 0 ? (
              steps[currentStepIndex].logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-600 select-none text-[10px]">[{i + 1}]</span>
                  <span className={log.includes('faster') || log.includes('succeeded') ? 'text-emerald-400' : log.includes('error') ? 'text-rose-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 py-10 text-center font-mono">
                Click "Trigger Workflow Run" to execute the full CI benchmark pipeline and watch real-time output.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
