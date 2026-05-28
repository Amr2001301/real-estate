import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/bonus_entry.dart';
import '../../domain/repositories/bonus_repository.dart';
import '../../domain/usecases/get_bonus_entries.dart';

enum SummaryStatus { loading, ready, unavailable }

/// Dashboard bonus card state. Permission-aware: any failure (incl. 403)
/// collapses to [SummaryStatus.unavailable] so the dashboard never breaks.
class BonusSummaryState extends Equatable {
  const BonusSummaryState({this.status = SummaryStatus.loading, this.overview});
  final SummaryStatus status;
  final BonusOverview? overview;

  @override
  List<Object?> get props => [status, overview];
}

class BonusSummaryCubit extends Cubit<BonusSummaryState> {
  BonusSummaryCubit(this._getEntries) : super(const BonusSummaryState());

  final GetBonusEntries _getEntries;

  Future<void> load() async {
    emit(const BonusSummaryState(status: SummaryStatus.loading));
    final result = await _getEntries(const BonusQuery());
    result.when(
      ok: (entries) => emit(BonusSummaryState(
        status: SummaryStatus.ready,
        overview: bonusOverviewOf(entries),
      )),
      err: (_) => emit(const BonusSummaryState(status: SummaryStatus.unavailable)),
    );
  }
}
