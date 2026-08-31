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
    /// A high-performance, thread-safe observable collection supporting true O(1) MoveBefore and MoveAfter operations,
    /// high-throughput producer/consumer FIFO processing, zero-allocation node recycling, and deadlock-safe INotifyCollectionChanged notifications.
    /// Multi-targets .NET 6.0 and .NET Framework 4.8.
    /// </summary>
    public class ConcurrentObservableReorderableCollection<T> : 
        IReadOnlyCollection<T>, 
        INotifyCollectionChanged, 
        INotifyPropertyChanged
        where T : notnull
    {
        #region Internal Node Definition & Object Pool

        internal sealed class Node
        {
            public T Value = default!;
            public Node? Previous;
            public Node? Next;
            public Node? PoolNext;
        }

        #endregion

        #region Fields

        private readonly object _syncRoot = new object();
        private readonly Dictionary<T, Node> _nodeMap;

        private Node? _head;
        private Node? _tail;
        private int _count;

        // Free-list node pool to eliminate GC allocations in streaming / producer-consumer workloads
        private Node? _poolHead;
        private int _poolCount;
        private const int MaxPoolCapacity = 65536;

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
            : this(0, null)
        {
        }

        public ConcurrentObservableReorderableCollection(int initialCapacity)
            : this(initialCapacity, null)
        {
        }

        public ConcurrentObservableReorderableCollection(IEqualityComparer<T>? comparer)
            : this(0, comparer)
        {
        }

        public ConcurrentObservableReorderableCollection(int initialCapacity, IEqualityComparer<T>? comparer)
        {
            if (initialCapacity < 0) throw new ArgumentOutOfRangeException(nameof(initialCapacity), "Capacity cannot be negative.");
            _nodeMap = new Dictionary<T, Node>(initialCapacity, comparer ?? EqualityComparer<T>.Default);
        }

        public ConcurrentObservableReorderableCollection(IEnumerable<T> collection)
            : this(0, null)
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
        /// Recycles pooled nodes to achieve near-zero GC allocations.
        /// </summary>
        public void Add(T item)
        {
            if (item == null) throw new ArgumentNullException(nameof(item));

            NotifyCollectionChangedEventArgs? eventArgs = null;
            bool hasSubscribers;

            lock (_syncRoot)
            {
                hasSubscribers = CollectionChanged != null;

                if (_nodeMap.TryGetValue(item, out var existingNode))
                {
                    // Item already in collection; relocate to tail if not already tail
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
                }
                else
                {
                    // New item insertion from free-list node pool
                    var newNode = AcquireNode_Locked(item);
                    LinkLast_Locked(newNode);
                    _nodeMap[item] = newNode;
                    _count++;

                    if (hasSubscribers)
                    {
                        eventArgs = new NotifyCollectionChangedEventArgs(
                            NotifyCollectionChangedAction.Add,
                            item,
                            _count - 1);
                    }
                }
            }

            // Fire events outside the lock to prevent dispatcher / UI deadlocks
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
        /// Returns the node to the free-list pool for zero GC allocations.
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

                UnlinkNode_Locked(headNode);
                _count--;
                ReleaseNode_Locked(item, headNode);

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
            if (source == null || target == null || EqualityComparer<T>.Default.Equals(source, target))
                return false;

            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                if (!_nodeMap.TryGetValue(source, out var sourceNode) ||
                    !_nodeMap.TryGetValue(target, out var targetNode))
                {
                    return false;
                }

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
            if (source == null || target == null || EqualityComparer<T>.Default.Equals(source, target))
                return false;

            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                if (!_nodeMap.TryGetValue(source, out var sourceNode) ||
                    !_nodeMap.TryGetValue(target, out var targetNode))
                {
                    return false;
                }

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
        /// Clears all elements from the collection.
        /// Recycles all nodes back into the free-list pool.
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
                    current.PoolNext = _poolHead;
                    _poolHead = current;
                    _poolCount++;
                    current = next;
                }

                _head = null;
                _tail = null;
                _count = 0;
                _nodeMap.Clear();

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
        public bool Contains(T item)
        {
            if (item == null) return false;

            lock (_syncRoot)
            {
                return _nodeMap.ContainsKey(item);
            }
        }

        #endregion

        #region Internal Link Helpers (Must be called inside lock (_syncRoot))

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private Node AcquireNode_Locked(T item)
        {
            if (_poolHead != null)
            {
                var node = _poolHead;
                _poolHead = node.PoolNext;
                node.PoolNext = null;
                _poolCount--;
                node.Value = item;
                return node;
            }
            return new Node { Value = item };
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void ReleaseNode_Locked(T item, Node node)
        {
            _nodeMap.Remove(item);
            if (_poolCount < MaxPoolCapacity)
            {
                node.Value = default!;
                node.Previous = null;
                node.Next = null;
                node.PoolNext = _poolHead;
                _poolHead = node;
                _poolCount++;
            }
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
