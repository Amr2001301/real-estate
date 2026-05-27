import 'package:equatable/equatable.dart';

import '../error/app_failure.dart';

/// Lifecycle of an async data load.
enum DataStatus { initial, loading, success, empty, failure }

/// A reusable Cubit/Bloc state for "load some data" screens (lists, details,
/// simple screen state). Pair it with the shared `StateView` widget to render
/// loading → success → empty → failure consistently.
///
/// For richer feature states, compose this or model a bespoke Equatable state.
class DataState<T> extends Equatable {
  const DataState._({
    required this.status,
    this.data,
    this.failure,
  });

  const DataState.initial() : this._(status: DataStatus.initial);
  const DataState.loading({T? previousData})
      : this._(status: DataStatus.loading, data: previousData);
  const DataState.success(T data)
      : this._(status: DataStatus.success, data: data);
  const DataState.empty() : this._(status: DataStatus.empty);
  const DataState.failure(AppFailure failure, {T? previousData})
      : this._(
          status: DataStatus.failure,
          data: previousData,
          failure: failure,
        );

  final DataStatus status;
  final T? data;
  final AppFailure? failure;

  bool get isLoading => status == DataStatus.loading;
  bool get isSuccess => status == DataStatus.success;
  bool get isFailure => status == DataStatus.failure;
  bool get isEmpty => status == DataStatus.empty;

  DataState<T> toLoading() => DataState<T>.loading(previousData: data);
  DataState<T> toSuccess(T value) => DataState<T>.success(value);
  DataState<T> toEmpty() => DataState<T>.empty();
  DataState<T> toFailure(AppFailure f) =>
      DataState<T>.failure(f, previousData: data);

  @override
  List<Object?> get props => [status, data, failure];
}
