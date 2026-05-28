import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_project.dart';
import '../../domain/usecases/broker_catalog_use_cases.dart';

typedef BrokerUnitsState = DataState<List<BrokerUnit>>;

/// Loads the units for one project (broker scope).
class BrokerUnitsCubit extends Cubit<BrokerUnitsState> {
  BrokerUnitsCubit(this._getUnits, {required this.projectId})
      : super(const BrokerUnitsState.initial());

  final GetBrokerProjectUnits _getUnits;
  final String projectId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getUnits(projectId);
    result.when(
      ok: (units) => emit(units.isEmpty ? const BrokerUnitsState.empty() : BrokerUnitsState.success(units)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
