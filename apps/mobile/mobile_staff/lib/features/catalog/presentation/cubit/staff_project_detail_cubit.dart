import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_project.dart';
import '../../domain/usecases/staff_catalog_use_cases.dart';

typedef StaffProjectDetailState = DataState<StaffProjectDetail>;

class StaffProjectDetailCubit extends Cubit<StaffProjectDetailState> {
  StaffProjectDetailCubit(this._getDetail, {required this.projectId})
      : super(const StaffProjectDetailState.initial());

  final GetStaffProjectDetail _getDetail;
  final String projectId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDetail(projectId);
    result.when(
      ok: (detail) => emit(StaffProjectDetailState.success(detail)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
