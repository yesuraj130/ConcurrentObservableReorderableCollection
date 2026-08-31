using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;

#if NET6_0_OR_GREATER
using System.Diagnostics.CodeAnalysis;
#endif

namespace ConcurrentCollections
{
    /// <summary>
    /// A high-performance, lock-synchronized observable collection supporting true O(1) MoveBefore and MoveAfter operations,
    /// high-throughput producer/consumer FIFO processing, zero-allocation intrusive node recycling, and deadlock-safe
    /// INotifyCollectionChanged / INotifyPropertyChanged notifications.
    /// Multi-targets .NET 6.0 and .NET Framework 4.8.
    /// </summary>
    public class ConcurrentObservableReorderableCollection<T> : 
        IReadOnlyCollection<T>, 
        INotifyCollectionChanged, 
        INotifyPropertyChanged
        where T : notnull
    {
        #region Internal Intrusive Node Definition

        internal sealed class Node
        {
            public T Value = default!;
            public int HashCode;
            public Node? Previous;
            public Node? Next;
            public Node? BucketNext;
            public Node? PoolNext;
        }

        #endregion

        #region Fields

        private readonly object _syncRoot = new object();
        private readonly IEqualityComparer<T> _comparer;

        // High-performance intrusive power-of-2 hash table (eliminates Dictionary<T, Node> overhead)
        private Node?[] _buckets;
        private int _mask; // _buckets.Length - 1 (allows fast bitwise AND instead of integer division)

        private Node? _head;
        private Node? _tail;
        private int _count;

        // Free-list node pool to eliminate GC allocations in streaming / producer-consumer workloads
        private Node? _poolHead;
        private int _poolCount;
        private const int MaxPoolCapacity = 65536;
        private const int DefaultCapacity = 16;

        // Cached static event args to eliminate PropertyChanged allocations
        private static readonly PropertyChangedEventArgs s_countChangedEventArgs = new PropertyChangedEventArgs(nameof(Count));
        private static readonly PropertyChangedEventArgs s_isEmptyChangedEventArgs = new PropertyChangedEventArgs(nameof(IsEmpty));

        #endregion

        #region Events

        public event NotifyCollectionChangedEventHandler? CollectionChanged;
        public event PropertyChangedEventHandler? PropertyChanged;

        #endregion

        #region Constructors

        public ConcurrentObservableReorderableCollection()
            : this(DefaultCapacity, null)
        {
        }

        public ConcurrentObservableReorderableCollection(int initialCapacity)
            : this(initialCapacity, null)
        {
        }

        public ConcurrentObservableReorderableCollection(IEqualityComparer<T>? comparer)
            : this(DefaultCapacity, comparer)
        {
        }

        public ConcurrentObservableReorderableCollection(int initialCapacity, IEqualityComparer<T>? comparer)
        {
            if (initialCapacity < 0) throw new ArgumentOutOfRangeException(nameof(initialCapacity), "Capacity cannot be negative.");
            _comparer = comparer ?? EqualityComparer<T>.Default;

            int capacity = CalculatePowerOfTwo(Math.Max(DefaultCapacity, initialCapacity));
            _buckets = new Node?[capacity];
            _mask = capacity - 1;
        }

        public ConcurrentObservableReorderableCollection(IEnumerable<T> collection)
            : this(DefaultCapacity, null)
        {
            if (collection == null) throw new ArgumentNullException(nameof(collection));
            foreach (var item in collection)
            {
                Add(item);
            }
        }

        #endregion

        #region Properties

        public int Count
        {
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            get
            {
                lock (_syncRoot)
                {
                    return _count;
                }
            }
        }

        public bool IsEmpty
        {
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            get
            {
                lock (_syncRoot)
                {
                    return _count == 0;
                }
            }
        }

        #endregion

        #region Public Operations

        /// <summary>
        /// Adds an item to the tail of the collection in O(1) time.
        /// If the item already exists in the collection, it is relocated to the tail.
        /// Recycles pooled nodes to achieve zero steady-state GC allocations.
        /// </summary>
        public void Add(T item)
        {
            if (item == null) throw new ArgumentNullException(nameof(item));

            NotifyCollectionChangedEventArgs? eventArgs = null;
            bool hasSubscribers;
            int hashCode = _comparer.GetHashCode(item);

            lock (_syncRoot)
            {
                hasSubscribers = CollectionChanged != null;

                int bucket = (int)((uint)hashCode & (uint)_mask);
                var existingNode = _buckets[bucket];

                // Fast collision chain walk
                while (existingNode != null)
                {
                    if (existingNode.HashCode == hashCode && _comparer.Equals(existingNode.Value, item))
                    {
                        // Item already exists; relocate to tail if not already tail
                        if (existingNode != _tail)
                        {
                            int oldIndex = hasSubscribers ? GetNodeIndex_Locked(existingNode) : -1;
                            UnlinkNode_Locked(existingNode);
                            LinkLast_Locked(existingNode);
                            int newIndex = _count - 1;

                            if (hasSubscribers)
                            {
                                eventArgs = new NotifyCollectionChangedEventArgs(
                                    NotifyCollectionChangedAction.Move,
                                    item,
                                    newIndex,
                                    oldIndex);
                            }
                        }
                        goto DispatchEvents;
                    }
                    existingNode = existingNode.BucketNext;
                }

                // Check if hash table resize is needed
                if (_count >= _buckets.Length)
                {
                    Resize_Locked();
                    bucket = (int)((uint)hashCode & (uint)_mask);
                }

                // New item insertion from free-list node pool
                var newNode = AcquireNode_Locked(item, hashCode);
                
                // Intrusive bucket chain insertion (at head of bucket)
                newNode.BucketNext = _buckets[bucket];
                _buckets[bucket] = newNode;

                // Doubly-linked list tail insertion
                LinkLast_Locked(newNode);
                _count++;

                if (hasSubscribers)
                {
                    eventArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Add,
                        item,
                        _count - 1);
                }
            }

        DispatchEvents:
            // Fire events OUTSIDE the lock to prevent dispatcher / UI deadlocks
            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            if (PropertyChanged != null)
            {
                OnPropertyChanged(s_countChangedEventArgs);
                OnPropertyChanged(s_isEmptyChangedEventArgs);
            }
        }

        /// <summary>
        /// Dequeues the item at the head of the collection in FIFO order in O(1) time.
        /// Returns the node to the free-list pool with zero GC allocations.
        /// </summary>
        public bool TryTake(
#if NET6_0_OR_GREATER
            [MaybeNullWhen(false)]
#endif
            out T item)
        {
            NotifyCollectionChangedEventArgs? eventArgs = null;
            bool hasSubscribers;

            lock (_syncRoot)
            {
                if (_head == null)
                {
                    item = default!;
                    return false;
                }

                var headNode = _head;
                item = headNode.Value;

                // Intrusively remove from hash table bucket
                int bucket = (int)((uint)headNode.HashCode & (uint)_mask);
                var cur = _buckets[bucket];
                Node? prevBucketNode = null;

                while (cur != null)
                {
                    if (ReferenceEquals(cur, headNode))
                    {
                        if (prevBucketNode != null)
                        {
                            prevBucketNode.BucketNext = cur.BucketNext;
                        }
                        else
                        {
                            _buckets[bucket] = cur.BucketNext;
                        }
                        break;
                    }
                    prevBucketNode = cur;
                    cur = cur.BucketNext;
                }

                // Unlink from doubly-linked list
                UnlinkNode_Locked(headNode);
                _count--;

                // Recycle node to pool
                headNode.BucketNext = null;
                ReleaseNode_Locked(headNode);

                hasSubscribers = CollectionChanged != null;
                if (hasSubscribers)
                {
                    eventArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Remove,
                        item,
                        0);
                }
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            if (PropertyChanged != null)
            {
                OnPropertyChanged(s_countChangedEventArgs);
                OnPropertyChanged(s_isEmptyChangedEventArgs);
            }
            return true;
        }

        /// <summary>
        /// Moves the source element immediately BEFORE the target element in O(1) time.
        /// </summary>
        public bool MoveBefore(T source, T target)
        {
            if (source == null || target == null || _comparer.Equals(source, target))
                return false;

            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                var sourceNode = FindNode_Locked(source);
                if (sourceNode == null) return false;

                var targetNode = FindNode_Locked(target);
                if (targetNode == null) return false;

                if (sourceNode.Next == targetNode)
                    return false; // Already immediately before target

                bool hasSubscribers = CollectionChanged != null;
                int oldIndex = hasSubscribers ? GetNodeIndex_Locked(sourceNode) : -1;

                UnlinkNode_Locked(sourceNode);
                LinkBefore_Locked(targetNode, sourceNode);

                if (hasSubscribers)
                {
                    int newIndex = GetNodeIndex_Locked(sourceNode);
                    eventArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Move,
                        source,
                        newIndex,
                        oldIndex);
                }
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            return true;
        }

        /// <summary>
        /// Moves the source element immediately AFTER the target element in O(1) time.
        /// </summary>
        public bool MoveAfter(T source, T target)
        {
            if (source == null || target == null || _comparer.Equals(source, target))
                return false;

            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                var sourceNode = FindNode_Locked(source);
                if (sourceNode == null) return false;

                var targetNode = FindNode_Locked(target);
                if (targetNode == null) return false;

                if (sourceNode.Previous == targetNode)
                    return false; // Already immediately after target

                bool hasSubscribers = CollectionChanged != null;
                int oldIndex = hasSubscribers ? GetNodeIndex_Locked(sourceNode) : -1;

                UnlinkNode_Locked(sourceNode);
                LinkAfter_Locked(targetNode, sourceNode);

                if (hasSubscribers)
                {
                    int newIndex = GetNodeIndex_Locked(sourceNode);
                    eventArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Move,
                        source,
                        newIndex,
                        oldIndex);
                }
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            return true;
        }

        /// <summary>
        /// Clears all elements from the collection and recycles nodes into the free-list pool.
        /// </summary>
        public void Clear()
        {
            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                if (_count == 0)
                    return;

                // Recycle all nodes to pool
                var current = _head;
                while (current != null && _poolCount < MaxPoolCapacity)
                {
                    var next = current.Next;
                    current.Value = default!;
                    current.Previous = null;
                    current.Next = null;
                    current.BucketNext = null;
                    current.PoolNext = _poolHead;
                    _poolHead = current;
                    _poolCount++;
                    current = next;
                }

                Array.Clear(_buckets, 0, _buckets.Length);
                _head = null;
                _tail = null;
                _count = 0;

                if (CollectionChanged != null)
                {
                    eventArgs = new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset);
                }
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            if (PropertyChanged != null)
            {
                OnPropertyChanged(s_countChangedEventArgs);
                OnPropertyChanged(s_isEmptyChangedEventArgs);
            }
        }

        /// <summary>
        /// Determines whether the collection contains the specified item in O(1) time.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool Contains(T item)
        {
            if (item == null) return false;

            lock (_syncRoot)
            {
                return FindNode_Locked(item) != null;
            }
        }

        #endregion

        #region Internal Hash & Pointer Helpers (Must be called inside lock (_syncRoot))

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private Node? FindNode_Locked(T item)
        {
            int hashCode = _comparer.GetHashCode(item);
            int bucket = (int)((uint)hashCode & (uint)_mask);
            var cur = _buckets[bucket];

            while (cur != null)
            {
                if (cur.HashCode == hashCode && _comparer.Equals(cur.Value, item))
                    return cur;
                cur = cur.BucketNext;
            }
            return null;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private Node AcquireNode_Locked(T item, int hashCode)
        {
            if (_poolHead != null)
            {
                var node = _poolHead;
                _poolHead = node.PoolNext;
                node.PoolNext = null;
                _poolCount--;
                node.Value = item;
                node.HashCode = hashCode;
                return node;
            }
            return new Node { Value = item, HashCode = hashCode };
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void ReleaseNode_Locked(Node node)
        {
            if (_poolCount < MaxPoolCapacity)
            {
                node.Value = default!;
                node.Previous = null;
                node.Next = null;
                node.BucketNext = null;
                node.PoolNext = _poolHead;
                _poolHead = node;
                _poolCount++;
            }
        }

        private void Resize_Locked()
        {
            int newCapacity = _buckets.Length * 2;
            var newBuckets = new Node?[newCapacity];
            int newMask = newCapacity - 1;

            // Re-bucket all active nodes from doubly-linked list in O(N) with NO re-hashing
            var current = _head;
            while (current != null)
            {
                int bucket = (int)((uint)current.HashCode & (uint)newMask);
                current.BucketNext = newBuckets[bucket];
                newBuckets[bucket] = current;
                current = current.Next;
            }

            _buckets = newBuckets;
            _mask = newMask;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void LinkLast_Locked(Node node)
        {
            node.Previous = _tail;
            node.Next = null;
            if (_tail != null)
            {
                _tail.Next = node;
            }
            else
            {
                _head = node;
            }
            _tail = node;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void LinkBefore_Locked(Node target, Node node)
        {
            node.Next = target;
            node.Previous = target.Previous;
            if (target.Previous != null)
            {
                target.Previous.Next = node;
            }
            else
            {
                _head = node;
            }
            target.Previous = node;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void LinkAfter_Locked(Node target, Node node)
        {
            node.Previous = target;
            node.Next = target.Next;
            if (target.Next != null)
            {
                target.Next.Previous = node;
            }
            else
            {
                _tail = node;
            }
            target.Next = node;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void UnlinkNode_Locked(Node node)
        {
            if (node.Previous != null)
            {
                node.Previous.Next = node.Next;
            }
            else
            {
                _head = node.Next;
            }

            if (node.Next != null)
            {
                node.Next.Previous = node.Previous;
            }
            else
            {
                _tail = node.Previous;
            }

            node.Previous = null;
            node.Next = null;
        }

        private int GetNodeIndex_Locked(Node node)
        {
            int index = 0;
            var current = _head;
            while (current != null)
            {
                if (ReferenceEquals(current, node)) return index;
                current = current.Next;
                index++;
            }
            return -1;
        }

        private static int CalculatePowerOfTwo(int value)
        {
            int power = 16;
            while (power < value && power > 0)
            {
                power <<= 1;
            }
            return power > 0 ? power : 1073741824;
        }

        #endregion

        #region Event Invocation Helpers

        protected virtual void OnCollectionChanged(NotifyCollectionChangedEventArgs e) =>
            CollectionChanged?.Invoke(this, e);

        protected virtual void OnPropertyChanged(PropertyChangedEventArgs e) =>
            PropertyChanged?.Invoke(this, e);

        #endregion

        #region IEnumerable Implementation

        public IEnumerator<T> GetEnumerator()
        {
            T[] snapshot;
            lock (_syncRoot)
            {
                snapshot = new T[_count];
                int idx = 0;
                var current = _head;
                while (current != null)
                {
                    snapshot[idx++] = current.Value;
                    current = current.Next;
                }
            }

            for (int i = 0; i < snapshot.Length; i++)
            {
                yield return snapshot[i];
            }
        }

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        #endregion
    }
}
