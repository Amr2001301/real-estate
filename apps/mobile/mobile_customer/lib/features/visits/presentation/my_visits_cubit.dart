import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/visit_request.dart';
import '../domain/usecases/get_my_visit_requests.dart';

typedef MyVisitsState = DataState<List<VisitRequest>>;

class MyVisitsCubit extends Cubit<MyVisitsState> {
  MyVisitsCubit(this._getMyVisits) : super(const MyVisitsState.initial());

  final GetMyVisitRequests _getMyVisits;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyVisits(1);
    result.when(
      ok: (page) => emit(
        page.data.isEmpty
            ? const MyVisitsState.empty()
            : MyVisitsState.success(page.data),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
