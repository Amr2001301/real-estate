import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/home_summary.dart';
import '../domain/repositories/home_summary_repository.dart';

typedef HomeSummaryState = DataState<HomeSummary>;

class HomeSummaryCubit extends Cubit<HomeSummaryState> {
  HomeSummaryCubit(this._repo) : super(const HomeSummaryState.initial());

  final HomeSummaryRepository _repo;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _repo.getHomeSummary();
    result.when(
      ok: (summary) => emit(HomeSummaryState.success(summary)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
