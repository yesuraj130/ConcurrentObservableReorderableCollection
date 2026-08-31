# ConcurrentObservableReorderableCollection<T> (.NET 6.0 & .NET Framework 4.8)

High-performance, thread-safe observable collection supporting:
- $O(1)$ constant time `MoveBefore` and `MoveAfter` relinking.
- Concurrent thread-safe `Add` and `TryTake` (FIFO queue semantics).
- Deadlock-safe `INotifyCollectionChanged` and `INotifyPropertyChanged` event dispatching.
- Multi-targeting `.NET 6.0` and `.NET Framework 4.8`.
- Complete BenchmarkDotNet benchmark suite and automated GitHub Actions CI.

## Solution Layout
```
├── .github/workflows/benchmark.yml
├── dotnet/
│   ├── ConcurrentObservableCollection.sln
│   ├── src/ConcurrentCollections/
│   │   ├── ConcurrentObservableReorderableCollection.cs
│   │   └── ConcurrentCollections.csproj
│   ├── benchmarks/ConcurrentCollections.Benchmarks/
│   │   ├── ReorderBenchmarks.cs
│   │   ├── Program.cs
│   │   └── ConcurrentCollections.Benchmarks.csproj
│   └── tests/ConcurrentCollections.Tests/
│       ├── ConcurrentObservableCollectionTests.cs
│       └── ConcurrentCollections.Tests.csproj
```

## Running Tests & Benchmarks

### 1. Build and Run Unit Tests
```bash
dotnet test dotnet/tests/ConcurrentCollections.Tests/ConcurrentCollections.Tests.csproj
```

### 2. Run BenchmarkDotNet Suite
```bash
dotnet run --project dotnet/benchmarks/ConcurrentCollections.Benchmarks/ConcurrentCollections.Benchmarks.csproj -c Release -f net6.0
```
