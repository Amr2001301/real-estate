import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_project.dart';
import '../../domain/usecases/staff_catalog_use_cases.dart';

typedef StaffUnitDetailState = DataState<StaffUnit>;

class StaffUnitDetailCubit extends Cubit<StaffUnitDetailState> {
  StaffUnitDetailCubit(this._getUnit, {required this.unitId})
      : super(const StaffUnitDetailState.initial());

  final GetStaffUnitDetail _getUnit;
  final String unitId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getUnit(unitId);
    result.when(
      ok: (unit) => emit(StaffUnitDetailState.success(unit)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
