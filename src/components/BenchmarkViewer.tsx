import React from 'react';
import { BENCHMARK_RESULTS } from '../data/benchmarkData';
import { 
  Gauge, 
  Search,
  Zap,
  TrendingDown,
  Layers,
  ArrowDownUp,
  SlidersHorizontal
} from 'lucide-react';

export const BenchmarkViewer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedN, setSelectedN] = React.useState<string>('all');
  const [selectedCollection, setSelectedCollection] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const filteredResults = BENCHMARK_RESULTS.filter(res => {
    const matchesCategory = selectedCategory === 'all' || res.category === selectedCategory;
    const matchesN = selectedN === 'all' || res.n.toString() === selectedN;
    
    const matchesCollection = 
      selectedCollection === 'all' ||
      (selectedCollection === 'Reorderable' && res.method.includes('ReorderableCollection')) ||
      (selectedCollection === 'ConcurrentQueue' && res.method.includes('ConcurrentQueue')) ||
      (selectedCollection === 'ObservableCollection' && res.method.includes('ObservableCollection'));

    const matchesSearch = searchQuery === '' || 
      res.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesN && matchesCollection && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Benchmark Summary Cards comparing the 3 Collections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-emerald-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Reorder_Move: N=10,000</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              12.7x Faster / 233x Less RAM
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-100">
            9.525 μs <span className="text-xs font-normal text-slate-400">vs 121.293 μs (Queue)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-semibold">736 B</span> allocated vs <span className="text-amber-400 font-semibold">172,024 B</span> in ConcurrentQueue (drain &amp; rebuild).
          </p>
        </div>

        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-blue-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ConcurrentStress: N=10,000</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/50">
              5.1x Faster vs Locked ObsCol
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-100">
            139.910 μs <span className="text-xs font-normal text-slate-400">vs 715.180 μs (ObsCol)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Reorderable queue delivers constant multi-threaded throughput while locked ObservableCollection degrades rapidly under lock contention.
          </p>
        </div>

        <div className="bg-[#0F172A] p-4 rounded border-l-2 border-purple-500 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">TryTake vs RemoveFirst: N=10k</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/50">
              6.2x Faster
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-100">
            567.130 μs <span className="text-xs font-normal text-slate-400">vs 3,522.548 μs (ObsCol)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            O(1) LinkedList node removal avoids O(N) array copy shifts required when calling <code className="text-purple-300">RemoveAt(0)</code>.
          </p>
        </div>
      </div>

      {/* BenchmarkDotNet Output Table */}
      <div className="bg-[#0F172A] rounded border border-[#1E293B] overflow-hidden shadow-xs">
        {/* Table header with filters */}
        <div className="p-3 border-b border-[#1E293B] bg-[#0F172A] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              BenchmarkDotNet Results Matrix
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-[#1E293B] border border-[#334155]/60 px-1.5 py-0.2 rounded">
              39 Benchmarks
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap font-mono">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search methods..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#0B0F19] border border-[#1E293B] text-slate-200 text-xs rounded pl-7 pr-2 py-1 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
              <span className="text-[10px] text-slate-500 font-medium px-1">Category:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'Add_Enqueue', label: 'Add/Enqueue' },
                { id: 'ConcurrentStress', label: 'Stress' },
                { id: 'Reorder_Move', label: 'Reorder/Move' },
                { id: 'TryTake_Dequeue', label: 'Take/Dequeue' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                    selectedCategory === cat.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* N Size Filter */}
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
              <span className="text-[10px] text-slate-500 font-medium px-1">N:</span>
              {[
                { id: 'all', label: 'All' },
                { id: '100', label: '100' },
                { id: '1000', label: '1,000' },
                { id: '10000', label: '10,000' },
              ].map(nOpt => (
                <button
                  key={nOpt.id}
                  onClick={() => setSelectedN(nOpt.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                    selectedN === nOpt.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {nOpt.label}
                </button>
              ))}
            </div>

            {/* Collection Filter */}
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
              <span className="text-[10px] text-slate-500 font-medium px-1">Target:</span>
              {[
                { id: 'all', label: 'All 3' },
                { id: 'Reorderable', label: 'Reorderable' },
                { id: 'ConcurrentQueue', label: 'Queue' },
                { id: 'ObservableCollection', label: 'ObsCol' },
              ].map(col => (
                <button
                  key={col.id}
                  onClick={() => setSelectedCollection(col.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                    selectedCollection === col.id ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {col.label}
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
                <th className="py-2.5 px-2.5 font-semibold uppercase">Categories</th>
                <th className="py-2.5 px-2 font-semibold uppercase text-right">N</th>
                <th className="py-2.5 px-3 font-semibold uppercase text-right">Mean</th>
                <th className="py-2.5 px-2.5 font-semibold uppercase text-right">Error</th>
                <th className="py-2.5 px-2.5 font-semibold uppercase text-right">StdDev</th>
                <th className="py-2.5 px-3 font-semibold uppercase text-right">Median</th>
                <th className="py-2.5 px-2.5 font-semibold uppercase text-right">Ratio</th>
                <th className="py-2.5 px-2 font-semibold uppercase text-right">RatioSD</th>
                <th className="py-2.5 px-3 font-semibold uppercase text-right">Allocated</th>
                <th className="py-2.5 px-2.5 font-semibold uppercase text-right">Alloc Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] font-mono text-slate-300">
              {filteredResults.map((row, idx) => {
                const isReorderable = row.method.includes('ReorderableCollection');
                const isQueue = row.method.includes('ConcurrentQueue');
                const isObs = row.method.includes('ObservableCollection');

                const isRatioBaseline = row.ratio === '1.00';
                const ratioNum = parseFloat(row.ratio);
                const isRatioHigh = ratioNum > 1.05;
                const isRatioLow = ratioNum < 0.95;

                return (
                  <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isReorderable ? 'bg-emerald-400' : isQueue ? 'bg-blue-400' : 'bg-amber-400'
                        }`} />
                        <span>{row.method}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#1E293B] text-slate-300 border border-slate-700/60">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-400">{row.n.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-100">{row.mean}</td>
                    <td className="py-2 px-2.5 text-right text-slate-500">{row.error}</td>
                    <td className="py-2 px-2.5 text-right text-slate-500">{row.stdDev}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{row.median}</td>
                    <td className="py-2 px-2.5 text-right">
                      <span className={`font-semibold ${
                        isRatioBaseline ? 'text-slate-400' : isRatioHigh ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {row.ratio}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500">{row.ratioSD}</td>
                    <td className="py-2 px-3 text-right font-medium">
                      <span className={row.allocated === '736 B' || row.allocated === '0 B' ? 'text-emerald-400' : 'text-slate-200'}>
                        {row.allocated}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className={`font-medium ${
                        row.allocRatio === '1.00' || row.allocRatio === '1.000'
                          ? 'text-slate-400'
                          : parseFloat(row.allocRatio) > 1
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {row.allocRatio}
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
            BenchmarkDotNet v0.14.0 | Categories: Add_Enqueue, ConcurrentStress, Reorder_Move, TryTake_Dequeue
          </div>
          <div className="text-slate-400">
            Showing {filteredResults.length} of {BENCHMARK_RESULTS.length} benchmarks
          </div>
        </div>
      </div>
    </div>
  );
};
