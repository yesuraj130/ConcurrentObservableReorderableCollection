using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Jobs;
using ConcurrentCollections;
using System.Threading.Tasks;

namespace ConcurrentCollections.Benchmarks
{
    [MemoryDiagnoser]
    public class ReorderBenchmarks
    {
        private ConcurrentObservableReorderableCollection<int> _collection = null!;
        private int _midItem;
        private int _headItem;
        private int _tailItem;

        [Params(100, 1000, 10000)]
        public int N { get; set; }

        [IterationSetup]
        public void Setup()
        {
            _collection = new ConcurrentObservableReorderableCollection<int>();
            for (int i = 0; i < N; i++)
            {
                _collection.Add(i);
            }

            _headItem = 0;
            _midItem = N / 2;
            _tailItem = N - 1;
        }

        [Benchmark]
        public bool MoveBefore_MiddleToHead()
        {
            return _collection.MoveBefore(_midItem, _headItem);
        }

        [Benchmark]
        public bool MoveAfter_HeadToTail()
        {
            return _collection.MoveAfter(_headItem, _tailItem);
        }

        [Benchmark]
        public void Add_NewItem()
        {
            _collection.Add(N + 100);
        }

        [Benchmark]
        public bool TryTake_HeadItem()
        {
            return _collection.TryTake(out _);
        }

        [Benchmark]
        public void HeavyConcurrent_MultiThreadedStress()
        {
            Parallel.Invoke(
                () => _collection.Add(999999),
                () => _collection.TryTake(out _),
                () => _collection.MoveBefore(_midItem, _headItem),
                () => _collection.MoveAfter(_tailItem, _midItem)
            );
        }
    }
}
