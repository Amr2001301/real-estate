import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Opens a detail screen from an id alone — a notification, a push or a link
/// — by finding the item in the customer's own list. Screens opened from
/// their list still pass the loaded object and never get here.
class LoadById<T> extends StatefulWidget {
  const LoadById({
    super.key,
    required this.load,
    required this.matches,
    required this.builder,
  });

  final Future<Result<List<T>>> Function() load;
  final bool Function(T item) matches;
  final Widget Function(T item) builder;

  @override
  State<LoadById<T>> createState() => _LoadByIdState<T>();
}

class _LoadByIdState<T> extends State<LoadById<T>> {
  late Future<Result<List<T>>> _future = widget.load();

  void _retry() => setState(() => _future = widget.load());

  Widget _page(Widget body) => Scaffold(appBar: AppBar(), body: body);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Result<List<T>>>(
      future: _future,
      builder: (context, snap) {
        if (snap.hasError) return _page(ErrorState(onRetry: _retry));
        final result = snap.data;
        if (result == null) {
          return _page(const Center(child: CircularProgressIndicator()));
        }
        return result.when(
          ok: (items) {
            for (final item in items) {
              if (widget.matches(item)) return widget.builder(item);
            }
            // Not (or no longer) the customer's: say so, never guess.
            return _page(ErrorState(failure: AppFailure(type: FailureType.notFound)));
          },
          err: (failure) => _page(ErrorState(failure: failure, onRetry: _retry)),
        );
      },
    );
  }
}
