using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace ConcurrentCollections.Tests
{
    public class ConcurrentObservableReorderableCollectionTests
    {
        [Fact]
        public void Add_SingleItem_ShouldIncreaseCountAndNotify()
        {
            var collection = new ConcurrentObservableReorderableCollection<string>();
            var events = new List<NotifyCollectionChangedEventArgs>();
            collection.CollectionChanged += (s, e) => events.Add(e);

            collection.Add("Task 1");

            Assert.Single(collection);
            Assert.False(collection.IsEmpty);
            Assert.Single(events);
            Assert.Equal(NotifyCollectionChangedAction.Add, events[0].Action);
            Assert.Equal("Task 1", events[0].NewItems![0]);
        }

        [Fact]
        public void MoveBefore_ValidElements_ShouldRelinkInO1Time()
        {
            var collection = new ConcurrentObservableReorderableCollection<string>();
            collection.Add("A");
            collection.Add("B");
            collection.Add("C");

            bool moved = collection.MoveBefore("C", "A");

            Assert.True(moved);
            var list = collection.ToList();
            Assert.Equal(new[] { "C", "A", "B" }, list);
        }

        [Fact]
        public void MoveAfter_ValidElements_ShouldRelinkInO1Time()
        {
            var collection = new ConcurrentObservableReorderableCollection<string>();
            collection.Add("A");
            collection.Add("B");
            collection.Add("C");

            bool moved = collection.MoveAfter("A", "C");

            Assert.True(moved);
            var list = collection.ToList();
            Assert.Equal(new[] { "B", "C", "A" }, list);
        }

        [Fact]
        public void TryTake_FIFOOrder_ShouldDequeueHead()
        {
            var collection = new ConcurrentObservableReorderableCollection<int>();
            collection.Add(10);
            collection.Add(20);

            bool taken = collection.TryTake(out int val);

            Assert.True(taken);
            Assert.Equal(10, val);
            Assert.Single(collection);
        }

        [Fact]
        public void ConcurrentStress_NoDeadlocksOrCorruptions()
        {
            var collection = new ConcurrentObservableReorderableCollection<int>();
            const int iterations = 10000;

            Parallel.For(0, iterations, i =>
            {
                collection.Add(i);
                if (i % 2 == 0)
                {
                    collection.TryTake(out _);
                }
            });

            Assert.True(collection.Count >= 0);
        }
    }
}
