import React from 'react';
import { BENCHMARK_RESULTS } from '../data/benchmarkData';
import { 
  Gauge, 
  TrendingUp, 
  Cpu, 
  MemoryStick, 
  CheckCircle2, 
  Layers, 
  Zap, 
  ArrowUpRight,
  Filter
} from 'lucide-react';

export const BenchmarkViewer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedRuntime, setSelectedRuntime] = React.useState<string>('all');

  const filteredResults = BENCHMARK_RESULTS.filter(res => {
    const matchesCategory = 
      selectedCategory === 'all' ||
      (selectedCategory === 'Add' && res.method.includes('Add')) ||
      (selectedCategory === 'TryTake' && res.method.includes('TryTake')) ||
      (selectedCategory === 'Reorder' && (res.method.includes('MoveBefore') || res.method.includes('MoveAfter'))) ||
      (selectedCategory === 'Concurrent' && res.method.includes('Concurrent'));

    const matchesRuntime = selectedRuntime === 'all' || res.targetFramework === selectedRuntime;

    return matchesCategory && matchesRuntime;
  });

  return (
    <div className="space-y-5">
      {/* Benchmark Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-emerald-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">O(1) Move Reordering</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              Sub-Microsecond
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-100">
            40.82 ns <span className="text-xs font-normal text-slate-400">(.NET 6.0)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Zero GC allocations (0 B allocated) with instantaneous pointer relinking.
          </p>
        </div>

        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-blue-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Concurrent Add &amp; Take</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/50">
              High-Throughput
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-100">
            18.42 μs <span className="text-xs font-normal text-slate-400">/ 1,000 ops</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Over 54,000,000 items/sec throughput under optimized locking invariants.
          </p>
        </div>

        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-orange-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Runtime Delta (.NET 6 vs 4.8)</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/50">
              ~30-45% Faster
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-emerald-400">
            1.45x <span className="text-xs font-normal text-slate-400">speedup in .NET 6.0</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Enhanced JIT tiering, dynamic PGO, and modernized collection intrinsics in .NET 6.0.
          </p>
        </div>
      </div>

      {/* BenchmarkDotNet Output Table */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] overflow-hidden shadow-xs">
        {/* Table header with filters */}
        <div className="p-3 border-b border-[#1E293B] bg-[#0F172A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              BenchmarkDotNet Results Matrix
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-[#1E293B] border border-[#334155]/60 px-1.5 py-0.2 rounded">
              v0.14.0
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap font-mono">
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
              <span className="text-[10px] text-slate-500 font-medium px-1">Category:</span>
              {['all', 'Add', 'TryTake', 'Reorder', 'Concurrent'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                    selectedCategory === cat ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
              <span className="text-[10px] text-slate-500 font-medium px-1">Runtime:</span>
              {['all', 'net6.0', 'net48'].map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedRuntime(rt)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                    selectedRuntime === rt ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0B0F19] font-mono text-[10px] text-slate-400">
                <th className="py-2.5 px-3 font-semibold uppercase">Method</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Runtime</th>
                <th className="py-2.5 px-3 font-semibold uppercase">N</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Mean</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Error</th>
                <th className="py-2.5 px-3 font-semibold uppercase">StdDev</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Ratio</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Gen0</th>
                <th className="py-2.5 px-3 font-semibold uppercase">Allocated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] font-mono text-slate-300">
              {filteredResults.map((row, idx) => {
                const isNet6 = row.targetFramework === 'net6.0';
                return (
                  <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-slate-200">
                      {row.method}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        isNet6 ? 'bg-blue-950 text-blue-300 border border-blue-800/50' : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                      }`}>
                        {row.targetFramework}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{row.itemCount}</td>
                    <td className="py-2 px-3 font-semibold text-slate-100">{row.mean}</td>
                    <td className="py-2 px-3 text-slate-500">{row.error}</td>
                    <td className="py-2 px-3 text-slate-500">{row.stdDev}</td>
                    <td className="py-2 px-3">
                      <span className={`font-semibold ${
                        row.ratio === '1.00' ? 'text-slate-400' : Number(row.ratio) > 1 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {row.ratio}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{row.gen0}</td>
                    <td className="py-2 px-3">
                      <span className={row.allocated === '0 B' ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                        {row.allocated}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Environmental Metadata footnote */}
        <div className="p-2.5 bg-[#0B0F19] border-t border-[#1E293B] text-[10px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
          <div>
            BenchmarkDotNet v0.14.0, Windows 11 / Server 2022 (x64), Hardware Intrinsics enabled.
          </div>
          <div className="text-slate-400">
            [MemoryDiagnoser] [SimpleJob(net6.0)] [SimpleJob(net48)]
          </div>
        </div>
      </div>
    </div>
  );
};
