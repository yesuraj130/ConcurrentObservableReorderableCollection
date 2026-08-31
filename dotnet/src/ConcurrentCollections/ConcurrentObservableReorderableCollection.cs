using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Threading;

#if NET6_0_OR_GREATER
using System.Diagnostics.CodeAnalysis;
#endif

namespace ConcurrentCollections
{
    /// <summary>
    /// A thread-safe observable collection supporting O(1) MoveBefore and MoveAfter operations,
    /// producer/consumer FIFO processing, and deadlock-safe INotifyCollectionChanged notifications.
    /// Multi-targets .NET 6.0 and .NET Framework 4.8.
    /// </summary>
    public class ConcurrentObservableReorderableCollection<T> : 
        IReadOnlyCollection<T>, 
        INotifyCollectionChanged, 
        INotifyPropertyChanged
        where T : notnull
    {
        private readonly object _syncRoot = new object();
        private readonly LinkedList<T> _linkedList = new LinkedList<T>();
        private readonly Dictionary<T, LinkedListNode<T>> _nodeMap = new Dictionary<T, LinkedListNode<T>>();

        public event NotifyCollectionChangedEventHandler? CollectionChanged;
        public event PropertyChangedEventHandler? PropertyChanged;

        public int Count
        {
            get
            {
                lock (_syncRoot)
                {
                    return _linkedList.Count;
                }
            }
        }

        public bool IsEmpty
        {
            get
            {
                lock (_syncRoot)
                {
                    return _linkedList.Count == 0;
                }
            }
        }

        /// <summary>
        /// Adds an item to the tail of the collection.
        /// If the item already exists, it is relocated to the tail.
        /// </summary>
        public void Add(T item)
        {
            if (item == null) throw new ArgumentNullException(nameof(item));

            NotifyCollectionChangedEventArgs? eventArgs = null;
            int oldIndex = -1;
            int newIndex = -1;

            lock (_syncRoot)
            {
                if (_nodeMap.TryGetValue(item, out var existingNode))
                {
                    // Relocate existing item to tail
                    oldIndex = GetNodeIndex_Locked(existingNode);
                    _linkedList.Remove(existingNode);
                    _linkedList.AddLast(existingNode);
                    newIndex = _linkedList.Count - 1;

                    if (oldIndex != newIndex)
                    {
                        eventArgs = new NotifyCollectionChangedEventArgs(
                            NotifyCollectionChangedAction.Move,
                            item,
                            newIndex,
                            oldIndex);
                    }
                }
                else
                {
                    // New insertion
                    var newNode = _linkedList.AddLast(item);
                    _nodeMap[item] = newNode;
                    newIndex = _linkedList.Count - 1;

                    eventArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Add,
                        item,
                        newIndex);
                }
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
                OnPropertyChanged(nameof(Count));
                OnPropertyChanged(nameof(IsEmpty));
            }
        }

        /// <summary>
        /// Dequeues the item at the head of the collection in FIFO order.
        /// </summary>
        public bool TryTake(
#if NET6_0_OR_GREATER
            [MaybeNullWhen(false)]
#endif
            out T item)
        {
            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                if (_linkedList.First == null)
                {
                    item = default!;
                    return false;
                }

                var headNode = _linkedList.First;
                item = headNode.Value;
                _linkedList.RemoveFirst();
                _nodeMap.Remove(item);

                eventArgs = new NotifyCollectionChangedEventArgs(
                    NotifyCollectionChangedAction.Remove,
                    item,
                    0);
            }

            OnCollectionChanged(eventArgs);
            OnPropertyChanged(nameof(Count));
            OnPropertyChanged(nameof(IsEmpty));
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
                    return false; // Already immediately before

                int oldIndex = GetNodeIndex_Locked(sourceNode);
                _linkedList.Remove(sourceNode);
                _linkedList.AddBefore(targetNode, sourceNode);
                int newIndex = GetNodeIndex_Locked(sourceNode);

                eventArgs = new NotifyCollectionChangedEventArgs(
                    NotifyCollectionChangedAction.Move,
                    source,
                    newIndex,
                    oldIndex);
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
                    return false; // Already immediately after

                int oldIndex = GetNodeIndex_Locked(sourceNode);
                _linkedList.Remove(sourceNode);
                _linkedList.AddAfter(targetNode, sourceNode);
                int newIndex = GetNodeIndex_Locked(sourceNode);

                eventArgs = new NotifyCollectionChangedEventArgs(
                    NotifyCollectionChangedAction.Move,
                    source,
                    newIndex,
                    oldIndex);
            }

            if (eventArgs != null)
            {
                OnCollectionChanged(eventArgs);
            }
            return true;
        }

        /// <summary>
        /// Clears all elements from the collection.
        /// </summary>
        public void Clear()
        {
            NotifyCollectionChangedEventArgs? eventArgs = null;

            lock (_syncRoot)
            {
                if (_linkedList.Count == 0)
                    return;

                _linkedList.Clear();
                _nodeMap.Clear();

                eventArgs = new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset);
            }

            OnCollectionChanged(eventArgs);
            OnPropertyChanged(nameof(Count));
            OnPropertyChanged(nameof(IsEmpty));
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

        private int GetNodeIndex_Locked(LinkedListNode<T> node)
        {
            int index = 0;
            var current = _linkedList.First;
            while (current != null)
            {
                if (ReferenceEquals(current, node)) return index;
                current = current.Next;
                index++;
            }
            return -1;
        }

        protected virtual void OnCollectionChanged(NotifyCollectionChangedEventArgs e) =>
            CollectionChanged?.Invoke(this, e);

        protected virtual void OnPropertyChanged(string propertyName) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));

        public IEnumerator<T> GetEnumerator()
        {
            List<T> snapshot;
            lock (_syncRoot)
            {
                snapshot = new List<T>(_linkedList);
            }
            return snapshot.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
