using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Configs;
using BenchmarkDotNet.Diagnosers;
using ConcurrentCollections;

namespace ConcurrentCollections.Benchmarks
{
    [MemoryDiagnoser]
    [GroupBenchmarksBy(BenchmarkLogicalGroupRule.ByCategory)]
    [CategoriesColumn]
    public class ReorderBenchmarks
    {
        private ConcurrentObservableReorderableCollection<int> _reorderableCollection = null!;
        private ConcurrentQueue<int> _concurrentQueue = null!;
        private ObservableCollection<int> _observableCollection = null!;
        private readonly object _observableLock = new object();

        private int[] _sampleItems = null!;
        private int _headItem;
        private int _midItem;
        private int _tailItem;

        [Params(100, 1000, 10000)]
        public int N { get; set; }

        [GlobalSetup]
        public void GlobalSetup()
        {
            _sampleItems = new int[N];
            for (int i = 0; i < N; i++)
            {
                _sampleItems[i] = i + 1;
            }
        }

        [IterationSetup]
        public void IterationSetup()
        {
            _reorderableCollection = new ConcurrentObservableReorderableCollection<int>();
            _concurrentQueue = new ConcurrentQueue<int>();
            _observableCollection = new ObservableCollection<int>();

            for (int i = 0; i < N; i++)
            {
                int val = _sampleItems[i];
                _reorderableCollection.Add(val);
                _concurrentQueue.Enqueue(val);
                _observableCollection.Add(val);
            }

            _headItem = _sampleItems[0];
            _midItem = _sampleItems[N / 2];
            _tailItem = _sampleItems[N - 1];
        }

        // ====================================================================
        // 1. ADD / ENQUEUE BENCHMARKS
        // ====================================================================

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("Add_Enqueue")]
        public void Add_ReorderableCollection()
        {
            var coll = new ConcurrentObservableReorderableCollection<int>();
            for (int i = 0; i < N; i++)
            {
                coll.Add(_sampleItems[i]);
            }
        }

        [Benchmark]
        [BenchmarkCategory("Add_Enqueue")]
        public void Enqueue_ConcurrentQueue()
        {
            var queue = new ConcurrentQueue<int>();
            for (int i = 0; i < N; i++)
            {
                queue.Enqueue(_sampleItems[i]);
            }
        }

        [Benchmark]
        [BenchmarkCategory("Add_Enqueue")]
        public void Add_ObservableCollection()
        {
            var obs = new ObservableCollection<int>();
            lock (_observableLock)
            {
                for (int i = 0; i < N; i++)
                {
                    obs.Add(_sampleItems[i]);
                }
            }
        }

        // ====================================================================
        // 2. TAKE / DEQUEUE / REMOVE BENCHMARKS
        // ====================================================================

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("TryTake_Dequeue")]
        public void TryTake_ReorderableCollection()
        {
            while (_reorderableCollection.TryTake(out _))
            {
            }
        }

        [Benchmark]
        [BenchmarkCategory("TryTake_Dequeue")]
        public void TryDequeue_ConcurrentQueue()
        {
            while (_concurrentQueue.TryDequeue(out _))
            {
            }
        }

        [Benchmark]
        [BenchmarkCategory("TryTake_Dequeue")]
        public void RemoveFirst_ObservableCollection()
        {
            lock (_observableLock)
            {
                while (_observableCollection.Count > 0)
                {
                    _observableCollection.RemoveAt(0);
                }
            }
        }

        // ====================================================================
        // 3. REORDER / MOVE IN-PLACE BENCHMARKS
        // ====================================================================

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("Reorder_Move")]
        public bool MoveBefore_ReorderableCollection_O1()
        {
            // O(1) instantaneous pointer relink via internal hash map + LinkedList
            return _reorderableCollection.MoveBefore(_midItem, _headItem);
        }

        [Benchmark]
        [BenchmarkCategory("Reorder_Move")]
        public bool MoveAfter_ReorderableCollection_O1()
        {
            // O(1) instantaneous pointer relink via internal hash map + LinkedList
            return _reorderableCollection.MoveAfter(_headItem, _tailItem);
        }

        [Benchmark]
        [BenchmarkCategory("Reorder_Move")]
        public void Move_ObservableCollection_ON()
        {
            // O(N) index-based array shift in ObservableCollection
            lock (_observableLock)
            {
                _observableCollection.Move(N / 2, 0);
            }
        }

        [Benchmark]
        [BenchmarkCategory("Reorder_Move")]
        public void Reorder_ConcurrentQueue_DrainRebuild_ON()
        {
            // ConcurrentQueue has no random reorder API; requires draining to list and re-enqueuing
            var list = new List<int>(N);
            while (_concurrentQueue.TryDequeue(out var item))
            {
                list.Add(item);
            }

            // Move item in list
            if (list.Count > 1)
            {
                int itemToMove = list[list.Count / 2];
                list.RemoveAt(list.Count / 2);
                list.Insert(0, itemToMove);
            }

            foreach (var item in list)
            {
                _concurrentQueue.Enqueue(item);
            }
        }

        // ====================================================================
        // 4. MULTI-THREADED CONCURRENT WORKLOAD
        // ====================================================================

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("ConcurrentStress")]
        public void ConcurrentStress_ReorderableCollection()
        {
            Parallel.Invoke(
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _reorderableCollection.Add(100_000 + i);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _reorderableCollection.TryTake(out _);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _reorderableCollection.MoveBefore(_sampleItems[i % N], _headItem);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _reorderableCollection.MoveAfter(_headItem, _sampleItems[(i + 1) % N]);
                    }
                }
            );
        }

        [Benchmark]
        [BenchmarkCategory("ConcurrentStress")]
        public void ConcurrentStress_ConcurrentQueue()
        {
            Parallel.Invoke(
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _concurrentQueue.Enqueue(100_000 + i);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        _concurrentQueue.TryDequeue(out _);
                    }
                }
            );
        }

        [Benchmark]
        [BenchmarkCategory("ConcurrentStress")]
        public void ConcurrentStress_ObservableCollection_Locked()
        {
            Parallel.Invoke(
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        lock (_observableLock)
                        {
                            _observableCollection.Add(100_000 + i);
                        }
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        lock (_observableLock)
                        {
                            if (_observableCollection.Count > 0)
                            {
                                _observableCollection.RemoveAt(0);
                            }
                        }
                    }
                },
                () =>
                {
                    for (int i = 0; i < 200; i++)
                    {
                        lock (_observableLock)
                        {
                            if (_observableCollection.Count > 1)
                            {
                                _observableCollection.Move(_observableCollection.Count / 2, 0);
                            }
                        }
                    }
                }
            );
        }
    }
}
