/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TabType, QueueItem, CollectionEvent } from './types';
import { Navbar } from './components/Navbar';
import { VisualQueueExplorer } from './components/VisualQueueExplorer';
import { ConcurrencySimulator } from './components/ConcurrencySimulator';
import { EventLogViewer } from './components/EventLogViewer';
import { CodeExplorer } from './components/CodeExplorer';
import { BenchmarkViewer } from './components/BenchmarkViewer';
import { WorkflowSimulator } from './components/WorkflowSimulator';
import { ArchitectureGuide } from './components/ArchitectureGuide';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<TabType>('simulator');

  // Shared state for the interactive collection
  const [items, setItems] = React.useState<QueueItem[]>([
    { id: 'item-1', value: 'HighPriority-Task', addedAt: Date.now() - 4000, priority: 'critical', moveCount: 0 },
    { id: 'item-2', value: 'RenderPipelineJob', addedAt: Date.now() - 3000, priority: 'normal', moveCount: 0 },
    { id: 'item-3', value: 'DatabaseBackupSync', addedAt: Date.now() - 2000, priority: 'normal', moveCount: 0 },
    { id: 'item-4', value: 'SendEmailDigest', addedAt: Date.now() - 1000, priority: 'low', moveCount: 0 },
  ]);

  const [events, setEvents] = React.useState<CollectionEvent[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      action: 'Reset',
      details: 'Collection initialized with 4 items for .NET 6.0 / .NET 4.8 runtime',
    },
  ]);

  const addEvent = (eventData: Omit<CollectionEvent, 'id' | 'timestamp'>) => {
    const newEvent: CollectionEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
  };

  const handleClearEvents = () => {
    setEvents([]);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#94A3B8] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        itemCount={items.length}
      />

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {activeTab === 'simulator' && (
          <div className="space-y-5">
            {/* Visual Queue & Controls */}
            <VisualQueueExplorer
              items={items}
              setItems={setItems}
              addEvent={addEvent}
            />

            {/* Two-Column: Concurrency Stress Harness & Live Event Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7">
                <ConcurrencySimulator
                  items={items}
                  setItems={setItems}
                  addEvent={addEvent}
                />
              </div>
              <div className="lg:col-span-5">
                <EventLogViewer
                  events={events}
                  onClear={handleClearEvents}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <CodeExplorer />
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkViewer />
        )}

        {activeTab === 'workflow' && (
          <WorkflowSimulator />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0F172A] py-3 mt-auto font-mono text-[11px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-0.5"></span>
            <span className="font-semibold text-slate-200">ConcurrentObservableReorderableCollection&lt;T&gt;</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Targeting .NET 6.0 &amp; .NET Framework 4.8</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-[#1E293B] text-slate-300 text-[10px]">BenchmarkDotNet v0.14.0</span>
            <span>INotifyCollectionChanged</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
