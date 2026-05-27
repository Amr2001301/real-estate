import 'package:flutter/material.dart';

import '../state/data_state.dart';
import 'empty_state.dart';
import 'error_state.dart';

/// Renders a [DataState] consistently: loading → success → empty → failure.
/// Drop this into a `BlocBuilder` to standardize screen-level async UI.
///
/// - [loading]: pass a Skeletonizer-wrapped placeholder (preferred over a
///   spinner). A spinner is only the last-resort fallback.
/// - [empty]: shown for [DataStatus.empty] — semantically different from a
///   failure.
/// - failures render a full-screen [ErrorState] with retry (when retryable).
class StateView<T> extends StatelessWidget {
  const StateView({
    super.key,
    required this.state,
    required this.onData,
    this.loading,
    this.empty,
    this.onRetry,
  });

  final DataState<T> state;
  final Widget Function(T data) onData;
  final Widget? loading;
  final Widget? empty;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return loading ?? const Center(child: CircularProgressIndicator());
      case DataStatus.empty:
        return empty ?? const EmptyState();
      case DataStatus.failure:
        return ErrorState(failure: state.failure, onRetry: onRetry);
      case DataStatus.success:
        final data = state.data;
        if (data == null) return empty ?? const EmptyState();
        return onData(data);
    }
  }
}
