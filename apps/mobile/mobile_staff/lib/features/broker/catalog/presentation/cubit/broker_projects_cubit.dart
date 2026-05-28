import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_project.dart';
import '../../domain/usecases/broker_catalog_use_cases.dart';

typedef BrokerProjectsState = DataState<List<BrokerProject>>;

class BrokerProjectsCubit extends Cubit<BrokerProjectsState> {
  BrokerProjectsCubit(this._getProjects) : super(const BrokerProjectsState.initial());

  final GetBrokerProjects _getProjects;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getProjects(const NoParams());
    result.when(
      ok: (projects) => emit(
        projects.isEmpty ? const BrokerProjectsState.empty() : BrokerProjectsState.success(projects),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
