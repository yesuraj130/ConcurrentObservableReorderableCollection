import React from 'react';
import { CSharpFileItem } from '../types';
import { CSHARP_FILES } from '../data/csharpCodebase';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  FolderTree, 
  Search, 
  Terminal, 
  Layers,
  FileCheck2,
  Workflow
} from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = React.useState<string>('core-cs');
  const [copied, setCopied] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const selectedFile = CSHARP_FILES.find(f => f.id === selectedFileId) || CSHARP_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const filteredFiles = CSHARP_FILES.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          file.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: CSharpFileItem['category']) => {
    switch (category) {
      case 'core': return <FileCode className="w-3.5 h-3.5 text-indigo-600" />;
      case 'benchmarks': return <Terminal className="w-3.5 h-3.5 text-amber-600" />;
      case 'tests': return <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'workflows': return <Workflow className="w-3.5 h-3.5 text-purple-600" />;
      case 'solution': return <Layers className="w-3.5 h-3.5 text-zinc-600" />;
    }
  };

  return (
    <div className="bg-[#0F172A] rounded border border-[#1E293B] overflow-hidden shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        {/* Left Sidebar: File Tree */}
        <div className="lg:col-span-4 border-r border-[#1E293B] bg-[#0F172A] flex flex-col">
          {/* File list header & search */}
          <div className="p-3 border-b border-[#1E293B] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                Solution Explorer
              </span>
              <span className="text-[10px] bg-[#1E293B] text-slate-300 border border-[#334155]/60 px-1.5 py-0.2 rounded font-mono">
                {CSHARP_FILES.length} files
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter solution files..."
                className="w-full text-xs font-mono pl-8 pr-2 py-1.5 bg-[#0B0F19] text-slate-200 border border-[#1E293B] rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 font-mono">
              {['all', 'core', 'workflows', 'benchmarks', 'tests'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-[#1E293B] text-slate-400 hover:text-slate-200 border border-[#334155]/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFiles.map(file => {
              const isSelected = file.id === selectedFile.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E293B] border border-blue-500/60 shadow-xs'
                      : 'hover:bg-[#1E293B]/50 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      {getCategoryIcon(file.category)}
                      <span className={`truncate font-mono text-[11px] ${isSelected ? 'font-bold text-slate-100' : 'text-slate-300'}`}>
                        {file.name}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">
                      {file.language}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate pl-5 font-mono">
                    {file.path}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="lg:col-span-8 flex flex-col bg-[#0B0F19] text-slate-200">
          {/* Viewer Toolbar */}
          <div className="p-2.5 bg-[#0F172A] border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              {getCategoryIcon(selectedFile.category)}
              <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                {selectedFile.path}
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#1E293B] hover:bg-[#334155] text-slate-200 rounded border border-[#334155]/60 cursor-pointer transition-colors"
                title="Copy file contents"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#1E293B] hover:bg-[#334155] text-slate-200 rounded border border-[#334155]/60 cursor-pointer transition-colors"
                title="Download this single file"
              >
                <Download className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Description banner */}
          <div className="px-3.5 py-1.5 bg-[#0B0F19] border-b border-[#1E293B] text-[11px] text-slate-400 font-mono">
            {selectedFile.description}
          </div>

          {/* Syntax Code Container */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed selection:bg-blue-600 selection:text-white">
            <pre className="text-slate-300">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
