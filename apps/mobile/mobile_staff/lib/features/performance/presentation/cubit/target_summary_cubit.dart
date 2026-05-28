import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/sales_performance.dart';
import '../../domain/usecases/performance_use_cases.dart';

enum TargetSummaryStatus { loading, ready, unavailable }

/// Dashboard target card state. Permission-aware: any failure (incl. 403)
/// collapses to [TargetSummaryStatus.unavailable] so the dashboard never breaks.
class TargetSummaryState extends Equatable {
  const TargetSummaryState({this.status = TargetSummaryStatus.loading, this.performance});
  final TargetSummaryStatus status;
  final SalesPerformance? performance;

  @override
  List<Object?> get props => [status, performance];
}

class TargetSummaryCubit extends Cubit<TargetSummaryState> {
  TargetSummaryCubit(this._getPerformance) : super(const TargetSummaryState());

  final GetSalesPerformance _getPerformance;

  Future<void> load() async {
    emit(const TargetSummaryState(status: TargetSummaryStatus.loading));
    final result = await _getPerformance(null);
    result.when(
      ok: (p) => emit(TargetSummaryState(status: TargetSummaryStatus.ready, performance: p)),
      err: (_) => emit(const TargetSummaryState(status: TargetSummaryStatus.unavailable)),
    );
  }
}
