import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_project.dart';
import '../../domain/repositories/staff_catalog_repository.dart';
import '../../domain/usecases/staff_catalog_use_cases.dart';

typedef StaffProjectDetailState = DataState<StaffProjectDetail>;

class StaffProjectDetailCubit extends Cubit<StaffProjectDetailState> {
  StaffProjectDetailCubit(
    this._getDetail,
    this._repo, {
    required this.projectId,
  }) : super(const StaffProjectDetailState.initial());

  final GetStaffProjectDetail _getDetail;
  final StaffCatalogRepository _repo;
  final String projectId;

  // Preserved across status filter calls so stat tiles always show full counts.
  List<StaffUnit>? _baseUnits;

  List<StaffUnit> get baseUnits => _baseUnits ?? state.data?.units ?? [];

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDetail(projectId);
    result.when(
      ok: (detail) {
        _baseUnits = detail.units;
        emit(StaffProjectDetailState.success(detail));
      },
      err: (failure) => emit(state.toFailure(failure)),
    );
  }

  Future<void> filterByStatus(String? status) async {
    final current = state.data;
    if (current == null) return;
    emit(state.toLoading());
    final result = await _repo.getProjectUnits(projectId, status: status);
    result.when(
      ok: (units) => emit(StaffProjectDetailState.success(
        StaffProjectDetail(
          project: current.project,
          description: current.description,
          units: units,
        ),
      )),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
