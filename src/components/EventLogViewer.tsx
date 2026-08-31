import React from 'react';
import { CollectionEvent, CollectionAction } from '../types';
import { Radio, ListFilter, Trash2, ArrowRight } from 'lucide-react';

interface EventLogViewerProps {
  events: CollectionEvent[];
  onClear: () => void;
}

export const EventLogViewer: React.FC<EventLogViewerProps> = ({ events, onClear }) => {
  const [filter, setFilter] = React.useState<string>('all');

  const filteredEvents = React.useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.action === filter);
  }, [events, filter]);

  const getActionBadge = (action: CollectionAction) => {
    switch (action) {
      case 'Add':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50">Add</span>;
      case 'Remove':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/50">Remove</span>;
      case 'Move':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/50">Move</span>;
      case 'Reset':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/50">Reset</span>;
    }
  };

  return (
    <div className="bg-[#0F172A] rounded border border-[#1E293B] overflow-hidden flex flex-col h-full shadow-xs">
      <div className="p-3 border-b border-[#1E293B] bg-[#0F172A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            INotifyCollectionChanged Stream
          </h3>
          <span className="text-[10px] bg-[#1E293B] text-slate-300 border border-[#334155]/60 px-1.5 py-0.2 rounded font-mono">
            {events.length}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <div className="flex items-center gap-1 bg-[#0B0F19] border border-[#1E293B] rounded p-0.5 text-xs">
            <ListFilter className="w-3 h-3 text-slate-500 ml-1" />
            <button
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                filter === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('Add')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                filter === 'Add' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Add
            </button>
            <button
              onClick={() => setFilter('Remove')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                filter === 'Remove' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Remove
            </button>
            <button
              onClick={() => setFilter('Move')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                filter === 'Move' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-orange-400'
              }`}
            >
              Move
            </button>
          </div>

          <button
            onClick={onClear}
            title="Clear event history"
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#1E293B] rounded cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[340px] font-mono text-xs bg-[#0B0F19]">
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No events logged yet. Perform an Add, Move, or Take action to see dispatched notifications.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-2 rounded border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B]/40 transition-colors flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-slate-500 mt-0.5">{evt.timestamp}</span>
                {getActionBadge(evt.action)}
                <div className="text-slate-300">
                  <span className="font-semibold text-slate-100">{evt.details}</span>
                  {evt.action === 'Move' && evt.oldIndex !== undefined && evt.newIndex !== undefined && (
                    <span className="ml-2 text-orange-400 font-medium inline-flex items-center gap-1">
                      [{evt.oldIndex}] <ArrowRight className="w-2.5 h-2.5 inline" /> [{evt.newIndex}]
                    </span>
                  )}
                  {evt.action === 'Add' && evt.newIndex !== undefined && (
                    <span className="ml-2 text-emerald-400 font-medium">
                      at [{evt.newIndex}]
                    </span>
                  )}
                  {evt.action === 'Remove' && evt.oldIndex !== undefined && (
                    <span className="ml-2 text-rose-400 font-medium">
                      from [{evt.oldIndex}]
                    </span>
                  )}
                </div>
              </div>
              {evt.threadId !== undefined && (
                <span className="text-[9px] bg-[#1E293B] text-slate-400 border border-[#334155]/60 px-1.5 py-0.2 rounded shrink-0">
                  Thread #{evt.threadId}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
