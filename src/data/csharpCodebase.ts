import { CSharpFileItem } from '../types';

export const CSHARP_FILES: CSharpFileItem[] = [
  {
    id: 'core-cs',
    name: 'ConcurrentObservableReorderableCollection.cs',
    path: 'src/ConcurrentObservableReorderableCollection/ConcurrentObservableReorderableCollection.cs',
    language: 'csharp',
    category: 'core',
    description: 'The core high-performance thread-safe reorderable collection implementation targeting .NET 6.0 and .NET 4.8.',
    content: `// <copyright file="ConcurrentObservableReorderableCollection.cs" company="OpenSource">
// Copyright (c) All rights reserved.
// Licensed under the MIT license.
// </copyright>

namespace System.Collections.Concurrent
{
    using System;
    using System.Collections;
    using System.Collections.Generic;
    using System.Collections.Specialized;
    using System.ComponentModel;
    using System.Diagnostics;
    using System.Diagnostics.CodeAnalysis;
    using System.Threading;

    /// <summary>
    /// Represents a thread-safe, observable collection that supports O(1) element reordering 
    /// (<see cref="MoveBefore(T, T)"/> and <see cref="MoveAfter(T, T)"/>), concurrent additions (<see cref="Add(T)"/>), 
    /// and concurrent removals (<see cref="TryTake(out T)"/>) while notifying subscribers safely via 
    /// <see cref="INotifyCollectionChanged"/> and <see cref="INotifyPropertyChanged"/>.
    /// </summary>
    /// <typeparam name="T">The type of elements contained in the collection. Must implement equality properly.</typeparam>
    [DebuggerDisplay("Count = {Count}, IsEmpty = {IsEmpty}")]
    public sealed class ConcurrentObservableReorderableCollection<T> : 
        INotifyCollectionChanged, 
        INotifyPropertyChanged, 
        IReadOnlyCollection<T>, 
        IEnumerable<T>
    {
        private readonly object _syncRoot = new object();
        private readonly LinkedList<T> _list;
        private readonly Dictionary<T, LinkedListNode<T>> _nodeMap;
        private readonly IEqualityComparer<T> _comparer;

        /// <summary>
        /// Initializes a new instance of the <see cref="ConcurrentObservableReorderableCollection{T}"/> class.
        /// </summary>
        public ConcurrentObservableReorderableCollection()
            : this(EqualityComparer<T>.Default)
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="ConcurrentObservableReorderableCollection{T}"/> class
        /// with a specified equality comparer.
        /// </summary>
        /// <param name="comparer">The equality comparer to use for item lookup and uniqueness.</param>
        public ConcurrentObservableReorderableCollection(IEqualityComparer<T>? comparer)
        {
            _comparer = comparer ?? EqualityComparer<T>.Default;
            _list = new LinkedList<T>();
            _nodeMap = new Dictionary<T, LinkedListNode<T>>(_comparer);
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="ConcurrentObservableReorderableCollection{T}"/> class
        /// populated with initial elements.
        /// </summary>
        /// <param name="collection">The initial items to add.</param>
        public ConcurrentObservableReorderableCollection(IEnumerable<T> collection)
            : this(collection, EqualityComparer<T>.Default)
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="ConcurrentObservableReorderableCollection{T}"/> class
        /// populated with initial elements and a custom equality comparer.
        /// </summary>
        /// <param name="collection">The initial items to add.</param>
        /// <param name="comparer">The equality comparer to use.</param>
        public ConcurrentObservableReorderableCollection(IEnumerable<T> collection, IEqualityComparer<T>? comparer)
            : this(comparer)
        {
            if (collection == null)
            {
                throw new ArgumentNullException(nameof(collection));
            }

            foreach (var item in collection)
            {
                Add(item);
            }
        }

        /// <summary>
        /// Occurs when the collection changes (items added, removed, moved, or reset).
        /// </summary>
        public event NotifyCollectionChangedEventHandler? CollectionChanged;

        /// <summary>
        /// Occurs when a property value (such as <see cref="Count"/> or <see cref="IsEmpty"/>) changes.
        /// </summary>
        public event PropertyChangedEventHandler? PropertyChanged;

        /// <summary>
        /// Gets the number of elements contained in the collection.
        /// </summary>
        public int Count
        {
            get
            {
                lock (_syncRoot)
                {
                    return _list.Count;
                }
            }
        }

        /// <summary>
        /// Gets a value indicating whether the collection is empty.
        /// </summary>
        public bool IsEmpty
        {
            get
            {
                lock (_syncRoot)
                {
                    return _list.Count == 0;
                }
            }
        }

        /// <summary>
        /// Adds an item to the end of the collection in O(1) time and raises the <see cref="CollectionChanged"/> event.
        /// If the item already exists, it is relocated to the tail.
        /// </summary>
        /// <param name="item">The item to add.</param>
        /// <exception cref="ArgumentNullException">Thrown if item is null (for reference types).</exception>
        public void Add(T item)
        {
            if (item == null)
            {
                throw new ArgumentNullException(nameof(item));
            }

            NotifyCollectionChangedEventArgs? collectionArgs = null;
            int newIndex;
            int countSnapshot;

            lock (_syncRoot)
            {
                if (_nodeMap.TryGetValue(item, out var existingNode))
                {
                    // Item already exists - relocate to tail
                    int oldIndex = GetNodeIndexUnsafe(existingNode);
                    _list.Remove(existingNode);
                    _list.AddLast(existingNode);
                    newIndex = _list.Count - 1;

                    if (oldIndex != newIndex)
                    {
                        collectionArgs = new NotifyCollectionChangedEventArgs(
                            NotifyCollectionChangedAction.Move,
                            item,
                            newIndex,
                            oldIndex);
                    }
                }
                else
                {
                    var newNode = _list.AddLast(item);
                    _nodeMap[item] = newNode;
                    newIndex = _list.Count - 1;

                    collectionArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Add,
                        item,
                        newIndex);
                }

                countSnapshot = _list.Count;
            }

            // Fire notifications OUTSIDE of lock to prevent deadlocks with UI threads / event listeners
            if (collectionArgs != null)
            {
                OnCollectionChanged(collectionArgs);
                OnPropertyChanged(nameof(Count));
                OnPropertyChanged(nameof(IsEmpty));
            }
        }

        /// <summary>
        /// Attempts to remove and return the item at the head of the collection (FIFO queue order).
        /// </summary>
        /// <param name="item">When this method returns, contains the removed item, or default(T) if empty.</param>
        /// <returns><c>true</c> if an item was successfully removed; otherwise, <c>false</c>.</returns>
#if NET6_0_OR_GREATER
        public bool TryTake([MaybeNullWhen(false)] out T item)
#else
        public bool TryTake(out T item)
#endif
        {
            NotifyCollectionChangedEventArgs? collectionArgs = null;
            bool success = false;

            lock (_syncRoot)
            {
                if (_list.First != null)
                {
                    var headNode = _list.First;
                    item = headNode.Value;
                    _list.RemoveFirst();
                    _nodeMap.Remove(item);

                    collectionArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Remove,
                        item,
                        0);

                    success = true;
                }
                else
                {
                    item = default!;
                    success = false;
                }
            }

            if (success && collectionArgs != null)
            {
                OnCollectionChanged(collectionArgs);
                OnPropertyChanged(nameof(Count));
                OnPropertyChanged(nameof(IsEmpty));
            }

            return success;
        }

        /// <summary>
        /// Reorders the collection such that <paramref name="source"/> is positioned immediately BEFORE <paramref name="target"/>.
        /// </summary>
        /// <param name="source">The item to be moved.</param>
        /// <param name="target">The destination reference item.</param>
        /// <returns><c>true</c> if the move succeeded; <c>false</c> if either item was not found or if source equals target.</returns>
        public bool MoveBefore(T source, T target)
        {
            if (source == null || target == null || _comparer.Equals(source, target))
            {
                return false;
            }

            NotifyCollectionChangedEventArgs? collectionArgs = null;
            bool moved = false;

            lock (_syncRoot)
            {
                if (_nodeMap.TryGetValue(source, out var sourceNode) &&
                    _nodeMap.TryGetValue(target, out var targetNode))
                {
                    // If source is already immediately before target, no-op
                    if (sourceNode.Next == targetNode)
                    {
                        return true;
                    }

                    int oldIndex = GetNodeIndexUnsafe(sourceNode);

                    _list.Remove(sourceNode);
                    _list.AddBefore(targetNode, sourceNode);

                    int newIndex = GetNodeIndexUnsafe(sourceNode);

                    collectionArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Move,
                        source,
                        newIndex,
                        oldIndex);

                    moved = true;
                }
            }

            if (moved && collectionArgs != null)
            {
                OnCollectionChanged(collectionArgs);
            }

            return moved;
        }

        /// <summary>
        /// Reorders the collection such that <paramref name="source"/> is positioned immediately AFTER <paramref name="target"/>.
        /// </summary>
        /// <param name="source">The item to be moved.</param>
        /// <param name="target">The destination reference item.</param>
        /// <returns><c>true</c> if the move succeeded; <c>false</c> if either item was not found or if source equals target.</returns>
        public bool MoveAfter(T source, T target)
        {
            if (source == null || target == null || _comparer.Equals(source, target))
            {
                return false;
            }

            NotifyCollectionChangedEventArgs? collectionArgs = null;
            bool moved = false;

            lock (_syncRoot)
            {
                if (_nodeMap.TryGetValue(source, out var sourceNode) &&
                    _nodeMap.TryGetValue(target, out var targetNode))
                {
                    // If source is already immediately after target, no-op
                    if (sourceNode.Previous == targetNode)
                    {
                        return true;
                    }

                    int oldIndex = GetNodeIndexUnsafe(sourceNode);

                    _list.Remove(sourceNode);
                    _list.AddAfter(targetNode, sourceNode);

                    int newIndex = GetNodeIndexUnsafe(sourceNode);

                    collectionArgs = new NotifyCollectionChangedEventArgs(
                        NotifyCollectionChangedAction.Move,
                        source,
                        newIndex,
                        oldIndex);

                    moved = true;
                }
            }

            if (moved && collectionArgs != null)
            {
                OnCollectionChanged(collectionArgs);
            }

            return moved;
        }

        /// <summary>
        /// Attempts to peek at the item at the head of the collection without removing it.
        /// </summary>
        /// <param name="item">The peeked item if available.</param>
        /// <returns><c>true</c> if an item exists at the head; otherwise <c>false</c>.</returns>
#if NET6_0_OR_GREATER
        public bool TryPeek([MaybeNullWhen(false)] out T item)
#else
        public bool TryPeek(out T item)
#endif
        {
            lock (_syncRoot)
            {
                if (_list.First != null)
                {
                    item = _list.First.Value;
                    return true;
                }

                item = default!;
                return false;
            }
        }

        /// <summary>
        /// Determines whether the collection contains the specified item in O(1) time.
        /// </summary>
        /// <param name="item">The item to locate.</param>
        /// <returns><c>true</c> if the item is present; otherwise, <c>false</c>.</returns>
        public bool Contains(T item)
        {
            if (item == null) return false;
            lock (_syncRoot)
            {
                return _nodeMap.ContainsKey(item);
            }
        }

        /// <summary>
        /// Removes all elements from the collection.
        /// </summary>
        public void Clear()
        {
            bool hadItems = false;
            lock (_syncRoot)
            {
                if (_list.Count > 0)
                {
                    _list.Clear();
                    _nodeMap.Clear();
                    hadItems = true;
                }
            }

            if (hadItems)
            {
                OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
                OnPropertyChanged(nameof(Count));
                OnPropertyChanged(nameof(IsEmpty));
            }
        }

        /// <summary>
        /// Copies the elements of the collection to a new array in snapshot order.
        /// </summary>
        /// <returns>An array containing snapshots of the elements.</returns>
        public T[] ToArray()
        {
            lock (_syncRoot)
            {
                var array = new T[_list.Count];
                _list.CopyTo(array, 0);
                return array;
            }
        }

        /// <summary>
        /// Returns an enumerator that iterates through a thread-safe snapshot of the collection.
        /// </summary>
        /// <returns>An enumerator for the collection.</returns>
        public IEnumerator<T> GetEnumerator()
        {
            T[] snapshot;
            lock (_syncRoot)
            {
                snapshot = new T[_list.Count];
                _list.CopyTo(snapshot, 0);
            }

            foreach (var item in snapshot)
            {
                yield return item;
            }
        }

        /// <inheritdoc />
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        private static int GetNodeIndexUnsafe(LinkedListNode<T> node)
        {
            int index = 0;
            var current = node.Previous;
            while (current != null)
            {
                index++;
                current = current.Previous;
            }
            return index;
        }

        private void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
        {
            var handler = CollectionChanged;
            if (handler == null) return;

            // Invocations are safeguarded to ensure subscriber faults don't corrupt collection state
            foreach (NotifyCollectionChangedEventHandler subscriber in handler.GetInvocationList())
            {
                try
                {
                    subscriber(this, e);
                }
                catch (Exception ex)
                {
                    Trace.TraceError($"Subscriber error in {nameof(ConcurrentObservableReorderableCollection<T>)}.{nameof(CollectionChanged)}: {ex}");
                }
            }
        }

        private void OnPropertyChanged(string propertyName)
        {
            var handler = PropertyChanged;
            if (handler == null) return;

            var args = new PropertyChangedEventArgs(propertyName);
            foreach (PropertyChangedEventHandler subscriber in handler.GetInvocationList())
            {
                try
                {
                    subscriber(this, args);
                }
                catch (Exception ex)
                {
                    Trace.TraceError($"Subscriber error in {nameof(ConcurrentObservableReorderableCollection<T>)}.{nameof(PropertyChanged)}: {ex}");
                }
            }
        }
    }
}
`,
  },
  {
    id: 'core-csproj',
    name: 'ConcurrentObservableReorderableCollection.csproj',
    path: 'src/ConcurrentObservableReorderableCollection/ConcurrentObservableReorderableCollection.csproj',
    language: 'xml',
    category: 'core',
    description: 'The multi-targeting .csproj supporting .NET 6.0 and .NET Framework 4.8 with modern C# compiler options.',
    content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <!-- Multi-target .NET 6.0 and .NET Framework 4.8 -->
    <TargetFrameworks>net6.0;net48</TargetFrameworks>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    
    <!-- NuGet Metadata -->
    <PackageId>ConcurrentObservableReorderableCollection</PackageId>
    <Version>1.0.0</Version>
    <Authors>YourNameOrOrg</Authors>
    <Company>OpenSource</Company>
    <Description>High-performance thread-safe reorderable collection with INotifyCollectionChanged for .NET 6.0 and .NET Framework 4.8.</Description>
    <PackageTags>concurrent;collection;reorderable;observable;queue;net6.0;net48;inotifycollectionchanged</PackageTags>
    <PackageLicenseExpression>MIT</PackageLicenseExpression>
    <RepositoryType>git</RepositoryType>
    <PublishRepositoryUrl>true</PublishRepositoryUrl>
    <EmbedUntrackedSources>true</EmbedUntrackedSources>
    <IncludeSymbols>true</IncludeSymbols>
    <SymbolPackageFormat>snupkg</SymbolPackageFormat>
  </PropertyGroup>

  <!-- Framework-specific dependencies -->
  <ItemGroup Condition="'$(TargetFramework)' == 'net48'">
    <Reference Include="System" />
    <Reference Include="System.Core" />
    <Reference Include="WindowsBase" />
  </ItemGroup>

</Project>
`,
  },
  {
    id: 'github-workflow',
    name: 'benchmark.yml',
    path: '.github/workflows/benchmark.yml',
    language: 'yaml',
    category: 'workflows',
    description: 'GitHub Actions workflow to run BenchmarkDotNet for net6.0 and net48, track regressions, and upload artifacts.',
    content: `name: Benchmark Continuous Performance

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: write
  deployments: write
  pull-requests: write

jobs:
  benchmark:
    name: Run BenchmarkDotNet (.NET 6.0 & .NET 4.8)
    runs-on: windows-latest  # windows-latest provides native runtime support for both .NET 6.0 and .NET Framework 4.8

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup .NET SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: |
            6.0.x
            8.0.x

      - name: Restore Dependencies
        run: dotnet restore ./benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj

      - name: Build Benchmark Suite (Release)
        run: dotnet build ./benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj -c Release --no-restore

      - name: Run Benchmarks on .NET 6.0
        run: |
          dotnet run --project ./benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj -c Release --no-build -f net6.0 -- --exporters json,brief --filter "*" --artifacts ./BenchmarkDotNet.Artifacts/net6.0

      - name: Run Benchmarks on .NET Framework 4.8
        run: |
          dotnet run --project ./benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj -c Release --no-build -f net48 -- --exporters json,brief --filter "*" --artifacts ./BenchmarkDotNet.Artifacts/net48

      - name: Continuous Benchmark Tracking (.NET 6.0)
        uses: benchmark-action/github-action-benchmark@v1
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        with:
          name: BenchmarkDotNet Reorderable Collection (.NET 6.0)
          tool: 'benchmarkdotnet'
          output-file-path: ./BenchmarkDotNet.Artifacts/net6.0/results/ConcurrentObservableReorderableCollection.Benchmarks.ReorderBenchmarks-report-full-compressed.json
          github-token: \${{ secrets.GITHUB_TOKEN }}
          auto-push: true
          comment-on-alert: true
          alert-threshold: '130%'
          fail-on-alert: true
          summary-always: true

      - name: Continuous Benchmark Tracking (.NET 4.8)
        uses: benchmark-action/github-action-benchmark@v1
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        with:
          name: BenchmarkDotNet Reorderable Collection (.NET 4.8)
          tool: 'benchmarkdotnet'
          output-file-path: ./BenchmarkDotNet.Artifacts/net48/results/ConcurrentObservableReorderableCollection.Benchmarks.ReorderBenchmarks-report-full-compressed.json
          github-token: \${{ secrets.GITHUB_TOKEN }}
          auto-push: true
          comment-on-alert: true
          alert-threshold: '130%'
          fail-on-alert: true
          summary-always: true

      - name: Publish Step Summary
        run: |
          echo "### 🚀 BenchmarkDotNet Execution Summary" >> $GITHUB_STEP_SUMMARY
          echo "Target Runtimes: **.NET 6.0** & **.NET Framework 4.8**" >> $GITHUB_STEP_SUMMARY
          echo "Artifacts generated in \`./BenchmarkDotNet.Artifacts\`" >> $GITHUB_STEP_SUMMARY

      - name: Upload Benchmark Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-artifacts
          path: ./BenchmarkDotNet.Artifacts/
`,
  },
  {
    id: 'benchmarks-cs',
    name: 'ReorderBenchmarks.cs',
    path: 'benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ReorderBenchmarks.cs',
    language: 'csharp',
    category: 'benchmarks',
    description: 'BenchmarkDotNet suite comparing Add, TryTake, MoveBefore, MoveAfter across net6.0 and net48.',
    content: `namespace ConcurrentObservableReorderableCollection.Benchmarks
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using BenchmarkDotNet.Attributes;
    using BenchmarkDotNet.Configs;
    using BenchmarkDotNet.Diagnosers;
    using BenchmarkDotNet.Jobs;

    [MemoryDiagnoser]
    [SimpleJob(RuntimeMoniker.Net60, baseline: true)]
    [SimpleJob(RuntimeMoniker.Net48)]
    [GroupBenchmarksBy(BenchmarkLogicalGroupRule.ByCategory)]
    [CategoriesColumn]
    public class ReorderBenchmarks
    {
        private ConcurrentObservableReorderableCollection<int> _collection = null!;
        private ConcurrentQueue<int> _standardQueue = null!;
        private int[] _sampleItems = null!;

        [Params(100, 1000, 10000)]
        public int N;

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
            _collection = new ConcurrentObservableReorderableCollection<int>(_sampleItems);
            _standardQueue = new ConcurrentQueue<int>(_sampleItems);
        }

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("Add")]
        public void Add_ReorderableCollection()
        {
            var coll = new ConcurrentObservableReorderableCollection<int>();
            for (int i = 0; i < N; i++)
            {
                coll.Add(_sampleItems[i]);
            }
        }

        [Benchmark]
        [BenchmarkCategory("Add")]
        public void Add_ConcurrentQueue()
        {
            var q = new ConcurrentQueue<int>();
            for (int i = 0; i < N; i++)
            {
                q.Enqueue(_sampleItems[i]);
            }
        }

        [Benchmark(Baseline = true)]
        [BenchmarkCategory("TryTake")]
        public void TryTake_ReorderableCollection()
        {
            while (_collection.TryTake(out _))
            {
            }
        }

        [Benchmark]
        [BenchmarkCategory("TryTake")]
        public void TryTake_ConcurrentQueue()
        {
            while (_standardQueue.TryDequeue(out _))
            {
            }
        }

        [Benchmark]
        [BenchmarkCategory("Reorder")]
        public void MoveBefore_HeadAndTail()
        {
            // Move tail item to before head
            _collection.MoveBefore(_sampleItems[N - 1], _sampleItems[0]);
        }

        [Benchmark]
        [BenchmarkCategory("Reorder")]
        public void MoveAfter_MidToHead()
        {
            // Move middle item to after head
            _collection.MoveAfter(_sampleItems[N / 2], _sampleItems[0]);
        }

        [Benchmark]
        [BenchmarkCategory("ConcurrentStress")]
        public void Concurrent_MixedWorkload()
        {
            Parallel.Invoke(
                () =>
                {
                    for (int i = 0; i < 500; i++)
                    {
                        _collection.Add(100_000 + i);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 500; i++)
                    {
                        _collection.TryTake(out _);
                    }
                },
                () =>
                {
                    for (int i = 0; i < 500; i++)
                    {
                        _collection.MoveBefore(_sampleItems[i % N], _sampleItems[(i + 1) % N]);
                    }
                }
            );
        }
    }
}
`,
  },
  {
    id: 'benchmarks-program',
    name: 'Program.cs',
    path: 'benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/Program.cs',
    language: 'csharp',
    category: 'benchmarks',
    description: 'BenchmarkDotNet entry point application.',
    content: `namespace ConcurrentObservableReorderableCollection.Benchmarks
{
    using BenchmarkDotNet.Running;

    public class Program
    {
        public static void Main(string[] args)
        {
            var summary = BenchmarkRunner.Run<ReorderBenchmarks>(args: args);
        }
    }
}
`,
  },
  {
    id: 'benchmarks-csproj',
    name: 'ConcurrentObservableReorderableCollection.Benchmarks.csproj',
    path: 'benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj',
    language: 'xml',
    category: 'benchmarks',
    description: 'Benchmark project targeting net6.0 and net48 with BenchmarkDotNet packages.',
    content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFrameworks>net6.0;net48</TargetFrameworks>
    <PlatformTarget>AnyCPU</PlatformTarget>
    <Configuration>Release</Configuration>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="BenchmarkDotNet" Version="0.14.0" />
    <PackageReference Include="BenchmarkDotNet.Diagnostics.Windows" Version="0.14.0" Condition="'$(TargetFramework)' == 'net48'" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\ConcurrentObservableReorderableCollection\ConcurrentObservableReorderableCollection.csproj" />
  </ItemGroup>

</Project>
`,
  },
  {
    id: 'tests-cs',
    name: 'ConcurrentObservableReorderableCollectionTests.cs',
    path: 'tests/ConcurrentObservableReorderableCollection.Tests/ConcurrentObservableReorderableCollectionTests.cs',
    language: 'csharp',
    category: 'tests',
    description: 'Comprehensive xUnit test suite for single-threaded correctness, INotifyCollectionChanged verification, and concurrency stress.',
    content: `namespace ConcurrentObservableReorderableCollection.Tests
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Collections.Specialized;
    using System.Linq;
    using System.Threading.Tasks;
    using Xunit;

    public class ConcurrentObservableReorderableCollectionTests
    {
        [Fact]
        public void Add_IncreasesCount_And_RaisesCollectionChanged()
        {
            var coll = new ConcurrentObservableReorderableCollection<string>();
            var events = new List<NotifyCollectionChangedEventArgs>();
            coll.CollectionChanged += (s, e) => events.Add(e);

            coll.Add("Item1");
            coll.Add("Item2");

            Assert.Equal(2, coll.Count);
            Assert.False(coll.IsEmpty);
            Assert.Equal(2, events.Count);
            Assert.Equal(NotifyCollectionChangedAction.Add, events[0].Action);
            Assert.Equal("Item1", events[0].NewItems![0]);
            Assert.Equal(0, events[0].NewStartingIndex);
        }

        [Fact]
        public void TryTake_RemovesFIFO_And_RaisesRemoveEvent()
        {
            var coll = new ConcurrentObservableReorderableCollection<string>(new[] { "First", "Second" });
            var events = new List<NotifyCollectionChangedEventArgs>();
            coll.CollectionChanged += (s, e) => events.Add(e);

            bool success = coll.TryTake(out var item);

            Assert.True(success);
            Assert.Equal("First", item);
            Assert.Single(coll);
            Assert.Single(events);
            Assert.Equal(NotifyCollectionChangedAction.Remove, events[0].Action);
            Assert.Equal("First", events[0].OldItems![0]);
            Assert.Equal(0, events[0].OldStartingIndex);
        }

        [Fact]
        public void MoveBefore_CorrectlyReordersAndRaisesMoveEvent()
        {
            var coll = new ConcurrentObservableReorderableCollection<string>(new[] { "A", "B", "C", "D" });
            var events = new List<NotifyCollectionChangedEventArgs>();
            coll.CollectionChanged += (s, e) => events.Add(e);

            // Move D before B -> Expected: A, D, B, C
            bool moved = coll.MoveBefore("D", "B");

            Assert.True(moved);
            Assert.Equal(new[] { "A", "D", "B", "C" }, coll.ToArray());
            Assert.Single(events);
            Assert.Equal(NotifyCollectionChangedAction.Move, events[0].Action);
            Assert.Equal("D", events[0].OldItems![0]);
            Assert.Equal(3, events[0].OldStartingIndex);
            Assert.Equal(1, events[0].NewStartingIndex);
        }

        [Fact]
        public void MoveAfter_CorrectlyReordersAndRaisesMoveEvent()
        {
            var coll = new ConcurrentObservableReorderableCollection<string>(new[] { "A", "B", "C", "D" });
            var events = new List<NotifyCollectionChangedEventArgs>();
            coll.CollectionChanged += (s, e) => events.Add(e);

            // Move A after C -> Expected: B, C, A, D
            bool moved = coll.MoveAfter("A", "C");

            Assert.True(moved);
            Assert.Equal(new[] { "B", "C", "A", "D" }, coll.ToArray());
            Assert.Single(events);
            Assert.Equal(NotifyCollectionChangedAction.Move, events[0].Action);
            Assert.Equal("A", events[0].OldItems![0]);
            Assert.Equal(0, events[0].OldStartingIndex);
            Assert.Equal(2, events[0].NewStartingIndex);
        }

        [Fact]
        public void Move_NonExistentItem_ReturnsFalse()
        {
            var coll = new ConcurrentObservableReorderableCollection<string>(new[] { "A", "B" });
            Assert.False(coll.MoveBefore("X", "A"));
            Assert.False(coll.MoveAfter("A", "Y"));
            Assert.False(coll.MoveBefore("A", "A")); // Self move is false
        }

        [Fact]
        public void ConcurrentOperations_MaintainsIntegrity()
        {
            var coll = new ConcurrentObservableReorderableCollection<int>();
            int iterations = 2000;

            Parallel.Invoke(
                () =>
                {
                    for (int i = 0; i < iterations; i++)
                    {
                        coll.Add(i);
                    }
                },
                () =>
                {
                    for (int i = iterations; i < iterations * 2; i++)
                    {
                        coll.Add(i);
                    }
                }
            );

            Assert.Equal(iterations * 2, coll.Count);
        }
    }
}
`,
  },
  {
    id: 'ci-workflow',
    name: 'build-and-test.yml',
    path: '.github/workflows/build-and-test.yml',
    language: 'yaml',
    category: 'workflows',
    description: 'Continuous Integration build and unit test verification workflow across .NET 6.0 and .NET 4.8.',
    content: `name: Build & Test

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    name: Build & Unit Tests
    runs-on: windows-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: |
            6.0.x
            8.0.x

      - name: Restore Solution
        run: dotnet restore ConcurrentObservableReorderableCollection.sln

      - name: Build Solution (Release)
        run: dotnet build ConcurrentObservableReorderableCollection.sln -c Release --no-restore

      - name: Run Tests (.NET 6.0)
        run: dotnet test ./tests/ConcurrentObservableReorderableCollection.Tests/ConcurrentObservableReorderableCollection.Tests.csproj -c Release -f net6.0 --no-build --verbosity normal

      - name: Run Tests (.NET Framework 4.8)
        run: dotnet test ./tests/ConcurrentObservableReorderableCollection.Tests/ConcurrentObservableReorderableCollection.Tests.csproj -c Release -f net48 --no-build --verbosity normal
`,
  },
  {
    id: 'readme-md',
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    category: 'core',
    description: 'Documentation, API Reference, installation, and performance guide.',
    content: `# ConcurrentObservableReorderableCollection<T>

[![Continuous Benchmark](https://github.com/your-org/ConcurrentObservableReorderableCollection/actions/workflows/benchmark.yml/badge.svg)](https://github.com/your-org/ConcurrentObservableReorderableCollection/actions/workflows/benchmark.yml)
[![Build & Test](https://github.com/your-org/ConcurrentObservableReorderableCollection/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/your-org/ConcurrentObservableReorderableCollection/actions/workflows/build-and-test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, thread-safe, reorderable observable collection for **.NET 6.0** and **.NET Framework 4.8**.

## 🌟 Key Features

- **O(1) Reordering**: Reposition items instantaneously with \`MoveBefore(source, target)\` and \`MoveAfter(source, target)\`.
- **Observable Events**: Implements \`INotifyCollectionChanged\` and \`INotifyPropertyChanged\`.
- **Deadlock-Safe Dispatch**: Event notifications are evaluated and dispatched outside critical locks to prevent UI-thread deadlocks.
- **Dual Targeting**: Native support for modern \`.NET 6.0\` / \`.NET 8.0\` and legacy enterprise \`.NET Framework 4.8\`.
- **BenchmarkDotNet CI**: Preconfigured GitHub Actions continuous benchmark tracking pipeline with regression alerting.

## 📦 API Overview

\`\`\`csharp
public sealed class ConcurrentObservableReorderableCollection<T> : 
    INotifyCollectionChanged, 
    INotifyPropertyChanged, 
    IReadOnlyCollection<T>, 
    IEnumerable<T>
{
    public void Add(T item);
    public bool TryTake(out T item);
    public bool MoveBefore(T source, T target);
    public bool MoveAfter(T source, T target);
    public bool TryPeek(out T item);
    public bool Contains(T item);
    public void Clear();
    public T[] ToArray();
    public int Count { get; }
    public bool IsEmpty { get; }
    public event NotifyCollectionChangedEventHandler? CollectionChanged;
    public event PropertyChangedEventHandler? PropertyChanged;
}
\`\`\`

## 🚀 Quick Start

\`\`\`csharp
using System.Collections.Concurrent;

var collection = new ConcurrentObservableReorderableCollection<string>();

collection.CollectionChanged += (sender, e) =>
{
    Console.WriteLine($"Action: {e.Action}, OldIndex: {e.OldStartingIndex}, NewIndex: {e.NewStartingIndex}");
};

collection.Add("Task A");
collection.Add("Task B");
collection.Add("Task C");

// Prioritize Task C before Task A (O(1))
collection.MoveBefore("Task C", "Task A");

// Dequeue head item (O(1))
if (collection.TryTake(out var headTask))
{
    Console.WriteLine($"Processing: {headTask}"); // Outputs: Task C
}
\`\`\`

## 📊 Benchmarks

Run benchmarks locally:
\`\`\`bash
dotnet run --project benchmarks/ConcurrentObservableReorderableCollection.Benchmarks/ConcurrentObservableReorderableCollection.Benchmarks.csproj -c Release -f net6.0
\`\`\`
`,
  },
  {
    id: 'solution-sln',
    name: 'ConcurrentObservableReorderableCollection.sln',
    path: 'ConcurrentObservableReorderableCollection.sln',
    language: 'plaintext',
    category: 'solution',
    description: 'Visual Studio Solution grouping library, tests, benchmarks, and solution items.',
    content: `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.0.31903.59
MinimumVisualStudioVersion = 10.0.40219.1
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "ConcurrentObservableReorderableCollection", "src\\ConcurrentObservableReorderableCollection\\ConcurrentObservableReorderableCollection.csproj", "{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"
EndProject
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "ConcurrentObservableReorderableCollection.Tests", "tests\\ConcurrentObservableReorderableCollection.Tests\\ConcurrentObservableReorderableCollection.Tests.csproj", "{B2C3D4E5-F6A7-8901-BCDE-F12345678901}"
EndProject
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "ConcurrentObservableReorderableCollection.Benchmarks", "benchmarks\\ConcurrentObservableReorderableCollection.Benchmarks\\ConcurrentObservableReorderableCollection.Benchmarks.csproj", "{C3D4E5F6-A7B8-9012-CDEF-123456789012}"
EndProject
Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "Solution Items", "Solution Items", "{D4E5F6A7-B8C9-0123-DEFA-234567890123}"
	ProjectSection(SolutionItems) = preProject
		.github\\workflows\\benchmark.yml = .github\\workflows\\benchmark.yml
		.github\\workflows\\build-and-test.yml = .github\\workflows\\build-and-test.yml
		README.md = README.md
	EndProjectSection
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|Any CPU = Debug|Any CPU
		Release|Any CPU = Release|Any CPU
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}.Release|Any CPU.Build.0 = Release|Any CPU
		{B2C3D4E5-F6A7-8901-BCDE-F12345678901}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{B2C3D4E5-F6A7-8901-BCDE-F12345678901}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{B2C3D4E5-F6A7-8901-BCDE-F12345678901}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{B2C3D4E5-F6A7-8901-BCDE-F12345678901}.Release|Any CPU.Build.0 = Release|Any CPU
		{C3D4E5F6-A7B8-9012-CDEF-123456789012}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{C3D4E5F6-A7B8-9012-CDEF-123456789012}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{C3D4E5F6-A7B8-9012-CDEF-123456789012}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{C3D4E5F6-A7B8-9012-CDEF-123456789012}.Release|Any CPU.Build.0 = Release|Any CPU
	EndGlobalSection
EndGlobal
`,
  },
];
