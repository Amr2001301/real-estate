import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class LoadState<T> extends Equatable {
  const LoadState({this.status = DataStatus.initial, this.data, this.failure});
  final DataStatus status;
  final T? data;
  final AppFailure? failure;

  @override
  List<Object?> get props => [status, data, failure];
}

/// Reads one thing (a list or an item) and keeps it.
class LoadCubit<T> extends Cubit<LoadState<T>> {
  LoadCubit(this._read, {this.isEmpty}) : super(LoadState<T>());
  final Future<Result<T>> Function() _read;
  final bool Function(T)? isEmpty;

  Future<void> load() async {
    if (state.data == null) emit(LoadState<T>(status: DataStatus.loading));
    final result = await _read();
    if (isClosed) return;
    result.when(
      ok: (data) => emit(LoadState<T>(
        status: (isEmpty?.call(data) ?? false) ? DataStatus.empty : DataStatus.success,
        data: data,
      )),
      err: (f) => emit(LoadState<T>(status: DataStatus.failure, failure: f, data: state.data)),
    );
  }
}
