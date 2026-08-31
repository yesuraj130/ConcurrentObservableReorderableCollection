import React from 'react';
import { TabType } from '../types';
import { 
  Layers, 
  Code2, 
  Gauge, 
  Workflow, 
  BookOpen, 
  Download, 
  CheckCircle2, 
  Zap,
  Sparkles
} from 'lucide-react';
import { downloadSolutionZip } from '../utils/zipExporter';
import confetti from 'canvas-confetti';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  itemCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, itemCount }) => {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSolutionZip();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } finally {
      setDownloading(false);
    }
  };

  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'simulator', label: 'Live Simulation', icon: <Layers className="w-4 h-4" />, badge: `${itemCount}` },
    { id: 'code', label: 'C# Code & Solution', icon: <Code2 className="w-4 h-4" /> },
    { id: 'benchmark', label: 'BenchmarkDotNet', icon: <Gauge className="w-4 h-4" /> },
    { id: 'workflow', label: 'GitHub Workflow', icon: <Workflow className="w-4 h-4" /> },
    { id: 'architecture', label: 'Architecture & Docs', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <header className="border-b border-[#1E293B] bg-[#0F172A] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Framework Badges */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              C#
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-100 text-sm sm:text-base tracking-tight leading-none">
                  ConcurrentObservableReorderableCollection&lt;T&gt;
                </h1>
                <span className="px-2 py-0.5 bg-[#1E293B] border border-emerald-500/30 text-emerald-400 text-[10px] rounded uppercase tracking-wider font-bold">
                  Thread-Safe
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                <span className="bg-[#1E293B] text-slate-300 px-1.5 py-0.2 rounded text-[10px] border border-[#334155]/40">net6.0</span>
                <span>•</span>
                <span className="bg-[#1E293B] text-slate-300 px-1.5 py-0.2 rounded text-[10px] border border-[#334155]/40">net48</span>
                <span>•</span>
                <span className="text-slate-400">INotifyCollectionChanged</span>
                <span>•</span>
                <span className="text-blue-400">O(1) Move</span>
              </div>
            </div>
          </div>

          {/* Action: Download Full Solution */}
          <div className="flex items-center gap-2">
            <button
              id="download-solution-btn"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Packing...' : 'Download Solution (.zip)'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 border-t border-[#1E293B] overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1E293B] text-slate-100 border border-[#334155]/70 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isActive ? 'bg-blue-600 text-white font-bold' : 'bg-[#0B0F19] text-slate-400 border border-[#334155]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
