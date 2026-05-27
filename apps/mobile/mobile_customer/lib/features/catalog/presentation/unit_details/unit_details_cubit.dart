import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/unit.dart';
import '../../domain/usecases/get_unit.dart';

typedef UnitDetailsState = DataState<Unit>;

/// Loads a single unit. Depends on the [GetUnit] use case only.
class UnitDetailsCubit extends Cubit<UnitDetailsState> {
  UnitDetailsCubit(this._getUnit, this.unitId)
      : super(const UnitDetailsState.initial()) {
    load();
  }

  final GetUnit _getUnit;
  final String unitId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getUnit(unitId);
    result.when(
      ok: (unit) => emit(UnitDetailsState.success(unit)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
